/**
 * Стадия группировки движка строк (ADR 0200, §3–§4; EN15): плоские строки раскладываются по
 * группам своей стадией. Строка-группа создаётся `constructRow`, её поля и значения задаются
 * при создании; агрегаты считают определения колонки (`column.getAggregationFns()`). Ключи
 * групп и значения стадии переноса (ADR 0186, §3) — в словарях стадии, а не в кэшах строк.
 * `depth` и `parentId` листьев стадия назначает, как стоковая группировка. Смена `data` при
 * той же группировке пересобирает только затронутые группы (ADR 0194). У дерева на входе по
 * группам раскладываются корни, их ветки идут за ними.
 */
import { constructRow, makeObjectMap } from '@tanstack/react-table'

import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { RowDict, dictModel, editDictOf } from '../../core/rowEngine/rowDict'
import { positionOf } from '../../core/rowPosition'
import {
  groupMovesKey,
  readRowMoves,
  type RowMoves,
} from '../../shared/rowMoves'
import type { RowData, Table, TableFeatures } from '../../types'
import { childrenOf } from '../../core/rowEngine/displayChildren'

interface StageRow {
  id: string
  index: number
  depth: number
  parentId?: string
  original: unknown
  subRows: StageRow[]
  getValue: (columnId: string) => unknown
  groupingColumnId?: string
  groupingValue?: unknown
  leafRows?: StageRow[]
}

interface StageModel {
  rows: StageRow[]
  flatRows: StageRow[]
  rowsById: Record<string, StageRow>
}

interface AggregationContext {
  subRows: StageRow[]
  column: StageColumn
  columnId: string
  getValue: (row: StageRow) => unknown
  groupingRow: StageRow
  maxDepth: number
  rows: StageRow[]
  table: unknown
}

interface AggregationEntry {
  id?: string
  aggregationFn?: {
    aggregate: (context: AggregationContext) => unknown
    merge?: (
      context: AggregationContext & { subRowResults: unknown[] },
    ) => unknown
  }
}

interface StageColumn {
  id: string
  table: unknown
  columnDef: {
    getGroupingValue?: (
      original: unknown,
      index: number,
      row: unknown,
    ) => unknown
    aggregationFn?: unknown
    maxAggregationDepth?: number
  }
  getAggregationFns?: () => AggregationEntry[]
}

interface StageTable {
  atoms: { grouping?: { get: () => string[] | undefined } }
  options: { columns: unknown }
  getColumn: (id: string) => StageColumn | undefined
  getPreGroupedRowModel: () => StageModel
  autoResetExpanded?: () => void
  autoResetPageIndex?: () => void
}

const isFlat = (model: StageModel) =>
  model.flatRows.length === model.rows.length

/** Значение колонки строки: стадия переноса между группами главнее данных (ADR 0186, §3). */
const valueOf = (moves: RowMoves, row: StageRow, columnId: string) => {
  const staged = moves[row.id]?.group
  return staged && columnId in staged
    ? staged[columnId]
    : row.getValue(columnId)
}

/** Глубина агрегации — как у TanStack: неотрицательное целое, по умолчанию 0. */
const aggregationDepth = (value: number | undefined) =>
  value === undefined || Number.isNaN(value)
    ? 0
    : Math.max(0, Math.floor(value))

/**
 * Агрегат колонки строки-группы — как исполнитель агрегации TanStack, но через публичные
 * определения колонки. Строки агрегации — строки группы, а с `maxAggregationDepth` — их потомки
 * до этой глубины, как `normalizeUniqueAggregationRows` TanStack.
 */
const aggregateOf = (
  column: StageColumn,
  group: StageRow,
  subRows: StageRow[],
  rowsAt: (maxDepth: number) => StageRow[],
) => {
  const entries = column.getAggregationFns?.()
  if (!entries) return undefined
  const isMultiple = Array.isArray(column.columnDef.aggregationFn)
  const canMerge =
    subRows.length > 0 &&
    subRows.every(
      row => !!row.groupingColumnId && row.groupingColumnId !== column.id,
    )
  const context: AggregationContext = {
    subRows,
    column,
    columnId: column.id,
    getValue: row => row.getValue(column.id),
    groupingRow: group,
    maxDepth: aggregationDepth(column.columnDef.maxAggregationDepth),
    rows: rowsAt(aggregationDepth(column.columnDef.maxAggregationDepth)),
    table: column.table,
  }
  const subResultOf = (value: unknown, id: string | undefined) => {
    if (!isMultiple) return value
    if (!id || !value || typeof value !== 'object') return undefined
    return Object.hasOwn(value, id)
      ? (value as Record<string, unknown>)[id]
      : undefined
  }
  const execute = (entry: AggregationEntry) => {
    const definition = entry.aggregationFn
    if (!definition) return undefined
    if (canMerge && definition.merge) {
      return definition.merge({
        ...context,
        subRowResults: subRows.map(row =>
          subResultOf(row.getValue(column.id), entry.id),
        ),
      })
    }
    return definition.aggregate(context)
  }
  if (!isMultiple) return entries[0] ? execute(entries[0]) : undefined
  const result = makeObjectMap<unknown>()
  for (const entry of entries) {
    if (entry.id !== undefined) result[entry.id] = execute(entry)
  }
  return result
}

interface Layout {
  /** Модель входа: дети строки — её дети показа (ADR 0200, §4). */
  input: StageModel
  /** Колонки группировки, которые есть в таблице. */
  columns: string[]
  moves: RowMoves
  /** Вход плоский: строки группы — сами листья. */
  flat: boolean
  /** Значения `getGroupingValue` по строке — пока жив объект строки. */
  groupingValues: WeakMap<object, Map<string, unknown>>
}

const keyOf = (
  table: StageTable,
  layout: Layout,
  row: StageRow,
  columnId: string,
): string => {
  const staged = layout.moves[row.id]?.group
  if (staged && columnId in staged) return `${staged[columnId] as string}`
  const getGroupingValue = table.getColumn(columnId)?.columnDef.getGroupingValue
  if (!getGroupingValue) return `${row.getValue(columnId) as string}`
  let values = layout.groupingValues.get(row)
  if (!values) {
    values = new Map()
    layout.groupingValues.set(row, values)
  }
  if (!values.has(columnId)) {
    values.set(columnId, getGroupingValue(row.original, row.index, row))
  }
  return `${values.get(columnId) as string}`
}

/** Строки по ключу группы в порядке первого появления — как `groupBy` TanStack. */
const groupBy = (
  table: StageTable,
  layout: Layout,
  rows: readonly StageRow[],
  columnId: string,
) => {
  const groups = new Map<string, StageRow[]>()
  for (const row of rows) {
    const key = keyOf(table, layout, row, columnId)
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  return groups
}

/** Строка-группа: поля группы и значения задаются при создании, до публикации строки. */
const makeGroup = (
  table: StageTable,
  layout: Layout,
  place: { id: string; index: number; depth: number; parentId?: string },
  columnId: string,
  key: string,
  members: StageRow[],
  subRows: StageRow[],
): StageRow => {
  const { id, index, depth, parentId } = place
  const row = constructRow(
    table as never,
    id,
    members[0]!.original as never,
    index,
    depth,
    undefined,
    parentId,
  ) as unknown as StageRow
  const values = new Map<string, unknown>()
  Object.assign(row, {
    groupingColumnId: columnId,
    groupingValue: key,
    subRows,
    leafRows: layout.flat ? members : leavesOf(layout, members),
    getValue: (target: string) => {
      if (values.has(target)) return values.get(target)
      const level = layout.columns.indexOf(target)
      let value: unknown
      if (level !== -1 && level <= depth) {
        value = valueOf(layout.moves, members[0]!, target)
      } else {
        const column = table.getColumn(target)
        value = column
          ? aggregateOf(column, row, subRows, (maxDepth: number) =>
              layout.flat || maxDepth === 0
                ? members
                : leavesOf(layout, members, maxDepth),
            )
          : undefined
      }
      values.set(target, value)
      return value
    },
  })
  return row
}

interface Grouped {
  input: StageModel
  grouping: unknown
  columns: unknown
  movesKey: string
  layout: Layout
  output: StageModel
  /** Ключ верхней группы строки входа; собирается при первом инкременте. */
  topKeys?: Map<string, string>
  /** Начала участков верхних групп в `flatRows` выхода; собираются при первой замене на месте. */
  starts?: Int32Array
}

/** Строка данных под группой и её ветка: `depth` по месту, ветка идёт за строкой. */
const placeBranch = (
  layout: Layout,
  row: StageRow,
  depth: number,
  parentId: string | undefined,
  flatRows: StageRow[],
) => {
  row.depth = depth
  row.parentId = parentId
  flatRows.push(row)
  for (const child of childrenOf(layout.input, row)) {
    placeBranch(layout, child, depth + 1, row.id, flatRows)
  }
}

/** Листья веток — как `normalizeUniqueAggregationRows` TanStack до глубины `maxDepth`. */
const leavesOf = (
  layout: Layout,
  rows: readonly StageRow[],
  maxDepth = Infinity,
) => {
  const leaves: StageRow[] = []
  const visit = (row: StageRow, depth: number) => {
    const kids = childrenOf(layout.input, row)
    if (kids.length && depth < maxDepth) {
      for (const child of kids) visit(child, depth + 1)
    } else {
      leaves.push(row)
    }
  }
  for (const row of rows) visit(row, 0)
  return leaves
}

/** Раскладка уровня `depth` и ниже; листья получают свои `depth` и `parentId`. */
const groupUp = (
  table: StageTable,
  layout: Layout,
  rows: StageRow[],
  depth: number,
  parentId: string | undefined,
  flatRows: StageRow[],
): StageRow[] => {
  if (depth >= layout.columns.length) {
    for (const row of rows) placeBranch(layout, row, depth, parentId, flatRows)
    return rows
  }
  const columnId = layout.columns[depth]!
  const out: StageRow[] = []
  let index = 0
  for (const [key, members] of groupBy(table, layout, rows, columnId)) {
    out.push(
      buildGroup(
        table,
        layout,
        key,
        members,
        index++,
        depth,
        parentId,
        flatRows,
      ),
    )
  }
  return out
}

/** Группа уровня `depth` с поддеревом; строки поддерева — в `flatRows` после неё. */
const buildGroup = (
  table: StageTable,
  layout: Layout,
  key: string,
  members: StageRow[],
  index: number,
  depth: number,
  parentId: string | undefined,
  flatRows: StageRow[],
): StageRow => {
  const columnId = layout.columns[depth]!
  const local = `${columnId}:${key}`
  const id = parentId ? `${parentId}>${local}` : local
  const at = flatRows.length
  flatRows.push(undefined as never)
  const subRows = groupUp(table, layout, members, depth + 1, id, flatRows)
  const group = makeGroup(
    table,
    layout,
    { id, index, depth, parentId },
    columnId,
    key,
    members,
    subRows,
  )
  flatRows[at] = group
  return group
}

const byId = (flatRows: readonly StageRow[]) => {
  const rowsById = makeObjectMap<StageRow>()
  for (const row of flatRows) rowsById[row.id] = row
  return rowsById
}

const pushPreorder = (row: StageRow, flat: StageRow[]) => {
  flat.push(row)
  for (const child of row.subRows) pushPreorder(child, flat)
}

const subtreeIds = (row: StageRow, into: Set<string>) => {
  into.add(row.id)
  for (const child of row.subRows) subtreeIds(child, into)
}

/** Выход стадии со словарём версий: замена на месте правит его, а не копирует (ADR 0200, EN30). */
const modelOf = (
  rows: StageRow[],
  flatRows: StageRow[],
  rowsById: Record<string, StageRow>,
): StageModel => {
  const dict = new RowDict(rowsById)
  return dictModel(dict, dict.version(), rows, flatRows)
}

/** Начала участков групп `groups` в `flatRows`. */
const groupStarts = (
  groups: readonly StageRow[],
  flatRows: readonly StageRow[],
) => {
  const starts = new Int32Array(groups.length + 1)
  let at = 0
  for (let i = 0; i < flatRows.length && at < groups.length; i++) {
    if (flatRows[i] === groups[at]) starts[at++] = i
  }
  starts[groups.length] = flatRows.length
  return starts
}

/** Первое место в строках группы, чья позиция в данных не меньше `position`. */
const placeIn = (rows: readonly StageRow[], position: number) => {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (positionOf(rows[mid]!) < position) lo = mid + 1
    else hi = mid
  }
  return lo
}

const SPLICE_LIMIT = 10_000

const pushTo = (map: Map<string, StageRow[]>, key: string, row: StageRow) => {
  const list = map.get(key)
  if (list) list.push(row)
  else map.set(key, [row])
}

/**
 * Плоский вход без сдвигов — замена на месте и дописывание в конец (ADR 0194): строки
 * затронутой группы берутся из её прежних строк, без раскладки всех строк по группам;
 * плоский список — прежний с заменой участков групп, словарь переходит новой модели.
 * Новая или опустевшая группа и смена порядка групп — общий путь (`null`).
 */
const patchFlatGroups = (
  table: StageTable,
  prev: Grouped,
  input: StageModel,
  change: RowModelChange,
  known: {
    topKeys: Map<string, string>
    movedKeys: Map<string, string>
    prevGroups: Map<string, StageRow>
  },
): Grouped | null => {
  const before = prev.input.rows.length
  if (
    change.removed.size > 0 ||
    !isFlat(prev.input) ||
    input.rows.length !== before + change.inserted.size
  ) {
    return null
  }
  // Изменённая строка на другом месте — перенос (ADR 0199, §2): общий путь.
  for (const id of change.changed) {
    const old = change.previous?.get(id) as StageRow | undefined
    const now = input.rowsById[id]
    if (!old || !now || positionOf(old) !== positionOf(now)) return null
  }
  const { topKeys, movedKeys, prevGroups } = known
  // Строки, что входят в группу и выходят из неё, по ключу группы.
  const comes = new Map<string, StageRow[]>()
  const leaves = new Map<string, StageRow[]>()
  for (const [id, key] of movedKeys) {
    const row = input.rowsById[id]!
    const members = prevGroups.get(key)?.leafRows
    if (!members?.length) return null
    const old = topKeys.get(id)
    const position = positionOf(row)
    if (change.inserted.has(id) && position < before) return null
    if (old !== undefined && old !== key) {
      const from = prevGroups.get(old)!.leafRows!
      // Первая строка группы задаёт её место: её уход может сменить порядок групп.
      if (from[0]!.id === id || from.length === 1) return null
      pushTo(leaves, old, row)
    }
    if (old !== key && position < positionOf(members[0]!)) return null
    pushTo(comes, key, row)
  }

  const { layout } = prev
  const groups = prev.output.rows
  const starts = (prev.starts ??= groupStarts(groups, prev.output.flatRows))
  const affected = new Set([...comes.keys(), ...leaves.keys()])
  const rebuilt = [...affected]
    .map(key => {
      const old = prevGroups.get(key)!
      const members = old.leafRows!.slice()
      for (const row of leaves.get(key) ?? []) {
        members.splice(placeIn(members, positionOf(row)), 1)
      }
      for (const row of comes.get(key) ?? []) {
        const at = placeIn(members, positionOf(row))
        if (members[at]?.id === row.id) members[at] = row
        else members.splice(at, 0, row)
      }
      const subtree: StageRow[] = []
      const group = buildGroup(
        table,
        layout,
        key,
        members,
        old.index,
        0,
        undefined,
        subtree,
      )
      return { old, group, subtree }
    })
    .sort((a, b) => b.old.index - a.old.index)

  const rows = groups.slice()
  const flatRows = prev.output.flatRows.slice()
  const nextStarts = starts.slice()
  const gone = new Set<string>()
  const placed: StageRow[] = []
  const previous = new Map<string, object>()
  // Группы — с конца: участок группы сдвигает только участки после неё.
  for (const { old, group, subtree } of rebuilt) {
    const at = old.index
    rows[at] = group
    const from = starts[at]!
    const length = starts[at + 1]! - from
    for (let i = from; i < from + length; i++) {
      gone.add(flatRows[i]!.id)
      previous.set(flatRows[i]!.id, flatRows[i]!)
    }
    flatRows.splice(from, length)
    for (let i = 0; i < subtree.length; i += SPLICE_LIMIT) {
      flatRows.splice(from + i, 0, ...subtree.slice(i, i + SPLICE_LIMIT))
    }
    const shift = subtree.length - length
    if (shift !== 0) {
      for (let i = at + 1; i < nextStarts.length; i++) nextStarts[i]! += shift
    }
    for (const row of subtree) placed.push(row)
  }

  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  const placedIds = new Set<string>()
  const { dict, writer } = editDictOf(prev.output)
  // Сначала уходят прежние поддеревья всех групп: строка могла переехать в другую из них.
  for (const id of gone) writer.delete(id)
  for (const row of placed) {
    writer.set(row.id, row)
    placedIds.add(row.id)
    if (input.rowsById[row.id] !== undefined) {
      if (change.changed.has(row.id)) changed.add(row.id)
      else if (change.inserted.has(row.id)) inserted.add(row.id)
    } else if (gone.has(row.id)) {
      changed.add(row.id)
    } else {
      inserted.add(row.id)
    }
  }
  for (const id of gone) {
    if (!placedIds.has(id) && !input.rowsById[id]) removed.add(id)
  }
  for (const [id, key] of movedKeys) topKeys.set(id, key)
  const output = dictModel(dict, writer.version, rows, flatRows)
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
    inPlace: true,
    previous,
  })
  return { ...prev, input, output, topKeys, starts: nextStarts }
}

/**
 * Смена `data` при той же группировке (ADR 0194): строки верхних групп, затронутых сменой,
 * группируются заново; прочие группы переходят прежними объектами вместе с агрегатами.
 */
const patchGroups = (
  table: StageTable,
  prev: Grouped,
  input: StageModel,
): Grouped | undefined => {
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  if (
    !change ||
    change.prev !== prev.input ||
    prev.output === prev.input ||
    !isFlat(input) ||
    !prev.layout.flat
  ) {
    return undefined
  }
  const { layout } = prev
  const columnId = layout.columns[0]!
  const prevGroups = new Map<string, StageRow>()
  for (const group of prev.output.rows) {
    prevGroups.set(`${group.groupingValue as string}`, group)
  }
  let topKeys = prev.topKeys
  if (!topKeys) {
    topKeys = new Map()
    for (const [key, group] of prevGroups) {
      for (const row of group.leafRows ?? []) topKeys.set(row.id, key)
    }
  }

  const affected = new Set<string>()
  const movedKeys = new Map<string, string>()
  for (const id of change.removed) {
    const key = topKeys.get(id)
    if (key !== undefined) affected.add(key)
  }
  for (const ids of [change.changed, change.inserted]) {
    for (const id of ids) {
      const row = input.rowsById[id]
      if (!row) continue
      const old = topKeys.get(id)
      if (old !== undefined) affected.add(old)
      const key = keyOf(table, layout, row, columnId)
      movedKeys.set(id, key)
      affected.add(key)
    }
  }

  const flat = patchFlatGroups(table, prev, input, change, {
    topKeys,
    movedKeys,
    prevGroups,
  })
  if (flat !== null) return flat

  // Строки по группам в порядке входа; новые объекты — только строки смены (movedKeys).
  const members = new Map<string, StageRow[]>()
  for (const row of input.rows) {
    let key = movedKeys.get(row.id)
    if (key === undefined) {
      key = topKeys.get(row.id)
      if (key === undefined) return undefined
    }
    const list = members.get(key)
    if (list) list.push(row)
    else members.set(key, [row])
  }

  const rows: StageRow[] = []
  const flatRows: StageRow[] = []
  const rebuilt: { old?: StageRow; from: number; to: number }[] = []
  let index = 0
  for (const [key, list] of members) {
    const old = prevGroups.get(key)
    if (old && !affected.has(key) && old.index === index) {
      rows.push(old)
      pushPreorder(old, flatRows)
    } else {
      const from = flatRows.length
      rows.push(
        buildGroup(table, layout, key, list, index, 0, undefined, flatRows),
      )
      rebuilt.push({ old, from, to: flatRows.length })
    }
    index++
  }

  const rowsById = byId(flatRows)
  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  const gone = new Set<string>()
  for (const [key, group] of prevGroups) {
    if (!members.has(key)) subtreeIds(group, gone)
  }
  for (const { old } of rebuilt) if (old) subtreeIds(old, gone)
  // Строки групп — новые объекты: их агрегаты могли измениться.
  for (const { from, to } of rebuilt) {
    for (let i = from; i < to; i++) {
      const row = flatRows[i]!
      if (input.rowsById[row.id]) continue
      if (gone.has(row.id)) changed.add(row.id)
      else inserted.add(row.id)
    }
  }
  for (const id of gone) {
    if (!rowsById[id] && !input.rowsById[id]) removed.add(id)
  }
  for (const id of change.changed) if (rowsById[id]) changed.add(id)
  for (const id of change.inserted) if (rowsById[id]) inserted.add(id)
  for (const id of change.removed) removed.add(id)

  for (const id of change.removed) topKeys.delete(id)
  for (const [id, key] of movedKeys) topKeys.set(id, key)

  const output = modelOf(rows, flatRows, rowsById)
  // Прежние объекты — из своего прежнего выхода: его словарь стадия не меняла.
  const was = prev.output.rowsById
  const previous = new Map<string, object>()
  for (const ids of [changed, removed]) {
    for (const id of ids) if (was[id]) previous.set(id, was[id])
  }
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
    previous,
  })
  return { ...prev, input, output, topKeys, starts: undefined }
}

/** Связи строк без группировки — как `resetRowRelationships` стоковой модели. */
const resetRelationships = (
  input: StageModel,
  rows: readonly StageRow[],
  depth = 0,
  parentId?: string,
) => {
  for (const row of rows) {
    if (row.depth !== depth) row.depth = depth
    if (row.parentId !== parentId) row.parentId = parentId
    const kids = childrenOf(input, row)
    if (kids.length) resetRelationships(input, kids, depth + 1, row.id)
  }
}

/**
 * Стадия группировки: вход — у движка (ADR 0200, §3), плоский и дерево.
 */
export const createGroupStage =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as StageTable
    let last: Grouped | undefined
    /** Последний выход своей стадии: без группировки — вход. */
    let shown: { input: StageModel; grouping: unknown } | undefined
    let grouped = false

    const resets = (input: StageModel, grouping: unknown) => {
      // Как мемо TanStack: сбросы — после пересчёта, не посреди чтения модели.
      if (shown && (shown.input !== input || shown.grouping !== grouping)) {
        queueMicrotask(() => {
          t.autoResetExpanded?.()
          t.autoResetPageIndex?.()
        })
      }
      shown = { input, grouping }
    }

    const own = (input: StageModel): StageModel => {
      const grouping = t.atoms.grouping?.get()
      const columns = (grouping ?? []).filter(id => t.getColumn(id))
      if (!input.rows.length || !columns.length) {
        // Без группировки строки уже в нужном виде: связи сбрасываются один раз (ADR 0068).
        if (grouped) {
          resetRelationships(input, input.rows)
          grouped = false
        }
        last = undefined
        resets(input, grouping)
        return input
      }
      const moves = readRowMoves(table)
      const movesKey = groupMovesKey(moves)
      const columnsOption = t.options.columns
      if (
        last &&
        last.input === input &&
        last.grouping === grouping &&
        last.columns === columnsOption &&
        last.movesKey === movesKey
      ) {
        return last.output
      }
      const same =
        last &&
        last.grouping === grouping &&
        last.columns === columnsOption &&
        last.movesKey === movesKey
      if (same) Object.assign(last!.layout, { moves, input })
      const patched = same ? patchGroups(t, last!, input) : undefined
      if (patched) {
        last = patched
      } else {
        const layout: Layout = {
          input,
          flat: isFlat(input),
          columns,
          moves,
          groupingValues:
            last && last.columns === columnsOption
              ? last.layout.groupingValues
              : new WeakMap(),
        }
        const flatRows: StageRow[] = []
        const rows = groupUp(t, layout, input.rows, 0, undefined, flatRows)
        last = {
          input,
          grouping,
          columns: columnsOption,
          movesKey,
          layout,
          output: modelOf(rows, flatRows, byId(flatRows)),
        }
      }
      grouped = true
      resets(input, grouping)
      return last.output
    }

    return (read: () => unknown) => own(read() as StageModel) as never
  }

/**
 * Значение ячейки колонки группировки до итога переноса между группами (ADR 0186, §3): строка
 * не расходится сама с собой, кэши строки не меняются.
 */
export const stagedGroupValue = (cell: unknown) => {
  const { row, column } = cell as {
    row: { id: string; table: unknown }
    column: { id: string }
  }
  const staged = readRowMoves(row.table)[row.id]?.group
  return staged && column.id in staged
    ? { value: staged[column.id] }
    : undefined
}
