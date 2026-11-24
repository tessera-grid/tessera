/**
 * Замер высоты строк по содержимому (ADR 0218, §4–5): ячейка колонки `autoHeight` ставит
 * в себя пробу, проба отдаёт обёртку содержимого ячейки наблюдателю размеров. Высота строки —
 * наибольшая из её ячеек; ядро получает её по id строки. Строка, ушедшая из окна, держит
 * последнюю высоту — по ней она вернётся с первого кадра.
 *
 * Замеры коммита идут пачкой в микрозадаче до кадра. Ячейки, смонтированные внутри
 * колбэка наблюдателя, наблюдаются со следующего кадра, чтобы их первое уведомление
 * не осталось недоставленным.
 */
import { flushSync } from 'react-dom'

import { setHeadLevelHeights } from '../../core/headSizes'
import { clearRowNeeds, setRowNeeds } from '../../core/rowSizes'

const WRAPPER = '.data-grid__cell-wrapper-content'
const TITLE = '.data-grid__cell-wrapper-title'
/** Поле редактора в ячейке: правка на месте. */
const FIELD = 'input, textarea, select, [contenteditable="true"]'
const ROW = '.data-grid__body-row[data-row-id]'

/**
 * Идёт колбэк наблюдателя замера тела или шапки: его синхронная перерисовка монтирует новые
 * ячейки, и их наблюдение — со следующего кадра, иначе первое уведомление осталось бы
 * недоставленным в этом кадре.
 */
let delivering = 0
const deferred = new Map<Element, () => void>()
let deferFrame = 0

const observeSafely = (element: Element, observe: () => void) => {
  if (!delivering) {
    observe()
    return
  }
  deferred.set(element, observe)
  deferFrame ||= requestAnimationFrame(() => {
    deferFrame = 0
    const pending = [...deferred.values()]
    deferred.clear()
    for (const run of pending) run()
  })
}

/** Колбэк наблюдателя: новая высота и места строк — в этом же кадре (AH17). */
const deliver = (run: () => void) => {
  delivering++
  try {
    flushSync(run)
  } finally {
    delivering--
  }
}

interface Probe {
  rowId: string
  row: HTMLElement
  cell: HTMLElement
  wrapper: HTMLElement | null
  /** Высота содержимого ячейки, px; нет — ещё не замерена. */
  need?: number
  /** Строка группы — высотой строки (ADR 0218, §8). */
  group: boolean
}

class Measurer {
  private probes = new Map<Element, Probe>()
  private byWrapper = new Map<Element, Probe>()
  private byRow = new Map<string, Set<Probe>>()
  private observer: ResizeObserver | undefined
  /** Пробы одного коммита для общего чтения раскладки. */
  private pending = new Set<Probe>()

  constructor(private readonly table: unknown) {}

  private observe(element: Element) {
    this.observer ??= new ResizeObserver(entries => this.onResize(entries))
    observeSafely(element, () => {
      if (this.byWrapper.has(element)) this.observer?.observe(element)
    })
  }

  /**
   * Высота содержимого ячейки сейчас. Прежняя — пока ячейка рисует не своё содержимое: скелет
   * быстрой прокрутки и слота броска, редактор, ожидание сохранения и черновик (AH26); пустая
   * ячейка меряется.
   */
  private heightOf(probe: Probe, measured?: number) {
    if (probe.group) return 0
    const { wrapper } = probe
    if (!wrapper || probe.cell.querySelector('[data-skeleton]')) {
      return probe.need
    }
    if (
      probe.need !== undefined &&
      !wrapper.querySelector(TITLE) &&
      (wrapper.textContent || wrapper.querySelector(FIELD))
    ) {
      return probe.need
    }
    return measured ?? wrapper.getBoundingClientRect().height
  }

  /** Проба ячейки смонтирована или ячейка перерисована. */
  track(probeElement: HTMLElement) {
    const cell = probeElement.parentElement
    const row = cell?.closest<HTMLElement>(ROW)
    // Копии липких строк и скелет высоту не задают.
    if (!cell || !row || row.hasAttribute('data-sticky-copy')) {
      this.untrack(probeElement)
      return
    }
    const rowId = row.getAttribute('data-row-id')!
    let probe = this.probes.get(probeElement)
    if (probe && probe.rowId !== rowId) {
      this.untrack(probeElement)
      probe = undefined
    }
    if (!probe) {
      probe = { rowId, row, cell, wrapper: null, group: false }
      this.probes.set(probeElement, probe)
      let probes = this.byRow.get(rowId)
      if (!probes) this.byRow.set(rowId, (probes = new Set()))
      probes.add(probe)
    }
    probe.group = row.getAttribute('data-group-row') === 'true'
    const wrapper = cell.querySelector<HTMLElement>(WRAPPER)
    if (probe.wrapper !== wrapper) {
      if (probe.wrapper) {
        this.observer?.unobserve(probe.wrapper)
        this.byWrapper.delete(probe.wrapper)
      }
      probe.wrapper = wrapper
      if (wrapper) {
        this.byWrapper.set(wrapper, probe)
        this.observe(wrapper)
      }
    }
    if (this.pending.size === 0) queueMicrotask(() => this.readPending())
    this.pending.add(probe)
  }

  /**
   * Сначала читаем все высоты после записей стилей коммита, затем обновляем строки
   * одной пачкой. Микрозадача выполняется до кадра.
   */
  private readPending() {
    const probes = this.pending
    this.pending = new Set()
    const rows = new Set<string>()
    for (const probe of probes) {
      if (!this.byRow.get(probe.rowId)?.has(probe)) continue
      const need = this.heightOf(probe)
      if (need === probe.need) continue
      probe.need = need
      rows.add(probe.rowId)
    }
    if (rows.size > 0) flushSync(() => this.flush(rows))
  }

  /** Проба ячейки ушла: строка на месте — высота по оставшимся ячейкам (скрыли колонку). */
  untrack(probeElement: HTMLElement) {
    const probe = this.probes.get(probeElement)
    if (!probe) return
    this.probes.delete(probeElement)
    if (probe.wrapper) {
      this.observer?.unobserve(probe.wrapper)
      this.byWrapper.delete(probe.wrapper)
    }
    const probes = this.byRow.get(probe.rowId)
    probes?.delete(probe)
    if (probes?.size === 0) this.byRow.delete(probe.rowId)
    queueMicrotask(() => {
      const { row, rowId } = probe
      if (!row.isConnected || row.getAttribute('data-row-id') !== rowId) return
      const rest = this.byRow.get(rowId)
      flushSync(() => {
        if (!rest) setRowNeeds(this.table, [[rowId, 0]])
        else this.flush([rowId])
      })
    })
  }

  private onResize(entries: ResizeObserverEntry[]) {
    const rows = new Set<string>()
    for (const entry of entries) {
      const probe = this.byWrapper.get(entry.target)
      if (!probe) continue
      const height = this.heightOf(probe, entry.borderBoxSize?.[0]?.blockSize)
      if (probe.need === height) continue
      probe.need = height
      rows.add(probe.rowId)
    }
    if (rows.size === 0) return
    deliver(() => this.flush(rows))
  }

  /** Высота строк — наибольшая из замеренных ячеек; незамеренные строки ждут замера. */
  private flush(rowIds: Iterable<string>) {
    const changes: [string, number][] = []
    for (const rowId of rowIds) {
      let need: number | undefined
      for (const probe of this.byRow.get(rowId) ?? []) {
        if (probe.need !== undefined) need = Math.max(need ?? 0, probe.need)
      }
      if (need !== undefined) changes.push([rowId, need])
    }
    if (changes.length) setRowNeeds(this.table, changes)
  }

  dispose() {
    this.observer?.disconnect()
    this.pending.clear()
    this.probes.clear()
    this.byWrapper.clear()
    this.byRow.clear()
    clearRowNeeds(this.table)
  }
}

const measurers = new WeakMap<object, Measurer>()
const storeOf = (table: unknown) => (table as { store: object }).store

export const measurerOf = (table: unknown) => {
  const store = storeOf(table)
  let measurer = measurers.get(store)
  if (!measurer) {
    measurer = new Measurer(table)
    measurers.set(store, measurer)
  }
  return measurer
}

/** Плагин снят или грид размонтирован: высоты забыты, наблюдатель отключён. */
export const disposeMeasurer = (table: unknown) => {
  const store = storeOf(table)
  measurers.get(store)?.dispose()
  measurers.delete(store)
}

interface HeadProbe {
  cell: HTMLElement
  wrapper: HTMLElement | null
  /** Уровень шапки и число уровней, которые заголовок занимает. */
  level: number
  span: number
  need?: number
}

/**
 * Замер шапки (ADR 0218, §10): высота уровня — наибольшая из его заголовков `autoHeaderHeight`,
 * но не меньше строки шапки; растянутый лист добирает недостающее нижним своим уровнем.
 */
class HeadMeasurer {
  private probes = new Map<Element, HeadProbe>()
  private byWrapper = new Map<Element, HeadProbe>()
  private observer: ResizeObserver | undefined
  private head: HTMLElement | null = null
  private scheduled = false

  constructor(private readonly table: unknown) {}

  track(probeElement: HTMLElement) {
    const cell = probeElement.parentElement
    const row = cell?.closest<HTMLElement>('[role="row"]')
    if (!cell || !row) return
    this.head =
      row.parentElement?.closest<HTMLElement>('.data-grid__head') ?? null
    let probe = this.probes.get(probeElement)
    if (!probe) {
      probe = { cell, wrapper: null, level: 0, span: 1 }
      this.probes.set(probeElement, probe)
    }
    probe.level = Number(row.getAttribute('aria-rowindex') ?? 1) - 1
    probe.span = Number(cell.getAttribute('aria-rowspan') ?? 1)
    const wrapper = cell.querySelector<HTMLElement>(WRAPPER)
    if (probe.wrapper !== wrapper) {
      if (probe.wrapper) {
        this.observer?.unobserve(probe.wrapper)
        this.byWrapper.delete(probe.wrapper)
      }
      probe.wrapper = wrapper
      if (wrapper) {
        this.byWrapper.set(wrapper, probe)
        this.observer ??= new ResizeObserver(entries => {
          let changed = false
          for (const entry of entries) {
            const target = this.byWrapper.get(entry.target)
            const height = entry.borderBoxSize?.[0]?.blockSize
            if (!target || height === undefined || target.need === height)
              continue
            target.need = height
            changed = true
          }
          // Рост шапки меняет её ячейки, за которыми следят другие наблюдатели грида: в этом
          // кадре их уведомление осталось бы недоставленным — высоты уровней в следующем.
          if (changed) this.applyNextFrame()
        })
        observeSafely(wrapper, () => {
          if (this.byWrapper.has(wrapper)) this.observer?.observe(wrapper)
        })
      }
    }
    const need = wrapper?.getBoundingClientRect().height
    if (need !== undefined && need !== probe.need) {
      probe.need = need
      this.schedule()
    }
  }

  untrack(probeElement: HTMLElement) {
    const probe = this.probes.get(probeElement)
    if (!probe) return
    this.probes.delete(probeElement)
    if (probe.wrapper) {
      this.observer?.unobserve(probe.wrapper)
      this.byWrapper.delete(probe.wrapper)
    }
    this.schedule()
  }

  private frame = 0
  private applyNextFrame() {
    this.frame ||= requestAnimationFrame(() => {
      this.frame = 0
      deliver(() => this.apply())
    })
  }

  /** Из эффекта коммита — микрозадачей до кадра: синхронная перерисовка в коммите запрещена. */
  private schedule() {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      flushSync(() => this.apply())
    })
  }

  private apply() {
    const head = this.head
    if (this.probes.size === 0 || !head?.isConnected) {
      setHeadLevelHeights(this.table, undefined)
      return
    }
    const min = parseFloat(
      getComputedStyle(head).getPropertyValue('--tsr-comp-head-row-height'),
    )
    const depth = head.querySelectorAll('.data-grid__head-row').length
    if (!(min > 0) || depth === 0) return
    const levels = Array.from({ length: depth }, () => min)
    const probes = [...this.probes.values()].filter(
      probe => probe.need !== undefined,
    )
    for (const probe of probes) {
      if (probe.span === 1 && probe.level < depth) {
        levels[probe.level] = Math.max(levels[probe.level]!, probe.need!)
      }
    }
    for (const probe of probes) {
      if (probe.span <= 1) continue
      const last = Math.min(depth, probe.level + probe.span) - 1
      let sum = probe.span - 1
      for (let level = probe.level; level <= last; level++)
        sum += levels[level]!
      if (probe.need! > sum) levels[last]! += probe.need! - sum
    }
    setHeadLevelHeights(this.table, levels)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
    this.probes.clear()
    this.byWrapper.clear()
    setHeadLevelHeights(this.table, undefined)
  }
}

const headMeasurers = new WeakMap<object, HeadMeasurer>()

export const headMeasurerOf = (table: unknown) => {
  const store = storeOf(table)
  let measurer = headMeasurers.get(store)
  if (!measurer) {
    measurer = new HeadMeasurer(table)
    headMeasurers.set(store, measurer)
  }
  return measurer
}

export const disposeHeadMeasurer = (table: unknown) => {
  const store = storeOf(table)
  headMeasurers.get(store)?.dispose()
  headMeasurers.delete(store)
}
