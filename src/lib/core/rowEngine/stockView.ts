/**
 * Стоковый вид выхода стадии (ADR 0200, §6): `table.get*RowModel()` отдаёт модель, как у моделей
 * TanStack, — строки с детьми показа в `subRows`. Выход без детей показа — он сам; иначе вид
 * собирается один раз на выход, при первом вызове: копии строк, чьи дети показа отличаются от
 * `subRows`. Тело и движок читают выходы стадий, а не этот вид.
 */
import { copyInstancePropertiesWithoutMemos } from '@tanstack/react-table'

import { childrenOf } from './displayChildren'
import { handOverRowsById } from '../rowsByIdHandover'
import { positionOf, setPosition } from '../rowPosition'

interface ViewRow {
  id: string
  index: number
  subRows: ViewRow[]
}

interface ViewModel {
  rows: ViewRow[]
  flatRows: ViewRow[]
  rowsById: Record<string, ViewRow>
}

const views = new WeakMap<object, ViewModel>()

const sameList = (a: readonly ViewRow[], b: readonly ViewRow[]) =>
  a.length === b.length && a.every((row, i) => row === b[i])

/** Дерево — выход фильтра, группировки или сортировки: строки — корни. */
const treeView = (model: ViewModel): ViewModel => {
  const flatRows: ViewRow[] = []
  const rowsById = handOverRowsById(model)
  const visit = (row: ViewRow): ViewRow => {
    const at = flatRows.length
    flatRows.push(row)
    const subRows = childrenOf(model, row).map(visit)
    let shown = row
    if (!sameList(subRows, row.subRows)) {
      // Как у TanStack: родитель с другими детьми — копия строки.
      shown = Object.create(Object.getPrototypeOf(row)) as ViewRow
      copyInstancePropertiesWithoutMemos(shown as never, row as never)
      setPosition(shown, positionOf(row))
      shown.subRows = subRows
      rowsById[shown.id] = shown
    }
    flatRows[at] = shown
    return shown
  }
  return { rows: model.rows.map(visit), flatRows, rowsById }
}

/** Список — выход раскрытия или страницы: строки — в виде входа. */
const listView = (
  model: ViewModel,
  base: ViewModel,
  flatten: boolean,
): ViewModel => {
  const rows = model.rows.map(row => base.rowsById[row.id] ?? row)
  if (!flatten) {
    return { rows, flatRows: base.flatRows, rowsById: base.rowsById }
  }
  // Как у модели страницы TanStack: строки страницы и их потомки без повторов.
  const flatRows: ViewRow[] = []
  const seen = new Set<string>()
  const visit = (row: ViewRow) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    flatRows.push(row)
    for (const child of row.subRows) visit(child)
  }
  for (const row of rows) visit(row)
  return { rows, flatRows, rowsById: base.rowsById }
}

export type ViewKind = 'tree' | 'list' | 'page'

/**
 * Стоковый вид выхода; `base` — стоковый вид входа стадии, нужен списку. Без детей показа —
 * выход как есть.
 */
export const stockView = (
  model: unknown,
  kind: ViewKind,
  base: () => unknown,
): unknown => {
  const m = model as ViewModel
  let view = views.get(m)
  if (!view) {
    view =
      kind === 'tree'
        ? treeView(m)
        : listView(m, base() as ViewModel, kind === 'page')
    views.set(m, view)
  }
  return view
}
