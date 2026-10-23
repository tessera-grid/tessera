import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { ENGLISH_LABELS } from '../../../core/localization'
import { firePointer, nextFrame } from '../../rowDragging.dnd'
import { Stories, renderGrid, settleRowMotion } from '../helpers'
import { waitForGrid } from './core-helpers'
import { ColumnResizingGrid, ColumnDraggingGrid } from './columns-fixtures'

// WCAG 2.2 AA (ADR 0034): альтернатива перетаскиванию одним указателем (2.5.7,
// `DA<n>`) и размер целей (2.5.8, `TS<n>`). Каждое требование — свой тест.

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
const HANDLE = '.drag__handler--column'
const RESIZE_GRIP = '.resize__handler--column'

const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const menuItem = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    item => item.textContent?.trim() === label,
  )!
const menuLabels = () =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map(item =>
    item.textContent?.trim(),
  )
const isDisabled = (item: HTMLElement) =>
  item.getAttribute('aria-disabled') === 'true' ||
  item.hasAttribute('data-disabled')
const active = () => document.activeElement as HTMLElement

/** Заголовки с ручкой перетаскивания — слева направо. */
const movableHeads = () =>
  Array.from(document.querySelectorAll<HTMLElement>(HEAD_CELL))
    .filter(cell => cell.querySelector(HANDLE))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

const headById = (id: string) =>
  document.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

const rowById = (id: string) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id='${id}']`)

const rowAt = (index: number) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-index='${index}']`)

/** Клик по ручке (или грипу) реальным указателем: наведение открывает скрытую иконку. */
const openHandleMenu = async (cell: HTMLElement, handle: HTMLElement) => {
  await userEvent.hover(cell)
  await userEvent.click(handle)
  await expect.poll(menu).toBeTruthy()
}

const fireMouse = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  target: Element | Document,
  x: number,
  y: number,
) =>
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  )

describe('WCAG 2.5.7 — альтернатива перетаскиванию (DA)', () => {
  test('DA1: ручка колонки — именованная кнопка меню, клик без сдвига открывает «Move left / right», Escape возвращает фокус', async () => {
    await render(<ColumnDraggingGrid />)
    await expect.poll(() => movableHeads().length).toBeGreaterThan(1)
    const cell = movableHeads()[1]
    const handle = cell.querySelector<HTMLElement>(HANDLE)!

    expect(handle.getAttribute('role')).toBe('button')
    expect(handle.getAttribute('aria-label')).toBe(ENGLISH_LABELS.moveColumn)
    expect(handle.getAttribute('aria-haspopup')).toBe('menu')
    expect(handle.hasAttribute('aria-describedby')).toBe(false)
    expect(handle.hasAttribute('aria-roledescription')).toBe(false)

    await openHandleMenu(cell, handle)
    expect(menu()!.getAttribute('aria-label')).toBe(ENGLISH_LABELS.moveColumn)
    expect(menuLabels()).toEqual([
      ENGLISH_LABELS.moveLeft,
      ENGLISH_LABELS.moveRight,
    ])
    expect(handle.getAttribute('aria-expanded')).toBe('true')

    await userEvent.keyboard('{Escape}')
    await expect.poll(menu).toBeNull()
    await expect.poll(active).toBe(handle)
    expect(handle.getAttribute('aria-expanded')).toBe('false')
  })

  test('DA2: сдвиг колонки из меню — setColumnOrder и onColumnDragEnd; за край пункт недоступен', async () => {
    const onColumnDragEnd = vi.fn()
    await render(<ColumnDraggingGrid onColumnDragEnd={onColumnDragEnd} />)
    await expect.poll(() => movableHeads().length).toBeGreaterThan(1)
    const [first, second] = movableHeads().map(cell =>
      cell.getAttribute('data-column-id')!,
    )
    const left = (id: string) => headById(id).getBoundingClientRect().left
    const handleOf = (id: string) =>
      headById(id).querySelector<HTMLElement>(HANDLE)!

    await openHandleMenu(headById(first), handleOf(first))
    // Первая перемещаемая колонка: левее — только закреплённые и служебные.
    expect(isDisabled(menuItem(ENGLISH_LABELS.moveLeft))).toBe(true)
    await userEvent.click(menuItem(ENGLISH_LABELS.moveRight))
    await expect.poll(menu).toBeNull()
    await expect.poll(() => left(first) > left(second)).toBe(true)
    expect(onColumnDragEnd).toHaveBeenCalledTimes(1)
    expect(onColumnDragEnd.mock.calls[0][0]).toEqual({
      dragIndex: expect.any(Number),
      hoverIndex: expect.any(Number),
      columnId: first,
      columnOrder: expect.any(Array),
    })

    await openHandleMenu(headById(first), handleOf(first))
    await userEvent.click(menuItem(ENGLISH_LABELS.moveLeft))
    await expect.poll(() => left(first) < left(second)).toBe(true)
    expect(onColumnDragEnd).toHaveBeenCalledTimes(2)
  })

  test('DA3: ручка строки открывается с клавиатуры, «Move down / up» переставляют строку, на краю пункт недоступен', async () => {
    await render(<Stories.RowDraggingPlayground />)
    await expect.poll(() => rowAt(1)).toBeTruthy()
    const moved = rowAt(0)!.getAttribute('data-row-id')!
    const indexOf = (id: string) =>
      Number(rowById(id)?.getAttribute('data-index'))
    const handle = () => rowById(moved)!.querySelector<HTMLElement>(HANDLE)!

    expect(handle().getAttribute('aria-label')).toBe(ENGLISH_LABELS.moveRow)
    handle().focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(menu).toBeTruthy()
    expect(menuLabels()).toEqual([
      ENGLISH_LABELS.moveUp,
      ENGLISH_LABELS.moveDown,
    ])
    expect(isDisabled(menuItem(ENGLISH_LABELS.moveUp))).toBe(true)

    await userEvent.click(menuItem(ENGLISH_LABELS.moveDown))
    await expect.poll(() => indexOf(moved)).toBe(1)
    await settleRowMotion()

    await openHandleMenu(rowById(moved)!, handle())
    await userEvent.click(menuItem(ENGLISH_LABELS.moveUp))
    await expect.poll(() => indexOf(moved)).toBe(0)
  })

  test('DA4: при раскрытии строк меню даёт «Indent / Outdent» — вложение в группу выше и вынос обратно', async () => {
    await render(
      <Stories.RowDraggingPlayground
        dataNesting="nested"
        enableRowExpanding
        initialExpanded
        enableKeyboardNavigation
      />,
    )
    await expect.poll(() => rowById('item-id-1')).toBeTruthy()
    const level = () => rowById('item-id-1')?.getAttribute('aria-level')
    const handleOf = (row: HTMLElement) =>
      row.querySelector<HTMLElement>(HANDLE)!
    expect(level()).toBe('1')

    await openHandleMenu(rowById('item-id-1')!, handleOf(rowById('item-id-1')!))
    expect(menuLabels()).toEqual([
      ENGLISH_LABELS.moveUp,
      ENGLISH_LABELS.moveDown,
      ENGLISH_LABELS.indentRow,
      ENGLISH_LABELS.outdentRow,
    ])
    expect(isDisabled(menuItem(ENGLISH_LABELS.outdentRow))).toBe(true)
    await userEvent.click(menuItem(ENGLISH_LABELS.indentRow))
    await expect.poll(level).toBe('2')

    await openHandleMenu(rowById('item-id-1')!, handleOf(rowById('item-id-1')!))
    expect(isDisabled(menuItem(ENGLISH_LABELS.indentRow))).toBe(true)
    await userEvent.click(menuItem(ENGLISH_LABELS.outdentRow))
    await expect.poll(level).toBe('1')
  })

  test('DA5: протяжка ручки стартует после сдвига ≥ 5 px, переставляет колонку и меню не открывает', async () => {
    await render(<ColumnDraggingGrid />)
    await expect.poll(() => movableHeads().length).toBeGreaterThan(2)
    const [, source, target] = movableHeads()
    const sourceId = source.getAttribute('data-column-id')!
    const targetId = target.getAttribute('data-column-id')!
    const overlay = () =>
      document.querySelector('.data-grid-head__cell--overlay')
    const handle = source.querySelector<HTMLElement>(HANDLE)!
    const hr = handle.getBoundingClientRect()
    const hx = hr.left + hr.width / 2
    const hy = hr.top + hr.height / 2

    firePointer('pointerdown', handle, hx, hy)
    await nextFrame()
    firePointer('pointermove', document, hx + 3, hy)
    await nextFrame()
    await nextFrame()
    // Меньше порога — перетаскивание не началось, оверлея нет.
    expect(overlay()).toBeNull()

    firePointer('pointermove', document, hx + 6, hy)
    await expect.poll(overlay).toBeTruthy()
    const tr = target.getBoundingClientRect()
    const tx = tr.left + tr.width / 2
    firePointer('pointermove', document, tx, hy)
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, tx + 1, hy)
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, tx + 1, hy)
    // Браузер шлёт click, если отпускание пришлось на ту же ручку.
    handle.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: tx + 1, clientY: hy }),
    )

    await expect
      .poll(
        () =>
          headById(sourceId).getBoundingClientRect().left >
          headById(targetId).getBoundingClientRect().left,
      )
      .toBe(true)
    await nextFrame()
    expect(menu()).toBeNull()
  })

  test('DA6: меню грипа ширины — «Wider / Narrower» меняют ширину на 50 px в пределах minSize и зовут onColumnResizeEnd; протяжка меню не открывает', async () => {
    const onColumnResizeEnd = vi.fn()
    await render(<ColumnResizingGrid onColumnResizeEnd={onColumnResizeEnd} />)
    const cell = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='false']`,
        ),
      )
        .filter(c => c.querySelector(RESIZE_GRIP))
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0]
    await expect.poll(cell).toBeTruthy()
    const id = cell().getAttribute('data-column-id')!
    const rect = () => headById(id).getBoundingClientRect()
    const width = () => Math.round(rect().width)
    const grip = () => headById(id).querySelector<HTMLElement>(RESIZE_GRIP)!
    const min = Number(
      grip().querySelector('[role="separator"]')!.getAttribute('aria-valuemin'),
    )
    const initial = width()
    // Следующий заголовок справа — сдвигается вслед за шириной.
    const next = () =>
      Array.from(document.querySelectorAll<HTMLElement>(HEAD_CELL)).find(
        c => Math.abs(c.getBoundingClientRect().left - rect().right) < 1,
      )

    await openHandleMenu(headById(id), grip())
    expect(menu()!.getAttribute('aria-label')).toBe(ENGLISH_LABELS.columnWidth)
    expect(menuLabels()).toEqual([
      ENGLISH_LABELS.widenColumn,
      ENGLISH_LABELS.narrowColumn,
      ENGLISH_LABELS.resetColumnWidth,
    ])
    // Ширина на minSize — сужать некуда.
    expect(isDisabled(menuItem(ENGLISH_LABELS.narrowColumn))).toBe(
      initial <= min,
    )
    const nextId = next()!.getAttribute('data-column-id')
    onColumnResizeEnd.mockClear()
    await userEvent.click(menuItem(ENGLISH_LABELS.widenColumn))
    await expect.poll(width).toBe(initial + 50)
    expect(onColumnResizeEnd).toHaveBeenLastCalledWith({
      id,
      width: initial + 50,
    })
    await expect.poll(() => next()?.getAttribute('data-column-id')).toBe(nextId)

    await openHandleMenu(headById(id), grip())
    expect(isDisabled(menuItem(ENGLISH_LABELS.narrowColumn))).toBe(false)
    await userEvent.click(menuItem(ENGLISH_LABELS.narrowColumn))
    await expect.poll(width).toBe(initial)

    // Протяжка грипа вправо меняет ширину и меню не открывает, даже если
    // отпускание пришлось на грип.
    const r = grip().getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y = r.top + r.height / 2
    fireMouse('mousedown', grip(), x0, y)
    await nextFrame()
    fireMouse('mousemove', document, x0 + 60, y)
    await nextFrame()
    await nextFrame()
    fireMouse('mouseup', document, x0 + 60, y)
    grip().dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: x0 + 60, clientY: y }),
    )
    await expect.poll(width).toBeGreaterThan(initial + 40)
    await nextFrame()
    expect(menu()).toBeNull()
  })
})

// --- 2.5.8: зона нажатия -------------------------------------------------------

/** Цели указателя — контролы внутри ячеек (сами ячейки — контейнеры, не цели). */
const TARGET =
  'button, input:not([type="hidden"]), [role="button"], [role="checkbox"], .resize__handler--column'
const MIN = 24

/** Точки квадрата 24×24 относительно его центра. */
const SAMPLE = [-11, -8, -4, 0, 4, 8, 11]

/** Центры квадратов 24×24 вдоль оси, целиком накрывающих цель. */
const squareCenters = (start: number, size: number) => {
  if (size >= MIN) {
    return [start + size / 2]
  }
  const centers: number[] = []
  for (let from = start + size - MIN; from <= start; from += 2) {
    centers.push(from + MIN / 2)
  }
  return centers
}

/**
 * Первая точка, где зона нажатия не принадлежит цели, для каждого квадрата 24×24,
 * содержащего цель; `null` — есть квадрат, целиком принадлежащий цели.
 */
const findMiss = (el: HTMLElement, rect: DOMRect) => {
  let first: { x: number; y: number } | null = null
  for (const x of squareCenters(rect.left, rect.width)) {
    for (const y of squareCenters(rect.top, rect.height)) {
      const miss = SAMPLE.flatMap(dx =>
        SAMPLE.map(dy => ({ x: x + dx, y: y + dy })),
      ).find(p => !el.contains(document.elementFromPoint(p.x, p.y)))
      if (!miss) {
        return null
      }
      first ??= miss
    }
  }
  return first
}

const center = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
})

/** Расстояние от точки до прямоугольника (0 — внутри). */
const distanceToRect = (p: { x: number; y: number }, r: DOMRect) =>
  Math.hypot(
    Math.max(r.left - p.x, 0, p.x - r.right),
    Math.max(r.top - p.y, 0, p.y - r.bottom),
  )

const describeTarget = (el: HTMLElement) =>
  `${el.getAttribute('aria-label') ?? el.className} (${el.closest('[data-column-id]')?.getAttribute('data-column-id')})`

describe('WCAG 2.5.8 и 2.4.7 — размер целей и видимость фокуса (TS, FO)', () => {
  const renderAll = async () => {
    renderGrid({
      columnCount: 5,
      dataCount: 6,
      initialExpanded: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableColumnSizing: true,
      enableColumnDragging: true,
      enableRowDragging: true,
      enableRowExpanding: true,
      enableRowSelection: true,
      enableCellEditing: true,
      enableRowActions: true,
    })
    await waitForGrid()
  }

  test('TS1: цели не меньше 24×24 по зоне нажатия или проходят исключение об отступе', async () => {
    await renderAll()
    const header = document.querySelector<HTMLElement>('.data-grid__head')
    const rows = [0, 1, 2].map(rowAt).filter(Boolean) as HTMLElement[]
    const all = [header!, ...rows]
      .flatMap(scope => Array.from(scope.querySelectorAll<HTMLElement>(TARGET)))
      .filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 1 && r.height > 1
      })
      .filter(el => !el.parentElement?.closest(TARGET))
    // Цели под закреплёнными колонками сейчас недостижимы указателем.
    const targets = all.filter(el => {
      const c = center(el.getBoundingClientRect())
      return el.contains(document.elementFromPoint(c.x, c.y))
    })
    const kinds = (selector: string) =>
      targets.filter(el => el.matches(selector)).length
    expect(kinds('[role="checkbox"]')).toBeGreaterThan(1)
    expect(kinds(HANDLE)).toBeGreaterThan(1)
    expect(kinds(RESIZE_GRIP)).toBeGreaterThan(0)
    expect(kinds('button')).toBeGreaterThan(1)

    const failures = targets.flatMap(el => {
      const rect = el.getBoundingClientRect()
      const c = center(rect)
      const miss = findMiss(el, rect)
      if (!miss) {
        return []
      }
      const undersized = (r: DOMRect) => r.width < MIN || r.height < MIN
      const spaced = all
        .filter(other => other !== el)
        .every(other => {
          const r = other.getBoundingClientRect()
          return (
            distanceToRect(c, r) >= MIN / 2 &&
            (!undersized(r) ||
              Math.hypot(center(r).x - c.x, center(r).y - c.y) >= MIN)
          )
        })
      const blocker = document.elementFromPoint(miss.x, miss.y)
      return spaced
        ? []
        : [
            `${describeTarget(el)}: ${rect.width}×${rect.height}, в точке ${Math.round(miss.x)},${Math.round(miss.y)} — ${blocker?.tagName}.${blocker?.getAttribute('class')}`,
          ]
    })
    expect(failures).toEqual([])
  })

  test('FO1: контур фокуса заголовка лежит поверх контролов — грип ширины его не перекрывает', async () => {
    await render(<Stories.A11yGrid />)
    const head = () =>
      document.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-kn-cell][data-column-id='country']`,
      )
    await expect.poll(head).toBeTruthy()
    head()!.focus()
    // Клавиатурная модальность: контур только при :focus-visible.
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await expect.poll(() => document.activeElement).toBe(head())
    // Контур рисует отрисовка после нажатия — дождаться её.
    await expect
      .poll(() => getComputedStyle(head()!, '::after').borderRightStyle)
      .toBe('solid')

    const ring = getComputedStyle(head()!, '::after')
    const grip = getComputedStyle(head()!.querySelector(RESIZE_GRIP)!)
    expect(ring.borderRightStyle).toBe('solid')
    expect(ring.borderRightWidth).toBe(
      getComputedStyle(head()!)
        .getPropertyValue('--tsr-comp-focus-ring-width')
        .trim(),
    )
    expect(ring.position).toBe('absolute')
    expect(Number(ring.zIndex)).toBeGreaterThan(Number(grip.zIndex))
    expect(ring.pointerEvents).toBe('none')
  })

  test('TS2: зона нажатия не меняет вид — рамка чекбокса и иконка ручки 16×16', async () => {
    await renderAll()
    const checkbox = document.querySelector<HTMLElement>('[role="checkbox"]')!
    const handle = document.querySelector<HTMLElement>(HANDLE)!
    const size = (el: Element) => {
      const r = el.getBoundingClientRect()
      return [r.width, r.height]
    }
    expect(size(checkbox)).toEqual([16, 16])
    // Ручка — кнопка кита (ADR 0112, 0114); иконка в ней прежняя.
    expect(size(handle.querySelector('svg')!)).toEqual([16, 16])
  })
})
