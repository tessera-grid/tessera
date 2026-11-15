/** Умолчания колонки (ADR 0077): переданное приложением дополняет размеры по умолчанию. */
export interface DefaultColumnSizing {
  size?: number
  minSize?: number
  maxSize?: number
  /** Вес флекс-колонки (ADR 0216): `1` — колонки делят ширину таблицы. */
  flex?: number
  /** Строки дерева, которые складывает агрегат колонки (ADR 0229): `'all'` — все узлы. */
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
