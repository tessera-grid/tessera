/**
 * Смена `data` по тождеству строк (ADR 0194, §1–§2): новая модель ядра собирается из прежней.
 * Строка с прежним объектом данных на прежнем месте — прежний объект строки; изменённые,
 * вставленные и строки со сдвинутым индексом — новые объекты; удалённые уходят. Перестановка
 * или изменённых, вставленных и удалённых строк больше порога — полная сборка (`undefined`). Смена записывается для моделей
 * ниже по конвейеру (§3).
 */
import { constructRow, makeObjectMap } from '@tanstack/react-table'

import { recordRowChange } from './rowChanges'
import { handOverRowsById } from './rowsByIdHandover'

export interface ChangeRow {
  id: string
  index: number
  depth: number
  original: unknown
  parentId?: string
  subRows: ChangeRow[]
  originalSubRows?: unknown[]
  _valuesCache?: Record<string, unknown>
}

export interface ChangeModel {
  rows: ChangeRow[]
  flatRows: ChangeRow[]
  rowsById: Record<string, ChangeRow>
}

/** Смена модели относительно прежней: id строк по виду смены, на любой глубине. */
export interface RowModelChange {
  /** Модель, из которой собрана эта: смена годится, только если модель ниже собрана из неё. */
  prev: object
  /** Тот же id, другой объект данных. */
  changed: ReadonlySet<string>
  inserted: ReadonlySet<string>
  /** Удалённые строки вместе с их поддеревьями. */
  removed: ReadonlySet<string>
  /**
   * Сдвигов нет: строки вне `changed`, `inserted`, `removed` — прежние объекты на прежних
   * местах; `previous` — прежние объекты изменённых и удалённых строк.
   */
  inPlace?: boolean
  previous?: ReadonlyMap<string, object>
}

const changes = new WeakMap<object, RowModelChange>()

/** Смена, с которой собрана модель; у модели полной сборки её нет. */
export const rowModelChangeOf = (model: object): RowModelChange | undefined =>
  changes.get(model)

/** Смена модели и место первого отличия её строк от прежних — подсказка виртуализатору (ADR 0145). */
export const recordRowModelChange = (
  model: { rows: readonly object[] },
  change: RowModelChange,
) => {
  changes.set(model, change)
  const before = (change.prev as { rows?: readonly object[] }).rows
  const { rows } = model
  if (!before || rows === before) return
  const end = Math.min(rows.length, before.length)
  let from = 0
  while (from < end && rows[from] === before[from]) from++
  recordRowChange(rows, before, from)
}

/** Доля строк, после которой полная сборка не дороже инкремента. */
export const PATCH_LIMIT = 0.25

interface DataTable<TData> {
  options: {
    getRowId?: unknown
    getSubRows?: (row: TData, index: number) => TData[] | undefined
  }
  getRowId: (row: TData, index: number, parent?: ChangeRow) => string
  getAllFlatColumns: () => {
    id: string
    accessorFn?: (...args: never[]) => unknown
  }[]
}

const subtreeIds = (row: ChangeRow, into: Set<string>) => {
  into.add(row.id)
  for (const child of row.subRows) subtreeIds(child, into)
}

/**
 * Модель ядра для `data` из прежней модели, собранной на `prevData`, или `undefined` —
 * тогда полная сборка. Прежняя модель не меняется.
 */
export const patchCoreModel = <TData>(
  table: unknown,
  prev: ChangeModel,
  prevData: unknown,
  data: unknown,
): ChangeModel | undefined => {
  if (!Array.isArray(prevData) || !Array.isArray(data)) return undefined
  const t = table as DataTable<TData>
  const byId = typeof t.options.getRowId === 'function'
  const getSubRows = t.options.getSubRows
  let budget = Math.max(1, prev.flatRows.length * PATCH_LIMIT)
  const changed = new Set<string>()
  const inserted = new Set<string>()
  const removed = new Set<string>()
  let failed = false
  // Колонки, чьё значение зависит от индекса строки: `accessorFn(original, index)`.
  let byIndex: Set<string> | undefined
  const carryValues = (from: ChangeRow, to: ChangeRow) => {
    byIndex ??= new Set(
      t
        .getAllFlatColumns()
        .filter(column => (column.accessorFn?.length ?? 0) > 1)
        .map(column => column.id),
    )
    const values = from._valuesCache
    const into = to._valuesCache
    if (!values || !into) return
    for (const key in values) {
      if (!byIndex.has(key)) into[key] = values[key]
    }
  }

  const spend = (count: number) => {
    budget -= count
    if (budget < 0) failed = true
  }

  const construct = (
    original: TData,
    index: number,
    depth: number,
    parent: ChangeRow | undefined,
    id: string,
  ) =>
    constructRow(
      table as never,
      id,
      original as never,
      index,
      depth,
      undefined,
      parent?.id,
    ) as unknown as ChangeRow

  /** Поддерево новой строки целиком — обходом `accessRows` TanStack. */
  const build = (
    original: TData,
    index: number,
    depth: number,
    parent: ChangeRow | undefined,
    id: string,
  ): ChangeRow => {
    const row = construct(original, index, depth, parent, id)
    inserted.add(id)
    spend(1)
    if (getSubRows) {
      row.originalSubRows = getSubRows(original, index)
      if (row.originalSubRows?.length) {
        row.subRows = (row.originalSubRows as TData[]).map((child, i) =>
          build(child, i, depth + 1, row, t.getRowId(child, i, row)),
        )
      }
    }
    return row
  }

  /** Уровень дерева: строки для `originals` из прежних строк уровня. */
  const level = (
    prevRows: readonly ChangeRow[],
    originals: readonly TData[],
    depth: number,
    parent: ChangeRow | undefined,
  ): ChangeRow[] => {
    if (prevRows.length === originals.length) {
      let same = true
      for (let i = 0; i < originals.length; i++) {
        if (prevRows[i]!.original !== originals[i]) {
          same = false
          break
        }
      }
      if (same && parent === undefined) return prevRows as ChangeRow[]
      if (same && prevRows.every(row => row.parentId === parent?.id)) {
        return prevRows as ChangeRow[]
      }
    }
    // Без getRowId id строки — её место: вставка и удаление сдвигают все id.
    if (!byId && prevRows.length !== originals.length) {
      failed = true
      return []
    }
    const prevAt = new Map<string, ChangeRow>()
    for (const row of prevRows) prevAt.set(row.id, row)
    const seen = new Set<string>()
    const rows = new Array<ChangeRow>(originals.length)
    // Вставка и удаление не меняют порядок выживших строк; нарушен — это перестановка.
    let lastIndex = -1
    for (let i = 0; i < originals.length && !failed; i++) {
      const original = originals[i]!
      const id = t.getRowId(original, i, parent)
      if (seen.has(id)) {
        failed = true
        break
      }
      seen.add(id)
      const old = prevAt.get(id)
      if (!old) {
        rows[i] = build(original, i, depth, parent, id)
        continue
      }
      prevAt.delete(id)
      if (old.index < lastIndex) {
        failed = true
        break
      }
      lastIndex = old.index
      if (old.original === original) {
        if (old.index === i) {
          rows[i] = old
          continue
        }
        // Сдвиг: данные те же, место другое — новый объект, поддерево и значения ячеек
        // прежние. Ниже по конвейеру сдвиг не работа: модели находят строку по id.
        const row = construct(original, i, depth, parent, id)
        row.originalSubRows = old.originalSubRows
        row.subRows = old.subRows
        carryValues(old, row)
        rows[i] = row
        continue
      }
      changed.add(id)
      spend(1)
      const row = construct(original, i, depth, parent, id)
      if (getSubRows) {
        row.originalSubRows = getSubRows(original, i)
        if (row.originalSubRows?.length) {
          row.subRows = level(
            old.subRows,
            row.originalSubRows as TData[],
            depth + 1,
            row,
          )
        } else {
          for (const child of old.subRows) subtreeIds(child, removed)
        }
      }
      rows[i] = row
    }
    for (const old of prevAt.values()) {
      subtreeIds(old, removed)
    }
    spend(prevAt.size)
    return rows
  }

  /**
   * Плоские данные без сдвигов — замена на месте и дописывание в конец: строки сверяются по
   * местам, без словаря id; массивы — копией прежних, словарь `rowsById` переходит новой
   * модели (ADR 0069). `null` — случай не этот.
   */
  const patchFlat = (): ChangeModel | undefined | null => {
    const prevRows = prev.rows
    const originals = data as TData[]
    if (
      prev.flatRows.length !== prevRows.length ||
      originals.length < prevRows.length
    ) {
      return null
    }
    const leaf = (original: TData, index: number) =>
      !getSubRows?.(original, index)?.length
    const replaced: number[] = []
    for (let i = 0; i < prevRows.length; i++) {
      const old = prevRows[i]!
      const original = originals[i]!
      if (old.original === original) continue
      if (t.getRowId(original, i, undefined) !== old.id || !leaf(original, i)) {
        return null
      }
      replaced.push(i)
      if (replaced.length > budget) return undefined
    }
    if (replaced.length + originals.length - prevRows.length > budget) {
      return undefined
    }
    const before = prev.rowsById
    const added: [number, string][] = []
    const fresh = new Set<string>()
    for (let i = prevRows.length; i < originals.length; i++) {
      const id = t.getRowId(originals[i]!, i, undefined)
      if (before[id] || fresh.has(id) || !leaf(originals[i]!, i)) return null
      fresh.add(id)
      added.push([i, id])
    }
    if (!replaced.length && !added.length) return prev
    const rows = prevRows.slice()
    const place = (i: number, id: string) => {
      const row = construct(originals[i]!, i, 0, undefined, id)
      if (getSubRows) row.originalSubRows = getSubRows(originals[i]!, i)
      rows[i] = row
      return row
    }
    const previous = new Map<string, object>()
    for (const i of replaced) previous.set(prevRows[i]!.id, prevRows[i]!)
    const changedRows = replaced.map(i => place(i, prevRows[i]!.id))
    const addedRows = added.map(([i, id]) => place(i, id))
    const rowsById = handOverRowsById(prev) as Record<string, ChangeRow>
    for (const row of changedRows) {
      rowsById[row.id] = row
      changed.add(row.id)
    }
    for (const row of addedRows) {
      rowsById[row.id] = row
      inserted.add(row.id)
    }
    const model: ChangeModel = { rows, flatRows: rows.slice(), rowsById }
    recordRowModelChange(model, {
      prev,
      changed,
      inserted,
      removed,
      inPlace: true,
      previous,
    })
    return model
  }
  const flat = patchFlat()
  if (flat !== null) return flat

  const rows = level(prev.rows, data as TData[], 0, undefined)
  if (failed) return undefined
  if (rows === prev.rows) return prev

  const flatRows: ChangeRow[] = []
  const walk = (list: readonly ChangeRow[]) => {
    for (const row of list) {
      flatRows.push(row)
      if (row.subRows.length) walk(row.subRows)
    }
  }
  walk(rows)
  const rowsById = makeObjectMap<ChangeRow>()
  for (const row of flatRows) rowsById[row.id] = row
  const model: ChangeModel = { rows, flatRows, rowsById }
  recordRowModelChange(model, { prev, changed, inserted, removed })
  return model
}
