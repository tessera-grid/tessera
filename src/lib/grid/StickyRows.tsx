/**
 * Липкие строки групп и веток (ADR 0160, §3): строка группы или ветки держится под шапкой,
 * пока видны её дети; вложенные уровни — стопкой, следующая группа выталкивает прежнюю.
 * Копии рисуются отдельно от окна виртуализации: строка группы может уйти из окна. Они
 * скрыты от скринридера и вне табуляции — клавиатура ходит по настоящим строкам; шеврон
 * копии сворачивает группу и прокручивает к её строке.
 */
import { type ReactNode, type MouseEvent, useRef, useState } from 'react'

import { useLatest } from '../core/useLatest'

import { scrollLayer } from '../core/scrollStretch'
import { viewportOf } from '../core/scrollToRow/viewport'
import type { RowSource } from '../core/rowSource'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import type { Row } from '../types'

import styles from './Body/Body.module.css'

type AnyRow = Row<any, any>

export interface StickyRow {
  row: AnyRow
  index: number
  /** Верх копии от низа шапки, px: отрицательный — её выталкивает следующая группа. */
  top: number
}

interface StickyTable {
  options: { stickyGroupRows?: boolean; stickyBranchRows?: boolean }
  scrollToRowIndex?: (index: number, options?: { align?: 'start' }) => unknown
}

/** Глубже не бывает: стопка ограничена, даже если дерево глубже. */
const MAX_LEVELS = 10
const NONE: readonly StickyRow[] = []

/** Липкие строки включены у группировки или у дерева. */
export const hasStickyRows = (table: unknown) => {
  const { options } = table as StickyTable
  return !!options.stickyGroupRows || !!options.stickyBranchRows
}

const isGroup = (row: AnyRow) =>
  !!(row as { getIsGrouped?: () => boolean }).getIsGrouped?.()

/** Строка держится под шапкой: группа при липких группах, ветка — при липких ветках. */
const sticks = (table: StickyTable, row: AnyRow) =>
  isGroup(row)
    ? !!table.options.stickyGroupRows
    : !!table.options.stickyBranchRows && row.getCanExpand()

/** Предки строки от корня. */
const ancestorsOf = (row: AnyRow) => {
  const chain: AnyRow[] = []
  for (
    let parent = row.getParentRow();
    parent;
    parent = parent.getParentRow()
  ) {
    chain.unshift(parent)
  }
  return chain
}

const sameStack = (a: readonly StickyRow[], b: readonly StickyRow[]) =>
  a.length === b.length &&
  a.every(
    (entry, k) =>
      entry.row === b[k]!.row &&
      entry.index === b[k]!.index &&
      entry.top === b[k]!.top,
  )

interface Measured {
  start: number
  end: number
}

/** Стопка липких строк при прокрутке `offset` (в координатах строк тела). */
export const stickyStack = (
  table: unknown,
  source: RowSource<AnyRow>,
  items: readonly Measured[],
  offset: number,
  rowHeight: number,
): StickyRow[] => {
  const t = table as StickyTable
  /** Строка, чья полоса содержит `y`: поиск делением по местам строк. */
  const indexAt = (y: number) => {
    let low = 0
    let high = items.length - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      const item = items[mid]!
      if (y < item.start) high = mid - 1
      else if (y >= item.end) low = mid + 1
      else return mid
    }
    return -1
  }
  const stack: StickyRow[] = []
  for (let level = 0; level < MAX_LEVELS; level++) {
    const y = offset + level * rowHeight
    const index = indexAt(y)
    const row = index < 0 ? undefined : source.at(index)
    if (!row) break
    const chain = ancestorsOf(row)
    // Сама строка группы ушла под стопку — её дети ниже: она тоже держится.
    if (row.getIsExpanded() && items[index]!.start < y) chain.push(row)
    const candidate = chain[level]
    if (!candidate || !sticks(t, candidate)) break
    stack.push({
      row: candidate,
      index: source.indexOf(candidate.id),
      top: level * rowHeight,
    })
  }
  if (stack.length === 0) return stack
  // Строка не глубже уровня, идущая за его группой, выталкивает его вверх.
  const last = indexAt(offset + (stack.length + 1) * rowHeight)
  const first = Math.max(indexAt(offset), 0)
  const end = last < 0 ? items.length - 1 : last
  for (let index = first; index <= end; index++) {
    const row = source.at(index)
    if (!row) continue
    const pushed = items[index]!.start - offset - rowHeight
    for (const entry of stack) {
      if (index > entry.index && row.depth <= entry.row.depth) {
        entry.top = Math.min(entry.top, pushed)
      }
    }
  }
  return stack
}

export const StickyRows = ({
  table,
  source,
  rowHeight,
  renderRow,
}: {
  table: unknown
  source: RowSource<AnyRow>
  rowHeight: number
  /**
   * `last` — нижняя невытесняемая копия: под ней отделитель; `pushed` — группа кончилась,
   * копию выталкивает следующая.
   */
  renderRow: (
    entry: StickyRow,
    place: { last: boolean; pushed: boolean },
  ) => ReactNode
}) => {
  const [stack, setStack] = useState<readonly StickyRow[]>(NONE)
  const ref = useRef<HTMLDivElement>(null)
  // Контейнер прокрутки — по блоку: окно грида регистрируется позже эффектов тела.
  const scrollerOf = () =>
    ref.current?.closest<HTMLElement>('.data-grid__container') ?? null
  const update = useLatest(() => {
    const viewport = viewportOf(table)
    const scroller = scrollerOf()
    if (!viewport || !scroller) return
    const next = stickyStack(
      table,
      source,
      viewport.rows.measurementsCache,
      // Растянутая область (ADR 0142): место строк — виртуальная позиция.
      scrollLayer(scroller).top(),
      rowHeight,
    )
    setStack(prev => (sameStack(prev, next) ? prev : next))
  })

  // Каждая отрисовка тела: строки окна меняет и приход блока серверной модели.
  useIsomorphicLayoutEffect(() => {
    update.current()
  })

  useIsomorphicLayoutEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('.data-grid__container')
    if (!scroller) return
    // Событие прокрутки — раз в кадр, расчёт — поиск делением и строки стопки.
    const onScroll = () => update.current()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [update])

  // Копия скрыта от скринридера: её кнопки — вне табуляции.
  useIsomorphicLayoutEffect(() => {
    ref.current
      ?.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]',
      )
      .forEach(node => node.setAttribute('tabindex', '-1'))
  })

  // Шеврон копии сворачивает группу — к её строке, иначе свёрнутая ушла бы выше экрана.
  // Строка встаёт под копиями предков: они остаются в стопке над ней.
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element
    if (!target.closest('.row-expand-button')) return
    const id = target.closest<HTMLElement>('[data-row-id]')?.dataset.rowId
    const level = stack.findIndex(entry => entry.row.id === id)
    if (level < 0) return
    const index = stack[level]!.index - level
    requestAnimationFrame(() =>
      (table as StickyTable).scrollToRowIndex?.(index, { align: 'start' }),
    )
  }

  const pushed = (level: number) => stack[level]!.top < level * rowHeight
  let lastLevel = stack.length - 1
  while (lastLevel >= 0 && pushed(lastLevel)) lastLevel--

  return (
    <div
      ref={ref}
      className={styles.sticky}
      aria-hidden="true"
      data-sticky-rows=""
      onClickCapture={onClickCapture}
    >
      {/* Мелкий уровень — поверх глубокого: глубокий уезжает под него. */}
      {[...stack].reverse().map((entry, k) => {
        const level = stack.length - 1 - k
        return renderRow(entry, {
          last: level === lastLevel,
          pushed: pushed(level),
        })
      })}
    </div>
  )
}
