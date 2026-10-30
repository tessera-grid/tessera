/**
 * «Раскрыто всё, кроме» (ADR 0160, §1): срез `expanded` серверной модели строк хранит
 * `{ all: true, except }`, как выбор строк «всё, кроме» (ADR 0148). `true` значит то же с
 * пустым `except`. Общий модуль раскрытия и тела — вне папок плагинов (IV3).
 */

export interface ExpandedAll {
  all: true
  /** Строки, свёрнутые вручную. */
  except: string[]
}

export const isExpandedAll = (value: unknown): value is ExpandedAll =>
  typeof value === 'object' &&
  value !== null &&
  (value as { all?: unknown }).all === true &&
  Array.isArray((value as { except?: unknown }).except)

/** Раскрыто всё: `true` или «всё, кроме». */
export const isExpandAllValue = (value: unknown) =>
  value === true || isExpandedAll(value)

/** Строка раскрыта по срезу `expanded`: `true`, «всё, кроме» или объект `id`. */
export const isRowExpandedIn = (value: unknown, id: string): boolean =>
  value === true
    ? true
    : isExpandedAll(value)
      ? !value.except.includes(id)
      : !!(value as Record<string, boolean> | undefined)?.[id]

/** Срез после раскрытия или сворачивания строки `id`: «всё, кроме» помнит свёрнутые. */
export const withRowExpanded = (
  value: unknown,
  id: string,
  open: boolean,
): ExpandedAll | Record<string, boolean> => {
  if (isExpandAllValue(value)) {
    const except = (value === true ? [] : (value as ExpandedAll).except).filter(
      other => other !== id,
    )
    return { all: true, except: open ? except : [...except, id] }
  }
  return { ...(value as Record<string, boolean> | undefined), [id]: open }
}
