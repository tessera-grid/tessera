/**
 * Показ служебной колонки по условию (ADR 0050): колонка остаётся в модели, а её
 * видимость сужается в эффективном состоянии — идентичность `columns` не меняется,
 * сохранённый срез `columnVisibility` не переписывается.
 */
import type { NarrowContext, NarrowState } from './effectiveState'

/** The table as the condition sees it: source rows only. */
export interface PresenceTable {
  getCoreRowModel: () => { rows: readonly { subRows: readonly unknown[] }[] }
}

/**
 * Whether the column is needed. `table` is the instance with current data or `null`;
 * `undefined` means it can't be computed without a table. Looks only at the source data, the
 * plugin's arguments and the fold of the set, not at the view (SC2).
 */
export type ServicePresence<TOptions> = (
  table: PresenceTable | null,
  context: NarrowContext,
  opts: TOptions,
) => boolean | undefined

/** A plugin option with a condition: `'always'` shows the column regardless of it. */
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
