/**
 * Показанный текст ячеек для буфера (ADR 0219, WR4): формат по типу колонки, подписи
 * вариантов, булево — подписью словаря. Excel того же языка понимает «1 234,5» и «2026-11-12».
 */
import { announcerLabels } from '../../core/announcer'
import { columnFormatter, type FormatColumn } from '../../core/dataTypeFormat'
import { ENGLISH_LABELS } from '../../core/localization'

interface ShownColumn extends FormatColumn {
  getDataType?: () => { base: string } | undefined
}

type ShownTable = {
  getColumn: (id: string) => ShownColumn | undefined
  options: Parameters<typeof columnFormatter>[0]['options']
}

/** Текст значения колонки: форматтеры — раз на колонку в пределах одного копирования. */
export const shownTextOf = (table: unknown) => {
  const t = table as ShownTable
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  const formatters = new Map<
    string,
    ((value: unknown, row: unknown) => string) | null
  >()
  return (columnId: string, value: unknown, row: unknown): string => {
    if (value === null || value === undefined) return ''
    let format = formatters.get(columnId)
    if (format === undefined) {
      const column = t.getColumn(columnId)
      format = column
        ? column.getDataType?.()?.base === 'boolean'
          ? (item: unknown) =>
              item === true
                ? labels.booleanTrue
                : item === false
                  ? labels.booleanFalse
                  : String(item)
          : columnFormatter(t, column)
        : null
      formatters.set(columnId, format)
    }
    return format ? format(value, row) : String(value)
  }
}
