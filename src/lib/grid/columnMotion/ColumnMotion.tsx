/**
 * Движение колонок (ADR 0115): FLIP по горизонтали. Перед коммитом нового порядка колонок
 * снимает видимые позиции колонок и копии ячеек уходящих из окна, после коммита запускает
 * Web Animations ячеек шапки, тела и футера от старта к местам новой раскладки. Класс —
 * ради `getSnapshotBeforeUpdate`: только он видит DOM до изменений коммита.
 */
import { Component, createRef, type ReactNode, type RefObject } from 'react'

import { planColumnMotion, type MotionColumn } from './planColumnMotion'
import { rowMotionTiming } from '../../ui/theme/rowMotionTiming'
import styles from './ColumnMotion.module.css'

/** Ячейки шапки — по ним меряются позиции колонок. */
const HEAD_CELLS = '.data-grid__head-cell[data-column-id]'
const BODY_ROWS = '.data-grid__body-row[data-row-id]'

/**
 * Ячейка ездит: не закреплённая, не облако перетаскивания, не призрак строки. Фильтр — в
 * коде, а не селектором с `:not()`: тот проверялся бы на каждой ячейке грида.
 */
const travels = (cell: HTMLElement) =>
  cell.dataset.cellPinned !== 'left' &&
  cell.dataset.cellPinned !== 'right' &&
  !cell.classList.contains('data-grid-head__cell--overlay') &&
  !cell.closest('[data-row-ghost]')

/** Ячейки колонки во всём гриде: шапка, тело, футер. */
const cellsOf = (root: HTMLElement, id: string) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      `[data-column-id="${CSS.escape(id)}"]`,
    ),
  ].filter(travels)
/** Сдвиг dnd-kit по X в `style.transform` ячейки шапки. */
const DND_SHIFT = /translate3d\(\s*(-?[\d.]+)px/

interface MotionColumnDef {
  id: string
  getSize: () => number
}

interface ColumnMotionProps {
  enabled: boolean
  /** Видимые листовые колонки в порядке отображения: закреплённые слева — первыми. */
  columns: readonly MotionColumnDef[]
  /** Срез закрепления: его смена — не перенос, движения нет (CN6). */
  pinning: unknown
  isVirtualColumns: boolean
  rootRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

interface LeavingCell {
  node: HTMLElement
  left: number
  top: number
  width: number
  height: number
}

interface Measured {
  left: number
  width: number
  /** Ячейка стоит на месте раскладки: без сдвига dnd-kit и движения. */
  settled: boolean
}

interface Snapshot {
  before: Map<string, number>
  /** Сдвиг видимой раскладки от логической (сумма ширин слева), px. */
  offset: number
  /** Копии ячеек колонок, которые после коммита уйдут из окна. */
  leaving: Map<string, LeavingCell[]>
  prevColumns: readonly MotionColumnDef[]
  /**
   * Строки тела в видимой части грида: ячейки строк запаса виртуализации не едут — слой
   * композитора на каждую дорог.
   */
  visibleRows: Set<string>
  scrolledAt: { top: number; left: number }
  /**
   * Тайминг из токенов темы до коммита: стили ещё чисты, а после коммита чтение
   * вычисленного стиля пересчитало бы стили всего изменённого DOM.
   */
  timing: { duration: number; easing: string }
  /** Видимая часть таблицы в её координатах: за краем колонки встают сразу. */
  viewport: { left: number; right: number; top: number; bottom: number }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Тот же набор колонок в другом порядке. */
const reordered = (
  prev: readonly MotionColumnDef[],
  next: readonly MotionColumnDef[],
) => {
  if (prev.length !== next.length) return false
  if (prev.every((column, i) => column.id === next[i].id)) return false
  const ids = new Set(prev.map(column => column.id))
  return next.every(column => ids.has(column.id))
}

/** Левые края колонок раскладки без прокрутки и виртуализации: сумма ширин слева. */
const logicalLefts = (columns: readonly MotionColumnDef[]) => {
  const lefts = new Map<string, number>()
  let left = 0
  for (const column of columns) {
    lefts.set(column.id, left)
    left += column.getSize()
  }
  return lefts
}

/** Копия ячейки — только вид: без ролей, `id`, фокуса и признаков, по которым её ищут. */
const asGhost = (cell: HTMLElement) => {
  for (const node of [cell, ...cell.querySelectorAll<HTMLElement>('*')]) {
    for (const { name } of [...node.attributes]) {
      if (
        name === 'id' ||
        name === 'role' ||
        name === 'tabindex' ||
        name.startsWith('aria-') ||
        name === 'data-column-id' ||
        name === 'data-row-id' ||
        name === 'data-testid'
      ) {
        node.removeAttribute(name)
      }
    }
    node.classList.remove(
      'data-grid__head-cell',
      'data-grid__body-cell',
      'data-grid__footer-cell',
    )
  }
  return cell
}

/**
 * Колонки окна, которые после смены порядка уйдут из него: новое место не задевает
 * окно смонтированных колонок. Окно виртуализации держится за прокрутку, а не за
 * колонки, поэтому по прежнему окну видно, кто его покинет.
 */
const leavingWindow = (
  measured: Map<string, Measured>,
  nextLefts: Map<string, number>,
  offset: number,
) => {
  const spans = [...measured.values()]
  const start = Math.min(...spans.map(span => span.left))
  const end = Math.max(...spans.map(span => span.left + span.width))
  const away = new Set<string>()
  for (const [id, { width }] of measured) {
    const next = nextLefts.get(id)
    if (next === undefined) continue
    const left = next + offset
    if (left + width <= start || left >= end) away.add(id)
  }
  return away
}

export class ColumnMotion extends Component<ColumnMotionProps> {
  private readonly ghosts = createRef<HTMLDivElement>()
  private animations: Animation[] = []
  /** Колонки, которые сейчас едут: их видимое место — не место раскладки. */
  private gliding = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private scroller: Element | null = null
  private scrolledAt = { top: 0, left: 0 }

  componentDidMount() {
    // `inert` атрибутом: в React 18 у пропа нет булевой формы.
    this.ghosts.current?.setAttribute('inert', '')
  }

  getSnapshotBeforeUpdate(prev: ColumnMotionProps): Snapshot | null {
    const root = this.props.rootRef.current
    if (
      !root ||
      prev.columns === this.props.columns ||
      prev.pinning !== this.props.pinning ||
      !this.props.enabled ||
      !reordered(prev.columns, this.props.columns) ||
      prefersReducedMotion()
    ) {
      return null
    }
    const rootRect = root.getBoundingClientRect()
    const measured = new Map<string, Measured>()
    for (const cell of root.querySelectorAll<HTMLElement>(HEAD_CELLS)) {
      const id = cell.dataset.columnId!
      if (measured.has(id) || !travels(cell)) continue
      const rect = cell.getBoundingClientRect()
      measured.set(id, {
        left: rect.left - rootRect.left,
        width: rect.width,
        settled:
          !this.gliding.has(id) &&
          !Number(DND_SHIFT.exec(cell.style.transform)?.[1] ?? 0),
      })
    }
    // Сдвиг логической раскладки до видимой — по колонке, что стоит на своём месте.
    const prevLefts = logicalLefts(prev.columns)
    const anchor = [...measured].find(
      ([id, { settled }]) => settled && prevLefts.has(id),
    )
    const offset = anchor ? anchor[1].left - prevLefts.get(anchor[0])! : 0
    const leaving = new Map<string, LeavingCell[]>()
    const away = this.props.isVirtualColumns
      ? leavingWindow(measured, logicalLefts(this.props.columns), offset)
      : new Set<string>()
    if (away.size > 0) {
      for (const id of away) {
        leaving.set(
          id,
          cellsOf(root, id).map(cell => {
            const rect = cell.getBoundingClientRect()
            return {
              node: cell.cloneNode(true) as HTMLElement,
              left: rect.left - rootRect.left,
              top: rect.top - rootRect.top,
              width: rect.width,
              height: rect.height,
            }
          }),
        )
      }
    }
    const scroller = root.closest('.data-grid__container')
    const view = scroller?.getBoundingClientRect()
    const visibleRows = new Set<string>()
    for (const row of root.querySelectorAll<HTMLElement>(BODY_ROWS)) {
      const rect = row.getBoundingClientRect()
      if (!view || (rect.bottom > view.top && rect.top < view.bottom)) {
        visibleRows.add(row.dataset.rowId!)
      }
    }
    return {
      before: new Map([...measured].map(([id, { left }]) => [id, left])),
      offset,
      leaving,
      prevColumns: prev.columns,
      visibleRows,
      scrolledAt: {
        top: scroller?.scrollTop ?? 0,
        left: scroller?.scrollLeft ?? 0,
      },
      timing: rowMotionTiming(root),
      viewport: view
        ? {
            left: view.left - rootRect.left,
            right: view.right - rootRect.left,
            top: view.top - rootRect.top,
            bottom: view.bottom - rootRect.top,
          }
        : {
            left: -Infinity,
            right: Infinity,
            top: -Infinity,
            bottom: Infinity,
          },
    }
  }

  componentDidUpdate(
    _prev: ColumnMotionProps,
    _state: unknown,
    snapshot: Snapshot | null,
  ) {
    if (snapshot) this.play(snapshot)
  }

  componentWillUnmount() {
    this.finish()
  }

  /** Довести движение до конца: колонки на места, призраки — прочь (CN7). */
  readonly finish = () => {
    clearTimeout(this.timer)
    this.timer = undefined
    this.scroller?.removeEventListener('scroll', this.onScroll)
    this.scroller = null
    for (const animation of this.animations) animation.cancel()
    this.animations = []
    this.gliding.clear()
    this.ghosts.current?.replaceChildren()
  }

  private readonly onScroll = () => {
    const scroller = this.scroller
    if (
      scroller &&
      (scroller.scrollTop !== this.scrolledAt.top ||
        scroller.scrollLeft !== this.scrolledAt.left)
    ) {
      this.finish()
    }
  }

  /**
   * Места колонок после коммита — замером шапки: ширины ячеек не всегда равны размерам
   * колонок. Одно чтение раскладки на коммит; логические края — сумма ширин — нужны
   * только колонкам вне окна.
   */
  private placesAfter(root: HTMLElement) {
    const rootLeft = root.getBoundingClientRect().left
    const after: MotionColumn[] = []
    const seen = new Set<string>()
    let anchor: MotionColumn | undefined
    for (const cell of root.querySelectorAll<HTMLElement>(HEAD_CELLS)) {
      const id = cell.dataset.columnId!
      if (seen.has(id) || !travels(cell)) continue
      seen.add(id)
      const rect = cell.getBoundingClientRect()
      const column = { id, left: rect.left - rootLeft, width: rect.width }
      after.push(column)
      if (!anchor && !Number(DND_SHIFT.exec(cell.style.transform)?.[1] ?? 0)) {
        anchor = column
      }
    }
    return { after, anchor }
  }

  private play(snapshot: Snapshot) {
    this.finish()
    const root = this.props.rootRef.current
    if (!root) return
    const { after, anchor } = this.placesAfter(root)
    if (after.length === 0) return
    const lefts = logicalLefts(this.props.columns)
    const sizes = new Map(
      this.props.columns.map(column => [column.id, column.getSize()]),
    )
    const prevLefts = logicalLefts(snapshot.prevColumns)
    const offset =
      anchor && lefts.has(anchor.id)
        ? anchor.left - lefts.get(anchor.id)!
        : snapshot.offset
    const shift = (left: number | undefined) =>
      left === undefined ? undefined : left + offset
    const plan = planColumnMotion({
      before: snapshot.before,
      after,
      prevLeftOf: id => shift(prevLefts.get(id)),
      nextLeftOf: id => shift(lefts.get(id)),
      widthOf: id => sizes.get(id) ?? 0,
    })
    if (plan) this.start(root, plan, after, snapshot)
  }

  private start(
    root: HTMLDivElement,
    plan: NonNullable<ReturnType<typeof planColumnMotion>>,
    after: readonly MotionColumn[],
    { leaving, visibleRows, scrolledAt, timing, viewport }: Snapshot,
  ) {
    if (plan.moves.size === 0 && plan.exits.length === 0) return
    // Тема гасит движение нулевой длительностью (MO3).
    if (!timing.duration) return
    /** Путь колонки шириной `width` от `from` до `to` задевает видимую часть таблицы. */
    const seen = (from: number, to: number, width: number) =>
      Math.min(from, to) < viewport.right &&
      Math.max(from, to) + width > viewport.left

    const columns = new Map(after.map(column => [column.id, column]))
    const moving = new Map<string, number>()
    for (const [id, dx] of plan.moves) {
      const column = columns.get(id)
      if (column && seen(column.left + dx, column.left, column.width)) {
        moving.set(id, dx)
      }
    }
    for (const [id, dx] of moving) {
      for (const cell of cellsOf(root, id)) {
        const row = cell.closest<HTMLElement>(BODY_ROWS)
        if (row && !visibleRows.has(row.dataset.rowId!)) continue
        this.animations.push(
          cell.animate(
            [{ translate: `${dx}px 0` }, { translate: '0 0' }],
            timing,
          ),
        )
      }
    }
    this.gliding = new Set(moving.keys())
    // Призраки — одной вставкой: каждая вставка заново проверяет селекторы `:has()`.
    const ghosts = document.createDocumentFragment()
    const exits: [HTMLElement, number][] = []
    for (const { id, from, to } of plan.exits) {
      const cells = leaving.get(id)
      if (!cells || !seen(from, to, cells[0]?.width ?? 0)) continue
      for (const { node, left, top, width, height } of cells) {
        if (top >= viewport.bottom || top + height <= viewport.top) continue
        const ghost = asGhost(node)
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          margin: '0',
          transform: 'none',
        })
        ghosts.append(ghost)
        exits.push([ghost, to - from])
      }
    }
    this.ghosts.current?.append(ghosts)
    for (const [ghost, dx] of exits) {
      this.animations.push(
        ghost.animate([{ translate: '0 0' }, { translate: `${dx}px 0` }], {
          ...timing,
          fill: 'forwards',
        }),
      )
    }

    if (this.animations.length === 0) return
    this.timer = setTimeout(this.finish, timing.duration)
    this.scrolledAt = scrolledAt
    this.scroller = root.closest('.data-grid__container')
    this.scroller?.addEventListener('scroll', this.onScroll, { passive: true })
  }

  render() {
    return (
      <>
        {this.props.children}
        <div
          ref={this.ghosts}
          className={styles.ghosts}
          data-column-ghosts=""
          aria-hidden="true"
        />
      </>
    )
  }
}
