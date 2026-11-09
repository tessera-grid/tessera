/**
 * Смена `data` по тождеству строк (ADR 0194, §1–§2): новая модель ядра собирается из прежней.
 * Строка с прежним объектом данных — прежний объект строки, сдвинутая — с новым `index`
 * (ADR 0199, §1); изменённые, вставленные и перенесённые — новые объекты; удалённые уходят.
 * Изменённых, вставленных, перенесённых и удалённых строк больше порога — полная сборка
 * (`undefined`). Смена записывается для моделей ниже по конвейеру (§3).
 */
import { constructRow, makeObjectMap } from '@tanstack/react-table'

import { recordRowChange } from './rowChanges'
import { positionOf, setPosition } from './rowPosition'
import { RowDict, dictModel, editDictOf } from './rowEngine/rowDict'

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
  readonly rowsById: Record<string, ChangeRow>
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
   * Строки вне `changed`, `inserted`, `removed` — прежние объекты в прежнем порядке; места
   * могли сдвинуться, `index` у них новый (ADR 0199, §3).
   */
  inPlace?: boolean
  /**
   * Прежние объекты изменённых, перенесённых и удалённых строк: стадии берут прежнее отсюда, а не
   * из словаря прежней модели — хранилище меняется на месте (ADR 0200, §2, EN32).
   */
  previous?: ReadonlyMap<string, object>
}

const changes = new WeakMap<object, RowModelChange>()
/** Отпущенная запись: стадии её не применяют — смена уже прочитана всеми. */
const RELEASED: object = Object.freeze({})

/** Смена, с которой собрана модель; у модели полной сборки её нет. */
export const rowModelChangeOf = (model: object): RowModelChange | undefined =>
  changes.get(model)

/** Смена модели и место первого отличия её строк от прежних — подсказка виртуализатору (ADR 0145). */
export const recordRowModelChange = (
  model: { rows: readonly object[] },
  change: RowModelChange,
) => {
  changes.set(model, change)
  // Запись прежней модели больше не прочтут: цепочка моделей держала бы прежние строки (EN26).
  changes.delete(change.prev)
  const before = (change.prev as { rows?: readonly object[] }).rows
  const { rows } = model
  if (!before || rows === before) return
  const end = Math.min(rows.length, before.length)
  let from = 0
  while (from < end && rows[from] === before[from]) from++
  recordRowChange(rows, before, from)
}

/**
 * Смена прочитана всеми стадиями (ADR 0200, EN26): запись остаётся видом смены, а прежняя модель
 * и прежние объекты строк отпускаются — удалённая строка уходит из памяти.
 */
export const releaseRowModelChange = (model: object) => {
  const change = changes.get(model)
  if (change && change.prev !== RELEASED) {
    changes.set(model, { ...change, prev: RELEASED, previous: undefined })
  }
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

/**
 * Места выживших строк уровня, которые перенесены: вне наибольшей возрастающей цепочки их
 * прежних мест. Без переносов — пусто за один проход.
 */
const movedPositions = (
  olds: readonly ({ index: number } | undefined)[],
): ReadonlySet<number> => {
  let last = -1
  let ordered = true
  for (const old of olds) {
    if (!old) continue
    if (positionOf(old) < last) {
      ordered = false
      break
    }
    last = positionOf(old)
  }
  if (ordered) return new Set()
  // Терпеливая сортировка: tails[k] — место с наименьшим концом цепочки длины k + 1.
  const tails: number[] = []
  const before = new Int32Array(olds.length).fill(-1)
  for (let p = 0; p < olds.length; p++) {
    const old = olds[p]
    if (!old) continue
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (positionOf(olds[tails[mid]!]!) < positionOf(old)) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) before[p] = tails[lo - 1]!
    tails[lo] = p
  }
  const chain = new Set<number>()
  for (let p = tails[tails.length - 1] ?? -1; p >= 0; p = before[p]!) {
    chain.add(p)
  }
  const moved = new Set<number>()
  for (let p = 0; p < olds.length; p++) {
    if (olds[p] && !chain.has(p)) moved.add(p)
  }
  return moved
}

/** Новое место строки — тот же объект, место знает хранилище (ADR 0200, §5). */
const setRowIndex = (row: ChangeRow, index: number) => {
  setPosition(row, index)
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
  const spend = (count: number) => {
    budget -= count
    if (budget < 0) failed = true
  }

  // Новые места сдвинутых строк ставятся, только когда смена собрана: при отказе — полная сборка.
  const shifts: [ChangeRow, number][] = []
  const shiftRow = (row: ChangeRow, index: number) => {
    shifts.push([row, index])
  }
  const applyShifts = () => {
    if (!shifts.length) return
    for (const [row, index] of shifts) setRowIndex(row, index)
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
    const ids = new Array<string>(originals.length)
    const olds = new Array<ChangeRow | undefined>(originals.length)
    for (let i = 0; i < originals.length; i++) {
      const id = t.getRowId(originals[i]!, i, parent)
      if (seen.has(id)) {
        failed = true
        return []
      }
      seen.add(id)
      ids[i] = id
      olds[i] = prevAt.get(id)
      if (olds[i]) prevAt.delete(id)
    }
    // Выжившие вне наибольшей возрастающей цепочки прежних мест перенесены (ADR 0199, §2).
    const moved = movedPositions(olds)
    if (moved.size > 0) spend(moved.size)
    const rows = new Array<ChangeRow>(originals.length)
    for (let i = 0; i < originals.length && !failed; i++) {
      const original = originals[i]!
      const id = ids[i]!
      const old = olds[i]
      if (!old) {
        rows[i] = build(original, i, depth, parent, id)
        continue
      }
      const isMoved = moved.has(i)
      if (old.original === original && !isMoved) {
        // Сдвиг: тот же объект строки с новым местом (ADR 0199, §1).
        if (positionOf(old) !== i) shiftRow(old, i)
        rows[i] = old
        continue
      }
      changed.add(id)
      if (!isMoved) spend(1)
      const row = construct(original, i, depth, parent, id)
      if (old.original === original) {
        // Перенос: данные и поддерево прежние, место другое.
        row.originalSubRows = old.originalSubRows
        row.subRows = old.subRows
        rows[i] = row
        continue
      }
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
    const { dict, writer } = editDictOf(prev)
    for (const row of changedRows) {
      writer.set(row.id, row)
      changed.add(row.id)
    }
    for (const row of addedRows) {
      writer.set(row.id, row)
      inserted.add(row.id)
    }
    const model = dictModel(
      dict,
      writer.version,
      rows,
      rows.slice(),
    ) as ChangeModel
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

  /**
   * Плоские данные со сдвигами — вставка, удаление и перенос в середине (ADR 0199, §1–§2):
   * строки сверяются по объектам данных двумя указателями с шагом вперёд, id считается только у
   * несовпавших. Совпавшие — прежние объекты с новым местом; несовпавшая с прежним id —
   * изменена или перенесена; словарь переходит новой модели. `null` — случай не этот.
   */
  const patchShifted = (): ChangeModel | undefined | null => {
    const prevRows = prev.rows
    const originals = data as TData[]
    if (!byId || prev.flatRows.length !== prevRows.length) return null
    const n0 = prevRows.length
    const n1 = originals.length
    // Пары «прежняя строка — новое место» по тождеству данных, в порядке обоих списков: общее
    // начало и общий конец, середина — двумя указателями с шагом вперёд.
    const shortest = Math.min(n0, n1)
    let head = 0
    while (head < shortest && prevRows[head]!.original === originals[head]) {
      head++
    }
    let tail = 0
    while (
      tail < shortest - head &&
      prevRows[n0 - 1 - tail]!.original === originals[n1 - 1 - tail]
    ) {
      tail++
    }
    const lostOld: number[] = []
    const extraNew: number[] = []
    const oldEnd = n0 - tail
    const newEnd = n1 - tail
    // Место прежней строки для мест середины: -1 — несовпавшая.
    const keptAt = new Int32Array(newEnd - head).fill(-1)
    let i = head
    let j = head
    while (i < newEnd && j < oldEnd) {
      const original = originals[i]
      if (prevRows[j]!.original === original) {
        keptAt[i++ - head] = j++
      } else if (j + 1 < oldEnd && prevRows[j + 1]!.original === original) {
        lostOld.push(j++)
      } else if (i + 1 < newEnd && originals[i + 1] === prevRows[j]!.original) {
        extraNew.push(i++)
      } else {
        lostOld.push(j++)
        extraNew.push(i++)
      }
      // Шаги вперёд сбились — сверка по id на общем пути.
      if (lostOld.length + extraNew.length > budget * 2) return null
    }
    while (j < oldEnd) lostOld.push(j++)
    while (i < newEnd) extraNew.push(i++)
    if (!lostOld.length && !extraNew.length) return prev

    const leaf = (original: TData, index: number) =>
      !getSubRows?.(original, index)?.length
    const lostById = new Map<string, ChangeRow>()
    for (const at of lostOld) lostById.set(prevRows[at]!.id, prevRows[at]!)
    const before = prev.rowsById
    const fresh = new Set<string>()
    const middle = new Array<ChangeRow>(newEnd - head)
    const placed: ChangeRow[] = []
    const previous = new Map<string, object>()
    let spent = 0
    for (const at of extraNew) {
      const original = originals[at]!
      if (!leaf(original, at)) return null
      const id = t.getRowId(original, at, undefined)
      if (fresh.has(id)) return undefined
      fresh.add(id)
      const old = lostById.get(id)
      // Тот же id у строки, что осталась на месте, — повтор id в данных: полная сборка.
      if (!old && before[id]) return undefined
      if (++spent > budget) return undefined
      const row = construct(original, at, 0, undefined, id)
      if (getSubRows) row.originalSubRows = getSubRows(original, at)
      if (old) {
        // Перенос — те же данные на другом месте; иначе — новые данные строки.
        lostById.delete(id)
        changed.add(id)
        previous.set(id, old)
      } else {
        inserted.add(id)
      }
      placed.push(row)
      middle[at - head] = row
    }
    for (const old of lostById.values()) {
      if (++spent > budget) return undefined
      removed.add(old.id)
      previous.set(old.id, old)
    }

    // Смена собрана — у прежних строк середины и конца новые места; начало не сдвинулось.
    for (let k = 0; k < middle.length; k++) {
      const from = keptAt[k]!
      if (from < 0) continue
      const old = prevRows[from]!
      if (positionOf(old) !== head + k) setRowIndex(old, head + k)
      middle[k] = old
    }
    const end = prevRows.slice(oldEnd)
    if (n1 !== n0) {
      for (let k = 0; k < end.length; k++) {
        setRowIndex(end[k]!, newEnd + k)
      }
    }
    const rows = prevRows.slice(0, head).concat(middle, end)
    const { dict, writer } = editDictOf(prev)
    for (const id of removed) writer.delete(id)
    for (const row of placed) writer.set(row.id, row)
    const model = dictModel(
      dict,
      writer.version,
      rows,
      rows.slice(),
    ) as ChangeModel
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
  const shifted = patchShifted()
  if (shifted !== null) return shifted

  const rows = level(prev.rows, data as TData[], 0, undefined)
  if (failed) return undefined
  if (rows === prev.rows) return prev
  applyShifts()

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
  const dict = new RowDict(rowsById)
  const model = dictModel(dict, dict.version(), rows, flatRows) as ChangeModel
  // Прежние объекты — из словаря, который ядро ещё не меняло (ADR 0200, §2, EN32).
  const previous = new Map<string, object>()
  for (const ids of [changed, removed]) {
    for (const id of ids) {
      const old = prev.rowsById[id]
      if (old) previous.set(id, old)
    }
  }
  recordRowModelChange(model, { prev, changed, inserted, removed, previous })
  return model
}
