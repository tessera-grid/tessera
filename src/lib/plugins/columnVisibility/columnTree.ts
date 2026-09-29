/**
 * Модель меню колонок (ADR 0035, CV3–CV13): дерево пользовательских колонок в
 * порядке отображения, состояние галочек, переключение с защитой последней видимой
 * колонки и фильтр поиска. Чистые функции над колонками TanStack.
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

const labelOf = (column: VisibilityColumn) =>
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
const countVisibleUserLeaves = (table: VisibilityTable): number =>
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
  const visible = node.leaves.filter(leaf => leaf.getIsVisible()).length
  if (visible === node.leaves.length) return 'checked'
  return visible === 0 ? 'unchecked' : 'indeterminate'
}

/**
 * Что сделает клик: показать скрываемые скрытые листья, если хоть один скрыт, иначе
 * скрыть все скрываемые. `null` — клик недоступен (нечего менять или скрытие убрало
 * бы последнюю видимую колонку).
 */
export const getToggle = (
  node: ColumnTreeNode,
  table: VisibilityTable,
): { columnIds: string[]; visible: boolean } | null => {
  const hideable = node.leaves.filter(leaf => leaf.getCanHide())
  const hidden = hideable.filter(leaf => !leaf.getIsVisible())

  if (hidden.length > 0) {
    return { columnIds: hidden.map(leaf => leaf.id), visible: true }
  }
  if (hideable.length === 0) {
    return null
  }

  // Здесь все скрываемые листья узла видимы: после скрытия останутся остальные видимые.
  return countVisibleUserLeaves(table) - hideable.length === 0
    ? null
    : { columnIds: hideable.map(leaf => leaf.id), visible: false }
}

/**
 * Скрыть видимые скрываемые листья (действие «Скрыть» в заголовке, CV14). `null` —
 * скрывать нечего или скрытие убрало бы последнюю видимую колонку.
 */
export const getHide = (
  leaves: VisibilityColumn[],
  table: VisibilityTable,
): string[] | null => {
  const hiding = leaves.filter(
    leaf =>
      !leaf.getIsActionsColumn?.() && leaf.getCanHide() && leaf.getIsVisible(),
  )
  if (hiding.length === 0) {
    return null
  }
  return countVisibleUserLeaves(table) - hiding.length === 0
    ? null
    : hiding.map(leaf => leaf.id)
}

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
