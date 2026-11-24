/**
 * Маркер угла активного диапазона выделения (ADR 0198): у мыши — квадрат в правом нижнем
 * углу, у пальца — круги в левом верхнем и правом нижнем; протяжка маркера двигает его угол,
 * противоположный стоит на месте.
 *
 * Строки и тело обрезают своё содержимое, поэтому маркер — слой корня грида поверх
 * области прокрутки: место он читает у угловой ячейки при смене выделения, прокрутке и
 * смене размеров и прячется, когда угол не виден — вне окна виртуализации, под шапкой,
 * закреплённым футером или закреплёнными колонками, в ячейке с правкой.
 *
 * Жест отделён от того, что он делает с выделением (§8): жест даёт ячейку под указателем,
 * автопрокрутку у края, конец и отмену. Режим диапазона двигает угол; режим протяжки значения
 * (ADR 0219, §4) показывает рамку цели и пишет значения после отпускания.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import type { RootHookProps } from '../../core/bodyContributions'
import { serviceColumnOf } from '../../core/createColumns'
import { reportAction } from '../../core/debugActions'
import { useTableState } from '../../core/reactivity'
import { scrollLayer } from '../../core/scrollStretch'
import { EDGE_ZONE, edgeSpeed } from '../../shared/edgeScroll'
import { FillFrame } from '../../ui/FillFrame'
import { SelectionHandle } from '../../ui/SelectionHandle'
import { isInteractive } from './copyEvent'
import { type Bounds, fillAndWrite, selectBounds } from './fill'
import { canPaste, columnOrderOf } from './paste'
import type { CellSelectionHandle } from './registry'

const ROW = '.data-grid__body-row[data-index]'
/** Строка под указателем, в том числе незагруженная строка серверной модели (ADR 0146). */
const ANY_ROW = `${ROW}, [data-pending-row]`
const CELL = '.data-grid__body-cell[data-column-id]'

interface Range {
  anchorRowIndex?: number
  focusRowIndex?: number
  anchorRowId?: string
  focusRowId?: string
  anchorColumnId: string
  focusColumnId: string
  operation?: 'include' | 'exclude'
}

interface RangeView {
  minRowIndex: number
  maxRowIndex: number
  columnIds: string[]
  operation: 'include' | 'exclude'
}

interface HandleTable {
  options: {
    cellSelectionInteraction?: boolean
    cellSelectionHandle?: CellSelectionHandle
  }
  getCellSelectionBounds?: () => Bounds[]
  atoms: { cellSelection?: { get: () => Range[] | undefined } }
  setCellSelection?: (updater: (old: Range[]) => Range[]) => void
  getCellSelectionRanges?: () => RangeView[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
  getColumn: (id: string) => { columnDef: object } | undefined
}

/** Ячейка диапазона: место строки в списке и колонка. */
export interface HandleCell {
  row: number
  column: string
}

/**
 * Режим маркера (§8): что делает жест с выделением. Жест зовёт `move` с ячейкой под
 * указателем, `end` на отпускание и `cancel` на Escape.
 */
export interface HandleMode {
  move: (cell: HandleCell) => void
  end: () => void
  cancel: () => void
  /** Прокрутка под неподвижным указателем: перерисовать своё по новому месту ячеек. */
  refresh?: () => void
}

/** Режим диапазона: неподвижный угол — опорный, второй следует за указателем. */
export const rangeMode = (table: unknown, fixed: HandleCell): HandleMode => {
  const t = table as HandleTable
  const before = t.atoms.cellSelection?.get() ?? []
  const last = before.at(-1)
  const set = (focus: HandleCell) =>
    t.setCellSelection?.(old => [
      ...old.slice(0, -1),
      {
        anchorRowIndex: fixed.row,
        anchorColumnId: fixed.column,
        focusRowIndex: focus.row,
        focusColumnId: focus.column,
        ...(last?.operation && { operation: last.operation }),
      },
    ])
  return {
    move: set,
    end: () => {},
    cancel: () => t.setCellSelection?.(() => before),
  }
}

/** Цель протяжки: прямоугольник рамки, план записи или сужение выделения. */
interface FillTarget {
  frame: Bounds
  plan?: { axis: 'x' | 'y'; to: number }
}

/**
 * Режим протяжки значения (ADR 0219, §4, WR22–WR23): ось — по большему смещению от диапазона,
 * `direction` её ограничивает; рамка показывает цель, значения считаются после отпускания.
 * Протяжка внутрь сужает выделение без записи.
 */
export const fillMode = (
  table: unknown,
  bound: Bounds,
  options: Pick<CellSelectionHandle, 'direction' | 'getFillValue'>,
  show: (frame: Bounds | undefined) => void,
  alt: () => boolean,
): HandleMode => {
  const t = table as HandleTable
  const indexes = t.getCellSelectionColumnIndexes?.() ?? {}
  let target: FillTarget | undefined
  const offset = (value: number, min: number, max: number) =>
    value > max ? value - max : value < min ? value - min : 0
  return {
    move: cell => {
      const column = indexes[cell.column]
      if (column === undefined) return
      const dy = offset(cell.row, bound.minRowIndex, bound.maxRowIndex)
      const dx = offset(column, bound.minColumnIndex, bound.maxColumnIndex)
      const axis =
        options.direction === 'y'
          ? 'y'
          : options.direction === 'x'
            ? 'x'
            : Math.abs(dy) >= Math.abs(dx)
              ? 'y'
              : 'x'
      const along = axis === 'y' ? dy : dx
      if (along === 0) {
        // Внутри диапазона: сужение от левого верхнего угла до ячейки под указателем.
        target = {
          frame: {
            minRowIndex: bound.minRowIndex,
            maxRowIndex: Math.min(
              Math.max(cell.row, bound.minRowIndex),
              bound.maxRowIndex,
            ),
            minColumnIndex: bound.minColumnIndex,
            maxColumnIndex: Math.min(
              Math.max(column, bound.minColumnIndex),
              bound.maxColumnIndex,
            ),
          },
        }
      } else {
        const to = axis === 'y' ? cell.row : column
        target = {
          frame:
            axis === 'y'
              ? {
                  ...bound,
                  minRowIndex: Math.min(bound.minRowIndex, to),
                  maxRowIndex: Math.max(bound.maxRowIndex, to),
                }
              : {
                  ...bound,
                  minColumnIndex: Math.min(bound.minColumnIndex, to),
                  maxColumnIndex: Math.max(bound.maxColumnIndex, to),
                },
          plan: { axis, to },
        }
      }
      show(target.frame)
    },
    refresh: () => show(target?.frame),
    end: () => {
      show(undefined)
      if (!target) return
      if (!target.plan) {
        selectBounds(table, target.frame)
        return
      }
      const frame = target.frame
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'fill',
        detail: { toggle: alt() },
        source: 'pointer',
      })
      // Выделение — после записи: смена выделения отменила бы догрузку строк цели (WR28).
      void fillAndWrite(
        table,
        { bound, ...target.plan },
        'fill',
        { toggle: alt(), getFillValue: options.getFillValue },
        () => selectBounds(table, frame),
      )
    },
    cancel: () => show(undefined),
  }
}

/** Активный диапазон: последний, если он включает ячейки. */
const activeRange = (table: HandleTable): RangeView | undefined => {
  const view = table.getCellSelectionRanges?.().at(-1)
  return view && view.operation !== 'exclude' && view.columnIds.length
    ? view
    : undefined
}

const cellOf = (scroller: HTMLElement, cell: HandleCell) =>
  scroller.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${cell.row}"] .data-grid__body-cell[data-column-id="${CSS.escape(cell.column)}"]`,
  )

const isPinned = (cell: Element) => {
  const side = cell.getAttribute('data-cell-pinned')
  return side === 'left' || side === 'right'
}

/**
 * Видимая часть тела для точки ячейки: область прокрутки без шапки, закреплённого футера
 * и — для незакреплённой ячейки — закреплённых колонок её строки.
 */
const bodyBounds = (scroller: HTMLElement, cell?: Element) => {
  const area = scroller.getBoundingClientRect()
  let left = area.left + scroller.clientLeft
  let right = left + scroller.clientWidth
  let top = area.top + scroller.clientTop
  let bottom = top + scroller.clientHeight
  const head = scroller.querySelector('.data-grid__head')
  if (head) top = Math.max(top, head.getBoundingClientRect().bottom)
  const footer = scroller.querySelector(
    '.data-grid__footer:not([data-position="inline"])',
  )
  if (footer) bottom = Math.min(bottom, footer.getBoundingClientRect().top)
  const row = cell?.closest(ROW)
  if (cell && row && !isPinned(cell)) {
    for (const pinned of row.querySelectorAll('[data-cell-pinned="left"]')) {
      left = Math.max(left, pinned.getBoundingClientRect().right)
    }
    for (const pinned of row.querySelectorAll('[data-cell-pinned="right"]')) {
      right = Math.min(right, pinned.getBoundingClientRect().left)
    }
  }
  return { left, right, top, bottom }
}

/** Сдвиг указателя, после которого нажатие на маркер — протяжка (px). */
const DRAG_TOLERANCE = 3

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/**
 * Ячейка под точкой, прижатой к видимой части тела. Над незагруженной строкой — её место
 * и прежняя колонка; служебные колонки не берутся — колонка остаётся прежней.
 */
const cellAt = (
  table: HandleTable,
  scroller: HTMLElement,
  x: number,
  y: number,
  previous: HandleCell,
): HandleCell | undefined => {
  const bounds = bodyBounds(scroller)
  const hit = document.elementFromPoint(
    clamp(x, bounds.left + 1, bounds.right - 1),
    clamp(y, bounds.top + 1, bounds.bottom - 1),
  )
  const row = hit?.closest<HTMLElement>(ANY_ROW)
  const index = Number(row?.getAttribute('data-index'))
  if (!Number.isInteger(index)) return undefined
  const column = hit?.closest<HTMLElement>(CELL)?.dataset.columnId
  const known = table.getCellSelectionColumnIndexes?.()
  const selectable =
    !!column &&
    !serviceColumnOf(table.getColumn(column)?.columnDef) &&
    (!known || column in known)
  return { row: index, column: selectable ? column : previous.column }
}

/**
 * Поставить рамку цели протяжки на прямоугольник. Край строки или колонки вне окна
 * виртуализации — у края видимой части тела с его стороны.
 */
const placeFrame = (
  table: HandleTable,
  scroller: HTMLElement,
  frame: HTMLElement,
  rect: Bounds | undefined,
) => {
  const host = frame.parentElement
  if (!rect || !host) {
    frame.hidden = true
    return
  }
  const bounds = bodyBounds(scroller)
  const rows = [...scroller.querySelectorAll<HTMLElement>(ANY_ROW)].map(
    row => ({ row, index: Number(row.getAttribute('data-index')) }),
  )
  const rowEdge = (index: number, side: 'top' | 'bottom') => {
    const found = rows.find(item => item.index === index)
    if (found) return found.row.getBoundingClientRect()[side]
    const before = rows.every(item => index < item.index)
    return before ? bounds.top : bounds.bottom
  }
  const order = columnOrderOf(table as never)
  const columnEdge = (index: number, side: 'left' | 'right') => {
    const id = order[index]
    const cell =
      id === undefined
        ? null
        : scroller.querySelector<HTMLElement>(
            `.data-grid__body-cell[data-column-id="${CSS.escape(id)}"]`,
          )
    if (cell) return cell.getBoundingClientRect()[side]
    return side === 'left' ? bounds.left : bounds.right
  }
  const top = Math.max(bounds.top, rowEdge(rect.minRowIndex, 'top'))
  const bottom = Math.min(bounds.bottom, rowEdge(rect.maxRowIndex, 'bottom'))
  const left = Math.max(bounds.left, columnEdge(rect.minColumnIndex, 'left'))
  const right = Math.min(bounds.right, columnEdge(rect.maxColumnIndex, 'right'))
  if (bottom <= top || right <= left) {
    frame.hidden = true
    return
  }
  const origin = host.getBoundingClientRect()
  frame.hidden = false
  frame.style.left = `${left - origin.left - host.clientLeft}px`
  frame.style.top = `${top - origin.top - host.clientTop}px`
  frame.style.width = `${right - left}px`
  frame.style.height = `${bottom - top}px`
}

/** Ячейка в правке: в ней поле ввода. */
const isEditing = (cell: Element) =>
  !!cell.querySelector('input, textarea, [contenteditable="true"]')

/** Угол диапазона, у которого стоит маркер: левый верхний — только у пальца (§2). */
type Corner = 'start' | 'end'

/** Ячейка угла и точка угла на ней. */
const cornerOf = (view: RangeView, corner: Corner): HandleCell =>
  corner === 'end'
    ? { row: view.maxRowIndex, column: view.columnIds.at(-1)! }
    : { row: view.minRowIndex, column: view.columnIds[0]! }

/** Сдвиг указателя пальца, после которого нажатие на круг — протяжка (px). */
const TOUCH_TOLERANCE = 6

export const useRangeHandle = ({ table, getScrollElement }: RootHookProps) => {
  const t = table as unknown as HandleTable
  const startRef = useRef<HTMLSpanElement>(null)
  const endRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<HTMLSpanElement>(null)
  // Перерисовка по выделению и по опции маркера; место читается после раскладки.
  const ranges = useTableState(
    table,
    state => (state as { cellSelection?: unknown }).cellSelection,
  )
  /** Каким вводом сделано выделение: вид маркера — по нему, а не по `pointer: coarse` (§3). */
  const [input, setInput] = useState<'mouse' | 'touch'>('mouse')
  const allowed = t.options.cellSelectionHandle
  const enabled = isInteractive(table) && allowed?.[input] === true
  const touch = input === 'touch'
  const dragging = useRef(false)
  /** Прервать идущую протяжку: грид уходит со страницы посреди жеста. */
  const abort = useRef<(() => void) | null>(null)
  const view = enabled ? activeRange(t) : undefined
  const end = view && cornerOf(view, 'end')
  const start = view && touch ? cornerOf(view, 'start') : undefined
  const cornersKey = [end, start]
    .map(cell => (cell ? `${cell.row}:${cell.column}` : ''))
    .join('|')

  useEffect(() => {
    const scroller = getScrollElement()
    if (!scroller) return
    const onPress = (event: PointerEvent) => {
      if (dragging.current) return
      setInput(event.pointerType === 'touch' ? 'touch' : 'mouse')
    }
    scroller.addEventListener('pointerdown', onPress, true)
    return () => scroller.removeEventListener('pointerdown', onPress, true)
  }, [getScrollElement])

  useEffect(() => () => abort.current?.(), [])

  useLayoutEffect(() => {
    const scroller = getScrollElement()
    if (!scroller || !end) return
    const placed: [HTMLSpanElement | null, HandleCell | undefined, Corner][] = [
      [endRef.current, end, 'end'],
      [startRef.current, start, 'start'],
    ]
    const placeOne = (
      handle: HTMLSpanElement | null,
      cell: HandleCell | undefined,
      corner: Corner,
    ) => {
      const host = handle?.parentElement
      if (!handle || !cell || !host) return
      const element = cellOf(scroller, cell)
      if (!element || isEditing(element)) {
        if (!handle.hidden) handle.hidden = true
        return
      }
      const rect = element.getBoundingClientRect()
      const bounds = bodyBounds(scroller, element)
      const x = corner === 'end' ? rect.right : rect.left
      const y = corner === 'end' ? rect.bottom : rect.top
      const hidden =
        x < bounds.left - 0.5 ||
        x > bounds.right + 0.5 ||
        y < bounds.top - 0.5 ||
        y > bounds.bottom + 0.5
      if (handle.hidden !== hidden) handle.hidden = hidden
      if (hidden) return
      const origin = host.getBoundingClientRect()
      handle.style.left = `${x - origin.left - host.clientLeft}px`
      handle.style.top = `${y - origin.top - host.clientTop}px`
    }
    const place = () => {
      for (const [handle, cell, corner] of placed)
        placeOne(handle, cell, corner)
    }
    place()
    let frame = 0
    // Прокрутка и монтаж окна могут сработать вместе. Читаем их геометрию перед кадром.
    const later = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        place()
      })
    }
    const observer = new ResizeObserver(place)
    observer.observe(scroller)
    const tableElement = scroller.querySelector('.data-grid__table')
    if (tableElement) observer.observe(tableElement)
    const mutations = new MutationObserver(later)
    mutations.observe(scroller, { childList: true, subtree: true })
    scroller.addEventListener('scroll', later, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      scroller.removeEventListener('scroll', later)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- место по углам, а не по объектам
  }, [cornersKey, ranges, getScrollElement])

  const onPress = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const scroller = getScrollElement()
    if (event.button !== 0 || !view || !scroller) return
    const corner: Corner =
      event.currentTarget.dataset.rangeHandle === 'start' ? 'start' : 'end'
    // Нажатие на маркер — не начало нового выделения, не нажатие кнопок ячейки (HN8) и,
    // у пальца, не мышиные события совместимости после касания.
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    // Квадрат мыши в режиме `'fill'` тянет значения; круги пальца всегда меняют диапазон.
    const bound = t.getCellSelectionBounds?.().at(-1)
    const filling =
      allowed?.mode === 'fill' &&
      event.pointerType !== 'touch' &&
      !!bound &&
      canPaste(table)
    let alt = event.altKey
    const frame = frameRef.current
    const mode =
      filling && bound
        ? fillMode(
            table,
            bound,
            allowed,
            rect => frame && placeFrame(t, scroller, frame, rect),
            () => alt,
          )
        : // Неподвижен противоположный угол — он и становится опорной ячейкой.
          rangeMode(table, cornerOf(view, corner === 'end' ? 'start' : 'end'))
    const pressed = { x: event.clientX, y: event.clientY }
    const tolerance =
      event.pointerType === 'touch' ? TOUCH_TOLERANCE : DRAG_TOLERANCE
    let pointer = pressed
    let moved = false
    let focus: HandleCell = cornerOf(view, corner)
    let raf = 0
    dragging.current = true
    handle.dataset.dragging = ''
    reportAction(table, {
      plugin: 'cellSelection',
      action: filling ? 'fill' : 'resizeRange',
      source: 'pointer',
      phase: 'start',
    })
    const follow = () => {
      if (!moved) return
      const cell = cellAt(t, scroller, pointer.x, pointer.y, focus)
      if (!cell || (cell.row === focus.row && cell.column === focus.column)) {
        return
      }
      focus = cell
      mode.move(cell)
    }
    // Автопрокрутка у края — те же зона и скорость, что у протяжки выделения (ADR 0029).
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const area = scroller.getBoundingClientRect()
      const bounds = bodyBounds(scroller)
      let dx = 0
      let dy = 0
      if (pointer.x > bounds.right - EDGE_ZONE) {
        dx = edgeSpeed(pointer.x - (bounds.right - EDGE_ZONE))
      } else if (pointer.x < bounds.left + EDGE_ZONE) {
        dx = -edgeSpeed(bounds.left + EDGE_ZONE - pointer.x)
      }
      if (pointer.y > bounds.bottom - EDGE_ZONE) {
        dy = edgeSpeed(pointer.y - (bounds.bottom - EDGE_ZONE))
      } else if (pointer.y < Math.max(bounds.top, area.top) + EDGE_ZONE) {
        dy = -edgeSpeed(Math.max(bounds.top, area.top) + EDGE_ZONE - pointer.y)
      }
      if (!moved || (dx === 0 && dy === 0)) return
      scrollLayer(scroller).scrollBy(dy, dx)
      follow()
      mode.refresh?.()
    }
    const onMove = (move: PointerEvent) => {
      pointer = { x: move.clientX, y: move.clientY }
      alt = move.altKey
      moved ||=
        Math.hypot(pointer.x - pressed.x, pointer.y - pressed.y) >= tolerance
      follow()
    }
    const finish = (cancelled: boolean) => {
      abort.current = null
      cancelAnimationFrame(raf)
      dragging.current = false
      delete handle.dataset.dragging
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
      if (cancelled) mode.cancel()
      else mode.end()
      reportAction(table, {
        plugin: 'cellSelection',
        action: filling ? 'fill' : 'resizeRange',
        source: 'pointer',
        phase: 'end',
        ...(cancelled && { detail: { reason: 'cancel' } }),
      })
    }
    const onUp = () => finish(false)
    const onCancel = () => finish(true)
    // Alt/Option переключает копию и ряд (WR25); меню окна на Alt не открывается.
    const onKeyUp = (key: KeyboardEvent) => {
      if (key.key !== 'Alt') return
      key.preventDefault()
      alt = false
    }
    const onKey = (key: KeyboardEvent) => {
      if (key.key === 'Alt') {
        key.preventDefault()
        alt = true
        return
      }
      if (key.key !== 'Escape') return
      key.preventDefault()
      key.stopPropagation()
      finish(true)
    }
    abort.current = () => finish(true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    raf = requestAnimationFrame(tick)
  }

  // Долгое нажатие пальцем на круг — не контекстное меню (§2).
  const noMenu = (event: { preventDefault: () => void }) =>
    event.preventDefault()

  if (!end) return null
  const shape = touch ? 'circle' : 'square'
  return (
    <>
      {allowed?.mode === 'fill' && <FillFrame ref={frameRef} hidden />}
      <SelectionHandle
        ref={endRef}
        hidden
        shape={shape}
        data-range-handle="end"
        onPointerDown={onPress}
        onContextMenu={noMenu}
      />
      {start && (
        <SelectionHandle
          ref={startRef}
          hidden
          shape={shape}
          data-range-handle="start"
          onPointerDown={onPress}
          onContextMenu={noMenu}
        />
      )}
    </>
  )
}
