/**
 * Загрузчик ленты (ADR 0081): одна загрузка за раз, цепочка после ответа, пауза
 * после ответа без строк, отмена устаревшей загрузки. Геометрию края даёт
 * `measure` — по умолчанию из DOM грида.
 */
import { type DebugActionSource, reportAction } from '../../core/debugActions'
import { announceLabel } from '../../core/announcer'
import { scrollLayer } from '../../core/scrollStretch'
import { IDLE, shouldLoadMore, tailRowCount } from './model'
import type { InfiniteScrollHooks, InfiniteScrollState } from './types'

const SCROLLER_SELECTOR = '.data-grid__container'
const FALLBACK_ROW_HEIGHT = 50

export interface LoaderInput {
  table: unknown
  hooks: Partial<InfiniteScrollHooks>
  hasMore: boolean
  /** Корневых строк в `data`. */
  loaded: number
  rowCount?: number
  threshold?: number
  /** Плагин инертен — загрузчик ничего не делает. */
  inert: boolean
  /** Конец тела: по нему загрузчик находит область прокрутки. */
  sentinel: HTMLElement | null
  setValue: (next: InfiniteScrollState) => void
}

export interface EdgeGeometry {
  /** От конца тела до нижнего края области прокрутки, px. */
  distance: number
  rowHeight: number
  viewportHeight: number
  scrollTop: number
}

const rowHeightOf = (scroller: HTMLElement) =>
  Number.parseFloat(
    getComputedStyle(scroller).getPropertyValue('--tsr-comp-row-height'),
  ) || FALLBACK_ROW_HEIGHT

const domGeometry = (sentinel: HTMLElement | null): EdgeGeometry | null => {
  const scroller = sentinel?.closest<HTMLElement>(SCROLLER_SELECTOR)
  if (!sentinel || !scroller) return null
  return {
    distance:
      sentinel.getBoundingClientRect().top -
      scroller.getBoundingClientRect().bottom,
    rowHeight: rowHeightOf(scroller),
    viewportHeight: scroller.clientHeight,
    scrollTop: scrollLayer(scroller).top(),
  }
}

/** Причина отказа для показа: текст ошибки или строка, иначе — без причины. */
const reasonOf = (error: unknown): string | undefined => {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : undefined
  return text?.trim() || undefined
}

/** Два кадра на отрисовку новой `data` после ответа. */
const afterPaint = (run: () => void) =>
  requestAnimationFrame(() => requestAnimationFrame(run))

export class InfiniteLoader {
  sentinel: HTMLElement | null = null
  private input: LoaderInput | null = null
  private phase: InfiniteScrollState['status'] = 'idle'
  private abort: AbortController | null = null
  /** Номер загрузки: поздний итог отменённой игнорируется. */
  private generation = 0
  /** Ответ пришёл, ждём новую `data`: корневых строк на момент запроса. */
  private awaiting: number | null = null
  /** Ответ без строк: позиция прокрутки, до смены которой блок не просим. */
  private stalledAt: number | null = null
  /** Отказ пришёл, когда конец загруженных строк был в виду (ADR 0118, FT17). */
  private failedAtEdge = false

  constructor(
    private readonly measure: (
      sentinel: HTMLElement | null,
    ) => EdgeGeometry | null = domGeometry,
    private readonly schedule: (run: () => void) => void = afterPaint,
  ) {}

  /** Новые входы после рендера; приход строк завершает ожидание ответа. */
  update(input: LoaderInput) {
    this.input = input
    this.sentinel = input.sentinel
    if (this.awaiting !== null && input.loaded > this.awaiting) {
      this.settle()
    }
  }

  get status() {
    return this.phase
  }

  check() {
    const input = this.input
    // Без замеров, пока блок в пути или просить нечего: проверка идёт на каждом кадре прокрутки.
    if (!input || input.inert || !input.hasMore || this.phase !== 'idle') return
    const geometry = this.measure(this.sentinel)
    if (!geometry) return
    if (this.stalledAt !== null && geometry.scrollTop !== this.stalledAt) {
      this.stalledAt = null
    }
    const thresholdPx =
      input.threshold !== undefined
        ? input.threshold * geometry.rowHeight
        : geometry.viewportHeight
    if (
      shouldLoadMore({
        distance: geometry.distance,
        thresholdPx,
        hasMore: input.hasMore,
        status: this.phase,
        stalled: this.stalledAt !== null,
        loaded: input.loaded,
      })
    ) {
      this.load(geometry)
    }
  }

  retry(source: DebugActionSource = 'api') {
    const geometry = this.measure(this.sentinel)
    if (geometry) this.load(geometry, 'retryLoadMore', source)
  }

  /** Номер запроса порции в канале действий — `cause` её итога (ADR 0125, AL23). */
  private request: number | undefined

  private report(action: string, detail?: unknown) {
    reportAction(this.input?.table, {
      plugin: 'infiniteScroll',
      action,
      detail,
      source: 'auto',
      cause: this.request,
    })
  }

  private load(
    geometry: EdgeGeometry,
    action = 'loadMore',
    source: DebugActionSource = 'auto',
  ) {
    const input = this.input
    if (!input) return
    this.request = reportAction(input.table, {
      plugin: 'infiniteScroll',
      action,
      detail: { loaded: input.loaded },
      source,
    })
    this.abort?.abort()
    const abort = new AbortController()
    const generation = ++this.generation
    const from = input.loaded
    this.abort = abort
    this.phase = 'pending'
    this.awaiting = null
    input.setValue({
      status: 'pending',
      tailRows: tailRowCount(
        Math.ceil(geometry.viewportHeight / geometry.rowHeight),
        from,
        input.rowCount,
      ),
    })
    const fail = (error?: unknown) => {
      if (generation !== this.generation) return
      const reason = reasonOf(error)
      this.report('loadMoreRejected', reason)
      this.failedAtEdge = (this.measure(this.sentinel)?.distance ?? 1) <= 0
      this.phase = 'error'
      this.input?.setValue({ status: 'error', tailRows: 0, reason })
      announceLabel(this.input?.table, labels =>
        reason ? `${labels.loadMoreFailed}. ${reason}` : labels.loadMoreFailed,
      )
    }
    let result: Promise<void> | void
    try {
      result = input.hooks.onLoadMore?.({ signal: abort.signal, loaded: from })
    } catch (error) {
      fail(error)
      return
    }
    Promise.resolve(result).then(() => {
      if (generation !== this.generation) return
      this.awaiting = from
      if ((this.input?.loaded ?? 0) > from) {
        this.settle()
        return
      }
      // Ответ может опередить новую `data`.
      this.schedule(() => {
        if (generation === this.generation) this.settle()
      })
    }, fail)
  }

  private settle() {
    if (this.awaiting === null || !this.input) return
    const added = this.input.loaded - this.awaiting
    this.awaiting = null
    this.phase = 'idle'
    this.input.setValue(IDLE)
    this.report(added > 0 ? 'loadMoreResolved' : 'loadMoreEmpty', { added })
    if (added > 0) {
      this.stalledAt = null
      announceLabel(this.input.table, labels =>
        labels.announceMoreLoaded(added),
      )
    } else {
      this.stalledAt = this.measure(this.sentinel)?.scrollTop ?? 0
    }
  }

  /** Был ли пользователь у края при последнем отказе; ответ — один раз на отказ. */
  takeFailedAtEdge() {
    const atEdge = this.failedAtEdge
    this.failedAtEdge = false
    return atEdge
  }

  /** Условие выборки сменилось или грид ушёл: загрузка в пути устарела. */
  cancel({ abort }: { abort: boolean }) {
    if (abort) this.abort?.abort()
    this.abort = null
    this.generation++
    this.awaiting = null
    this.stalledAt = null
    if (this.phase !== 'idle') {
      if (this.phase === 'pending') this.report('loadMoreCancelled')
      this.phase = 'idle'
      this.input?.setValue(IDLE)
    }
  }

  scrollToTop() {
    const scroller = this.sentinel?.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (scroller) scrollLayer(scroller).scrollTo({ top: 0 })
  }

  /** Подписка на прокрутку области грида; возвращает отписку. */
  listen() {
    const scroller = this.sentinel?.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (!scroller) return () => {}
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        this.check()
      })
    }
    const { area } = scrollLayer(scroller)
    area.addEventListener('scroll', onScroll)
    return () => {
      area.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }
}

/**
 * Загрузчик ленты таблицы: его заводит хвост, повтор просит строка ошибки (ADR 0118).
 * Ключ — `store`: объект таблицы у слотов меняется со сменой состояния.
 */
const loaders = new WeakMap<object, InfiniteLoader>()

const storeOf = (table: object) => (table as { store: object }).store

export const registerLoader = (table: object, loader: InfiniteLoader) => {
  const store = storeOf(table)
  loaders.set(store, loader)
  return () => {
    if (loaders.get(store) === loader) loaders.delete(store)
  }
}

export const loaderOf = (table: object) => loaders.get(storeOf(table))
