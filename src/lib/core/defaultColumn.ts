/** Размеры колонки по умолчанию (ADR 0077): переданное приложением их дополняет. */
export interface DefaultColumnSizing {
  size?: number
  minSize?: number
  maxSize?: number
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
