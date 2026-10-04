/**
 * Показ служебной колонки по условию (ADR 0050): колонка остаётся в модели, а её
 * видимость сужается в эффективном состоянии — идентичность `columns` не меняется,
 * сохранённый срез `columnVisibility` не переписывается.
 */
import type { NarrowContext, NarrowState } from './effectiveState'

/** Таблица, которую видит условие: только исходные строки. */
export interface PresenceTable {
  getCoreRowModel: () => { rows: readonly { subRows: readonly unknown[] }[] }
}

/**
 * Нужна ли колонка. `table` — экземпляр с текущими данными или `null`;
 * `undefined` — без таблицы не посчитать. Смотрит только на исходные данные,
 * аргументы плагина и свёртку набора, не на вид (SC2).
 */
export type ServicePresence<TOptions> = (
  table: PresenceTable | null,
  context: NarrowContext,
  opts: TOptions,
) => boolean | undefined

/** Опция плагина с условием: `'always'` показывает колонку независимо от него. */
export type ServiceColumnMode = 'auto' | 'always'

export const presenceNarrow =
  <TOptions>(
    columnId: string,
    presence: ServicePresence<TOptions>,
    opts: TOptions,
  ): NarrowState =>
  (value: Record<string, boolean>, table, context) => {
    const present = presence(table, context, opts)
    if (present === undefined) {
      return undefined
    }
    if (present || value[columnId] === false) {
      return value
    }
    return { ...value, [columnId]: false }
  }
