/**
 * Геометрия выделения ячеек по индексам (ADR 0146, §2): диапазоны с включением и
 * исключением — в непересекающиеся прямоугольники, как у фичи TanStack.
 */

export interface SelectionBounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

export interface BoundsOperation extends SelectionBounds {
  operation: 'include' | 'exclude'
}

export const isWithinBounds = (
  bounds: readonly SelectionBounds[],
  rowIndex: number,
  columnIndex: number,
): boolean => {
  for (const bound of bounds) {
    if (
      rowIndex >= bound.minRowIndex &&
      rowIndex <= bound.maxRowIndex &&
      columnIndex >= bound.minColumnIndex &&
      columnIndex <= bound.maxColumnIndex
    ) {
      return true
    }
  }
  return false
}

const intersect = (
  a: SelectionBounds,
  b: SelectionBounds,
): SelectionBounds | undefined => {
  const minRowIndex = Math.max(a.minRowIndex, b.minRowIndex)
  const maxRowIndex = Math.min(a.maxRowIndex, b.maxRowIndex)
  const minColumnIndex = Math.max(a.minColumnIndex, b.minColumnIndex)
  const maxColumnIndex = Math.min(a.maxColumnIndex, b.maxColumnIndex)
  return minRowIndex <= maxRowIndex && minColumnIndex <= maxColumnIndex
    ? { minRowIndex, maxRowIndex, minColumnIndex, maxColumnIndex }
    : undefined
}

/** `source` без `cut`: до четырёх прямоугольников — сверху, снизу, слева, справа. */
const subtract = (
  source: SelectionBounds,
  cut: SelectionBounds,
): SelectionBounds[] => {
  const common = intersect(source, cut)
  if (!common) return [source]
  const parts: SelectionBounds[] = []
  if (source.minRowIndex < common.minRowIndex) {
    parts.push({ ...source, maxRowIndex: common.minRowIndex - 1 })
  }
  if (common.maxRowIndex < source.maxRowIndex) {
    parts.push({ ...source, minRowIndex: common.maxRowIndex + 1 })
  }
  const band = {
    minRowIndex: common.minRowIndex,
    maxRowIndex: common.maxRowIndex,
  }
  if (source.minColumnIndex < common.minColumnIndex) {
    parts.push({
      ...band,
      minColumnIndex: source.minColumnIndex,
      maxColumnIndex: common.minColumnIndex - 1,
    })
  }
  if (common.maxColumnIndex < source.maxColumnIndex) {
    parts.push({
      ...band,
      minColumnIndex: common.maxColumnIndex + 1,
      maxColumnIndex: source.maxColumnIndex,
    })
  }
  return parts
}

/** Два соседних прямоугольника с общей стороной — один. */
const joined = (
  a: SelectionBounds,
  b: SelectionBounds,
): SelectionBounds | undefined => {
  if (
    a.minRowIndex === b.minRowIndex &&
    a.maxRowIndex === b.maxRowIndex &&
    (a.maxColumnIndex + 1 === b.minColumnIndex ||
      b.maxColumnIndex + 1 === a.minColumnIndex)
  ) {
    return {
      minRowIndex: a.minRowIndex,
      maxRowIndex: a.maxRowIndex,
      minColumnIndex: Math.min(a.minColumnIndex, b.minColumnIndex),
      maxColumnIndex: Math.max(a.maxColumnIndex, b.maxColumnIndex),
    }
  }
  if (
    a.minColumnIndex === b.minColumnIndex &&
    a.maxColumnIndex === b.maxColumnIndex &&
    (a.maxRowIndex + 1 === b.minRowIndex || b.maxRowIndex + 1 === a.minRowIndex)
  ) {
    return {
      minRowIndex: Math.min(a.minRowIndex, b.minRowIndex),
      maxRowIndex: Math.max(a.maxRowIndex, b.maxRowIndex),
      minColumnIndex: a.minColumnIndex,
      maxColumnIndex: a.maxColumnIndex,
    }
  }
  return undefined
}

const byPosition = (a: SelectionBounds, b: SelectionBounds) =>
  a.minRowIndex - b.minRowIndex ||
  a.minColumnIndex - b.minColumnIndex ||
  a.maxRowIndex - b.maxRowIndex ||
  a.maxColumnIndex - b.maxColumnIndex

const mergeAdjacent = (input: SelectionBounds[]): SelectionBounds[] => {
  const result = input.slice()
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const merged = joined(result[i]!, result[j]!)
      if (!merged) continue
      result.splice(j, 1)
      result[i] = merged
      i = -1
      break
    }
  }
  return result.sort(byPosition)
}

/** Диапазоны по порядку — в непересекающиеся выделенные прямоугольники. */
export const applyBoundsOperations = (
  operations: readonly BoundsOperation[],
): SelectionBounds[] => {
  let selected: SelectionBounds[] = []
  for (const { operation, ...bounds } of operations) {
    if (operation === 'exclude') {
      selected = mergeAdjacent(selected.flatMap(b => subtract(b, bounds)))
      continue
    }
    let fragments = [bounds]
    for (const existing of selected) {
      fragments = fragments.flatMap(f => subtract(f, existing))
      if (!fragments.length) break
    }
    if (fragments.length) selected = mergeAdjacent([...selected, ...fragments])
  }
  return selected
}
