/**
 * Канал записи в ячейки (ADR 0219, §1): вставку, очистку, вырезание и массовую правку просят
 * выделение, клавиши, меню и приложение, а исполняет правка. Ядро держит только форму
 * операции и место исполнителя — его кладёт в опции таблицы плагин правки.
 */

/** Откуда операция: встроенные триггеры, приложение, отмена и повтор (ADR 0222). */
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

/** Ячейка сохранённой записи: значения до и после в типе колонки. */
export interface WrittenCell {
  rowId: string
  columnId: string
  before: unknown
  after: unknown
}

/** Новая или удалённая строка до сохранения (ADR 0222, §13): значения и место в списке. */
export interface WrittenRow {
  rowId: string
  change: 'insert' | 'delete'
  values: unknown
  /** Место в видимом списке. */
  index: number
  /** Строка над ней; нет — строка первая. */
  after?: string
}

/** Место строки: родитель и место среди сестёр. */
export interface RowPlace {
  parentId?: string
  index: number
}

/** Перенос строки (ADR 0222, §13). */
export interface WrittenMove {
  rowId: string
  from: RowPlace
  to: RowPlace
}

/**
 * Итог операции записи (ADR 0222, §2): что сохранено, что отклонено. `'edit'` — правка ячейки в
 * редакторе. `draft` — записано черновиками режима «Применить», без сервера; `cancelled` —
 * ожидание прервано «стопом», итог неизвестен.
 */
export interface CellsWritten {
  id: string
  source: CellWriteSource | 'edit' | 'row' | 'move' | 'discard' | 'apply'
  cells: readonly WrittenCell[]
  refused: readonly { rowId: string; columnId: string }[]
  draft?: boolean
  cancelled?: boolean
  /** Строки до сохранения: добавленные и удалённые (§13). */
  rows?: readonly WrittenRow[]
  /** Перенос строки; у отказа — нет, `failed`. */
  move?: WrittenMove
  /** Перенос отклонён (§13). */
  failed?: boolean
  /** «Применить» сохранило столько изменений (ADR 0222, §14); у источника `'apply'`. */
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
export const notifyCellsWritten = (table: unknown, record: CellsWritten) =>
  (table as SettledTable | undefined)?.options?.cellsWritten?.(table, record)

/**
 * Изменение одной ячейки: набранный или вставленный текст разбирается по типу колонки,
 * значение пишется как есть.
 */
export type CellWrite =
  | { rowId: string; columnId: string; text: string }
  | { rowId: string; columnId: string; value: unknown }

export interface CellWriteOptions {
  source?: CellWriteSource
}

/** Пределы одной операции записи в ячейках (ADR 0223, §1). */
export interface WriteLimits {
  /** Больше стольких ячеек — вопрос перед записью. */
  confirm?: number
  /** Больше стольких ячеек — отказ без записи. */
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

/** Итог разбора операции: что записано, пропущено и не разобрано (сохранение — отдельно). */
export interface CellWriteReport {
  /** Id операции — он же `id` пакета `onCommitEdits`. */
  id: string
  /** Ячейки, которые получили значение (в том числе прежнее). */
  written: number
  /** Нередактируемые ячейки: только для чтения, служебные, ждущие сохранения. */
  skipped: number
  /** Текст не разобрался по типу или не прошёл `validate`. */
  invalid: number
  /** Операция больше предела `max` — ничего не записано (ADR 0223). */
  limited?: { count: number; max: number }
  /** На вопрос предела ответили «нет» — ничего не записано. */
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
  valueOf: (table: unknown, rowId: string, columnId: string) => unknown
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
): unknown => cellWriterOf(table)?.valueOf(table, rowId, columnId)

/** Можно ли записать в ячейку; без исполнителя — нет. */
export const canWriteCell = (
  table: unknown,
  rowId: string,
  columnId: string,
): boolean => cellWriterOf(table)?.canWrite(table, rowId, columnId) ?? false
