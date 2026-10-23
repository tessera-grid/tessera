/**
 * Узлы перетаскивания колонок (ADR 0052): узел — нарисованный заголовок листа или
 * группы. Соседи — узлы того же родителя в той же зоне закрепления; переносится
 * только среди них, поэтому структура шапки не меняется. В плоской шапке все узлы —
 * листья верхнего уровня.
 */
import { isCoveredHeader, type SpanHeader } from './headerSpans'

export type PinZone = 'start' | 'end' | false

export interface NodeColumn {
  id: string
  parent?: NodeColumn
  columns: readonly unknown[]
  getIsPinned: () => PinZone
  getCanDrag: () => boolean
  getIsActionsColumn: () => boolean
  getDraggableIndex: () => number
}

export interface NodeHeader {
  id: string
  column: NodeColumn
  getLeafHeaders: () => NodeHeader[]
}

interface NodeTable {
  getHeaderGroups: () => { headers: NodeHeader[] }[]
}

/**
 * Листья узла. `getLeafHeaders` v9 возвращает и сам заголовок, и промежуточные, а у
 * растянутого листа вершина и нижний заголовок — одна колонка: убираем повторы.
 */
export const leafColumnsOf = (header: NodeHeader) => [
  ...new Map(
    header
      .getLeafHeaders()
      .filter(leaf => leaf.column.columns.length === 0)
      .map(leaf => [leaf.column.id, leaf.column] as const),
  ).values(),
]

/** Колонки узла: он сам, его подгруппы и листья — без повторов вершины растянутого листа. */
export const nodeColumnIdsOf = (header: NodeHeader) => [
  ...new Set(header.getLeafHeaders().map(item => item.column.id)),
]

/** Зона узла: закреплён, только если закреплены все его листья с одной стороны. */
export const zoneOf = (header: NodeHeader): PinZone => {
  const sides = new Set(leafColumnsOf(header).map(leaf => leaf.getIsPinned()))
  return sides.size === 1 ? [...sides][0] : false
}

/** Ключ группы соседей: родитель + зона. */
export const siblingKeyOf = (header: NodeHeader) =>
  `${header.column.parent?.id ?? ''}|${zoneOf(header)}`

/** Идентичность узла поверх сегментов: колонка + зона (сегменты одной группы различимы). */
export const nodeIdOf = (column: { id: string }, zone: PinZone) =>
  `${column.id}|${zone}`

/** Узлы предков заголовка (ближайший первым) — в его же зоне. */
export const ancestorNodeIdsOf = (header: NodeHeader) => {
  const zone = zoneOf(header)
  const ids: string[] = []
  for (let parent = header.column.parent; parent; parent = parent.parent) {
    ids.push(nodeIdOf(parent, zone))
  }
  return ids
}

/** Узел можно двигать: перетаскиваемый, не закреплён, не служебный. */
export const isMovableNode = (header: NodeHeader) =>
  header.column.getCanDrag() &&
  zoneOf(header) === false &&
  !header.column.getIsActionsColumn()

const siblingsCache = new WeakMap<object, Map<string, NodeHeader[]>>()

/** Нарисованные узлы по группам соседей, в визуальном порядке. */
export const getSiblingGroups = (table: NodeTable) => {
  const groups = table.getHeaderGroups()
  let cached = siblingsCache.get(groups)
  if (!cached) {
    cached = new Map()
    for (const group of groups) {
      for (const header of group.headers) {
        if (isCoveredHeader(header as unknown as SpanHeader)) continue
        const key = siblingKeyOf(header)
        cached.set(key, [...(cached.get(key) ?? []), header])
      }
    }
    siblingsCache.set(groups, cached)
  }
  return cached
}

export const siblingsOf = (table: NodeTable, header: NodeHeader) =>
  getSiblingGroups(table).get(siblingKeyOf(header)) ?? [header]

/**
 * Новый порядок листьев: блок `active` встаёт за блок `target` (вправо) или перед ним
 * (влево). `base` — текущий порядок листьев.
 */
export const moveBlock = (
  base: readonly string[],
  active: NodeHeader,
  target: NodeHeader,
  toRight: boolean,
) => {
  const moving = leafColumnsOf(active).map(leaf => leaf.id)
  const anchorIds = leafColumnsOf(target).map(leaf => leaf.id)
  const rest = base.filter(id => !moving.includes(id))
  const anchor = toRight
    ? rest.indexOf(anchorIds[anchorIds.length - 1]) + 1
    : rest.indexOf(anchorIds[0])
  return [...rest.slice(0, anchor), ...moving, ...rest.slice(anchor)]
}

/** Индекс узла для колбэка: индекс первого листа среди перетаскиваемых. */
export const draggableIndexOfNode = (header: NodeHeader) =>
  leafColumnsOf(header)[0]?.getDraggableIndex() ?? -1
