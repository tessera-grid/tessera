/**
 * Исходная модель строк с ленивыми детьми (ADR 0054): дети строки — из `subRows`
 * данных, иначе — сохранённый ответ `loadChildren`. Смена ответов при тех же `data`
 * собирает модель из прежней — пересобираются только изменённые поддеревья
 * (ADR 0067); смена `data` — полная сборка TanStack.
 */
import {
  constructRow,
  createCoreRowModel,
  makeObjectMap,
} from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../../types'
import { type LoadedChildren, readLoadedChildren } from './lazyChildrenFeature'

type GetSubRows<TData> = (row: TData, index: number) => TData[] | undefined

interface SubRowsTable<TData> {
  options: { data: unknown; getSubRows?: GetSubRows<TData> }
  getRowId: (row: TData, index: number, parent?: ModelRow) => string
}

interface ModelRow {
  id: string
  index: number
  depth: number
  original: unknown
  parentId?: string
  subRows: ModelRow[]
  originalSubRows?: unknown[]
}

interface CoreModel {
  rows: ModelRow[]
  flatRows: ModelRow[]
  rowsById: Record<string, ModelRow>
}

const UNSET = Symbol('unset')

export const createLazyCoreRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as SubRowsTable<TData>
    let loaded: LoadedChildren | typeof UNSET = UNSET
    let rowModel = createCoreRowModel<TFeatures, TData>()(table)
    let last:
      { data: unknown; loaded: LoadedChildren; model: CoreModel } | undefined

    /** Опция `getSubRows` — приложения; на время сборки дополняем её ответами. */
    const withAnswers = <T>(
      answers: LoadedChildren,
      build: (own: GetSubRows<TData> | undefined) => T,
    ): T => {
      const own = t.options.getSubRows
      if (Object.keys(answers).length === 0) {
        return build(own)
      }
      t.options.getSubRows = (row, index) => {
        const subRows = own?.(row, index)
        return subRows?.length
          ? subRows
          : (answers[t.getRowId(row, index)] as TData[] | undefined)
      }
      try {
        return build(own)
      } finally {
        t.options.getSubRows = own
      }
    }

    /** Строки поддерева — тем же обходом, что `accessRows` TanStack. */
    const accessRows = (
      originalRows: readonly TData[],
      depth: number,
      parent: ModelRow,
    ): ModelRow[] =>
      originalRows.map((original, index) => {
        const row = constructRow(
          table as never,
          t.getRowId(original, index, parent),
          original as never,
          index,
          depth,
          undefined,
          parent.id,
        ) as unknown as ModelRow
        addSubRows(row)
        return row
      })

    const addSubRows = (row: ModelRow) => {
      const getSubRows = t.options.getSubRows
      if (!getSubRows) {
        return
      }
      row.originalSubRows = getSubRows(row.original as TData, row.index)
      if (row.originalSubRows?.length) {
        row.subRows = accessRows(
          row.originalSubRows as TData[],
          row.depth + 1,
          row,
        )
      }
    }

    /** Строка и её потомки в порядке TanStack. */
    const subtree = (row: ModelRow, into: ModelRow[] = []): ModelRow[] => {
      into.push(row)
      row.subRows.forEach(child => subtree(child, into))
      return into
    }
    const subtreeSize = (row: ModelRow): number =>
      row.subRows.reduce((size, child) => size + subtreeSize(child), 1)

    const copyRow = (row: ModelRow) =>
      constructRow(
        table as never,
        row.id,
        row.original as never,
        row.index,
        row.depth,
        undefined,
        row.parentId,
      ) as unknown as ModelRow

    /** Модель из прежней: новые объекты — изменённые строки с поддеревьями и их предки. */
    const patch = (
      prev: CoreModel,
      prevAnswers: LoadedChildren,
      answers: LoadedChildren,
      own: GetSubRows<TData> | undefined,
    ): CoreModel => {
      const changed = new Set<string>()
      for (const id of [...Object.keys(prevAnswers), ...Object.keys(answers)]) {
        if (prevAnswers[id] !== answers[id]) {
          changed.add(id)
        }
      }
      const fromAnswer = (row: ModelRow) =>
        !own?.(row.original as TData, row.index)?.length
      const hasChangedAncestor = (row: ModelRow) => {
        for (let id = row.parentId; id !== undefined;) {
          if (changed.has(id)) {
            return true
          }
          id = prev.rowsById[id]?.parentId
        }
        return false
      }

      const replaced = new Map<string, ModelRow>()
      const changedTops = new Set<string>()
      const current = (row: ModelRow) => replaced.get(row.id) ?? row
      for (const id of changed) {
        const row = prev.rowsById[id]
        if (!row || !fromAnswer(row) || hasChangedAncestor(row)) {
          continue
        }
        const fresh = copyRow(row)
        addSubRows(fresh)
        replaced.set(id, fresh)
        changedTops.add(id)
        for (let parentId = row.parentId; parentId !== undefined;) {
          const parent = current(prev.rowsById[parentId]!)
          const copy = copyRow(parent)
          copy.originalSubRows = parent.originalSubRows
          copy.subRows = parent.subRows.map(current)
          replaced.set(parentId, copy)
          parentId = parent.parentId
        }
      }
      if (replaced.size === 0) {
        return prev
      }

      const rows = prev.rows.map(current)
      // flatRows — прежний массив: участок изменённого поддерева заменён целиком, предки —
      // на своих местах (порядок TanStack: строка, затем её потомки).
      let flatRows = prev.flatRows.slice()
      for (const [id, row] of replaced) {
        const at = flatRows.indexOf(prev.rowsById[id]!)
        if (!changedTops.has(id)) {
          flatRows[at] = row
          continue
        }
        const removed = subtreeSize(prev.rowsById[id]!)
        flatRows = flatRows
          .slice(0, at)
          .concat(subtree(row), flatRows.slice(at + removed))
      }
      const rowsById = makeObjectMap<ModelRow>()
      for (const row of flatRows) {
        rowsById[row.id] = row
      }
      return { rows, flatRows, rowsById }
    }

    return () => {
      const answers = readLoadedChildren(table)
      const data = t.options.data
      const prev = last
      if (prev && prev.data === data) {
        if (prev.loaded === answers) {
          return prev.model as never
        }
        const model = withAnswers(answers, own =>
          patch(prev.model, prev.loaded, answers, own),
        )
        // Мемо TanStack не пересоздаём: смена `data` после него — автосбросы, как раньше.
        loaded = answers
        last = { data, loaded: answers, model }
        return model as never
      }
      if (loaded !== UNSET && answers !== loaded) {
        rowModel = createCoreRowModel<TFeatures, TData>()(table)
      }
      loaded = answers
      const model = withAnswers(answers, () =>
        rowModel(),
      ) as unknown as CoreModel
      last = { data, loaded: answers, model }
      return model as never
    }
  }
