/**
 * Исходная модель строк с ленивыми детьми (ADR 0054): дети строки — из `subRows`
 * данных, иначе — сохранённый ответ `loadChildren`. Смена ответов при тех же `data`
 * собирает модель из прежней — пересобираются только изменённые поддеревья
 * (ADR 0067), словарь `rowsById` переходит новой модели (ADR 0069); смена `data` при тех же
 * ответах — из прежней по тождеству строк (ADR 0194), иначе полная сборка хранилища в памяти (ADR 0200). Ожидающие переносы ленивого дерева (ADR 0112) — стадия на
 * входе: модель собирается из данных и ответов, где строка уже на новом месте. Пока ответ
 * строки в пути, у неё ребёнок-заглушка — скелет-строка (ADR 0155, §3).
 */
import { constructRow } from '@tanstack/react-table'

import {
  type Answers,
  applyRowMoves,
  readRowMoves,
  type RowMoves,
  rowIdOf,
} from '../../shared/rowMoves'
import {
  isLazyPlaceholder,
  lazyPlaceholdersOf,
} from '../../core/lazyPlaceholder'
import { patchCoreModel, recordRowModelChange } from '../../core/dataChanges'
import { autoResetOnDataChange } from '../../core/incrementalCoreRowModel'
import { dictModel, editDictOf } from '../../core/rowEngine/rowDict'
import { buildCoreModel } from '../../core/rowEngine/memoryStore'
import type { RowData, Table, TableFeatures } from '../../types'
import { type LoadedChildren, readLoadedChildren } from './lazyChildrenFeature'
import { positionOf, setPosition } from '../../core/rowPosition'

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
  readonly rowsById: Record<string, ModelRow>
}

const UNSET = Symbol('unset')

export const createLazyCoreRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as SubRowsTable<TData>
    let loaded: LoadedChildren | typeof UNSET = UNSET
    /** Данные последней полной сборки: смена `data` после неё — автосбросы, как у мемо TanStack. */
    let built: WeakRef<object> | undefined
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

    const copyRow = (row: ModelRow) => {
      const copy = constructRow(
        table as never,
        row.id,
        row.original as never,
        row.index,
        row.depth,
        undefined,
        row.parentId,
      ) as unknown as ModelRow
      // Копия стоит на месте строки (ADR 0200, §5).
      setPosition(copy, positionOf(row))
      return copy
    }

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
      const { dict, writer } = editDictOf(prev)
      for (const old of oldTops) {
        for (const row of subtree(old)) writer.delete(row.id)
      }
      for (const [id, row] of replaced) {
        for (const fresh of changedTops.has(id) ? subtree(row) : [row]) {
          writer.set(fresh.id, fresh)
        }
      }
      const model = dictModel(dict, writer.version, rows, flatRows) as CoreModel
      recordRowModelChange(model, answerChange(prev, replaced, changedTops))
      return model
    }

    /**
     * Смена ветки ответа для стадий (ADR 0200, EN32): строка с ответом и её предки — изменённые,
     * дети ответа — вставленные, прежние дети — удалённые; одноимённый ребёнок — изменённый.
     */
    const answerChange = (
      prev: CoreModel,
      replaced: ReadonlyMap<string, ModelRow>,
      tops: ReadonlySet<string>,
    ) => {
      const changed = new Set<string>()
      const inserted = new Set<string>()
      const removed = new Set<string>()
      const previous = new Map<string, object>()
      for (const [id, row] of replaced) {
        const old = prev.rowsById[id]!
        changed.add(id)
        previous.set(id, old)
        if (!tops.has(id)) continue
        const before = new Map(
          subtree(old)
            .slice(1)
            .map(r => [r.id, r]),
        )
        for (const child of subtree(row).slice(1)) {
          const was = before.get(child.id)
          if (was) {
            changed.add(child.id)
            previous.set(child.id, was)
            before.delete(child.id)
          } else inserted.add(child.id)
        }
        for (const [childId, was] of before) {
          removed.add(childId)
          previous.set(childId, was)
        }
      }
      return { prev, changed, inserted, removed, previous }
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
      // Смена data при тех же ответах — из прежней модели по тождеству строк (ADR 0194).
      if (prev && prev.loaded === answers) {
        const patched = withAnswers(answers, () =>
          patchCoreModel<TData>(table, prev.model, prev.data, data),
        )
        if (patched) {
          last = { data, loaded: answers, model: patched as CoreModel }
          autoResetOnDataChange(table)
          return patched as never
        }
      }
      // Новые ответы — сборка заново без автосбросов, как у нового мемо TanStack.
      if (loaded !== UNSET && answers !== loaded) built = undefined
      loaded = answers
      const model = withAnswers(answers, () =>
        buildCoreModel(table, data as readonly unknown[]),
      ) as unknown as CoreModel
      if (built && built.deref() !== data) {
        queueMicrotask(() => autoResetOnDataChange(table))
      }
      // Слабо: после правок прежний data держали бы только мы (ADR 0200, EN26).
      built = new WeakRef(data as object)
      last = { data, loaded: answers, model }
      return model as never
    }
  }
