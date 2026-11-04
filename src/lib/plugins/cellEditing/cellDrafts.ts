/**
 * Черновик значения ячейки в режиме сохранения по кнопке (ADR 0178, §5): вид `cellValue`
 * реестра черновиков. Применяет его пакет `onCommitEdits`; «Применить всё» сначала завершает
 * открытую правку.
 */
import { readPluginHooks } from '../../core/definePlugin'
import { rowSourceOf } from '../../core/rowSource'
import { editTextOf } from './editValue'
import type { DraftKind } from '../../core/drafts/drafts'
import {
  CELL_VALUE_DRAFT,
  type CellDraftValue,
  EDIT_SESSION_KEY,
  commitAllDrafts,
  commitDrafts,
} from './session'
import { rowDeleteDraftKind, rowInsertDraftKind } from './rowDrafts'
import type { CellEditingHooks, CellEditingState } from './types'

const hooksOf = (table: unknown) =>
  readPluginHooks<Partial<CellEditingHooks>>(table as never, 'cellEditing')

export const cellValueDraftKind: DraftKind = {
  kind: CELL_VALUE_DRAFT,
  action: 'edit',
  describe: (_labels, draft) => (draft.value as CellDraftValue).text,
  // Значение из данных; строка не загружена (серверная модель) — прежнего не знаем.
  previous: (_labels, draft, table) => {
    if (!('cell' in draft.target)) return undefined
    const [rowId, columnId] = draft.target.cell
    const row = rowSourceOf<{ getValue: (id: string) => unknown }>(table).byId(
      rowId,
    )
    return row ? editTextOf(table, columnId, row.getValue(columnId)) : undefined
  },
  apply: (table, draft) => commitDrafts(table, [draft]),
  // Один пакет на ячейки и строки; открытая правка завершается первой (ADR 0178, §7).
  applyAll: commitAllDrafts,
  openKey: EDIT_SESSION_KEY,
  isOpen: state => !!(state as CellEditingState | undefined)?.active,
  active: table => hooksOf(table).saveMode === 'manual',
}

/** Виды строк до сохранения — тем же пакетом (ADR 0178, §7). */
export const rowInsertKind = rowInsertDraftKind(commitDrafts, commitAllDrafts)
export const rowDeleteKind = rowDeleteDraftKind(commitDrafts, commitAllDrafts)
