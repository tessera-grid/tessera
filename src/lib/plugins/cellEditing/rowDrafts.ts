/**
 * Строки до сохранения (ADR 0178, §7): в `'manual'` `addRow` и `removeRow` кладут черновики
 * `rowInsert` и `rowDelete`, данные не трогают. Новую строку показывает слой поверх источника
 * строк: она держится за строку над собой, модели строк её не видят. Удалённая стоит на месте.
 */
import { constructRow } from '@tanstack/react-table'

import { readPluginHooks } from '../../core/definePlugin'
import { commonOptionsOf } from '../../core/commonFeature'
import { flashOutcome } from '../../core/flashes/flashFeature'
import {
  type Draft,
  type DraftKind,
  hasDraft,
  readDrafts,
  removeDraft,
  removeDrafts,
  setDraft,
} from '../../core/drafts/drafts'
import type { TableLabels } from '../../core/localization'
import type { RowSource } from '../../core/rowSource'
import { logWarn } from '../../util/logger'
import { randomId } from '../../util/randomId'
import { editTextOf } from './editValue'
import type { CellEditingHooks } from './types'
import { cellEditingLabels } from './labels'

export const ROW_INSERT_DRAFT = 'rowInsert'
export const ROW_DELETE_DRAFT = 'rowDelete'

/** Значение черновика новой строки: данные строки и её место при добавлении. */
export interface RowInsertValue {
  values: Record<string, unknown>
  /** Место в видимом списке при добавлении; строки над новой уже нет — по нему. */
  index: number
  /** Строка над новой; нет — новая первая. */
  after?: string
}

const hooksOf = (table: unknown) =>
  readPluginHooks<Partial<CellEditingHooks>>(table as never, 'cellEditing')

type StateTable = { store: { get: () => { grouping?: readonly unknown[] } } }

/**
 * Почему строки до сохранения здесь не работают (DR33): дерево, группировка и лента
 * ведут свои списки; `undefined` — работают.
 */
export const rowDraftsInertReason = (table: unknown) => {
  if (hooksOf(table).saveMode !== 'manual') return 'autoSave'
  // Группы раскрывает модель дерева: группировка — причина точнее.
  const grouping = (table as StateTable).store.get().grouping
  if (grouping && grouping.length > 0) return 'grouping'
  const options = commonOptionsOf(table)
  if (options.treeRows) return 'treeRows'
  if (options.partialData) return 'infiniteScroll'
  return undefined
}

const inert = (table: unknown, call: string) => {
  const reason = rowDraftsInertReason(table)
  if (reason === undefined) return false
  logWarn(
    table as never,
    `cellEditing: ${call} is inert (${reason}) — rows before saving work in a flat list with saveMode: 'manual'`,
    `cellEditing:${call}:${reason}`,
  )
  return true
}

type InsertDraft = Draft & { target: { row: string } }

/** Новые строки среза: `getRowSource` спрашивает их на каждый вызов, срез — один на пачку. */
const inserts = new WeakMap<readonly Draft[], InsertDraft[]>()

const insertsOf = (drafts: readonly Draft[]) => {
  let list = inserts.get(drafts)
  if (!list) {
    list = drafts.filter(
      (draft): draft is InsertDraft =>
        draft.kind === ROW_INSERT_DRAFT && 'row' in draft.target,
    )
    inserts.set(drafts, list)
  }
  return list
}

/** Черновик новой строки по её временному id. */
export const insertDraftOf = (table: unknown, rowId: string) =>
  insertsOf(readDrafts(table)).find(draft => draft.target.row === rowId)

/** Id новых строк среза: строка ищет себя без перебора черновиков. */
const insertIds = new WeakMap<readonly Draft[], Set<string>>()

/** Строка — новая, ещё не сохранённая. */
export const isNewRow = (table: unknown, rowId: string) => {
  const drafts = readDrafts(table)
  let ids = insertIds.get(drafts)
  if (!ids) {
    ids = new Set(insertsOf(drafts).map(draft => draft.target.row))
    insertIds.set(drafts, ids)
  }
  return ids.has(rowId)
}

/** Строка удалена черновиком. */
export const isDeletedRow = (table: unknown, rowId: string) =>
  hasDraft(table, ROW_DELETE_DRAFT, { row: rowId })

/**
 * Добавить строку до сохранения; вернуть её id (DR27). Id выдаёт таблица — уникальный и
 * постоянный: сервер сохраняет строку под ним (ADR 0181, NI1).
 */
export const addRow = (
  table: unknown,
  values: Record<string, unknown>,
  { index }: { index?: number } = {},
): string | undefined => {
  if (inert(table, 'addRow')) return undefined
  const source = (
    table as { getRowSource: () => RowSource<{ id: string }> }
  ).getRowSource()
  const at = Math.max(0, Math.min(index ?? source.count(), source.count()))
  const after = at > 0 ? source.at(at - 1)?.id : undefined
  const rowId = randomId()
  const value: RowInsertValue = {
    values,
    index: at,
    ...(after ? { after } : {}),
  }
  setDraft(table, { kind: ROW_INSERT_DRAFT, target: { row: rowId }, value })
  flashOutcome(table, { row: rowId }, 'arrived')
  return rowId
}

/**
 * Удалить строку до сохранения (DR28): новая уходит вместе с черновиком, прочая стоит на месте
 * с черновиком `rowDelete`; черновики её ячеек остаются.
 */
export const removeRow = (table: unknown, rowId: string) => {
  if (inert(table, 'removeRow')) return
  if (isNewRow(table, rowId)) {
    removeDraft(table, ROW_INSERT_DRAFT, { row: rowId })
    return
  }
  setDraft(table, {
    kind: ROW_DELETE_DRAFT,
    target: { row: rowId },
    value: null,
  })
}

/** Значения ячеек новой строки — в её черновик, без черновиков ячеек (DR29). */
export const writeNewRowValues = (
  table: unknown,
  rowId: string,
  update: (values: Record<string, unknown>) => Record<string, unknown>,
) => {
  const draft = insertDraftOf(table, rowId)
  if (!draft) return
  const value = draft.value as RowInsertValue
  setDraft(table, {
    ...draft,
    value: { ...value, values: update(value.values) },
  })
}

/** Снять черновики строк и их ячеек, отобранные условием, — одной записью. */
export const removeRowDrafts = (table: unknown, rowIds: ReadonlySet<string>) =>
  removeDrafts(table, draft => {
    const target = draft.target
    if ('row' in target) return rowIds.has(target.row)
    return 'cell' in target && rowIds.has(target.cell[0])
  })

// --- Слой источника строк ---------------------------------------------------------------

type LayerRow = { id: string; getCanSelect?: () => boolean }

/** Раскладка слоя: новые строки на местах объединённого списка. */
interface Plan {
  count: number
  /** Места новых строк по возрастанию. */
  positions: number[]
  /** Новые строки на этих местах. */
  rows: LayerRow[]
  /** Индекс строки источника, перед которой стоит каждая новая, по возрастанию. */
  before: number[]
  byId: Map<string, { row: LayerRow; position: number }>
  list?: LayerRow[]
}

/** Строк в отсортированном массиве меньше `value` (`strict`) или не больше. */
const countBelow = (
  sorted: readonly number[],
  value: number,
  strict: boolean,
) => {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (strict ? sorted[mid]! < value : sorted[mid]! <= value) low = mid + 1
    else high = mid
  }
  return low
}

/** Строка новой записи: та же, пока черновик тот же. */
const builtRows = new WeakMap<Draft, LayerRow>()

const rowOfDraft = (table: unknown, draft: Draft, position: number) => {
  let row = builtRows.get(draft)
  if (!row) {
    row = constructRow(
      table as never,
      (draft.target as { row: string }).row,
      (draft.value as RowInsertValue).values as never,
      position,
      0,
    ) as unknown as LayerRow
    // Флажок выбора новой строки выключен (DR34): выбор считает по данным.
    row.getCanSelect = () => false
    builtRows.set(draft, row)
  }
  return row
}

const buildPlan = (
  table: unknown,
  base: RowSource<LayerRow>,
  inserts: readonly Draft[],
): Plan => {
  const baseCount = base.count()
  // Группы новых строк по индексу строки источника, перед которой они стоят.
  const groups = new Map<number, Draft[]>()
  const groupOf = new Map<string, number>()
  for (const draft of inserts) {
    const value = draft.value as RowInsertValue
    const id = (draft.target as { row: string }).row
    // Строка уже в данных или кэше — сохранённая, та же строка: слой её не рисует (ADR 0181, NI2).
    if (base.byId(id)) continue
    let key: number
    let at = 0
    if (value.after !== undefined && groupOf.has(value.after)) {
      key = groupOf.get(value.after)!
      at =
        groups
          .get(key)!
          .findIndex(
            item => (item.target as { row: string }).row === value.after,
          ) + 1
    } else {
      const above = value.after === undefined ? -1 : base.indexOf(value.after)
      if (value.after === undefined || above >= 0) {
        key = above + 1
      } else {
        // Строки над новой нет в списке (фильтр, страница): место — прежний индекс.
        key = Math.min(value.index, baseCount)
        at = groups.get(key)?.length ?? 0
      }
    }
    const group = groups.get(key) ?? []
    group.splice(at, 0, draft)
    groups.set(key, group)
    groupOf.set(id, key)
  }
  const positions: number[] = []
  const rows: LayerRow[] = []
  const before: number[] = []
  const byId = new Map<string, { row: LayerRow; position: number }>()
  let shift = 0
  for (const key of [...groups.keys()].sort((a, b) => a - b)) {
    for (const draft of groups.get(key)!) {
      const position = key + shift
      const row = rowOfDraft(table, draft, position)
      positions.push(position)
      rows.push(row)
      before.push(key)
      byId.set(row.id, { row, position })
      shift++
    }
  }
  return { count: baseCount + rows.length, positions, rows, before, byId }
}

interface Layer {
  source: RowSource<LayerRow>
  drafts?: readonly Draft[]
  list?: unknown
  version?: number
  count?: number
  plan?: Plan
}

const layers = new WeakMap<object, WeakMap<RowSource, Layer>>()

const layerOf = (table: object, base: RowSource<LayerRow>): Layer => {
  let byBase = layers.get(table)
  if (!byBase) {
    byBase = new WeakMap()
    layers.set(table, byBase)
  }
  let layer = byBase.get(base)
  if (layer) return layer
  const plan = () => {
    const drafts = readDrafts(table)
    const list = base.rows?.()
    const version = base.version?.()
    const count = base.count()
    if (
      !layer!.plan ||
      layer!.drafts !== drafts ||
      layer!.list !== list ||
      layer!.version !== version ||
      layer!.count !== count
    ) {
      Object.assign(layer!, {
        drafts,
        list,
        version,
        count,
        plan: buildPlan(table, base, insertsOf(drafts)),
      })
    }
    return layer!.plan!
  }
  /** Строк новых выше места `index` объединённого списка. */
  const above = (index: number) => countBelow(plan().positions, index, true)
  const toBase = (index: number) => index - above(index)
  const fromBase = (index: number) =>
    index + countBelow(plan().before, index, false)
  const source: RowSource<LayerRow> = {
    ...base,
    base,
    count: () => plan().count,
    at: index => {
      const { positions, rows } = plan()
      const at = countBelow(positions, index, true)
      if (positions[at] === index) return rows[at]
      return base.at(index - at)
    },
    newRows: () => {
      const { positions, rows } = plan()
      return rows.map((row, i) => ({ id: row.id, index: positions[i]! }))
    },
    byId: id => plan().byId.get(id)?.row ?? base.byId(id),
    indexOf: id => {
      const own = plan().byId.get(id)
      if (own) return own.position
      const index = base.indexOf(id)
      return index < 0 ? -1 : fromBase(index)
    },
    ...(base.rows && {
      rows: () => {
        const current = plan()
        if (!current.list) {
          const list = [...base.rows!()]
          current.positions.forEach((position, i) =>
            list.splice(position, 0, current.rows[i]!),
          )
          current.list = list
        }
        return current.list
      },
    }),
    ...(base.total && {
      total: () => {
        const total = base.total!()
        return total < 0 ? total : total + plan().rows.length
      },
    }),
    ...(base.observe && {
      observe: window =>
        base.observe!({
          ...window,
          first: toBase(window.first),
          last: toBase(window.last),
        }),
    }),
    // Строки диапазона по видимому списку: новые — из слоя, прочие — из источника под ним.
    ...(base.loadRange && {
      loadRange: async (first, last, signal) => {
        const current = plan()
        const own = new Map(
          current.positions.map((p, i) => [p, current.rows[i]!]),
        )
        const baseFirst = toBase(first)
        const baseLast = toBase(last + 1) - 1
        const fetched =
          baseLast >= baseFirst
            ? await base.loadRange!(baseFirst, baseLast, signal)
            : []
        const out: (LayerRow | undefined)[] = []
        for (let index = first; index <= last; index++)
          out.push(own.get(index) ?? fetched[toBase(index) - baseFirst])
        return out
      },
    }),
    ...(base.failures && {
      failures: () =>
        base.failures!().map(failure => ({
          ...failure,
          start: fromBase(failure.start),
          end: fromBase(failure.end),
        })),
    }),
  }
  layer = { source }
  byBase.set(base, layer)
  return layer
}

/** Индекс строки источника, перед которой стоит новая строка, — место вставки в кэш. */
export const baseIndexOfNewRow = (table: unknown, rowId: string) => {
  const source = (
    table as { getRowSource: () => RowSource<LayerRow> }
  ).getRowSource()
  const position = source.indexOf(rowId)
  if (position < 0 || !source.base) return undefined
  let index = position
  for (let i = 0; i < position; i++) {
    if (isNewRow(table, source.at(i)?.id ?? '')) index--
  }
  return index
}

/** Слой строк до сохранения: без новых строк или вне своего режима — источник как есть. */
export const rowDraftsLayer = (base: RowSource, table: unknown): RowSource => {
  // Слой спрашивают на каждую ячейку: при автосохранении новых строк нет (DR55).
  if (hooksOf(table).saveMode !== 'manual') return base
  if (insertsOf(readDrafts(table)).length === 0) return base
  if (rowDraftsInertReason(table) !== undefined) return base
  return layerOf(table as object, base as RowSource<LayerRow>).source
}

/** Сколько значений новой строки показывает пульт (DR43). */
const SUMMARY_VALUES = 3

interface SummaryColumn {
  id: string
  accessorFn?: (row: unknown, index: number) => unknown
}

/** Первые заполненные значения видимых колонок в виде ячейки, остальные — числом (DR43). */
const valuesText = (
  labels: TableLabels,
  table: unknown,
  values: Record<string, unknown>,
) => {
  const shown: string[] = []
  let more = 0
  const columns = (
    table as { getVisibleLeafColumns: () => SummaryColumn[] }
  ).getVisibleLeafColumns()
  for (const column of columns) {
    if (!column.accessorFn) continue
    const text = editTextOf(table, column.id, column.accessorFn(values, 0))
    if (text === '') continue
    if (shown.length < SUMMARY_VALUES) shown.push(text)
    else more++
  }
  const text = shown.join(', ')
  return more > 0
    ? cellEditingLabels(labels).rowInsertDraftMore(text, more)
    : text
}

const rowsActive = (table: unknown) => rowDraftsInertReason(table) === undefined

/** Вид новой строки: применяет её общий пакет `onCommitEdits`. */
export const rowInsertDraftKind = (
  commit: (table: unknown, drafts: readonly Draft[]) => void,
  commitAll: (table: unknown) => void,
): DraftKind => ({
  kind: ROW_INSERT_DRAFT,
  action: 'rowInsert',
  describe: (labels, draft, table) =>
    valuesText(labels, table, (draft.value as RowInsertValue).values),
  apply: (table, draft) => commit(table, [draft]),
  applyAll: table => commitAll(table),
  active: rowsActive,
  rowMark: 'inserted',
})

/** Вид удалённой строки. */
export const rowDeleteDraftKind = (
  commit: (table: unknown, drafts: readonly Draft[]) => void,
  commitAll: (table: unknown) => void,
): DraftKind => ({
  kind: ROW_DELETE_DRAFT,
  action: 'rowDelete',
  apply: (table, draft) => commit(table, [draft]),
  applyAll: table => commitAll(table),
  active: rowsActive,
  rowMark: 'deleted',
})
