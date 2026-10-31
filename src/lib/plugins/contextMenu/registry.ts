/**
 * Запись плагина contextMenu (ADR 0030) — поверхность контекстного меню.
 *
 * Сам плагин пунктов не даёт: он лишь ВКЛЮЧАЕТ поверхность (`enableContextMenu`),
 * а пункты контрибьютят другие плагины через канал `contextMenuActions` (напр.
 * cellSelection → «Копировать»). Триггер/позиционирование/рендер живут в
 * grid/contextMenu (читают presence по опции, ядро плагин не импортит).
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { noContextMenuActionsReason } from '../../core/pluginDiagnostics'
import type { ContextMenuOptions } from './types'

export const contextMenu = definePlugin<ContextMenuOptions>()({
  id: 'contextMenu',
  diagnose: noContextMenuActionsReason,
  options: o => ({ enableContextMenu: o.enabled !== false }),
})

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
