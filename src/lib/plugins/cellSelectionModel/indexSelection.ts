/**
 * Выделение ячеек по индексам строк (ADR 0146, §1–§2). У источника с ключами по индексу
 * (серверная модель строк) методы фичи TanStack работают по индексам источника: строки
 * могут быть не загружены, их id неизвестны. Иначе — стоковые методы.
 */
import { logWarn } from '../../util/logger'
import {
  followRowList as followRows,
  followSpans,
  shiftIndexSpan,
} from '../../core/rowListFollow'
import {
  type RowListChange,
  type RowSource,
  rowSourceOf,
} from '../../core/rowSource'
import type { TableFeature } from '../../types'
import {
  applyBoundsOperations,
  type BoundsOperation,
  isWithinBounds,
  type SelectionBounds,
} from './selectionGeometry'

/** Диапазон выделения: в серверной модели — индексы строк, иначе — id строк. */
export interface CellSelectionRange {
  anchorRowId?: string
  focusRowId?: string
  anchorRowIndex?: number
  focusRowIndex?: number
  anchorColumnId: string
  focusColumnId: string
  /** Как диапазон меняет выделение диапазонов до него; по умолчанию `include`. */
  operation?: 'include' | 'exclude'
}

export type CellSelectionState = CellSelectionRange[]

type Direction = 'up' | 'down' | 'left' | 'right'

interface Row {
  id: string
  getAllCellsByColumnId: () => Record<string, Cell | undefined>
}

interface Column {
  id: string
  columnDef: { enableCellSelection?: unknown }
}

interface Cell {
  id: string
  row: Row
  column: Column
  getCanSelect: () => boolean
  getValue: () => unknown
}

interface SelectionTable {
  atoms: { cellSelection?: { get: () => CellSelectionState | undefined } }
  options: {
    enableCellSelection?: unknown
    enableCellRangeSelection?: boolean
    enableMultiCellRangeSelection?: boolean
    enableCellSelectionDrag?: boolean
    isCellRangeSelectionEvent?: (event: unknown) => boolean
    isMultiCellRangeSelectionEvent?: (event: unknown) => boolean
  }
  setCellSelection: (
    updater: (old: CellSelectionState) => CellSelectionState,
  ) => void
  getCellSelectionColumnIndexes: () => Record<string, number>
  getColumn: (id: string) => Column | undefined
  _isSelectingCells?: boolean
}

type Method = (...args: never[]) => unknown

/**
 * По индексам источника — в серверной модели и пока над источником стоит слой строк до
 * сохранения (ADR 0178, §7): диапазон идёт по видимому списку, а не по модели строк.
 */
export const isIndexSelection = (table: unknown): boolean => {
  const source = rowSourceOf(table)
  return source.keyByIndex === true || source.base !== undefined
}

const hasIndexes = (range: CellSelectionRange) =>
  typeof range.anchorRowIndex === 'number' &&
  typeof range.focusRowIndex === 'number'

const rangesOf = (t: SelectionTable): CellSelectionState =>
  t.atoms.cellSelection?.get() ?? []

const columnOrder = new WeakMap<Record<string, number>, string[]>()

/** Колонки выделения в порядке экрана — из стокового словаря «id → место». */
const columnIdsOf = (t: SelectionTable): string[] => {
  const indexes = t.getCellSelectionColumnIndexes()
  let ids = columnOrder.get(indexes)
  if (!ids) {
    ids = []
    for (const [id, index] of Object.entries(indexes)) ids[index] = id
    columnOrder.set(indexes, ids)
  }
  return ids
}

/** Колонки, где ячейки выбираемы по настройке колонки (как у стоковой фичи). */
const selectableColumnIds = (t: SelectionTable): string[] =>
  t.options.enableCellSelection === false
    ? []
    : columnIdsOf(t).filter(
        id => t.getColumn(id)?.columnDef.enableCellSelection !== false,
      )

const rowIndexes = new WeakMap<
  object,
  { key: string; list: unknown; index: number }
>()

/** Место строки в списке; кэш до смены выборки, раскладки или клиентского списка. */
const rowIndexOf = (source: RowSource, row: Row): number => {
  const key = `${source.epoch?.() ?? 0}:${source.version?.() ?? 0}`
  const list = source.rows?.()
  const known = rowIndexes.get(row)
  if (known?.key === key && known.list === list) return known.index
  const index = source.indexOf(row.id)
  rowIndexes.set(row, { key, list, index })
  return index
}

/** Выделение по индексам одной таблицы: прямоугольники — один раз на смену входов. */
const createIndexSelection = (t: SelectionTable) => {
  const source = () => rowSourceOf<Row>(t)
  let cache:
    | {
        ranges: CellSelectionState
        columns: Record<string, number>
        count: number
        bounds: SelectionBounds[]
      }
    | undefined
  let warned = false

  /** Серверная модель: диапазон — индексы; клиентская — id строк, индексы по источнику. */
  const byIndex = () => source().keyByIndex === true
  const resolve = (range: CellSelectionRange): CellSelectionRange | null => {
    if (byIndex()) return range
    const anchorRowIndex =
      range.anchorRowId !== undefined
        ? indexOfId(range.anchorRowId)
        : (range.anchorRowIndex ?? -1)
    const focusRowIndex =
      range.focusRowId !== undefined
        ? indexOfId(range.focusRowId)
        : (range.focusRowIndex ?? -1)
    if (anchorRowIndex < 0 || focusRowIndex < 0) return null
    return { ...range, anchorRowIndex, focusRowIndex }
  }
  let resolved:
    | { ranges: CellSelectionState; list: unknown; value: CellSelectionState }
    | undefined
  /** Диапазоны с индексами по видимому списку — одни на срез и список. */
  const live = (): CellSelectionState => {
    const ranges = rangesOf(t)
    if (byIndex()) return ranges
    const list = source().rows?.()
    if (resolved?.ranges !== ranges || resolved.list !== list) {
      resolved = {
        ranges,
        list,
        value: ranges.flatMap(range => resolve(range) ?? []),
      }
    }
    return resolved.value
  }
  /** Клиентский диапазон хранит и id строк: без слоя его читает стоковая фича. */
  const withIds = (ranges: CellSelectionState): CellSelectionState =>
    byIndex()
      ? ranges
      : ranges.map(range => ({
          ...range,
          anchorRowId: source().at(range.anchorRowIndex ?? -1)?.id,
          focusRowId: source().at(range.focusRowIndex ?? -1)?.id,
        }))
  const write = (updater: (old: CellSelectionState) => CellSelectionState) =>
    t.setCellSelection(old => withIds(updater(byIndex() ? old : live())))

  const bounds = (): SelectionBounds[] => {
    const ranges = live()
    const columns = t.getCellSelectionColumnIndexes()
    const count = source().count()
    if (
      cache?.ranges === ranges &&
      cache.columns === columns &&
      cache.count === count
    ) {
      return cache.bounds
    }
    const operations: BoundsOperation[] = []
    for (const range of ranges) {
      if (!hasIndexes(range)) {
        if (!warned && byIndex()) {
          warned = true
          logWarn(
            t as never,
            'cellSelection: with serverRowModel a range needs anchorRowIndex and focusRowIndex — it is ignored',
            'cellSelection:rowIndex',
          )
        }
        continue
      }
      const anchorColumn = columns[range.anchorColumnId] ?? -1
      const focusColumn = columns[range.focusColumnId] ?? -1
      const top = Math.min(range.anchorRowIndex!, range.focusRowIndex!)
      const bottom = Math.min(
        Math.max(range.anchorRowIndex!, range.focusRowIndex!),
        count - 1,
      )
      if (anchorColumn < 0 || focusColumn < 0 || top < 0 || top > bottom) {
        continue
      }
      operations.push({
        minRowIndex: top,
        maxRowIndex: bottom,
        minColumnIndex: Math.min(anchorColumn, focusColumn),
        maxColumnIndex: Math.max(anchorColumn, focusColumn),
        operation: range.operation ?? 'include',
      })
    }
    cache = {
      ranges,
      columns,
      count,
      bounds: applyBoundsOperations(operations),
    }
    return cache.bounds
  }

  const select = (range: CellSelectionRange, mode = 'replace') =>
    write(old => {
      const next: CellSelectionRange = {
        anchorRowIndex: range.anchorRowIndex,
        focusRowIndex: range.focusRowIndex,
        anchorColumnId: range.anchorColumnId,
        focusColumnId: range.focusColumnId,
        ...(mode === 'exclude' ? { operation: 'exclude' as const } : {}),
      }
      return mode === 'replace' ? [next] : [...old, next]
    })

  const indexOfId = (rowId: string | undefined) =>
    rowId === undefined ? -1 : source().indexOf(rowId)

  const single = (rowIndex: number, columnId: string) =>
    select({
      anchorRowIndex: rowIndex,
      focusRowIndex: rowIndex,
      anchorColumnId: columnId,
      focusColumnId: columnId,
    })

  /** Шаг от `[rowIndex, columnId]`: невыбираемые колонки перешагиваются. */
  const step = (rowIndex: number, columnId: string, direction: Direction) => {
    const columns = columnIdsOf(t)
    const selectable = new Set(selectableColumnIds(t))
    const count = source().count()
    if (!count || !selectable.size) return null
    const rowDelta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0
    const columnDelta =
      direction === 'left' ? -1 : direction === 'right' ? 1 : 0
    const nextRow = rowIndex + rowDelta
    if (nextRow < 0 || nextRow >= count) return null
    let column = columns.indexOf(columnId)
    if (column < 0) return null
    if (columnDelta) {
      do column += columnDelta
      while (
        column >= 0 &&
        column < columns.length &&
        !selectable.has(columns[column]!)
      )
    }
    const landing = columns[column]
    if (landing === undefined || !selectable.has(landing)) return null
    return { rowIndex: nextRow, columnId: landing }
  }

  const activeRange = () => live().at(-1)

  const table: Record<string, Method> = {
    getCellSelectionBounds: () => bounds(),
    setFocusedCell: ((rowId: string, columnId: string) => {
      const rowIndex = indexOfId(rowId)
      if (rowIndex >= 0) single(rowIndex, columnId)
    }) as Method,
    selectCellRange: ((
      range: CellSelectionRange,
      opts?: { mode?: string; additive?: boolean },
    ) => {
      const anchorRowIndex =
        range.anchorRowIndex ?? indexOfId(range.anchorRowId)
      const focusRowIndex = range.focusRowIndex ?? indexOfId(range.focusRowId)
      if (anchorRowIndex < 0 || focusRowIndex < 0) return
      select(
        { ...range, anchorRowIndex, focusRowIndex },
        opts?.mode ?? (opts?.additive ? 'include' : 'replace'),
      )
    }) as Method,
    selectAllCells: () => {
      const count = source().count()
      const columns = selectableColumnIds(t)
      if (!count || !columns.length) return
      select({
        anchorRowIndex: 0,
        focusRowIndex: count - 1,
        anchorColumnId: columns[0]!,
        focusColumnId: columns.at(-1)!,
      })
    },
    getFocusedCell: () => {
      const active = activeRange()
      if (!active || !hasIndexes(active)) return undefined
      return source().at(active.anchorRowIndex!)?.getAllCellsByColumnId()[
        active.anchorColumnId
      ]
    },
    moveCellSelection: ((direction: Direction) => {
      const active = activeRange()
      if (!active || !hasIndexes(active)) {
        const columns = selectableColumnIds(t)
        if (source().count() && columns.length) single(0, columns[0]!)
        return
      }
      const next = step(
        active.anchorRowIndex!,
        active.anchorColumnId,
        direction,
      )
      if (next) single(next.rowIndex, next.columnId)
    }) as Method,
    extendCellSelection: ((direction: Direction) => {
      const active = activeRange()
      if (!active || !hasIndexes(active)) {
        ;(table.moveCellSelection as (d: Direction) => void)(direction)
        return
      }
      const next = step(active.focusRowIndex!, active.focusColumnId, direction)
      if (!next) return
      write(old =>
        old.length
          ? [
              ...old.slice(0, -1),
              {
                ...old.at(-1)!,
                focusRowIndex: next.rowIndex,
                focusColumnId: next.columnId,
              },
            ]
          : old,
      )
    }) as Method,
    // Значения загруженных строк; у незагруженных — `undefined` по ширине региона.
    getSelectedCellRangesData: () => {
      const columns = columnIdsOf(t)
      return bounds().map(bound => {
        const grid: unknown[][] = []
        for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
          const cells = source().at(r)?.getAllCellsByColumnId()
          const values: unknown[] = []
          for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
            const cell = cells?.[columns[c]!]
            if (cells && (!cell || !cell.getCanSelect())) continue
            values.push(cell?.getValue())
          }
          grid.push(values)
        }
        return grid
      })
    },
    getSelectedCellCount: () => {
      const columns = columnIdsOf(t)
      let count = 0
      for (const bound of bounds()) {
        let width = 0
        for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
          const column = t.getColumn(columns[c]!)
          if (column?.columnDef.enableCellSelection !== false) width++
        }
        count += (bound.maxRowIndex - bound.minRowIndex + 1) * width
      }
      return count
    },
    // Id известны только у загруженных строк.
    getCellSelectionRowIds: () => {
      const ids: string[] = []
      for (const bound of bounds()) {
        for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
          const row = source().at(r)
          if (row && !ids.includes(row.id)) ids.push(row.id)
        }
      }
      return ids
    },
    getSelectedCellIds: () => {
      const columns = columnIdsOf(t)
      const ids: string[] = []
      for (const bound of bounds()) {
        for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
          const cells = source().at(r)?.getAllCellsByColumnId()
          if (!cells) continue
          for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
            const cell = cells[columns[c]!]
            if (cell?.getCanSelect()) ids.push(cell.id)
          }
        }
      }
      return ids
    },
  }

  /** Место ячейки: `null` — ячейка невыбираема или её строки нет в списке. */
  const positionOf = (cell: Cell) => {
    if (!cell.getCanSelect()) return null
    const rowIndex = rowIndexOf(source(), cell.row)
    const columnIndex = t.getCellSelectionColumnIndexes()[cell.column.id] ?? -1
    return rowIndex < 0 || columnIndex < 0 ? null : { rowIndex, columnIndex }
  }

  const isFocused = (cell: Cell) => {
    const active = activeRange()
    return (
      !!active &&
      hasIndexes(active) &&
      active.anchorColumnId === cell.column.id &&
      active.anchorRowIndex === rowIndexOf(source(), cell.row)
    )
  }

  const cell: Record<string, (cell: Cell, ...args: never[]) => unknown> = {
    getIsSelected: c => {
      const at = positionOf(c)
      return !!at && isWithinBounds(bounds(), at.rowIndex, at.columnIndex)
    },
    getIsFocused: c => isFocused(c),
    getTabIndex: c => (isFocused(c) ? 0 : -1),
    getSelectionEdges: c => {
      const at = positionOf(c)
      const b = bounds()
      if (!at || !isWithinBounds(b, at.rowIndex, at.columnIndex)) {
        return { top: false, right: false, bottom: false, left: false }
      }
      const { rowIndex: r, columnIndex: k } = at
      return {
        top: !isWithinBounds(b, r - 1, k),
        right: !isWithinBounds(b, r, k + 1),
        bottom: !isWithinBounds(b, r + 1, k),
        left: !isWithinBounds(b, r, k - 1),
      }
    },
    // Как у стоковой фичи: Shift — фокус диапазона сюда, Ctrl/Cmd — ещё диапазон или
    // исключение выделенного, протяжка — до отпускания кнопки.
    getSelectionStartHandler: (c, contextDocument?: Document) => {
      const canSelect = c.getCanSelect()
      return (event: unknown) => {
        if (!canSelect) return
        const { options } = t
        const doc =
          contextDocument ?? (typeof document === 'undefined' ? null : document)
        const range =
          options.enableCellRangeSelection !== false &&
          (options.isCellRangeSelectionEvent?.(event) ?? false)
        const multi =
          options.enableMultiCellRangeSelection !== false &&
          (options.isMultiCellRangeSelectionEvent?.(event) ?? false)
        if (
          options.enableCellSelectionDrag !== false &&
          options.enableCellRangeSelection !== false &&
          doc
        ) {
          t._isSelectingCells = true
          const up = () => {
            doc.removeEventListener('mouseup', up)
            t._isSelectingCells = false
          }
          doc.addEventListener('mouseup', up)
        }
        const rowIndex = rowIndexOf(source(), c.row)
        if (rowIndex < 0) return
        const columnId = c.column.id
        const exclude = multi && (cell.getIsSelected!(c) as boolean)
        write(old => {
          const active = old.at(-1)
          if (range && active && hasIndexes(active)) {
            return [
              ...old.slice(0, -1),
              { ...active, focusRowIndex: rowIndex, focusColumnId: columnId },
            ]
          }
          const next: CellSelectionRange = {
            anchorRowIndex: rowIndex,
            focusRowIndex: rowIndex,
            anchorColumnId: columnId,
            focusColumnId: columnId,
            ...(exclude ? { operation: 'exclude' as const } : {}),
          }
          return multi ? [...old, next] : [next]
        })
      }
    },
    getSelectionExtendHandler: c => {
      const canSelect = c.getCanSelect()
      return () => {
        if (!canSelect || !t._isSelectingCells) return
        const active = activeRange()
        const rowIndex = rowIndexOf(source(), c.row)
        if (!active || !hasIndexes(active) || rowIndex < 0) return
        if (
          active.focusRowIndex === rowIndex &&
          active.focusColumnId === c.column.id
        ) {
          return
        }
        write(old =>
          old.length
            ? [
                ...old.slice(0, -1),
                {
                  ...old.at(-1)!,
                  focusRowIndex: rowIndex,
                  focusColumnId: c.column.id,
                },
              ]
            : old,
        )
      }
    },
  }

  return { table, cell }
}

const engines = new WeakMap<object, ReturnType<typeof createIndexSelection>>()

const engineOf = (table: unknown) => {
  let engine = engines.get(table as object)
  if (!engine) {
    engine = createIndexSelection(table as SelectionTable)
    engines.set(table as object, engine)
  }
  return engine
}

/**
 * Фича поверх `cellSelectionFeature`: при ключах строк по индексу её методы таблицы и
 * ячейки — по индексам источника. Стоит в наборе после стоковой фичи.
 */
export const indexCellSelectionFeature: TableFeature = {
  constructTableAPIs: table => {
    const t = table as unknown as Record<string, Method>
    for (const name of Object.keys(engineOf(table).table)) {
      const stock = t[name]
      t[name] = ((...args: never[]) =>
        isIndexSelection(table)
          ? engineOf(table).table[name]!(...args)
          : stock?.(...args)) as Method
    }
  },
  assignCellPrototype: (prototype, table) => {
    const p = prototype as Record<string, Method>
    for (const name of Object.keys(engineOf(table).cell)) {
      const stock = p[name]
      p[name] = function (this: Cell, ...args: never[]) {
        return isIndexSelection(table)
          ? engineOf(table).cell[name]!(this, ...args)
          : stock?.apply(this, args)
      } as Method
    }
  },
}

/** Смена списка `change` под диапазоном: выше — сдвиг, ниже — без изменений, внутри — `null`. */
const shiftRange = (
  range: CellSelectionRange,
  change: RowListChange,
): CellSelectionRange | null => {
  if (!hasIndexes(range)) return range
  const delta = shiftIndexSpan(
    Math.min(range.anchorRowIndex!, range.focusRowIndex!),
    Math.max(range.anchorRowIndex!, range.focusRowIndex!),
    change,
  )
  if (delta === null) return null
  if (delta === 0) return range
  return {
    ...range,
    anchorRowIndex: range.anchorRowIndex! + delta,
    focusRowIndex: range.focusRowIndex! + delta,
  }
}

interface FollowTable {
  store: { get: () => Record<string, unknown> }
  setCellSelection: (
    updater: (old: CellSelectionState) => CellSelectionState,
  ) => void
}

/**
 * Выделение по индексам следует за списком (ADR 0146, §6): новая выборка сбрасывает его,
 * смена строк выше диапазона сдвигает, внутри — сбрасывает.
 */
export const followRowList = (table: unknown) => {
  const t = table as FollowTable
  const ranges = () => (t.store.get().cellSelection ?? []) as CellSelectionState
  return followRows(table, {
    active: () => ranges().length > 0,
    reset: () => t.setCellSelection(() => []),
    shift: batches => {
      const current = ranges()
      const next = followSpans(current, batches, shiftRange)
      if (next === null) t.setCellSelection(() => [])
      else if (next.some((range, index) => range !== current[index])) {
        t.setCellSelection(() => next)
      }
    },
  })
}
