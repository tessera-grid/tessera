/**
 * Хранилище блоков серверной модели строк (ADR 0138, §4–§5): блоки по `blockSize` строк,
 * не больше `maxConcurrent` запросов одновременно, отмена блоков, ушедших из окна,
 * вытеснение давно не нужных блоков сверх `maxBlocks`, итог известный или нет.
 * Без React и DOM: окно, быструю прокрутку и закреплённые строки сообщает плагин.
 */
import { isThenable, rejectionText } from '../../core/thenable'

/** Запрос строк `[start, end)`; состояние выборки — от плагина. */
export interface BlockRequest<TQuery> {
  start: number
  end: number
  query: TQuery
  signal: AbortSignal
}

export interface BlockResponse<TData> {
  rows: TData[]
  /** Итог, если сервер его знает. */
  rowCount?: number
}

export type BlockStatus = 'missing' | 'queued' | 'pending' | 'loaded' | 'error'

export interface BlockStoreOptions<TData, TRow, TQuery> {
  blockSize: number
  maxBlocks: number
  maxConcurrent?: number
  /** Итог до первого ответа. */
  rowCount?: number
  getRows: (
    request: BlockRequest<TQuery>,
  ) => PromiseLike<BlockResponse<TData>> | BlockResponse<TData>
  /** Состояние выборки на момент запроса. */
  query: () => TQuery
  /** Строки блока из данных ответа; `start` — индекс первой строки в списке. */
  toRows: (data: TData[], start: number) => TRow[]
  idOf: (row: TRow) => string
  /** Видимое состояние изменилось: строки, статус блока, итог. */
  onChange: () => void
  /** Блок отказал (не отменён): объявление отказа. */
  onFailure?: (blockIndex: number, reason?: string) => void
}

/** Отказавший блок: строки `[start, end)` и причина. */
export interface BlockFailure {
  index: number
  start: number
  end: number
  reason?: string
}

/** `auto` — запрос автоповтора отказавшего блока (ADR 0138, §11). */
type Block<TRow> =
  | { status: 'queued'; auto?: boolean }
  | { status: 'pending'; abort: AbortController; auto?: boolean }
  | { status: 'loaded'; rows: TRow[]; used: number }
  | {
      status: 'error'
      reason?: string
      /** Блок уходил из окна после отказа. */
      away?: boolean
      /** Отказал сам автоповтор: дальше — только кнопкой. */
      retried?: boolean
    }

const MAX_CONCURRENT = 2

export class BlockStore<TData, TRow, TQuery> {
  private readonly blocks = new Map<number, Block<TRow>>()
  private readonly indexById = new Map<string, number>()
  private window: { first: number; last: number } | null = null
  private pinned: number[] = []
  /** Порядок обращений к блокам: больше — нужен позже. */
  private clock = 0
  private total: number | undefined
  /** Конец списка найден по короткому блоку (итог неизвестен). */
  private ended = false
  private maxBlocks: number
  private suspended = false

  constructor(
    private readonly options: BlockStoreOptions<TData, TRow, TQuery>,
  ) {
    this.total = options.rowCount
    this.maxBlocks = options.maxBlocks
  }

  /** Строк в списке: итог, а без него — загруженное и один блок впереди. */
  /** Итог известен: задан, пришёл в ответе или найден коротким блоком. */
  isTotalKnown(): boolean {
    return this.total !== undefined || this.ended
  }

  count(): number {
    if (this.total !== undefined) return this.total
    let end = 0
    for (const [index, block] of this.blocks) {
      if (block.status === 'loaded') {
        end = Math.max(end, index * this.size + block.rows.length)
      }
    }
    return this.ended ? end : end + this.size
  }

  rowAt(index: number): TRow | undefined {
    const block = this.blocks.get(Math.floor(index / this.size))
    return block?.status === 'loaded'
      ? block.rows[index % this.size]
      : undefined
  }

  /** Заменить загруженную строку по индексу; незагруженная — без изменений. */
  replaceRow(index: number, row: TRow) {
    const block = this.blocks.get(Math.floor(index / this.size))
    if (block?.status !== 'loaded') return
    const rows = [...block.rows]
    rows[index % this.size] = row
    block.rows = rows
  }

  indexOf(id: string): number {
    return this.indexById.get(id) ?? -1
  }

  rowById(id: string): TRow | undefined {
    const index = this.indexById.get(id)
    return index === undefined ? undefined : this.rowAt(index)
  }

  statusOf(blockIndex: number): BlockStatus {
    return this.blocks.get(blockIndex)?.status ?? 'missing'
  }

  reasonOf(blockIndex: number): string | undefined {
    const block = this.blocks.get(blockIndex)
    return block?.status === 'error' ? block.reason : undefined
  }

  blockOf(index: number): number {
    return Math.floor(index / this.size)
  }

  /**
   * Окно строк `[first, last]` с запасом виртуализатора. Блоки вне окна отменяются; во
   * время быстрой прокрутки новые не запрашиваются.
   */
  setWindow(first: number, last: number, fast = false) {
    this.window = { first, last }
    const needed = new Set(this.neededBlocks())
    for (const [index, block] of this.blocks) {
      if (needed.has(index)) continue
      if (block.status === 'pending') {
        block.abort.abort()
        this.blocks.delete(index)
      } else if (block.status === 'queued') {
        this.blocks.delete(index)
      } else if (block.status === 'error') {
        block.away = true
      }
    }
    for (const index of needed) {
      const block = this.blocks.get(index)
      if (block?.status === 'loaded') block.used = ++this.clock
    }
    if (!fast) {
      for (const index of needed) {
        const block = this.blocks.get(index)
        if (!block) this.blocks.set(index, { status: 'queued' })
        // Отказавший блок вернулся в окно: один автоповтор.
        else if (block.status === 'error' && block.away && !block.retried)
          this.blocks.set(index, { status: 'queued', auto: true })
      }
    }
    // Окно и закрепления сменились: блоки сверх предела, ставшие ненужными, уходят.
    this.evict()
    this.pump()
  }

  /** Строки, чьи блоки не вытесняются: активная ячейка, правка. */
  setPinned(indices: number[]) {
    this.pinned = indices
  }

  setMaxBlocks(maxBlocks: number) {
    this.maxBlocks = maxBlocks
    this.evict()
  }

  /** Отказавшие блоки по порядку; ссылка на массив новая на каждое изменение. */
  failures(): BlockFailure[] {
    const result: BlockFailure[] = []
    for (const [index, block] of this.blocks) {
      if (block.status !== 'error') continue
      const start = index * this.size
      result.push({
        index,
        start,
        end: Math.min(start + this.size, this.count()),
        reason: block.reason,
      })
    }
    return result.sort((a, b) => a.index - b.index)
  }

  /** Загружен ли хоть один блок. */
  /** Не загружено ничего, а блок отказал: отказ списка целиком. */
  failedEmpty(): boolean {
    let failed = false
    for (const block of this.blocks.values()) {
      if (block.status === 'loaded') return false
      if (block.status === 'error') failed = true
    }
    return failed
  }

  hasLoaded(): boolean {
    for (const block of this.blocks.values()) {
      if (block.status === 'loaded') return true
    }
    return false
  }

  /** Повторить все отказавшие блоки. */
  retryAll() {
    for (const { index } of this.failures()) this.retry(index)
  }

  /** Повторить отказавший блок. */
  retry(blockIndex: number) {
    if (this.blocks.get(blockIndex)?.status !== 'error') return
    this.blocks.set(blockIndex, { status: 'queued' })
    this.options.onChange()
    this.pump()
  }

  /**
   * Строки окна под этим хранилищем: все пришли, ещё идут или блок окна отказал. Без окна
   * — идут.
   */
  windowState(): 'loading' | 'loaded' | { failed: string | undefined } {
    if (!this.window) return 'loading'
    let loading = false
    for (const index of this.neededBlocks()) {
      const block = this.blocks.get(index)
      if (block?.status === 'error') return { failed: block.reason }
      if (block?.status !== 'loaded') loading = true
    }
    return loading ? 'loading' : 'loaded'
  }

  /** Хранилище больше не нужно: запросы в пути отменены, кэш пуст, без уведомлений. */
  dispose() {
    for (const block of this.blocks.values()) {
      if (block.status === 'pending') block.abort.abort()
    }
    this.blocks.clear()
    this.indexById.clear()
    this.window = null
  }

  /** Сбросить кэш и отменить запросы: новое состояние выборки или обновление. */
  reset(rowCount = this.options.rowCount) {
    for (const block of this.blocks.values()) {
      if (block.status === 'pending') block.abort.abort()
    }
    this.blocks.clear()
    this.indexById.clear()
    this.total = rowCount
    this.ended = false
    this.options.onChange()
    if (this.window) this.setWindow(this.window.first, this.window.last)
  }

  /**
   * Размонтирование или смена аргументов плагина: запросы в пути отменяются, загруженное
   * остаётся. Отмена — после текущей задачи: смена аргументов и повтор эффектов StrictMode
   * сразу зовут `resume`, и запрос живёт.
   */
  suspend() {
    this.suspended = true
    queueMicrotask(() => {
      if (!this.suspended) return
      for (const [index, block] of this.blocks) {
        if (block.status === 'pending') block.abort.abort()
        if (block.status === 'pending' || block.status === 'queued') {
          this.blocks.delete(index)
        }
      }
    })
  }

  resume() {
    this.suspended = false
    if (this.window) this.setWindow(this.window.first, this.window.last)
  }

  private get size() {
    return this.options.blockSize
  }

  private neededBlocks(): number[] {
    if (!this.window) return []
    const lastRow = Math.min(this.window.last, this.count() - 1)
    const result: number[] = []
    for (
      let index = this.blockOf(Math.max(this.window.first, 0));
      index * this.size <= lastRow;
      index++
    ) {
      result.push(index)
    }
    return result
  }

  /** Отправить запросы из очереди — ближайшие к середине окна первыми. */
  private pump() {
    const limit = this.options.maxConcurrent ?? MAX_CONCURRENT
    const queued = [...this.blocks]
      .filter(([, block]) => block.status === 'queued')
      .map(([index]) => index)
    const middle = this.window
      ? (this.window.first + this.window.last) / 2 / this.size
      : 0
    // Ближе к середине окна середина блока — раньше запрос.
    const distance = (index: number) => Math.abs(index + 0.5 - middle)
    queued.sort((a, b) => distance(a) - distance(b))
    for (const index of queued) {
      if (this.inFlight() >= limit) break
      // Синхронный ответ уже мог отправить следующий блок.
      if (this.blocks.get(index)?.status !== 'queued') continue
      this.request(index)
    }
  }

  private inFlight() {
    let count = 0
    for (const block of this.blocks.values()) {
      if (block.status === 'pending') count++
    }
    return count
  }

  private request(blockIndex: number) {
    const abort = new AbortController()
    const queued = this.blocks.get(blockIndex)
    const auto = queued?.status === 'queued' && queued.auto
    const block: Block<TRow> = { status: 'pending', abort, auto }
    this.blocks.set(blockIndex, block)
    const start = blockIndex * this.size
    const current = () => this.blocks.get(blockIndex) === block
    const fail = (reason: unknown) => {
      if (!current() || abort.signal.aborted) return
      const text = rejectionText(reason)
      this.blocks.set(blockIndex, {
        status: 'error',
        reason: text,
        retried: auto,
      })
      this.options.onChange()
      this.options.onFailure?.(blockIndex, text)
      this.pump()
    }
    let result: ReturnType<BlockStoreOptions<TData, TRow, TQuery>['getRows']>
    try {
      result = this.options.getRows({
        start,
        end: start + this.size,
        query: this.options.query(),
        signal: abort.signal,
      })
    } catch (error) {
      fail(error)
      return
    }
    const done = (response: BlockResponse<TData>) => {
      if (!current() || abort.signal.aborted) return
      this.applyBlock(blockIndex, response)
    }
    if (isThenable(result)) {
      result.then(done, fail)
    } else {
      done(result)
    }
  }

  private applyBlock(blockIndex: number, response: BlockResponse<TData>) {
    const start = blockIndex * this.size
    const rows = this.options.toRows(response.rows, start)
    this.blocks.set(blockIndex, { status: 'loaded', rows, used: ++this.clock })
    rows.forEach((row, offset) =>
      this.indexById.set(this.options.idOf(row), start + offset),
    )
    if (response.rowCount !== undefined) {
      this.total = response.rowCount
    } else if (this.total === undefined && rows.length < this.size) {
      this.ended = true
    }
    this.evict()
    this.options.onChange()
    // Неизвестный итог вырос: окно может захватить следующий блок.
    if (this.window) this.setWindow(this.window.first, this.window.last)
    else this.pump()
  }

  /** Вытеснить давно не нужные блоки сверх `maxBlocks`, кроме окна и закреплённых. */
  private evict() {
    const loaded = [...this.blocks].filter(
      (entry): entry is [number, Block<TRow> & { status: 'loaded' }] =>
        entry[1].status === 'loaded',
    )
    let excess = loaded.length - this.maxBlocks
    if (excess <= 0) return
    const kept = new Set([
      ...this.neededBlocks(),
      ...this.pinned.map(index => this.blockOf(index)),
    ])
    loaded.sort((a, b) => a[1].used - b[1].used)
    for (const [index, block] of loaded) {
      if (excess <= 0) break
      if (kept.has(index)) continue
      for (const row of block.rows)
        this.indexById.delete(this.options.idOf(row))
      this.blocks.delete(index)
      excess--
    }
  }
}
