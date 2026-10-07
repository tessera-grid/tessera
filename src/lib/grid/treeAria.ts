/**
 * `aria-setsize` и `aria-posinset` строк `treegrid` (ADR 0065, W10): соседи — строки
 * того же родителя в модели строк. Счёт — по индексу строки в модели, без объекта на
 * строку.
 */
interface TreeRow {
  id: string
  depth: number
  parentId?: string
}

export interface TreeAriaIndex {
  setSize: (index: number) => number
  posInSet: (index: number) => number
}

/**
 * Модель в порядке обхода дерева: соседи строки глубины `d` — дети последней строки
 * глубины `d − 1`. `undefined` — порядок не древесный (родитель не перед строкой).
 */
const countInTreeOrder = (
  rows: readonly TreeRow[],
): TreeAriaIndex | undefined => {
  const group = new Int32Array(rows.length)
  const position = new Int32Array(rows.length)
  const sizes: number[] = []
  // По уровням: индекс последней строки и группа её детей (-1 — ещё не открыта).
  // id читается только у родителя проверяемой строки: у корней он не нужен.
  const lastIndex: number[] = []
  const childGroup: number[] = []
  let rootGroup = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const depth = row.depth
    let g: number
    if (depth === 0) {
      if (rootGroup < 0) rootGroup = sizes.push(0) - 1
      g = rootGroup
    } else {
      const parent = lastIndex[depth - 1]
      if (parent === undefined || rows[parent].id !== row.parentId)
        return undefined
      g = childGroup[depth - 1] ?? -1
      if (g < 0) {
        g = sizes.push(0) - 1
        childGroup[depth - 1] = g
      }
    }
    position[i] = ++sizes[g]
    group[i] = g
    lastIndex[depth] = i
    childGroup[depth] = -1
  }
  return {
    setSize: index => sizes[group[index]],
    posInSet: index => position[index],
  }
}

/** Запасной путь: соседи — строки с тем же `parentId` в порядке модели. */
const countByParentId = (rows: readonly TreeRow[]): TreeAriaIndex => {
  const sizes = new Map<string, number>()
  const position = new Int32Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].parentId ?? ''
    const count = (sizes.get(key) ?? 0) + 1
    sizes.set(key, count)
    position[i] = count
  }
  return {
    setSize: index => sizes.get(rows[index].parentId ?? '')!,
    posInSet: index => position[index],
  }
}

export const getTreeAria = (rows: readonly TreeRow[]): TreeAriaIndex =>
  countInTreeOrder(rows) ?? countByParentId(rows)
