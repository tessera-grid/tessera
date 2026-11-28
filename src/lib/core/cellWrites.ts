/**
 * Канал записи в ячейки (ADR 0219, §1): вставку, очистку, вырезание и массовую правку просят
 * выделение, клавиши, меню и приложение, а исполняет правка. Ядро держит только форму
 * операции и место исполнителя — его кладёт в опции таблицы плагин правки.
 */

/** Where an operation came from: built-in triggers, the application, undo and redo (ADR 0222). */
export type CellWriteSource =
  | 'paste'
  | 'fill'
  | 'fillDown'
  | 'fillRight'
  | 'bulk'
  | 'clear'
  | 'cut'
  | 'api'
  | 'undo'
  | 'redo'

/** A cell of a saved write: values before and after, in the column type. */
export interface WrittenCell {
  rowId: string
  columnId: string
  before: unknown
  after: unknown
}

/** A row added or removed before saving (ADR 0222, §13): its values and place in the list. */
export interface WrittenRow {
  rowId: string
  change: 'insert' | 'delete'
  values: unknown
  /** Place in the visible list. */
  index: number
  /** The row above it; none means it is the first row. */
  after?: string
}

/** A row's place: its parent and position among its siblings. */
export interface RowPlace {
  parentId?: string
  index: number
}

/** A row move (ADR 0222, §13). */
export interface WrittenMove {
  rowId: string
  from: RowPlace
  to: RowPlace
}

/**
 * Result of a write operation (ADR 0222, §2): what was saved and what was rejected. `'edit'` is a
 * cell edit in the editor. `draft` means it was written as drafts in "Apply" mode, without the
 * server; `cancelled` means waiting was stopped, the result is unknown.
 */
export interface CellsWritten {
  id: string
  source: CellWriteSource | 'edit' | 'row' | 'move' | 'discard' | 'apply'
  cells: readonly WrittenCell[]
  /** The executor confirmed that cell keys in the write are distinct. */
  uniqueCells?: boolean
  refused: readonly { rowId: string; columnId: string }[]
  draft?: boolean
  cancelled?: boolean
  /** Rows before saving: added and removed (§13). */
  rows?: readonly WrittenRow[]
  /** The row move; absent on refusal, see `failed`. */
  move?: WrittenMove
  /** The move was rejected (§13). */
  failed?: boolean
  /** "Apply" saved this many changes (ADR 0222, §14); set for source `'apply'`. */
  applied?: number
}

/** Исполнитель переноса строки — плагин перетаскивания строк (ADR 0222, §13). */
export interface RowMover {
  /** Перенести строку на место тем же путём, что бросок; `false` — перенос невозможен. */
  move: (
    table: unknown,
    rowId: string,
    place: RowPlace,
    source: 'undo' | 'redo',
  ) => boolean
  /** Место строки сейчас; нет строки — `undefined`. */
  placeOf: (table: unknown, rowId: string) => RowPlace | undefined
}

type MoverTable = { options?: { rowMover?: RowMover } }

/** Исполнитель переноса таблицы; без плагина перетаскивания — `undefined`. */
export const rowMoverOf = (table: unknown): RowMover | undefined =>
  (table as MoverTable | undefined)?.options?.rowMover

type SettledTable = {
  options?: { cellsWritten?: (table: unknown, record: CellsWritten) => void }
}

/** Сообщить итог записи слушателю таблицы — плагину истории; без него ничего. */
export const notifyCellsWritten = (
  table: unknown,
  record: CellsWritten | (() => CellsWritten),
) =>
  (table as SettledTable | undefined)?.options?.cellsWritten?.(
    table,
    typeof record === 'function' ? record() : record,
  )

/**
 * A change to one cell: typed or pasted text is parsed by the column type, a value is written
 * as is.
 */
export type CellWrite =
  | { rowId: string; columnId: string; text: string }
  | { rowId: string; columnId: string; value: unknown }

export interface CellWriteOptions {
  source?: CellWriteSource
}

/** Limits of one cell write operation (ADR 0223, §1). */
export interface WriteLimits {
  /** More cells than this — ask before writing. */
  confirm?: number
  /** More cells than this — refuse without writing. */
  max?: number
}

/** Пределы по умолчанию (ADR 0223, §6). */
export const DEFAULT_WRITE_LIMITS = { confirm: 5_000, max: 15_000 } as const

type LimitsTable = { options?: { writeLimits?: WriteLimits | false } }

/** Пределы записи таблицы; `writeLimits: false` — без пределов. */
export const writeLimitsOf = (table: unknown): Required<WriteLimits> => {
  const limits = (table as LimitsTable | undefined)?.options?.writeLimits
  if (limits === false) return { confirm: Infinity, max: Infinity }
  return {
    confirm: limits?.confirm ?? DEFAULT_WRITE_LIMITS.confirm,
    max: limits?.max ?? DEFAULT_WRITE_LIMITS.max,
  }
}

/** Parse result of an operation: what was written, skipped and not parsed (saving is separate). */
export interface CellWriteReport {
  /** Operation id — also the `id` of the `onCommitEdits` batch. */
  id: string
  /** Cells that received a value (including an unchanged one). */
  written: number
  /** Non-editable cells: read-only, service, or waiting to be saved. */
  skipped: number
  /** Text did not parse for the type or failed `validate`. */
  invalid: number
  /** The operation exceeds the `max` limit — nothing was written (ADR 0223). */
  limited?: { count: number; max: number }
  /** The limit question was answered "no" — nothing was written. */
  declined?: boolean
}

/**
 * Опции исполнителя: источник и строки, догруженные мимо кэша окна серверной модели (ADR 0219,
 * §7) — по id их не найти в источнике строк.
 */
export interface CellWriterOptions extends Required<CellWriteOptions> {
  rows?: ReadonlyMap<string, unknown>
}

/** Исполнитель записи — плагин правки. */
export interface CellWriter {
  write: (
    table: unknown,
    changes: readonly CellWrite[],
    options: CellWriterOptions,
  ) => Promise<CellWriteReport>
  /** Можно ли записать в ячейку — для вставки, пунктов меню и клавиш. */
  canWrite: (table: unknown, rowId: string, columnId: string) => boolean
  /** Значение, которое ячейка показывает: черновик или данные (ADR 0222, §6). */
  valueOf: (
    table: unknown,
    rowId: string,
    columnId: string,
    row?: { getValue: (columnId: string) => unknown },
  ) => unknown
  /**
   * Строки до сохранения (ADR 0222, §13): `insert` — вернуть строку (снять черновик удаления или
   * положить черновик вставки), `delete` — убрать её; без записи в историю.
   */
  writeRows: (table: unknown, rows: readonly WrittenRow[]) => void
}

type WriterTable = { options?: { cellWriter?: CellWriter } }

/** Исполнитель таблицы; без плагина правки — `undefined`. */
export const cellWriterOf = (table: unknown): CellWriter | undefined =>
  (table as WriterTable | undefined)?.options?.cellWriter

/** Записать в ячейки; без исполнителя — `undefined`. */
export const writeCells = (
  table: unknown,
  changes: readonly CellWrite[],
  {
    source = 'api',
    rows,
  }: CellWriteOptions & Pick<CellWriterOptions, 'rows'> = {},
): Promise<CellWriteReport> | undefined =>
  cellWriterOf(table)?.write(
    table,
    changes,
    rows ? { source, rows } : { source },
  )

/** Показанное значение ячейки; без исполнителя — `undefined`. */
export const shownCellValue = (
  table: unknown,
  rowId: string,
  columnId: string,
  row?: { getValue: (columnId: string) => unknown },
): unknown => cellWriterOf(table)?.valueOf(table, rowId, columnId, row)

/** Можно ли записать в ячейку; без исполнителя — нет. */
export const canWriteCell = (
  table: unknown,
  rowId: string,
  columnId: string,
): boolean => cellWriterOf(table)?.canWrite(table, rowId, columnId) ?? false
