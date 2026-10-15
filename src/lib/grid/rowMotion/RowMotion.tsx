/**
 * Движение строк (ADR 0107): FLIP по видимым позициям. Перед коммитом новой модели
 * строк снимает положение смонтированных строк и копии уходящих, после коммита
 * запускает Web Animations от старта к местам модели. Класс — ради
 * `getSnapshotBeforeUpdate`: только он видит DOM до изменений коммита.
 */
import { Component, createRef, type ReactNode, type RefObject } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'

import { planRowMotion, type RowMotionPlan } from './planRowMotion'
import { rowMotionTiming } from './rowMotionTiming'
import styles from '../Body/Body.module.css'

const ROW = ':scope > [data-row-id]'
const INLINE_FOOTER = ":scope > .data-grid__footer[data-position='inline']"
/** Вертикальный сдвиг строки от dnd-kit в её `style.transform`. */
const DND_SHIFT = /translate3d\([^,]+,\s*(-?[\d.]+)px/

interface RowMotionProps {
  enabled: boolean
  rows: readonly { id: string }[]
  virtualRows: readonly VirtualItem[]
  bodyRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

interface Snapshot {
  before: Map<string, number>
  /** Копии строк, которые после коммита уйдут из окна. */
  leaving: Map<string, HTMLElement>
  prevRows: readonly { id: string }[]
  /** Позиция прокрутки до коммита: запоздавшее событие прежней прокрутки не обрывает движение. */
  scrolledAt: { top: number; left: number }
  /**
   * Тайминг из токенов темы до коммита: стили ещё чисты, а после коммита чтение
   * вычисленного стиля пересчитало бы стили всего изменённого DOM (RM20).
   */
  timing: { duration: number; easing: string }
  /** Видимая часть тела в его координатах: за её краем строки встают сразу. */
  viewport: { top: number; bottom: number }
  /** Незакреплённый футер за телом: едет вместе со строками (ADR 0118, §8). */
  footer: {
    element: HTMLElement
    top: number
    /** Высота тела до коммита: футер стоит под ней. */
    bodyHeight: number
  } | null
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Индексы в модели нескольких строк окна — одним проходом с ранним выходом, когда план
 * спросит: карта всех `id` на 100 000 строк дороже самого движения (RM20).
 */
const lazyIndexes = (
  rows: readonly { id: string }[],
  ids: readonly string[],
) => {
  let found: Map<string, number> | undefined
  return (id: string) => {
    if (!found) {
      found = new Map()
      const wanted = new Set(ids)
      for (let i = 0; i < rows.length && found.size < wanted.size; i++) {
        if (wanted.has(rows[i].id)) found.set(rows[i].id, i)
      }
    }
    return found.get(id)
  }
}

/** Копия строки — только вид: без ролей, `id`, фокуса и классов, по которым её ищут. */
const asGhost = (row: HTMLElement) => {
  for (const node of [row, ...row.querySelectorAll<HTMLElement>('*')]) {
    for (const { name } of [...node.attributes]) {
      if (
        name === 'id' ||
        name === 'role' ||
        name === 'tabindex' ||
        name.startsWith('aria-') ||
        name === 'data-row-id' ||
        name === 'data-index' ||
        name === 'data-testid'
      ) {
        node.removeAttribute(name)
      }
    }
    node.classList.remove('data-grid__body-row', 'data-grid__body-cell')
  }
  row.setAttribute('data-row-ghost', '')
  return row
}

export class RowMotion extends Component<RowMotionProps> {
  private readonly ghosts = createRef<HTMLDivElement>()
  private animations: Animation[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private scroller: Element | null = null
  private scrolledAt = { top: 0, left: 0 }

  componentDidMount() {
    // `inert` атрибутом: в React 18 у пропа нет булевой формы.
    this.ghosts.current?.setAttribute('inert', '')
  }

  getSnapshotBeforeUpdate(prev: RowMotionProps): Snapshot | null {
    const body = this.props.bodyRef.current
    if (
      !body ||
      prev.rows === this.props.rows ||
      !this.props.enabled ||
      prefersReducedMotion()
    ) {
      return null
    }
    const bodyTop = body.getBoundingClientRect().top
    const { rows, virtualRows } = this.props
    const next = new Set(virtualRows.map(item => rows[item.index]?.id))
    const before = new Map<string, number>()
    const leaving = new Map<string, HTMLElement>()
    for (const row of body.querySelectorAll<HTMLElement>(ROW)) {
      const id = row.dataset.rowId!
      before.set(id, row.getBoundingClientRect().top - bodyTop)
      if (!next.has(id)) leaving.set(id, row.cloneNode(true) as HTMLElement)
    }
    // Раскладка чиста после замеров строк — позиция прокрутки бесплатна.
    const scroller = body.closest('.data-grid__container')
    const view = scroller?.getBoundingClientRect()
    const footer = body
      .closest('.data-grid__table')
      ?.querySelector<HTMLElement>(INLINE_FOOTER)
    const footerBox = footer?.getBoundingClientRect()
    return {
      before,
      leaving,
      prevRows: prev.rows,
      scrolledAt: {
        top: scroller?.scrollTop ?? 0,
        left: scroller?.scrollLeft ?? 0,
      },
      timing: rowMotionTiming(body),
      viewport: view
        ? { top: view.top - bodyTop, bottom: view.bottom - bodyTop }
        : { top: -Infinity, bottom: Infinity },
      footer:
        footer && footerBox
          ? {
              element: footer,
              top: footerBox.top - bodyTop,
              bodyHeight: body.clientHeight,
            }
          : null,
    }
  }

  componentDidUpdate(
    _prev: RowMotionProps,
    _state: unknown,
    snapshot: Snapshot | null,
  ) {
    if (snapshot) this.play(snapshot)
  }

  componentWillUnmount() {
    this.finish()
  }

  /** Довести движение до конца: строки на места, призраки — прочь (RM12). */
  readonly finish = () => {
    clearTimeout(this.timer)
    this.timer = undefined
    this.scroller?.removeEventListener('scroll', this.onScroll)
    this.scroller = null
    for (const animation of this.animations) animation.cancel()
    this.animations = []
    this.ghosts.current?.replaceChildren()
    this.props.bodyRef.current?.style.removeProperty('min-height')
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

  private play({
    before,
    leaving,
    prevRows,
    scrolledAt,
    timing,
    viewport,
    footer,
  }: Snapshot) {
    this.finish()
    const body = this.props.bodyRef.current
    const { rows, virtualRows } = this.props
    if (!body || virtualRows.length === 0) return
    const rowSize = virtualRows[0].size
    const offset = virtualRows[0].start - virtualRows[0].index * rowSize
    // Сдвиг dnd-kit, оставшийся строке после смены модели посреди перетаскивания: строка,
    // что на экране стоит на месте, не едет (ADR 0109).
    const shifts = new Map<string, number>()
    for (const row of body.querySelectorAll<HTMLElement>(ROW)) {
      const y = Number(DND_SHIFT.exec(row.style.transform)?.[1] ?? 0)
      if (y) shifts.set(row.dataset.rowId!, y)
    }
    const after = virtualRows.map(item => {
      const id = rows[item.index].id
      return {
        id,
        index: item.index,
        start: item.start + (shifts.get(id) ?? 0),
      }
    })
    const mounted = new Set(after.map(row => row.id))
    const plan = planRowMotion({
      before,
      after,
      rowSize,
      startOf: index => offset + index * rowSize,
      // Пришедшие в окно ищутся в прошлой модели, ушедшие из окна — в новой.
      prevIndexOf: lazyIndexes(
        prevRows,
        after.filter(row => !before.has(row.id)).map(row => row.id),
      ),
      nextIndexOf: lazyIndexes(
        rows,
        [...before.keys()].filter(id => !mounted.has(id)),
      ),
    })
    if (!plan) return
    this.start(
      body,
      plan,
      leaving,
      rowSize,
      new Map(after.map(row => [row.id, row.start])),
      scrolledAt,
      timing,
      viewport,
      footer && {
        ...footer,
        shift: (rows.length - prevRows.length) * rowSize,
      },
    )
  }

  private start(
    body: HTMLDivElement,
    plan: RowMotionPlan,
    leaving: Map<string, HTMLElement>,
    rowSize: number,
    starts: Map<string, number>,
    scrolledAt: Snapshot['scrolledAt'],
    timing: Snapshot['timing'],
    viewport: Snapshot['viewport'],
    footer: (NonNullable<Snapshot['footer']> & { shift: number }) | null,
  ) {
    if (
      plan.moves.size === 0 &&
      plan.enters.length === 0 &&
      plan.exits.length === 0
    ) {
      return
    }
    // Тема гасит движение нулевой длительностью (MO3).
    const { duration } = timing
    if (!duration) return
    /** Путь строки от `from` до `to` задевает видимую часть тела. */
    const seen = (from: number, to: number) =>
      Math.min(from, to) < viewport.bottom &&
      Math.max(from, to) + rowSize > viewport.top

    const mounted = new Map<string, HTMLElement>()
    for (const row of body.querySelectorAll<HTMLElement>(ROW)) {
      mounted.set(row.dataset.rowId!, row)
    }
    for (const [id, dy] of plan.moves) {
      const row = mounted.get(id)
      const start = starts.get(id) ?? 0
      if (row && seen(start + dy, start)) {
        this.animations.push(
          row.animate(
            [{ translate: `0 ${dy}px` }, { translate: '0 0' }],
            timing,
          ),
        )
      }
    }
    for (const id of plan.enters) {
      const row = mounted.get(id)
      const start = starts.get(id) ?? 0
      if (row && seen(start, start)) {
        this.animations.push(
          row.animate([{ opacity: 0 }, { opacity: 1 }], timing),
        )
      }
    }
    // Призраки — одной вставкой: каждая вставка заново проверяет селекторы `:has()`.
    const ghosts = document.createDocumentFragment()
    const exits: [HTMLElement, number, number | null][] = []
    for (const { id, from, to } of plan.exits) {
      const copy = leaving.get(id)
      if (!copy || !seen(from, to ?? from)) continue
      const ghost = asGhost(copy)
      ghost.style.top = `${from}px`
      ghosts.append(ghost)
      exits.push([ghost, from, to])
    }
    this.ghosts.current?.append(ghosts)
    for (const [ghost, from, to] of exits) {
      this.animations.push(
        ghost.animate(
          to === null
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [{ translate: '0 0' }, { translate: `0 ${to - from}px` }],
          { ...timing, fill: 'forwards' },
        ),
      )
    }

    if (this.animations.length === 0) return

    // Строки, едущие снизу, и призраки не обрезаются укоротившимся телом. Без чтения
    // раскладки: `min-height` ниже высоты тела ничего не меняет.
    const held = Math.max(
      0,
      ...plan.exits.map(exit => exit.from + rowSize),
      ...[...plan.moves].map(
        ([id, dy]) => (starts.get(id) ?? 0) + dy + rowSize,
      ),
    )
    body.style.minHeight = `${held}px`

    // Незакреплённый футер едет за последней строкой: от прежнего места к новому, а
    // раскладка держит его под удержанной высотой тела до конца движения.
    if (footer?.shift && seen(footer.top, footer.top + footer.shift)) {
      // Сдвиг раскладки: тело не ниже удержанной высоты.
      const laid =
        Math.max(held, footer.bodyHeight + footer.shift) - footer.bodyHeight
      this.animations.push(
        footer.element.animate(
          [
            { translate: `0 ${-laid}px` },
            { translate: `0 ${footer.shift - laid}px` },
          ],
          { ...timing, fill: 'forwards' },
        ),
      )
    }

    this.timer = setTimeout(this.finish, duration)
    this.scrolledAt = scrolledAt
    this.scroller = body.closest('.data-grid__container')
    this.scroller?.addEventListener('scroll', this.onScroll, { passive: true })
  }

  render() {
    return (
      <>
        {this.props.children}
        <div ref={this.ghosts} className={styles.ghosts} aria-hidden="true" />
      </>
    )
  }
}
