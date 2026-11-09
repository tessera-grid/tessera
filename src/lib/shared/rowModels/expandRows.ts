/**
 * Строки в порядке показа: строка, затем дети показа раскрытой (ADR 0200, §4) — как `expandRows`
 * TanStack, но детей даёт движок, а не `row.subRows` копий. Общий у стадий раскрытия и страницы.
 */
import { childrenOf } from '../../core/rowEngine/displayChildren'

export interface ExpandableRow {
  id: string
  subRows: ExpandableRow[]
  /** Без фичи раскрытия метода нет: строка не раскрыта. */
  getIsExpanded?: () => boolean
}

/** Строка и дети показа раскрытых строк — в `into`. */
export const walkExpanded = <TRow extends ExpandableRow>(
  model: object,
  row: TRow,
  into: TRow[],
) => {
  into.push(row)
  const children = childrenOf(model, row)
  if (children.length && row.getIsExpanded?.()) {
    for (const child of children) walkExpanded(model, child, into)
  }
}

/** Все строки поддеревьев `rows` по детям показа, без повторов. */
export const flattenShown = <TRow extends ExpandableRow>(
  model: object,
  rows: readonly TRow[],
) => {
  const flat: TRow[] = []
  const seen = new Set<string>()
  const visit = (row: TRow) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    flat.push(row)
    for (const child of childrenOf(model, row)) visit(child)
  }
  for (const row of rows) visit(row)
  return flat
}
