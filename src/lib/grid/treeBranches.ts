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
  /** Состояние прохода на строке `index` (вместе с ней); за концом модели — пустое. */
  seenFrom: (index: number) => number
}

/** Глубже маска не считается: уровни дальше рисуются как законченные. */
const MAX_DEPTH = 30

const levelOf = (depth: number) => Math.min(depth, MAX_DEPTH)

/** Маска строки глубины `depth` по состоянию прохода после неё. */
const maskOf = (seen: number, depth: number) => seen & ((1 << (depth + 1)) - 2)

/** Состояние прохода с учётом строки глубины `depth`. */
const withRow = (seen: number, depth: number) =>
  (seen & ((1 << depth) - 1)) | (1 << depth)

const branchOf = (mask: number, depth: number) => {
  let branch = ''
  for (let level = 1; level <= depth; level++)
    branch += mask & (1 << level) ? '1' : '0'
  return branch
}

export const getTreeLines = (rows: readonly TreeRow[]): TreeLinesIndex => {
  const masks = new Int32Array(rows.length)
  // Бит k: после текущей строки есть строка глубины k раньше, чем строка мельче k.
  let seen = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const depth = levelOf(rows[i].depth)
    masks[i] = maskOf(seen, depth)
    seen = withRow(seen, depth)
  }
  return {
    branch: index => branchOf(masks[index], levelOf(rows[index].depth)),
    open: index =>
      index + 1 < rows.length && rows[index + 1].depth > rows[index].depth,
    // Биты 1…глубина−1 состояния после строки — её маска, бит глубины — она сама;
    // бит 0 в ветки не идёт.
    seenFrom: index => {
      if (index >= rows.length) return 0
      const depth = levelOf(rows[index].depth)
      return withRow(masks[index], depth)
    },
  }
}

export interface TreeLinesProjection {
  /** Модельные индексы: откуда строка взята и куда встанет (как `arrayMove`). */
  from: number
  to: number
  /** Глубина строки на новом месте. */
  depth: number
}

/**
 * Ветки окна так, будто строку уже бросили (ADR 0108, §4–§5): строка `from` стоит на
 * месте `to` с глубиной `depth`. Проход идёт от состояния первой строки, которая за
 * окном и за обоими концами переноса не сдвинулась, — без прохода по всей модели.
 * Индексы результата — позиции после переноса; `branch`/`open` — для позиций окна
 * `start…end`.
 */
export const projectTreeLines = (
  rows: readonly TreeRow[],
  lines: TreeLinesIndex,
  { from, to, depth }: TreeLinesProjection,
  start: number,
  end: number,
): Pick<TreeLinesIndex, 'branch' | 'open'> => {
  const last = rows.length - 1
  /** Модельный индекс строки на позиции `p` после переноса. */
  const source = (p: number) => {
    if (p === to) return from
    if (from < to && p >= from && p < to) return p + 1
    if (from > to && p > to && p <= from) return p - 1
    return p
  }
  const depthAt = (p: number) =>
    p === to ? depth : (rows[source(p)]?.depth ?? -1)

  const hi = Math.min(last, Math.max(end, from, to))
  // За `hi` позиции совпадают с моделью: состояние берётся из её прохода.
  let seen = lines.seenFrom(hi + 1)
  const masks = new Map<number, number>()
  for (let p = hi; p >= start; p--) {
    const level = levelOf(depthAt(p))
    if (p <= end) masks.set(p, maskOf(seen, level))
    seen = withRow(seen, level)
  }
  return {
    branch: p => branchOf(masks.get(p) ?? 0, levelOf(depthAt(p))),
    open: p => p + 1 <= last && depthAt(p + 1) > depthAt(p),
  }
}
