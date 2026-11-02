/**
 * Запись плагина contextMenu (ADR 0030) — поверхность контекстного меню.
 *
 * Пункты вносят другие плагины каналом `contextMenuActions` (напр. cellSelection → «Копировать»);
 * свои у плагина — только пункты занятой и помеченной ячейки (ADR 0177, OB16), видные, лишь когда
 * ячейка ждёт или помечена. Триггер, долгое нажатие и
 * поповер — вкладом в тело (ADR 0170, §5).
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { noContextMenuActionsReason } from '../../core/pluginDiagnostics'
import { CELL_STATE_ACTIONS } from './cellStateActions'
import { contextMenuBody } from './body'
import type { ContextMenuOptions } from './types'

const contextMenuEntry = definePlugin<ContextMenuOptions>()({
  id: 'contextMenu',
  // Свои пункты меню видны не всегда: без чужих пунктов меню по-прежнему пустое.
  diagnose: table => noContextMenuActionsReason(table, CELL_STATE_ACTIONS),
  contextMenuActions: [...CELL_STATE_ACTIONS],
  options: o => ({ enableContextMenu: o.enabled !== false }),
})

export const contextMenu = withBody(contextMenuEntry, contextMenuBody)

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    contextMenuPlugin: {
      enableContextMenu?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
