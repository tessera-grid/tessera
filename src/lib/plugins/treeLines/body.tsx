/**
 * Вклад линий дерева в тело (ADR 0170, §5): ветки строк окна — по модели строк или
 * раскладке серверной модели (ADR 0161) и их проекция при броске (ADR 0108), слой в
 * ячейке отступа, атрибут корня темы и линии скелета.
 */
import type {
  BodyContributions,
  SkeletonTreePlace,
  WindowContext,
} from '../../core/bodyContributions'
import type { DropPreview } from '../../core/dragSession'
import { TreeLines } from '../../ui/TreeLines/TreeLinesLayer'
import {
  getTreeLines,
  projectTreeLines,
  type TreeLinesIndex,
  treeLinesOf,
} from './branches'

/** Линии строки: ветки уровней и линия к детям. */
interface RowLines {
  branch?: string
  open?: boolean
}

interface WindowLines {
  index: TreeLinesIndex
  drop: DropPreview | null
  /** Проекция окна при броске: одна на окно, а не на строку. */
  projection: (
    first: number,
    last: number,
  ) => Pick<TreeLinesIndex, 'branch' | 'open'>
}

/** Позиция строки `index` после переноса `from` → `to` (как `arrayMove`). */
const positionAfterMove = (index: number, from: number, to: number) => {
  if (index === from) return to
  if (from < to && index > from && index <= to) return index - 1
  if (from > to && index >= to && index < from) return index + 1
  return index
}

/** Индекс линий меняется только со строками, раскладкой источника и их числом. */
const indexes = new WeakMap<object, { key: unknown[]; index: TreeLinesIndex }>()

const indexOf = ({ rows, rowSource, rowCount }: WindowContext) => {
  const sourceLines = rowSource.treeLines
  const key = [rows, sourceLines, rowCount]
  const cached = indexes.get(rowSource)
  if (cached && cached.key.every((part, at) => part === key[at])) {
    return cached.index
  }
  const index = sourceLines
    ? treeLinesOf(rowCount, sourceLines)
    : getTreeLines(rows)
  indexes.set(rowSource, { key, index })
  return index
}

const computeLines = (context: WindowContext): WindowLines => {
  const index = indexOf(context)
  const { drop } = context
  let cached:
    | {
        first: number
        last: number
        lines: Pick<TreeLinesIndex, 'branch' | 'open'>
      }
    | undefined
  const projection = (first: number, last: number) => {
    if (cached?.first !== first || cached.last !== last) {
      cached = {
        first,
        last,
        lines: projectTreeLines(
          index,
          drop!,
          Math.max(0, first - 1),
          Math.min(index.count - 1, last + 1),
        ),
      }
    }
    return cached.lines
  }
  return { index, drop, projection }
}

const rowLinesOf = (
  data: WindowLines,
  index: number,
  { first, last }: { first: number; last: number },
): RowLines => {
  const { drop } = data
  if (!drop) {
    return { branch: data.index.branch(index), open: data.index.open(index) }
  }
  // Линии окна «как после броска» (ADR 0108, §4), и на недопустимом месте (ADR 0137, §4).
  const projected = data.projection(first, last)
  const position = positionAfterMove(index, drop.from, drop.to)
  return { branch: projected.branch(position), open: projected.open(position) }
}

export const treeLinesBody: BodyContributions = {
  window: {
    id: 'treeLines',
    compute: computeLines,
    row: rowLinesOf,
    // Незагруженная строка — скелет с линиями её места (ADR 0161, §2).
    skeleton: (
      data: WindowLines,
      index,
      context,
    ): SkeletonTreePlace | undefined => {
      const depth = data.index.depth(index)
      if (depth < 0) return undefined
      const lines = rowLinesOf(data, index, context)
      return { depth, branch: lines.branch ?? '', open: !!lines.open }
    },
  },
  cell: {
    id: 'treeLines',
    slices: [],
    select: () => null,
    render: () => null,
    // Слой стоит и без линий: ушедшие части в нём гаснут (ADR 0108, PV11); у скелета —
    // только с линиями.
    layer: ({ isIndent, depth, window, skeleton }) => {
      if (!isIndent) return null
      const lines = (window?.treeLines as RowLines | undefined) ?? skeleton
      if (lines?.branch === undefined) return null
      const shown = depth > 0 || !!lines.open
      if (skeleton && !shown) return null
      return {
        node: <TreeLines branch={lines.branch} open={!!lines.open} />,
        attrs: shown ? { 'data-tree-depth': depth } : undefined,
      }
    },
  },
  root: {
    id: 'treeLines',
    // С линиями дерева шаг отступа — свой; шаг приложения на теме главнее (ADR 0102).
    themeAttrs: () => ({ 'data-tree-lines': true }),
  },
}
