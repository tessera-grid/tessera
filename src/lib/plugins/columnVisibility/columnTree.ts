/**
 * Модель меню колонок (ADR 0035, CV3–CV13; ADR 0133): дерево пользовательских колонок
 * в порядке отображения, состояние галочек, корень «Все колонки», переключение и
 * фильтр поиска. Чистые функции над колонками TanStack.
 */
export interface VisibilityColumn {
  id: string
  parent?: VisibilityColumn
  columnDef: { header?: unknown }
  getIsVisible: () => boolean
  getCanHide: () => boolean
  getIsActionsColumn?: () => boolean
  getIsPinned?: () => false | 'start' | 'end'
}

export interface VisibilityTable {
  getAllLeafColumns: () => VisibilityColumn[]
  getVisibleLeafColumns?: () => VisibilityColumn[]
}

export interface ColumnTreeNode {
  id: string
  label: string
  depth: number
  /** Листья узла (у листа — он сам). */
  leaves: VisibilityColumn[]
  children: ColumnTreeNode[]
}

export type CheckState = 'checked' | 'unchecked' | 'indeterminate'

/** Подпись колонки в меню: строковый заголовок или id. */
export const labelOf = (column: VisibilityColumn) =>
  typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id

const ancestorsOf = (column: VisibilityColumn) => {
  const chain: VisibilityColumn[] = []
  for (let node = column.parent; node; node = node.parent) {
    chain.unshift(node)
  }
  return chain
}

const PIN_ORDER = { start: 0, center: 1, end: 2 } as const

/** Пользовательские листья в порядке отображения: start-закреплённые → центр → end. */
export const getUserLeaves = (table: VisibilityTable): VisibilityColumn[] =>
  table
    .getAllLeafColumns()
    .filter(column => !column.getIsActionsColumn?.())
    .map((column, index) => ({
      column,
      index,
      side: PIN_ORDER[column.getIsPinned?.() || 'center'],
    }))
    .sort((a, b) => a.side - b.side || a.index - b.index)
    .map(({ column }) => column)

/** Сколько пользовательских колонок видно сейчас; мемоизированный список TanStack, если есть. */
export const countVisibleColumns = (table: VisibilityTable): number =>
  (
    table.getVisibleLeafColumns?.() ??
    table.getAllLeafColumns().filter(column => column.getIsVisible())
  ).filter(column => !column.getIsActionsColumn?.()).length

/**
 * Дерево по цепочкам родителей: соседние листья с общим предком попадают в один
 * узел группы. Если группа разорвана (лист закреплён отдельно), её части — разные
 * узлы, как и в шапке грида.
 */
export const buildColumnTree = (table: VisibilityTable): ColumnTreeNode[] => {
  const roots: ColumnTreeNode[] = []

  for (const leaf of getUserLeaves(table)) {
    let siblings = roots
    ancestorsOf(leaf).forEach((group, depth) => {
      let node = siblings.at(-1)
      if (!node || node.id !== group.id) {
        node = {
          id: group.id,
          label: labelOf(group),
          depth,
          leaves: [],
          children: [],
        }
        siblings.push(node)
      }
      node.leaves.push(leaf)
      siblings = node.children
    })
    siblings.push({
      id: leaf.id,
      label: labelOf(leaf),
      depth: ancestorsOf(leaf).length,
      leaves: [leaf],
      children: [],
    })
  }

  return roots
}

export const getCheckState = (node: ColumnTreeNode): CheckState => {
  const first = node.leaves[0]
  if (!first) return 'checked'
  const visible = first.getIsVisible()
  if (node.leaves.some(leaf => leaf.getIsVisible() !== visible))
    return 'indeterminate'
  return visible ? 'checked' : 'unchecked'
}

/**
 * Что сделает клик: показать скрываемые скрытые листья, если хоть один скрыт, иначе
 * скрыть все скрываемые. `null` — скрываемых листьев нет. Последнюю видимую колонку
 * скрыть можно: таблица покажет заглушку `columnsHidden` (ADR 0133).
 */
export const getToggle = (
  node: ColumnTreeNode,
): { columnIds: string[]; visible: boolean } | null => {
  const hideable = node.leaves.filter(leaf => leaf.getCanHide())
  const hidden = hideable.filter(leaf => !leaf.getIsVisible())

  if (hidden.length > 0) {
    return { columnIds: hidden.map(leaf => leaf.id), visible: true }
  }
  return hideable.length === 0
    ? null
    : { columnIds: hideable.map(leaf => leaf.id), visible: false }
}

/** Скрыть видимые скрываемые листья (действие «Скрыть» в заголовке, CV14). */
export const getHide = (leaves: VisibilityColumn[]): string[] | null => {
  const hiding = leaves.filter(
    leaf =>
      !leaf.getIsActionsColumn?.() && leaf.getCanHide() && leaf.getIsVisible(),
  )
  return hiding.length === 0 ? null : hiding.map(leaf => leaf.id)
}

const foundLeaves = (nodes: ColumnTreeNode[]): VisibilityColumn[] =>
  nodes.flatMap(node =>
    node.children.length > 0 ? foundLeaves(node.children) : node.leaves,
  )

/**
 * Корень «Все колонки» над деревом (ADR 0133, HA2–HA5): листья — скрываемые колонки
 * дерева (при поиске — найденного), так что состояние и клик — как у группы.
 */
export const getRootNode = (nodes: ColumnTreeNode[]): ColumnTreeNode => ({
  id: 'all',
  label: '',
  depth: -1,
  leaves: foundLeaves(nodes).filter(leaf => leaf.getCanHide()),
  children: nodes,
})

/** Показать все скрываемые скрытые колонки. */
export const getShowAll = (table: VisibilityTable): string[] =>
  getUserLeaves(table)
    .filter(leaf => leaf.getCanHide() && !leaf.getIsVisible())
    .map(leaf => leaf.id)

/**
 * Поиск по подписи без учёта регистра: совпавший узел остаётся со всеми потомками,
 * иначе узел остаётся, только если совпал кто-то из потомков.
 */
export const filterColumnTree = (
  nodes: ColumnTreeNode[],
  query: string,
): ColumnTreeNode[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return nodes
  }
  return nodes.flatMap(node => {
    if (node.label.toLowerCase().includes(needle)) {
      return [node]
    }
    const children = filterColumnTree(node.children, needle)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}
