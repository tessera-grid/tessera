/**
 * Модель раскрытия из прошлой (ADR 0070): заново обходятся только корни, затронутые
 * сменой модели на входе или среза `expanded`; участки остальных копируются. Первая
 * сборка, «раскрыто всё», смена числа корней и больше половины затронутых корней —
 * модель TanStack. Смена `data` с записанной сменой модели (ADR 0194) копирует участки
 * корней с прежними детьми при любом числе корней.
 */
import type { RowData, Table, TableFeatures } from '../../types'
import { dataModeOf, isPaginationActive } from '../../core/dataMode'
import { rowModelChangeOf } from '../../core/dataChanges'
import type { NarrowState } from '../../core/definePlugin'
import { recordRowChange } from '../../core/rowChanges'
import { passChildren } from '../../core/rowEngine/displayChildren'
import { walkExpanded } from './expandRows'

interface ExpandRow {
  id: string
  original: unknown
  parentId?: string
  subRows: ExpandRow[]
  getIsExpanded: () => boolean
}

interface ExpandModel {
  rows: ExpandRow[]
  flatRows: ExpandRow[]
  rowsById: Record<string, ExpandRow>
}

type Expanded = true | Record<string, boolean>

interface ExpandTable {
  atoms: { expanded?: { get: () => Expanded | undefined } }
  options: {
    getIsRowExpanded?: unknown
  }
  getPreExpandedRowModel: () => ExpandModel
}

interface Built {
  input: ExpandModel
  expanded: Expanded
  paginate: unknown
  output: ExpandModel
  /** Из результата можно собрать следующий инкрементом. */
  patchable: boolean
  /**
   * Начало участка каждого корня в `output.rows`, последний элемент — длина; после
   * полной сборки считается перед первым инкрементом.
   */
  starts?: Int32Array
}

const NO_EXPANDED: Record<string, boolean> = {}

/**
 * Модель раскрывает строки сама: клиентская страница режется по корням, и раскрывает
 * модель страницы, а эта отдаёт вход как есть (ADR 0169, §6).
 */
const expandsHere = (table: unknown) =>
  !isPaginationActive(table) || dataModeOf(table, 'pagination') === 'server'

/**
 * Выключенная модель дерева показывает одни корни, сохранённый срез `expanded` не
 * меняется (ADR 0119). Модель включена, если её включила хоть одна запись.
 */
export const narrowExpandingOff: NarrowState = (value, _table, context) =>
  context.options.enableExpanding === false ? NO_EXPANDED : value
/** Сколько строк вставлять одним `splice`: аргументы вызова ограничены стеком. */
const SPLICE_LIMIT = 10_000

const isExpandedId = (expanded: Record<string, boolean>, id: string) =>
  Object.hasOwn(expanded, id) && !!expanded[id]

/**
 * Полная сборка — как модель раскрытия TanStack: без раскрытых строк и когда раскрывает страница
 * — вход как есть, иначе строки по детям показа.
 */
const expandModel = (
  table: ExpandTable,
  input: ExpandModel,
  expanded: Expanded,
): ExpandModel => {
  if (
    !input.rows.length ||
    (expanded !== true && !Object.keys(expanded).length) ||
    !expandsHere(table)
  ) {
    return input
  }
  const rows: ExpandRow[] = []
  for (const row of input.rows) walkExpanded(input, row, rows)
  const output = {
    rows,
    flatRows: input.flatRows,
    get rowsById() {
      return input.rowsById
    },
  }
  passChildren(output, input)
  return output
}

/** Начала участков корней в выходных строках. */
const rootStarts = (
  roots: readonly ExpandRow[],
  rows: readonly ExpandRow[],
) => {
  const starts = new Int32Array(roots.length + 1)
  let root = 0
  for (let i = 0; i < rows.length && root < roots.length; i++) {
    if (rows[i] === roots[root]) {
      starts[root++] = i
    }
  }
  starts[roots.length] = rows.length
  return starts
}

/** Индексы корней, затронутых сменой входа или `expanded`; `undefined` — нужна полная сборка. */
const affectedRoots = (
  last: Built & { starts: Int32Array },
  input: ExpandModel,
  expanded: Record<string, boolean>,
) => {
  const roots = input.rows
  const lastRoots = last.input.rows
  const affected = new Set<number>()
  const limit = roots.length / 2
  for (let i = 0; i < roots.length; i++) {
    if (roots[i] !== lastRoots[i]) {
      affected.add(i)
      if (affected.size > limit) {
        return undefined
      }
    }
  }
  if (expanded !== last.expanded) {
    const lastExpanded = last.expanded as Record<string, boolean>
    const ids = new Set([
      ...Object.keys(lastExpanded),
      ...Object.keys(expanded),
    ])
    for (const id of ids) {
      if (isExpandedId(lastExpanded, id) === isExpandedId(expanded, id)) {
        continue
      }
      // Строки нет в модели — раскрывать нечего; корень не найден — сборка заново.
      let row = input.rowsById[id]
      if (!row) {
        continue
      }
      while (row?.parentId !== undefined) {
        row = input.rowsById[row.parentId]
      }
      const at = row ? roots.indexOf(row) : -1
      if (at < 0) {
        return undefined
      }
      affected.add(at)
      if (affected.size > limit) {
        return undefined
      }
    }
  }
  return [...affected].sort((a, b) => a - b)
}

export const createIncrementalExpandedRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as ExpandTable
    let last: Built | undefined

    const full = (
      input: ExpandModel,
      expanded: Expanded,
      paginate: unknown,
    ): Built => {
      const expands = expandsHere(t)
      const output = expandModel(t, input, expanded)
      return {
        input,
        expanded,
        paginate,
        output,
        patchable: expands && expanded !== true,
      }
    }

    const patch = (
      prev: Built & { starts: Int32Array },
      input: ExpandModel,
      expanded: Record<string, boolean>,
      paginate: unknown,
    ): Built | undefined => {
      const affected = affectedRoots(prev, input, expanded)
      if (!affected) {
        return undefined
      }
      const roots = input.rows
      // Одна копия прошлого результата; участки затронутых корней заменяются с конца —
      // начала участков перед ними не сдвигаются.
      const rows = prev.output.rows.slice()
      const starts = prev.starts.slice()
      for (let k = affected.length - 1; k >= 0; k--) {
        const at = affected[k]!
        const from = prev.starts[at]!
        const removed = prev.starts[at + 1]! - from
        const piece: ExpandRow[] = []
        walkExpanded(input, roots[at]!, piece)
        rows.splice(from, removed)
        for (let i = 0; i < piece.length; i += SPLICE_LIMIT) {
          rows.splice(from + i, 0, ...piece.slice(i, i + SPLICE_LIMIT))
        }
        const shift = piece.length - removed
        if (shift !== 0) {
          for (let i = at + 1; i <= roots.length; i++) {
            starts[i]! += shift
          }
        }
      }
      // Первая строка, чей id отличается от прежней, — подсказка виртуализатору (ADR 0145).
      const before = prev.output.rows
      const end = Math.min(
        starts[affected[affected.length - 1]! + 1]!,
        before.length,
      )
      let from = prev.starts[affected[0]!]!
      while (from < end && rows[from]!.id === before[from]!.id) {
        from++
      }
      recordRowChange(rows, before, from)
      return {
        input,
        expanded,
        paginate,
        output: {
          rows,
          flatRows: input.flatRows,
          get rowsById() {
            return input.rowsById
          },
        },
        patchable: true,
        starts,
      }
    }

    /** Смена `data` (ADR 0194): корень с прежними детьми — прежний участок, прочие — обход. */
    const patchData = (
      prev: Built & { starts: Int32Array },
      input: ExpandModel,
      expanded: Expanded,
      paginate: unknown,
    ): Built => {
      const roots = input.rows
      const prevRoots = prev.input.rows
      const prevAt = new Map<string, number>()
      for (let j = 0; j < prevRoots.length; j++) prevAt.set(prevRoots[j]!.id, j)
      const before = prev.output.rows
      const rows: ExpandRow[] = []
      const starts = new Int32Array(roots.length + 1)
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i]!
        starts[i] = rows.length
        const j = prevAt.get(root.id)
        const old = j === undefined ? undefined : prevRoots[j]
        // Сдвинутый корень — новый объект с прежними детьми: участок прежний.
        if (old && (old === root || old.subRows === root.subRows)) {
          rows.push(root)
          for (let k = prev.starts[j!]! + 1; k < prev.starts[j! + 1]!; k++) {
            rows.push(before[k]!)
          }
        } else {
          walkExpanded(input, root, rows)
        }
      }
      starts[roots.length] = rows.length
      // Копия строки с теми же данными (родитель ответа ленивых детей) — не смена места.
      let from = 0
      const end = Math.min(rows.length, before.length)
      while (
        from < end &&
        (rows[from] === before[from] ||
          (rows[from]!.id === before[from]!.id &&
            rows[from]!.original === before[from]!.original))
      ) {
        from++
      }
      recordRowChange(rows, before, from)
      return {
        input,
        expanded,
        paginate,
        output: {
          rows,
          flatRows: input.flatRows,
          get rowsById() {
            return input.rowsById
          },
        },
        patchable: expanded !== true,
        starts,
      }
    }

    return (read: () => unknown) => {
      const input = read() as ExpandModel
      const expanded = t.atoms.expanded?.get() ?? NO_EXPANDED
      const paginate = expandsHere(t)
      const prev = last
      if (
        prev &&
        prev.input === input &&
        prev.expanded === expanded &&
        prev.paginate === paginate
      ) {
        return prev.output as never
      }
      // «Раскрыто всё» тоже: участки корней с прежними детьми переходят.
      const dataChanged =
        prev &&
        paginate &&
        prev.paginate === paginate &&
        expanded === prev.expanded &&
        !t.options.getIsRowExpanded &&
        (expanded === true || Object.keys(expanded).length > 0) &&
        rowModelChangeOf(input)?.prev === prev.input
      if (dataChanged) {
        last = patchData(
          Object.assign(prev, {
            starts:
              prev.starts ?? rootStarts(prev.input.rows, prev.output.rows),
          }),
          input,
          expanded,
          paginate,
        )
        return last.output as never
      }
      const incremental =
        prev?.patchable &&
        prev.paginate === paginate &&
        expanded !== true &&
        !t.options.getIsRowExpanded &&
        input.rows.length === prev.input.rows.length &&
        Object.keys(expanded).length > 0
          ? patch(
              Object.assign(prev, {
                starts:
                  prev.starts ?? rootStarts(prev.input.rows, prev.output.rows),
              }),
              input,
              expanded,
              paginate,
            )
          : undefined
      last = incremental ?? full(input, expanded, paginate)
      return last.output as never
    }
  }
