/** Column defaults (ADR 0077): what the application passes extends the default sizes. */
export interface DefaultColumnSizing {
  size?: number
  minSize?: number
  maxSize?: number
  /** Flex column weight (ADR 0216): with `1`, columns share the table width. */
  flex?: number
  /** Tree rows the column aggregate adds up (ADR 0229): `'all'` means all nodes. */
  aggregationScope?: 'top' | 'all'
}

/** `minSize` — наименьшая ширина текста ячейки; `size` по умолчанию — у TanStack (150). */
export const DEFAULT_COLUMN = {
  minSize: 48,
  maxSize: 750,
} as const satisfies DefaultColumnSizing

export const resolveDefaultColumn = (
  defaultColumn: DefaultColumnSizing | undefined,
): DefaultColumnSizing =>
  defaultColumn
    ? {
        ...DEFAULT_COLUMN,
        ...Object.fromEntries(
          Object.entries(defaultColumn).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      }
    : DEFAULT_COLUMN
