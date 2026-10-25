/**
 * Дерево хранилищ серверной модели строк (ADR 0138, §14): хранилище корней и по хранилищу
 * на раскрытую строку. Строки ветки стоят в списке сразу за родителем, индекс сквозной;
 * окно тела раскладывается по хранилищам. Предел `maxBlocks` — общий: первыми уходят
 * блоки свёрнутых веток, затем давно не нужные.
 */
import { BlockStore, type BlockResponse } from './blockStore'

export interface TreeRequest<TQuery> {
  start: number
  end: number
  query: TQuery
  signal: AbortSignal
  /** Строка, чьих детей просят; у корней — нет. */
  parentId?: string
}

export interface BlockTreeOptions<TData, TRow, TQuery> {
  blockSize: number
  maxBlocks: number
  /** Итог корней до первого ответа. */
  rowCount?: number
  getRows: (
    request: TreeRequest<TQuery>,
  ) => PromiseLike<BlockResponse<TData>> | BlockResponse<TData>
  query: () => TQuery
  /** Строки блока ветки `parentId` глубины `depth`; `start` — индекс в ветке. */
  toRows: (
    data: TData[],
    start: number,
    depth: number,
    parentId: string | undefined,
  ) => TRow[]
  idOf: (row: TRow) => string
  /** Раскрытые строки: срез `expanded` в виде набора `id`. */
  expanded: () => ReadonlySet<string>
  onChange: () => void
  /** Отказ блока (не отмена): объявление отказа. */
  onFailure?: (reason?: string) => void
}

interface TreeNode<TData, TRow, TQuery> {
  parentId: string | undefined
  depth: number
  store: BlockStore<TData, TRow, TQuery>
}

/** Ветка в раскладке: её строки и раскрытые дети по месту в ветке. */
interface Layout<TData, TRow, TQuery> {
  node: TreeNode<TData, TRow, TQuery>
  children: { local: number; layout: Layout<TData, TRow, TQuery> }[]
  /** Строки самой ветки. */
  count: number
  size: number
}

interface Position {
  parent: string | undefined
  local: number
}

/** Отказ блока в сквозных индексах. */
export interface TreeFailure {
  start: number
  end: number
  reason?: string
  retry: () => void
}

export class BlockTree<TData, TRow, TQuery> {
  private readonly nodes = new Map<
    string | undefined,
    TreeNode<TData, TRow, TQuery>
  >()
  /**
   * Место строки в её ветке: с прихода блока до его вытеснения; у раскрытой строки — и после,
   * чтобы её ветка оставалась на месте.
   */
  private readonly positions = new Map<string, Position>()
  private clock = 0
  private version = 0
  private maxBlocks: number
  private suspended = false
  private window: { first: number; last: number; fast: boolean } | null = null
  private pinned: number[] = []
  /** Ветки, получившие окно, — по ним считается приход окна. */
  private windowed = new Set<TreeNode<TData, TRow, TQuery>>()
  private cache: {
    version: number
    expanded: ReadonlySet<string>
    layout: Layout<TData, TRow, TQuery>
  } | null = null
  private readonly root: TreeNode<TData, TRow, TQuery>

  constructor(private readonly options: BlockTreeOptions<TData, TRow, TQuery>) {
    this.maxBlocks = options.maxBlocks
    this.root = this.createNode(undefined, 0, options.rowCount)
  }

  private createNode(
    parentId: string | undefined,
    depth: number,
    rowCount?: number,
  ) {
    const { options } = this
    const store = new BlockStore<TData, TRow, TQuery>({
      blockSize: options.blockSize,
      // Предел держит дерево на всех ветках сразу.
      maxBlocks: Number.POSITIVE_INFINITY,
      rowCount,
      clock: () => ++this.clock,
      getRows: ({ query, signal, ...range }) =>
        options.getRows({
          ...range,
          query,
          signal,
          ...(parentId === undefined ? {} : { parentId }),
        }),
      query: options.query,
      toRows: (data, start) => {
        const rows = options.toRows(data, start, depth, parentId)
        rows.forEach((row, offset) =>
          this.positions.set(options.idOf(row), {
            parent: parentId,
            local: start + offset,
          }),
        )
        return rows
      },
      idOf: options.idOf,
      onChange: () => {
        this.version++
        this.evict()
        this.scheduleWindow()
        options.onChange()
      },
      onFailure: (_, reason) => options.onFailure?.(reason),
    })
    const node = { parentId, depth, store }
    this.nodes.set(parentId, node)
    if (this.suspended) store.suspend()
    return node
  }

  /** Раскладка веток по срезу `expanded`; ветка раскрытой строки заводится при надобности. */
  private layout(): Layout<TData, TRow, TQuery> {
    const expanded = this.options.expanded()
    if (
      this.cache &&
      this.cache.version === this.version &&
      this.cache.expanded === expanded
    ) {
      return this.cache.layout
    }
    const build = (
      node: TreeNode<TData, TRow, TQuery>,
    ): Layout<TData, TRow, TQuery> => {
      const count = node.store.count()
      const children: Layout<TData, TRow, TQuery>['children'] = []
      for (const id of expanded) {
        const position = this.positions.get(id)
        if (!position || position.parent !== node.parentId) continue
        if (position.local >= count) continue
        const child = this.nodes.get(id) ?? this.createNode(id, node.depth + 1)
        children.push({ local: position.local, layout: build(child) })
      }
      children.sort((a, b) => a.local - b.local)
      const size = children.reduce(
        (sum, child) => sum + child.layout.size,
        count,
      )
      return { node, children, count, size }
    }
    const layout = build(this.root)
    // Раскрыли или свернули строку: ветке нужно своё окно, хотя окно тела то же.
    if (this.cache && this.cache.expanded !== expanded) this.scheduleWindow()
    this.cache = { version: this.version, expanded, layout }
    return layout
  }

  private windowScheduled = false

  /** Переложить окно по веткам после смены раскладки — одной микрозадачей. */
  private scheduleWindow() {
    if (!this.window || this.windowScheduled) return
    this.windowScheduled = true
    queueMicrotask(() => {
      this.windowScheduled = false
      const window = this.window
      if (window) this.setWindow(window.first, window.last, window.fast)
    })
  }

  /** Ветка и место в ней строки со сквозным индексом. */
  private resolve(
    index: number,
    layout = this.layout(),
  ): { node: TreeNode<TData, TRow, TQuery>; local: number } | undefined {
    if (index < 0) return undefined
    let rest = index
    let current = layout
    descend: for (;;) {
      let cursor = 0
      for (const child of current.children) {
        const own = child.local - cursor + 1
        if (rest < own) return { node: current.node, local: cursor + rest }
        rest -= own
        cursor = child.local + 1
        if (rest < child.layout.size) {
          current = child.layout
          continue descend
        }
        rest -= child.layout.size
      }
      const local = cursor + rest
      return local < current.count ? { node: current.node, local } : undefined
    }
  }

  /** Сквозной индекс строки ветки; `-1` — ветка не в раскладке. */
  private globalOf(parent: string | undefined, local: number): number {
    const find = (
      layout: Layout<TData, TRow, TQuery>,
      base: number,
    ): number => {
      if (layout.node.parentId === parent) {
        let before = 0
        for (const child of layout.children) {
          if (child.local >= local) break
          before += child.layout.size
        }
        return base + local + before
      }
      let before = 0
      for (const child of layout.children) {
        const start = base + child.local + 1 + before
        const found = find(child.layout, start)
        if (found !== -1) return found
        before += child.layout.size
      }
      return -1
    }
    return find(this.layout(), 0)
  }

  private openNodes(): Set<TreeNode<TData, TRow, TQuery>> {
    const open = new Set<TreeNode<TData, TRow, TQuery>>()
    const visit = (layout: Layout<TData, TRow, TQuery>) => {
      open.add(layout.node)
      for (const child of layout.children) visit(child.layout)
    }
    visit(this.layout())
    return open
  }

  count(): number {
    return this.layout().size
  }

  rowAt(index: number): TRow | undefined {
    const place = this.resolve(index)
    return place && place.node.store.rowAt(place.local)
  }

  rowById(id: string): TRow | undefined {
    const position = this.positions.get(id)
    return position && this.nodes.get(position.parent)?.store.rowById(id)
  }

  indexOf(id: string): number {
    const position = this.positions.get(id)
    if (!position) return -1
    const node = this.nodes.get(position.parent)
    if (node?.store.indexOf(id) !== position.local) return -1
    return this.globalOf(position.parent, position.local)
  }

  /** `aria-*` дерева по сквозному индексу: уровень, место среди соседей, их число. */
  ariaAt(index: number) {
    const place = this.resolve(index)
    return place
      ? {
          level: place.node.depth + 1,
          posInSet: place.local + 1,
          setSize: place.node.store.count(),
        }
      : undefined
  }

  /** Окно тела по веткам; ветки вне окна запросов не держат. */
  setWindow(first: number, last: number, fast = false) {
    this.window = { first, last, fast }
    const ranges = new Map<
      TreeNode<TData, TRow, TQuery>,
      { first: number; last: number }
    >()
    const end = Math.min(last, this.count() - 1)
    for (let index = Math.max(first, 0); index <= end; index++) {
      const place = this.resolve(index)
      if (!place) continue
      const range = ranges.get(place.node)
      if (!range)
        ranges.set(place.node, { first: place.local, last: place.local })
      else range.last = place.local
    }
    const pinned = new Map<TreeNode<TData, TRow, TQuery>, number[]>()
    for (const index of this.pinned) {
      const place = this.resolve(index)
      if (place)
        pinned.set(place.node, [...(pinned.get(place.node) ?? []), place.local])
    }
    this.windowed = new Set(ranges.keys())
    for (const node of this.nodes.values()) {
      node.store.setPinned(pinned.get(node) ?? [])
      const range = ranges.get(node)
      if (range) node.store.setWindow(range.first, range.last, fast)
      else node.store.setWindow(0, -1, fast)
    }
    this.evict()
  }

  /** Строки, чьи блоки держатся, — сквозными индексами. */
  setPinned(indices: number[]) {
    this.pinned = indices
  }

  setMaxBlocks(maxBlocks: number) {
    this.maxBlocks = maxBlocks
    this.evict()
  }

  /**
   * Общий предел: первыми — блоки свёрнутых веток, затем давно не нужные. Свёрнутая ветка без
   * блоков уходит целиком.
   */
  private evict() {
    const open = this.openNodes()
    let total = 0
    const candidates: {
      node: TreeNode<TData, TRow, TQuery>
      index: number
      used: number
      closed: boolean
    }[] = []
    for (const node of this.nodes.values()) {
      for (const block of node.store.loadedBlocks()) {
        total++
        if (!block.kept)
          candidates.push({ node, ...block, closed: !open.has(node) })
      }
    }
    let excess = total - this.maxBlocks
    if (excess <= 0) {
      this.prune(open)
      return
    }
    candidates.sort(
      (a, b) => Number(b.closed) - Number(a.closed) || a.used - b.used,
    )
    const expanded = this.options.expanded()
    for (const candidate of candidates) {
      if (excess <= 0) break
      for (const row of candidate.node.store.dropBlock(candidate.index)) {
        const id = this.options.idOf(row)
        if (!expanded.has(id)) this.positions.delete(id)
      }
      excess--
    }
    this.version++
    this.prune(open)
  }

  private prune(open: Set<TreeNode<TData, TRow, TQuery>>) {
    for (const [id, node] of this.nodes) {
      if (node === this.root || open.has(node)) continue
      if (node.store.loadedBlocks().length > 0) continue
      node.store.dispose()
      this.nodes.delete(id)
    }
  }

  failures(): TreeFailure[] {
    const result: TreeFailure[] = []
    for (const node of this.nodes.values()) {
      for (const failure of node.store.failures()) {
        const start = this.globalOf(node.parentId, failure.start)
        if (start === -1) continue
        result.push({
          start,
          end: this.globalOf(node.parentId, failure.end - 1) + 1,
          reason: failure.reason,
          retry: () => node.store.retry(failure.index),
        })
      }
    }
    return result.sort((a, b) => a.start - b.start)
  }

  failedEmpty(): boolean {
    return this.root.store.failedEmpty()
  }

  hasLoaded(): boolean {
    return this.root.store.hasLoaded()
  }

  retryAll() {
    for (const node of this.nodes.values()) node.store.retryAll()
  }

  /** Итог известен у корней и у каждой раскрытой ветки. */
  isTotalKnown(): boolean {
    return [...this.openNodes()].every(node => node.store.isTotalKnown())
  }

  /** Строки окна во всех ветках окна: пришли, идут или блок отказал. */
  windowState(): 'loading' | 'loaded' | { failed: string | undefined } {
    if (!this.window || this.windowed.size === 0) return 'loading'
    let loading = false
    for (const node of this.windowed) {
      const state = node.store.windowState()
      if (typeof state === 'object') return state
      if (state === 'loading') loading = true
    }
    return loading ? 'loading' : 'loaded'
  }

  replaceRow(index: number, row: TRow) {
    const place = this.resolve(index)
    if (!place) return
    place.node.store.replaceRow(place.local, row)
    this.version++
  }

  dispose() {
    for (const node of this.nodes.values()) node.store.dispose()
  }

  suspend() {
    this.suspended = true
    for (const node of this.nodes.values()) node.store.suspend()
  }

  resume() {
    this.suspended = false
    for (const node of this.nodes.values()) node.store.resume()
  }

  /** Строки корней: итог или, пока он неизвестен, строки списка корней. */
  rootCount(): number {
    return this.root.store.count()
  }

  retry(blockIndex: number) {
    this.root.store.retry(blockIndex)
  }
}
