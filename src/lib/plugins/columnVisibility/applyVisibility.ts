/**
 * Запись видимости в стоковый срез `columnVisibility` + бизнес-колбэк плагина
 * (ADR 0035, CV11–CV13). Колбэк получает только колонки, которые реально меняются.
 */
import type { Updater } from '../../types'
import { getUserLeaves, type VisibilityTable } from './columnTree'
import type { ColumnVisibilityHooks } from './types'

type VisibilityState = Record<string, boolean>

export interface VisibilityControlTable extends VisibilityTable {
  setColumnVisibility: (updater: Updater<VisibilityState>) => void
  resetColumnVisibility: () => void
  initialState: { columnVisibility?: VisibilityState }
  getHooks?: () => Record<string, unknown> | undefined
}

const notify = (
  table: VisibilityControlTable,
  columnIds: string[],
  visible: boolean,
) => {
  if (columnIds.length === 0) {
    return
  }
  const hooks = table.getHooks?.()?.columnVisibility as
    Partial<ColumnVisibilityHooks> | undefined
  hooks?.onToggleColumnVisibility?.(columnIds, visible)
}

export const setColumnsVisible = (
  table: VisibilityControlTable,
  columnIds: string[],
  visible: boolean,
) => {
  if (columnIds.length === 0) {
    return
  }
  table.setColumnVisibility(old => ({
    ...old,
    ...Object.fromEntries(columnIds.map(id => [id, visible])),
  }))
  notify(table, columnIds, visible)
}

/** К `initialState.columnVisibility`; колбэк — по изменившимся колонкам. */
export const resetColumnsVisibility = (table: VisibilityControlTable) => {
  const initial = table.initialState.columnVisibility ?? {}
  const shown: string[] = []
  const hidden: string[] = []
  for (const leaf of getUserLeaves(table)) {
    const target = initial[leaf.id] ?? true
    if (target !== leaf.getIsVisible()) {
      ;(target ? shown : hidden).push(leaf.id)
    }
  }
  table.resetColumnVisibility()
  notify(table, shown, true)
  notify(table, hidden, false)
}
