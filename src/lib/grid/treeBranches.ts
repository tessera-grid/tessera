/**
 * Ветки линий дерева (ADR 0102, §2): у каких уровней строки ниже есть сёстры. Один
 * обратный проход по модели в порядке обхода дерева, без id и объекта на строку.
 */
interface TreeRow {
  depth: number
}

export interface TreeLinesIndex {
  /** Уровни 1…глубина: `1` — ниже есть строка той же глубины раньше, чем мельче. */
  branch: (index: number) => string
  /** Следом идёт ребёнок строки: линия детей выходит из неё. */
  open: (index: number) => boolean
}

/** Глубже маска не считается: уровни дальше рисуются как законченные. */
const MAX_DEPTH = 30

export const getTreeLines = (rows: readonly TreeRow[]): TreeLinesIndex => {
  const masks = new Int32Array(rows.length)
  // Бит k: после текущей строки есть строка глубины k раньше, чем строка мельче k.
  let seen = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const depth = Math.min(rows[i].depth, MAX_DEPTH)
    masks[i] = seen & ((1 << (depth + 1)) - 2)
    seen = (seen & ((1 << depth) - 1)) | (1 << depth)
  }
  return {
    branch: index => {
      const depth = Math.min(rows[index].depth, MAX_DEPTH)
      let branch = ''
      for (let level = 1; level <= depth; level++)
        branch += masks[index] & (1 << level) ? '1' : '0'
      return branch
    },
    open: index =>
      index + 1 < rows.length && rows[index + 1].depth > rows[index].depth,
  }
}
