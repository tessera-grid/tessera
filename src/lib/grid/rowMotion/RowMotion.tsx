/**
 * Движение строк (ADR 0107): FLIP по видимым позициям. Перед коммитом новой модели
 * строк снимает положение смонтированных строк и копии уходящих, после коммита
 * запускает Web Animations от старта к местам модели. Класс — ради
 * `getSnapshotBeforeUpdate`: только он видит DOM до изменений коммита. Серверная модель
 * (ADR 0157, §4) массива строк не имеет: смена — по номеру раскладки, прежние места — по
 * журналу смен списка.
 */
import { Component, createRef, type ReactNode, type RefObject } from 'react'

import type { VirtualItem } from '../../../vendor/tanstack-virtual/react-virtual'

import type { RowSource } from '../../core/rowSource'
import { priorIndex } from '../../core/rowListFollow'
import { planRowMotion, type RowMotionPlan } from './planRowMotion'
import { rowMotionTiming } from '../../ui/theme/rowMotionTiming'
import styles from '../Body/Body.module.css'

const ROW = ':scope > [data-row-id]'
const INLINE_FOOTER = ":scope > .data-grid__footer[data-position='inline']"
/** Вертикальный сдвиг строки от dnd-kit в её `style.transform`. */
const DND_SHIFT = /translate3d\([^,]+,\s*(-?[\d.]+)px/

interface RowMotionProps {
  enabled: boolean
  /**
   * Список строк модели — геттером, а не массивом: dev-журнал React 19 сравнивает пропсы
   * перерисованной компоненты и обошёл бы массив целиком (ADR 0199, MS12). Новый геттер —
   * новый список.
   */
  getRows: () => readonly { id: string }[]
  /** Источник строк по индексу (серверная модель): движение — по его журналу. */
  source?: RowSource<{ id: string }>
  /** Номер раскладки источника по индексу. */
  listVersion?: number
  virtualRows: readonly VirtualItem[]
  bodyRef: RefObject<HTMLDivElement | null>
  /**
   * Место строки новой модели по индексу у виртуализатора: строки разной высоты (ADR 0218, §9).
   * Нет — строки одной высоты, место — индекс × высота.
   */
  placeOf?: (index: number) => { start: number; size: number } | undefined
  children: ReactNode
}

interface Snapshot {
  before: Map<string, number>
  /** Копии строк, которые после коммита уйдут из окна. */
  leaving: Map<string, HTMLElement>
  prevRows: readonly { id: string }[]
  prevVersion?: number
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
    /** Высота тела, при которой шапка, тело и футер умещаются в области без прокрутки. */
    room: number
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
      (prev.getRows === this.props.getRows &&
        prev.listVersion === this.props.listVersion) ||
      !this.props.enabled ||
      prefersReducedMotion()
    ) {
      return null
    }
    const bodyTop = body.getBoundingClientRect().top
    const { virtualRows } = this.props
    const next = new Set(virtualRows.map(item => this.idAt(item.index)))
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
      prevRows: prev.getRows(),
      prevVersion: prev.listVersion,
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
              room:
                (scroller?.clientHeight ?? Infinity) -
                (bodyTop - (view?.top ?? 0) + (scroller?.scrollTop ?? 0)) -
                footerBox.height,
            }
          : null,
    }
  }

  componentDidUpdate(
    _prev: RowMotionProps,
    _state: unknown,
    snapshot: Snapshot | null,
  ) {
    if (!snapshot) return
    this.play(snapshot)
    // React держит последний снимок до следующего обновления: прежние строки — нет (ADR 0200, EN26).
    snapshot.prevRows = []
  }

  componentWillUnmount() {
    this.finish()
  }

  private idAt(index: number) {
    const { getRows, source } = this.props
    return source?.keyByIndex ? source.at(index)?.id : getRows()[index]?.id
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
    this.clipped?.style.removeProperty('overflow-y')
    this.clipped = null
  }

  /** Таблица, обрезанная на время движения. */
  private clipped: HTMLElement | null = null

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
    prevVersion,
    scrolledAt,
    timing,
    viewport,
    footer,
  }: Snapshot) {
    this.finish()
    const body = this.props.bodyRef.current
    const { getRows, source, virtualRows } = this.props
    const rows = getRows()
    if (!body || virtualRows.length === 0) return
    const batches =
      source?.keyByIndex && prevVersion !== undefined
        ? source.changesSince?.(prevVersion)
        : undefined
    if (source?.keyByIndex && !batches) return
    const { placeOf } = this.props
    const rowSize = virtualRows[0].size
    const offset = virtualRows[0].start - virtualRows[0].index * rowSize
    const startOf = (index: number) =>
      placeOf?.(index)?.start ?? offset + index * rowSize
    // Сдвиг dnd-kit, оставшийся строке после смены модели посреди перетаскивания: строка,
    // что на экране стоит на месте, не едет (ADR 0109).
    const shifts = new Map<string, number>()
    for (const row of body.querySelectorAll<HTMLElement>(ROW)) {
      const y = Number(DND_SHIFT.exec(row.style.transform)?.[1] ?? 0)
      if (y) shifts.set(row.dataset.rowId!, y)
    }
    const after = virtualRows.flatMap(item => {
      // Незагруженная строка серверной модели — скелет, не движется.
      const id = this.idAt(item.index)
      if (id === undefined) return []
      return [
        {
          id,
          index: item.index,
          start: item.start + (shifts.get(id) ?? 0),
          size: item.size,
        },
      ]
    })
    const mounted = new Set(after.map(row => row.id))
    const plan = planRowMotion({
      before,
      after,
      rowSize,
      startOf,
      // Пришедшие в окно ищутся в прошлой модели, ушедшие из окна — в новой.
      prevIndexOf: batches
        ? id => {
            const index = source!.indexOf(id)
            return index === -1 ? undefined : priorIndex(index, batches)
          }
        : lazyIndexes(
            prevRows,
            after.filter(row => !before.has(row.id)).map(row => row.id),
          ),
      nextIndexOf: batches
        ? id => {
            const index = source!.indexOf(id)
            return index === -1 ? undefined : index
          }
        : lazyIndexes(
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
      new Map(after.map(row => [row.id, row])),
      scrolledAt,
      timing,
      viewport,
      footer && {
        ...footer,
        // Строки разной высоты: тело выросло на свою разницу, а не на число строк × высоту.
        shift: placeOf
          ? body.clientHeight - footer.bodyHeight
          : (batches
              ? batches.flat().reduce((sum, change) => sum + change.delta, 0)
              : rows.length - prevRows.length) * rowSize,
      },
    )
  }

  private start(
    body: HTMLDivElement,
    plan: RowMotionPlan,
    leaving: Map<string, HTMLElement>,
    rowSize: number,
    starts: Map<string, { start: number; size?: number }>,
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

    // Строки, удалённые из данных, сперва гаснут на своём месте, затем строки закрывают щель
    // (ADR 0157, §4): иначе соседи наезжают на призрак и удаления не видно. Строки фильтра,
    // поиска и свёрнутые в источнике остаются.
    const { source } = this.props
    const removing =
      !!source &&
      plan.exits.some(
        exit =>
          exit.to === null &&
          leaving.has(exit.id) &&
          seen(exit.from, exit.from) &&
          !source.byId(exit.id),
      )
    const settle = removing
      ? { ...timing, delay: duration, fill: 'backwards' as const }
      : timing

    const mounted = new Map<string, HTMLElement>()
    for (const row of body.querySelectorAll<HTMLElement>(ROW)) {
      mounted.set(row.dataset.rowId!, row)
    }
    for (const [id, dy] of plan.moves) {
      const row = mounted.get(id)
      const start = starts.get(id)?.start ?? 0
      if (row && seen(start + dy, start)) {
        this.animations.push(
          row.animate(
            [{ translate: `0 ${dy}px` }, { translate: '0 0' }],
            settle,
          ),
        )
      }
    }
    for (const id of plan.enters) {
      const row = mounted.get(id)
      const start = starts.get(id)?.start ?? 0
      if (row && seen(start, start)) {
        this.animations.push(
          row.animate([{ opacity: 0 }, { opacity: 1 }], settle),
        )
      }
    }
    // Призраки уходят группами — вниз, вверх и гаснущие на месте, одной анимацией на
    // группу: у каждой анимации свой слой и своя отрисовка (RM20, RM31). Группа едет так,
    // чтобы за край ушёл и ближний к нему призрак; соседи едут вместе, не сходясь у края.
    const groups = {
      down: [] as HTMLElement[],
      up: [] as HTMLElement[],
      fade: [] as HTMLElement[],
    }
    let down = 0
    let up = 0
    for (const { id, from, to } of plan.exits) {
      const copy = leaving.get(id)
      if (!copy || !seen(from, to ?? from)) continue
      const ghost = asGhost(copy)
      ghost.style.top = `${from}px`
      if (to === null) {
        groups.fade.push(ghost)
      } else if (to < from) {
        groups.up.push(ghost)
        up = Math.min(up, to - from)
      } else {
        groups.down.push(ghost)
        down = Math.max(down, to - from)
      }
    }
    // Одной вставкой: каждая вставка заново проверяет селекторы `:has()`.
    const layer = document.createDocumentFragment()
    const moving: [HTMLElement[], Keyframe[]][] = [
      [groups.down, [{ translate: '0 0' }, { translate: `0 ${down}px` }]],
      [groups.up, [{ translate: '0 0' }, { translate: `0 ${up}px` }]],
      [groups.fade, [{ opacity: 1 }, { opacity: 0 }]],
    ]
    const started: [HTMLElement, Keyframe[]][] = []
    for (const [members, keyframes] of moving) {
      if (members.length === 0) continue
      const group = document.createElement('div')
      group.className = styles.ghostGroup
      group.append(...members)
      layer.append(group)
      started.push([group, keyframes])
    }
    this.ghosts.current?.append(layer)
    for (const [group, keyframes] of started) {
      this.animations.push(
        group.animate(keyframes, { ...timing, fill: 'forwards' }),
      )
    }

    if (this.animations.length === 0) return

    // Строки, едущие снизу, и призраки не обрезаются укоротившимся телом. Без чтения
    // раскладки: `min-height` ниже высоты тела ничего не меняет.
    const moved = Math.max(
      0,
      // Призрак — копия строки своей высоты (ADR 0218, §9).
      ...plan.exits.map(
        exit =>
          exit.from +
          (parseFloat(leaving.get(exit.id)?.style.height ?? '') || rowSize),
      ),
      ...[...plan.moves].map(([id, dy]) => {
        const row = starts.get(id)
        return (row?.start ?? 0) + dy + (row?.size ?? rowSize)
      }),
    )
    // Таблица с футером, которая теперь умещается в области, уже не прокручивается: она
    // не выше области, а едущее за её край обрезается, иначе полоса прокрутки ждала бы
    // конца движения (FT18).
    const fits = !!footer && footer.bodyHeight + footer.shift <= footer.room
    const held = fits ? Math.min(moved, footer.room) : moved
    body.style.minHeight = `${held}px`
    if (fits) {
      this.clipped = body.closest<HTMLElement>('.data-grid__table')
      this.clipped?.style.setProperty('overflow-y', 'clip')
    }

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
          { ...settle, fill: 'both' },
        ),
      )
    }

    this.timer = setTimeout(this.finish, removing ? duration * 2 : duration)
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
