/**
 * Значение ячейки для отрисовки (ADR 0200, §4): плагин может подставить значение, которого строка
 * ещё не несёт, — стадию переноса между группами (ADR 0186, §3), — не трогая кэши строки.
 */
interface ValueCell {
  getValue: () => unknown
  row: { table: unknown }
}

export const cellValueOf = (
  cell: ValueCell,
): { value: unknown; overridden: boolean } => {
  const { options } = cell.row.table as {
    options: {
      cellValueOverride?: (cell: unknown) => { value: unknown } | undefined
    }
  }
  const override = options.cellValueOverride?.(cell)
  return override
    ? { value: override.value, overridden: true }
    : { value: cell.getValue(), overridden: false }
}
