/**
 * Выбор функции колонок (ADR 0230, §1, §7): выбор, равный функции по умолчанию, снимает ключ
 * среза — точки на кебабе нет. В серверной модели выбор — серверное действие `aggregation`: новая
 * выборка, при отказе — откат к выбору до цепочки.
 */
import { reportAction, type DebugActionSource } from '../../core/debugActions'
import {
  runServerAction,
  type ServerActionCause,
} from '../../core/serverActions'
import type { ColumnAggregationsState } from './feature'
import { type AggregationColumn, defaultNameOf } from './functions'

interface ChooseTable {
  atoms: { columnAggregations?: { get: () => ColumnAggregationsState } }
  setColumnAggregations: (
    updater: (prev: ColumnAggregationsState) => ColumnAggregationsState,
  ) => void
  getColumn: (id: string) => AggregationColumn | undefined
}

/** Новый срез: у колонок `columnIds` — функция `name`; `undefined` — функция по умолчанию. */
const nextChoice = (
  t: ChooseTable,
  prev: ColumnAggregationsState,
  columnIds: readonly string[],
  name: string | null | undefined,
) => {
  const next = { ...prev }
  for (const id of columnIds) {
    const column = t.getColumn(id)
    const fallback = column ? defaultNameOf(column) : null
    if (name === undefined || name === fallback) delete next[id]
    else next[id] = name
  }
  return next
}

/** Сменить функцию колонок тем путём, что и действие пользователя. */
export const chooseAggregation = (
  table: unknown,
  columnIds: readonly string[],
  name: string | null | undefined,
  source: DebugActionSource,
  cause?: ServerActionCause,
) => {
  const t = table as ChooseTable
  const prev = t.atoms.columnAggregations?.get() ?? {}
  const next = nextChoice(t, prev, columnIds, name)
  if (columnIds.every(id => prev[id] === next[id])) return
  reportAction(table, {
    plugin: 'columnAggregation',
    action: name === undefined ? 'resetSummary' : 'columnAggregation',
    detail: { columnIds: [...columnIds], summary: name ?? null },
    source,
  })
  runServerAction(
    table,
    'aggregation',
    () =>
      t.setColumnAggregations(current =>
        nextChoice(t, current, columnIds, name),
      ),
    () => undefined,
    cause ?? { control: 'columnAggregation', columns: [...columnIds] },
  )
}
