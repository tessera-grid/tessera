/**
 * Канал записи в ячейки (ADR 0219, §1): вставку, очистку, вырезание и массовую правку просят
 * выделение, клавиши, меню и приложение, а исполняет правка. Ядро держит только форму
 * операции и место исполнителя — его кладёт в опции таблицы плагин правки.
 */

/** Откуда операция: встроенные триггеры, приложение, будущий журнал отмен. */
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
}

/** Исполнитель записи — плагин правки. */
export interface CellWriter {
  write: (
    table: unknown,
    changes: readonly CellWrite[],
    options: Required<CellWriteOptions>,
  ) => Promise<CellWriteReport>
  /** Можно ли записать в ячейку — для вставки, пунктов меню и клавиш. */
  canWrite: (table: unknown, rowId: string, columnId: string) => boolean
}

type WriterTable = { options?: { cellWriter?: CellWriter } }

/** Исполнитель таблицы; без плагина правки — `undefined`. */
export const cellWriterOf = (table: unknown): CellWriter | undefined =>
  (table as WriterTable | undefined)?.options?.cellWriter

/** Записать в ячейки; без исполнителя — `undefined`. */
export const writeCells = (
  table: unknown,
  changes: readonly CellWrite[],
  { source = 'api' }: CellWriteOptions = {},
): Promise<CellWriteReport> | undefined =>
  cellWriterOf(table)?.write(table, changes, { source })

/** Можно ли записать в ячейку; без исполнителя — нет. */
export const canWriteCell = (
  table: unknown,
  rowId: string,
  columnId: string,
): boolean => cellWriterOf(table)?.canWrite(table, rowId, columnId) ?? false
