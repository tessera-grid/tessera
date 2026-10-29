/**
 * Исходная модель строк с ленивыми детьми (ADR 0054): дети строки — из `subRows`
 * данных, иначе — сохранённый ответ `loadChildren`. Смена ответов при тех же `data`
 * собирает модель из прежней — пересобираются только изменённые поддеревья
 * (ADR 0067), словарь `rowsById` переходит новой модели (ADR 0069); смена `data` —
 * полная сборка TanStack. Ожидающие переносы ленивого дерева (ADR 0112) — стадия на
 * входе: модель собирается из данных и ответов, где строка уже на новом месте. Пока ответ
 * строки в пути, у неё ребёнок-заглушка — скелет-строка (ADR 0155, §3).
 */
import { constructRow, createCoreRowModel } from '@tanstack/react-table'

import {
  type Answers,
  applyRowMoves,
  readRowMoves,
  type RowMoves,
  rowIdOf,
} from '../../core/rowMoves'
import {
  isLazyPlaceholder,
  lazyPlaceholdersOf,
} from '../../core/lazyPlaceholder'
import { handOverRowsById } from '../../core/rowsByIdHandover'
import type { RowData, Table, TableFeatures } from '../../types'
import { type LoadedChildren, readLoadedChildren } from './lazyChildrenFeature'

type GetSubRows<TData> = (row: TData, index: number) => TData[] | undefined

type GetRowId<TData> = (
  row: TData,
  index: number,
  parent?: { id: string },
) => string

interface SubRowsTable<TData> {
  options: {
    data: unknown
    getSubRows?: GetSubRows<TData>
    getRowId?: GetRowId<TData>
  }
  atoms: { rowExpandPending?: { get: () => Record<string, number> } }
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
    let moved:
      | {
          data: unknown
          answers: LoadedChildren
          moves: RowMoves
          result: { data: unknown; answers: LoadedChildren }
        }
      | undefined

    let withPending:
      | { loaded: LoadedChildren; pending: unknown; answers: LoadedChildren }
      | undefined

    /** Ответы и заглушки строк, чей ответ в пути и ещё не пришёл ни разу. */
    const pendingAnswers = (loaded: LoadedChildren): LoadedChildren => {
      const pending = t.atoms.rowExpandPending?.get()
      if (!pending) return loaded
      if (withPending?.loaded === loaded && withPending.pending === pending) {
        return withPending.answers
      }
      let answers = loaded
      for (const id of Object.keys(pending)) {
        if (id in loaded) continue
        if (answers === loaded) answers = { ...loaded }
        ;(answers as Record<string, unknown>)[id] = lazyPlaceholdersOf(t, id)
      }
      withPending = { loaded, pending, answers }
      return answers
    }

    /** Данные и ответы с ожидающими переносами; без них — те же ссылки. */
    const withMoves = (data: unknown, answers: LoadedChildren) => {
      const moves = readRowMoves(table)
      if (
        moved &&
        moved.data === data &&
        moved.answers === answers &&
        moved.moves === moves
      ) {
        return moved.result
      }
      const result = applyRowMoves(
        data as readonly unknown[],
        answers as Answers,
        moves,
        rowIdOf(table),
      ) as { data: unknown; answers: LoadedChildren }
      moved = { data, answers, moves, result }
      return result
    }

    /** Сборка на данных стадии: `options.data` подменяется на время вызова. */
    const withData = <T>(data: unknown, build: () => T): T => {
      const own = t.options.data
      if (own === data) {
        return build()
      }
      t.options.data = data
      try {
        return build()
      } finally {
        t.options.data = own
      }
    }

    /** Опция `getSubRows` — приложения; на время сборки дополняем её ответами. */
    const withAnswers = <T>(
      answers: LoadedChildren,
      build: (own: GetSubRows<TData> | undefined) => T,
    ): T => {
      const own = t.options.getSubRows
      if (Object.keys(answers).length === 0) {
        return build(own)
      }
      const ownId = t.options.getRowId
      t.options.getSubRows = (row, index) => {
        if (isLazyPlaceholder(row)) return undefined
        const subRows = own?.(row, index)
        return subRows?.length
          ? subRows
          : (answers[t.getRowId(row, index)] as TData[] | undefined)
      }
      // У заглушки нет данных для `getRowId` приложения: id — от родителя.
      t.options.getRowId = (row, index, parent) =>
        isLazyPlaceholder(row)
          ? `${parent?.id ?? ''}::loading`
          : (ownId?.(row, index, parent) ??
            (parent ? `${parent.id}.${index}` : String(index)))
      try {
        return build(own)
      } finally {
        t.options.getSubRows = own
        t.options.getRowId = ownId
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
      const byId = prev.rowsById
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
          id = byId[id]?.parentId
        }
        return false
      }

      const replaced = new Map<string, ModelRow>()
      const changedTops = new Set<string>()
      const current = (row: ModelRow) => replaced.get(row.id) ?? row
      for (const id of changed) {
        const row = byId[id]
        if (!row || !fromAnswer(row) || hasChangedAncestor(row)) {
          continue
        }
        const fresh = copyRow(row)
        addSubRows(fresh)
        replaced.set(id, fresh)
        changedTops.add(id)
        for (let parentId = row.parentId; parentId !== undefined;) {
          const parent = current(byId[parentId]!)
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
        const at = flatRows.indexOf(byId[id]!)
        if (!changedTops.has(id)) {
          flatRows[at] = row
          continue
        }
        const removed = subtreeSize(byId[id]!)
        flatRows = flatRows
          .slice(0, at)
          .concat(subtree(row), flatRows.slice(at + removed))
      }
      const oldTops = [...changedTops].map(id => byId[id]!)
      const rowsById = handOverRowsById(prev)
      for (const old of oldTops) {
        for (const row of subtree(old)) {
          delete rowsById[row.id]
        }
      }
      for (const [id, row] of replaced) {
        for (const fresh of changedTops.has(id) ? subtree(row) : [row]) {
          rowsById[fresh.id] = fresh
        }
      }
      return { rows, flatRows, rowsById }
    }

    return () => {
      const { data, answers } = withMoves(
        t.options.data,
        pendingAnswers(readLoadedChildren(table)),
      )
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
      const model = withData(data, () =>
        withAnswers(answers, () => rowModel()),
      ) as unknown as CoreModel
      last = { data, loaded: answers, model }
      return model as never
    }
  }
