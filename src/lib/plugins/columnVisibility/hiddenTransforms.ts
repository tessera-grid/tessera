/**
 * Преобразования скрытых колонок в меню «Колонки» и кебабе (ADR 0204, §3–§4): перечень видов —
 * «сортировка и фильтр» — для подсказок, объявление скрытия, снятие. Виды и подписи — из факта
 * ядра `columnTransforms`, плагины преобразований меню не знает.
 */
import { announceLabel } from '../../core/announcer'
import {
  clearColumnTransforms,
  describeColumnTransforms,
  transformsOfColumn,
} from '../../core/columnTransforms'
import { reportAction, type DebugActionSource } from '../../core/debugActions'
import type { TableLabels } from '../../core/localization'
import { columnVisibilityLabels } from './labels'

/** Названия видов преобразований колонок без повторов — в порядке плагинов. */
export const transformNamesOf = (
  table: unknown,
  columnIds: readonly string[],
  labels: TableLabels,
): string[] => {
  const names: string[] = []
  for (const id of columnIds)
    for (const { name } of describeColumnTransforms(table, id, labels))
      if (!names.includes(name)) names.push(name)
  return names
}

/** Первая буква — заглавная: перечень в начале подсказки. */
export const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** Подсказка «Сортировка и фильтр останутся» до скрытия; без преобразований — нет. */
export const willRemainHint = (
  table: unknown,
  columnIds: readonly string[],
  labels: TableLabels,
): string | undefined => {
  const names = transformNamesOf(table, columnIds, labels)
  return names.length === 0
    ? undefined
    : capitalized(
        columnVisibilityLabels(labels).transformsWillRemain(
          names,
          names.length,
        ),
      )
}

/** Объявить скрытие колонок, чьи преобразования остаются (HT6); остальные — молча. */
export const announceKeptTransforms = (
  table: unknown,
  columns: readonly { id: string; label: string }[],
) => {
  const kept = columns.filter(
    column => transformsOfColumn(table, column.id).length > 0,
  )
  if (kept.length === 0) return
  announceLabel(table, labels => {
    const names = transformNamesOf(
      table,
      kept.map(column => column.id),
      labels,
    )
    return columnVisibilityLabels(labels).columnsHiddenKept(
      kept.map(column => column.label),
      names,
      names.length,
    )
  })
}

/** «Снять» у пункта скрытой колонки: все её преобразования одним действием (HT4). */
export const clearHiddenTransforms = (
  table: unknown,
  columnId: string,
  source: DebugActionSource,
) => {
  reportAction(table, {
    plugin: 'columnVisibility',
    action: 'clearTransforms',
    detail: { columnId },
    source,
  })
  clearColumnTransforms(table, [columnId], source)
}
