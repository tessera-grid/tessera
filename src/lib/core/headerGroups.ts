/**
 * Линейная сборка групп шапки (ADR 0209): тот же результат, что `buildHeaderGroups` TanStack
 * v9, без квадратичного подсчёта заглушек и без верхнего уровня, который TanStack строит на
 * нижней ступени и выбрасывает. Заголовки создаёт экспортированный `constructHeader`.
 */
import { constructHeader } from '@tanstack/react-table'

interface GroupColumn {
  id: string
  depth: number
  parent?: GroupColumn
  columns: GroupColumn[]
  getIsVisible?: () => boolean
}

interface GroupHeader {
  id: string
  column: GroupColumn
  colSpan: number
  rowSpan: number
  isPlaceholder: boolean
  subHeaders: GroupHeader[]
  headerGroup: unknown
}

interface HeaderGroup {
  depth: number
  id: string
  headers: GroupHeader[]
}

interface GroupTable {
  getAllColumns: () => GroupColumn[]
  getAllLeafColumns: () => GroupColumn[]
  getVisibleLeafColumns?: () => GroupColumn[]
  _orderByColumnPinning?: (
    items: GroupColumn[],
    getColumnId: (column: GroupColumn) => string,
  ) => GroupColumn[]
  _headerGroupInstanceInitFns: ((headerGroup: HeaderGroup) => void)[]
}

const isVisible = (column: GroupColumn) => column.getIsVisible?.() ?? true

const maxDepthOf = (columns: GroupColumn[], depth = 1): number => {
  let max = depth
  for (const column of columns) {
    if (isVisible(column) && column.columns.length)
      max = Math.max(max, maxDepthOf(column.columns, depth + 1))
  }
  return max
}

const groupId = (family: string | undefined, depth: number) =>
  family ? `${family}_${depth}` : String(depth)

const headerId = (
  family: string | undefined,
  depth: number,
  columnId: string | undefined,
  childId: string | undefined,
) => {
  let id = family ?? ''
  if (depth) id = id ? `${id}_${depth}` : String(depth)
  if (columnId) id = id ? `${id}_${columnId}` : columnId
  if (childId) id = id ? `${id}_${childId}` : childId
  return id
}

const groupLevel = (
  toGroup: GroupHeader[],
  depth: number,
  table: GroupTable,
  family: string | undefined,
  groups: HeaderGroup[],
) => {
  const headerGroup: HeaderGroup = {
    depth,
    id: groupId(family, depth),
    headers: [],
  }
  // Заголовки уровня выше; на нижней ступени их TanStack строит и выбрасывает — здесь не строятся.
  const parents: GroupHeader[] = []
  const created = new Map<GroupColumn, number>()
  for (let i = 0; i < toGroup.length; i++) {
    if (!(i in toGroup)) continue
    const child = toGroup[i]!
    if (depth > 0) {
      const last = parents[parents.length - 1]
      const isLeaf = child.column.depth === depth
      const placeholder = !(isLeaf && child.column.parent)
      const column = placeholder ? child.column : child.column.parent!
      if (last && last.column === column) last.subHeaders.push(child)
      else {
        const count = created.get(column) ?? 0
        const header = constructHeader(table as never, column as never, {
          id: headerId(family, depth, column.id, child.id),
          isPlaceholder: placeholder,
          placeholderId: placeholder ? String(count) : undefined,
          depth,
          index: parents.length,
        }) as unknown as GroupHeader
        created.set(column, count + 1)
        header.subHeaders.push(child)
        parents.push(header)
      }
    }
    headerGroup.headers.push(child)
    child.headerGroup = headerGroup
  }
  for (const init of table._headerGroupInstanceInitFns) init(headerGroup)
  groups.push(headerGroup)
  if (depth > 0) groupLevel(parents, depth - 1, table, family, groups)
}

const updateSpans = (headers: GroupHeader[]) => {
  for (const header of headers) {
    if (!isVisible(header.column)) continue
    let colSpan = 0
    if (header.subHeaders.length) {
      updateSpans(header.subHeaders)
      for (const child of header.subHeaders) {
        if (isVisible(child.column)) colSpan += child.colSpan
      }
    } else colSpan = 1
    header.colSpan = colSpan
    const only = header.subHeaders[0]
    if (
      header.isPlaceholder &&
      header.subHeaders.length === 1 &&
      only!.column === header.column
    ) {
      let rowSpan = 1
      let chain: GroupHeader | undefined = only
      while (chain) {
        chain.rowSpan = 0
        rowSpan++
        const next: GroupHeader | undefined = chain.subHeaders[0]
        chain =
          chain.subHeaders.length === 1 && next!.column === header.column
            ? next
            : undefined
      }
      header.rowSpan = rowSpan
    } else header.rowSpan = 1
  }
}

/** Группы шапки по колонкам — как `buildHeaderGroups` TanStack, линейно. */
export const buildHeaderGroupsLinear = (
  allColumns: GroupColumn[],
  columnsToGroup: GroupColumn[],
  table: GroupTable,
  family?: string,
): HeaderGroup[] => {
  const maxDepth = maxDepthOf(allColumns)
  const groups: HeaderGroup[] = []
  const bottom = new Array<GroupHeader>(columnsToGroup.length)
  for (let i = 0; i < columnsToGroup.length; i++) {
    if (!(i in columnsToGroup)) continue
    bottom[i] = constructHeader(table as never, columnsToGroup[i] as never, {
      depth: maxDepth,
      index: i,
    }) as unknown as GroupHeader
  }
  groupLevel(bottom, maxDepth - 1, table, family, groups)
  groups.reverse()
  updateSpans(groups[0]?.headers ?? [])
  return groups
}

/** Группы шапки таблицы: видимые листья в порядке закрепления — как `table_getHeaderGroups` TanStack. */
export const tableHeaderGroups = (table: unknown) => {
  const t = table as GroupTable
  const leaves = t.getVisibleLeafColumns?.() ?? t.getAllLeafColumns()
  const ordered =
    t._orderByColumnPinning?.(leaves, column => column.id) ?? leaves
  return buildHeaderGroupsLinear(t.getAllColumns(), ordered, t)
}
