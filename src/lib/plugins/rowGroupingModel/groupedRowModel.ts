/**
 * Модель группировки TanStack без холостого прохода (ADR 0068): без группировки второй
 * проход подряд не переписывает `depth`/`parentId` строк. Стадия переноса между группами
 * (ADR 0186, §3): значение колонки группировки лежит в кэшах строки, которые TanStack читает
 * первыми; смена стадии пересобирает модель. Смена `data` при той же группировке
 * пересобирает только затронутые группы (ADR 0194).
 */
import {
  createGroupedRowModel,
  hasOwn,
  makeObjectMap,
} from '@tanstack/react-table'

import {
  type RowModelChange,
  recordRowModelChange,
  rowModelChangeOf,
} from '../../core/dataChanges'
import { handOverRowsById } from '../../core/rowsByIdHandover'
import { groupMovesKey, readRowMoves } from '../../shared/rowMoves'
import { skipIdlePasses } from '../../shared/rowModels/idleRowModel'
import type { RowData, Table, TableFeatures } from '../../types'

interface StagedRow {
  _valuesCache?: Record<string, unknown>
  _groupingValuesCache?: Record<string, unknown>
}

interface GroupingTable {
  atoms: { grouping?: { get: () => unknown[] | undefined } }
  options: { columns: unknown }
  getColumn: (id: string) => GroupColumn | undefined
  getCoreRowModel: () => { rowsById: Record<string, StagedRow | undefined> }
  getPreGroupedRowModel: () => unknown
  autoResetExpanded?: () => void
  autoResetPageIndex?: () => void
}

interface GroupRow {
  id: string
  index: number
  original: unknown
  subRows: GroupRow[]
  leafRows?: GroupRow[]
  groupingValue?: unknown
  getValue: (columnId: string) => unknown
  _groupingValuesCache?: Record<string, unknown>
}

interface GroupModel {
  rows: GroupRow[]
  flatRows: GroupRow[]
  rowsById: Record<string, GroupRow>
}

interface GroupColumn {
  columnDef: {
    getGroupingValue?: (
      original: unknown,
      index: number,
      row: unknown,
    ) => unknown
  }
}

interface Grouped {
  input: GroupModel
  grouping: unknown
  columns: unknown
  output: GroupModel
  /** Ключ верхней группы строки входа; собирается при первом инкременте. */
  topKeys?: Map<string, string>
  /** Начало участка каждой верхней группы в `output.flatRows`; последний элемент — длина. */
  starts?: Int32Array
}

/** Ключ группы строки по колонке — как `groupBy` TanStack. */
const groupKeyOf = (
  table: GroupingTable,
  row: GroupRow,
  columnId: string,
): string => {
  const getGroupingValue = table.getColumn(columnId)?.columnDef.getGroupingValue
  let value: unknown
  if (getGroupingValue) {
    const cache = row._groupingValuesCache
    if (cache && hasOwn(cache, columnId)) value = cache[columnId]
    else if (cache) {
      value = cache[columnId] = getGroupingValue(row.original, row.index, row)
    }
  } else {
    value = row.getValue(columnId)
  }
  return `${value as string}`
}

const pushPreorder = (row: GroupRow, flat: GroupRow[]) => {
  flat.push(row)
  for (const child of row.subRows) pushPreorder(child, flat)
}

const subtreeIds = (row: GroupRow, into: Set<string>) => {
  into.add(row.id)
  for (const child of row.subRows) subtreeIds(child, into)
}

/** Группа из её строк — стоковой моделью на подмножестве входа, с агрегатами TanStack. */
const groupSubset = <TFeatures extends TableFeatures, TData extends RowData>(
  table: Table<TFeatures, TData>,
  members: GroupRow[],
): GroupModel => {
  const rowsById = makeObjectMap<GroupRow>()
  for (const row of members) rowsById[row.id] = row
  const subset: GroupModel = { rows: members, flatRows: members, rowsById }
  const view = new Proxy(table, {
    get: (target, key, receiver) =>
      key === 'getPreGroupedRowModel'
        ? () => subset
        : (Reflect.get(target, key, receiver) as unknown),
  })
  return createGroupedRowModel<TFeatures, TData>()(
    view,
  )() as unknown as GroupModel
}

const SPLICE_LIMIT = 10_000

/** Начала участков групп `groups` в `flatRows`. */
const groupStarts = (
  groups: readonly GroupRow[],
  flatRows: readonly GroupRow[],
) => {
  const starts = new Int32Array(groups.length + 1)
  let at = 0
  for (let i = 0; i < flatRows.length && at < groups.length; i++) {
    if (flatRows[i] === groups[at]) starts[at++] = i
  }
  starts[groups.length] = flatRows.length
  return starts
}

/** Первое место в строках группы, чей индекс не меньше `index`. */
const placeOf = (rows: readonly GroupRow[], index: number) => {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.index < index) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Плоский вход без сдвигов — замена на месте и дописывание в конец (ADR 0194): строки
 * затронутой группы берутся из её прежних строк, без раскладки всех строк по группам;
 * плоский список — прежний с заменой участков групп, словарь переходит новой модели.
 * Новая или опустевшая группа и смена порядка групп — общий путь (`null`).
 */
const patchFlatGroups = <
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  table: Table<TFeatures, TData>,
  prev: Grouped,
  input: GroupModel,
  change: RowModelChange,
  known: {
    topKeys: Map<string, string>
    movedKeys: Map<string, string>
    prevGroups: Map<string, GroupRow>
  },
): Grouped | null => {
  const before = prev.input.rows.length
  if (
    change.removed.size > 0 ||
    input.flatRows.length !== input.rows.length ||
    prev.input.flatRows.length !== before ||
    input.rows.length !== before + change.inserted.size
  ) {
    return null
  }
  // Изменённая строка на другом месте — перенос (ADR 0199, §2): общий путь.
  for (const id of change.changed) {
    const old = (change.previous?.get(id) ?? prev.input.rowsById[id]) as
      GroupRow | undefined
    if (!old || old.index !== input.rowsById[id]?.index) return null
  }
  const { topKeys, movedKeys, prevGroups } = known
  // Строки, что входят в группу и выходят из неё, по ключу группы.
  const comes = new Map<string, GroupRow[]>()
  const leaves = new Map<string, GroupRow[]>()
  for (const [id, key] of movedKeys) {
    const row = input.rowsById[id]!
    const group = prevGroups.get(key)
    const members = group?.leafRows
    if (!members?.length) return null
    const old = topKeys.get(id)
    if (change.inserted.has(id) && row.index < before) return null
    if (old !== undefined && old !== key) {
      const from = prevGroups.get(old)!.leafRows!
      // Первая строка группы задаёт её место: её уход может сменить порядок групп.
      if (from[0]!.id === id || from.length === 1) return null
      const list = leaves.get(old)
      if (list) list.push(row)
      else leaves.set(old, [row])
    }
    if (old !== key && row.index < members[0]!.index) return null
    const list = comes.get(key)
    if (list) list.push(row)
    else comes.set(key, [row])
  }

  const groups = prev.output.rows
  const starts = (prev.starts ??= groupStarts(groups, prev.output.flatRows))
  const affected = new Set([...comes.keys(), ...leaves.keys()])
  const rebuilt = [...affected]
    .map(key => {
      const old = prevGroups.get(key)!
      const members = old.leafRows!.slice()
      for (const row of leaves.get(key) ?? []) {
        members.splice(placeOf(members, row.index), 1)
      }
      for (const row of comes.get(key) ?? []) {
        const at = placeOf(members, row.index)
        if (members[at]?.id === row.id) members[at] = row
        else members.splice(at, 0, row)
      }
      return { old, model: groupSubset(table, members) }
    })
    .sort((a, b) => b.old.index - a.old.index)

  const rows = groups.slice()
  const flatRows = prev.output.flatRows.slice()
  const nextStarts = starts.slice()
  const rowsById = handOverRowsById(prev.output)
  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  const gone = new Set<string>()
  const placed: GroupRow[] = []
  const previous = new Map<string, object>()
  for (const { old, model } of rebuilt) {
    const at = old.index
    const group = model.rows[0]!
    group.index = at
    rows[at] = group
    const from = starts[at]!
    const length = starts[at + 1]! - from
    for (let i = from; i < from + length; i++) {
      gone.add(flatRows[i]!.id)
      previous.set(flatRows[i]!.id, flatRows[i]!)
    }
    flatRows.splice(from, length)
    for (let i = 0; i < model.flatRows.length; i += SPLICE_LIMIT) {
      flatRows.splice(from + i, 0, ...model.flatRows.slice(i, i + SPLICE_LIMIT))
    }
    const shift = model.flatRows.length - length
    if (shift !== 0) {
      for (let i = at + 1; i < nextStarts.length; i++) nextStarts[i]! += shift
    }
    for (const row of model.flatRows) placed.push(row)
  }
  // Сначала уходят прежние поддеревья всех групп: строка могла переехать в другую из них.
  for (const id of gone) delete rowsById[id]
  for (const row of placed) {
    rowsById[row.id] = row
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
    if (!rowsById[id] && !input.rowsById[id]) removed.add(id)
  }
  for (const [id, key] of movedKeys) topKeys.set(id, key)
  const output: GroupModel = { rows, flatRows, rowsById }
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
    inPlace: true,
    previous,
  })
  return {
    input,
    grouping: prev.grouping,
    columns: prev.columns,
    output,
    topKeys,
    starts: nextStarts,
  }
}

/**
 * Смена `data` при той же группировке (ADR 0194): строки верхних групп, затронутых сменой,
 * группируются заново стоковой моделью; прочие группы переходят прежними объектами вместе
 * с агрегатами. Вход-дерево — полная сборка.
 */
const patchGrouped = <TFeatures extends TableFeatures, TData extends RowData>(
  table: Table<TFeatures, TData>,
  prev: Grouped,
  input: GroupModel,
): Grouped | undefined => {
  const t = table as unknown as GroupingTable
  const change = rowModelChangeOf(input) as RowModelChange | undefined
  const grouping = t.atoms.grouping?.get()
  const columns = t.options.columns
  if (
    !change ||
    change.prev !== prev.input ||
    prev.output === prev.input ||
    grouping !== prev.grouping ||
    columns !== prev.columns ||
    input.flatRows.length !== input.rows.length
  ) {
    return undefined
  }
  const columnId = (grouping as string[]).find(id => t.getColumn(id))
  if (columnId === undefined) return undefined

  const prevGroups = new Map<string, GroupRow>()
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
      const key = groupKeyOf(t, row, columnId)
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

  // Строки по группам в порядке входа; группа сдвинутой строки собирается заново.
  const before = prev.input.rowsById
  const members = new Map<string, GroupRow[]>()
  for (const row of input.rows) {
    let key = movedKeys.get(row.id)
    if (key === undefined) {
      key = topKeys.get(row.id)
      if (key === undefined) return undefined
      if (row !== before[row.id]) affected.add(key)
    }
    const list = members.get(key)
    if (list) list.push(row)
    else members.set(key, [row])
  }

  const rows: GroupRow[] = []
  const flatRows: GroupRow[] = []
  const rebuilt: { old?: GroupRow; model: GroupModel }[] = []
  let index = 0
  for (const [key, list] of members) {
    const old = prevGroups.get(key)
    if (old && !affected.has(key) && old.index === index) {
      rows.push(old)
      pushPreorder(old, flatRows)
    } else {
      const model = groupSubset(table, list)
      const group = model.rows[0]!
      group.index = index
      rows.push(group)
      for (const row of model.flatRows) flatRows.push(row)
      rebuilt.push({ old, model })
    }
    index++
  }

  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  // Словарь — свой: прежний остаётся у прошлой модели, его читают модели ниже.
  const rowsById = makeObjectMap<GroupRow>()
  for (const row of flatRows) rowsById[row.id] = row
  const gone = new Set<string>()
  for (const [key, group] of prevGroups) {
    if (!members.has(key)) subtreeIds(group, gone)
  }
  for (const { old } of rebuilt) if (old) subtreeIds(old, gone)
  // Строки групп — новые объекты: их агрегаты могли измениться.
  for (const { model } of rebuilt) {
    for (const row of model.flatRows) {
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

  const output: GroupModel = { rows, flatRows, rowsById }
  recordRowModelChange(output, {
    prev: prev.output,
    changed,
    inserted,
    removed,
  })
  return { input, grouping, columns, output, topKeys }
}

export const createIdleAwareGroupedRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as GroupingTable
    let rowModel = createGroupedRowModel<TFeatures, TData>()(table)
    let staged = ''
    let seeded: [StagedRow, string, string][] = []
    let last: Grouped | undefined
    const grouped = () => {
      const input = t.getPreGroupedRowModel() as GroupModel
      const grouping = t.atoms.grouping?.get()
      const columns = t.options.columns
      if (
        last &&
        last.input === input &&
        last.grouping === grouping &&
        last.columns === columns
      ) {
        return last.output
      }
      // Стадия переноса лежит в кэшах строк: инкремент — только без неё.
      const patched = !staged && last && patchGrouped(table, last, input)
      if (patched) {
        last = patched
        t.autoResetExpanded?.()
        t.autoResetPageIndex?.()
        return patched.output
      }
      const output = rowModel() as unknown as GroupModel
      last = { input, grouping, columns, output }
      return output
    }
    const currentModel = () => {
      const moves = readRowMoves(table)
      const key = groupMovesKey(moves)
      if (key !== staged) {
        staged = key
        const { rowsById } = t.getCoreRowModel()
        // Сдвинутая сменой data строка — новый объект с кэшем прежнего (ADR 0194).
        for (const [row, columnId, rowId] of seeded) {
          for (const target of [row, rowsById[rowId]]) {
            delete target?._valuesCache?.[columnId]
            delete target?._groupingValuesCache?.[columnId]
          }
        }
        seeded = []
        for (const rowId in moves) {
          const row = rowsById[rowId]
          const values = moves[rowId]!.group
          if (!row || !values) continue
          for (const columnId in values) {
            if (row._valuesCache) row._valuesCache[columnId] = values[columnId]
            if (row._groupingValuesCache) {
              row._groupingValuesCache[columnId] = values[columnId]
            }
            seeded.push([row, columnId, rowId])
          }
        }
        rowModel = createGroupedRowModel<TFeatures, TData>()(table)
        last = undefined
      }
      return grouped() as unknown as ReturnType<typeof rowModel>
    }
    return skipIdlePasses(
      currentModel,
      () => t.getPreGroupedRowModel() as ReturnType<typeof rowModel>,
      () => !t.atoms.grouping?.get()?.length,
      () => {
        t.autoResetExpanded?.()
        t.autoResetPageIndex?.()
      },
    )
  }
