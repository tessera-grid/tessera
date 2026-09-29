/**
 * Запись плагина contextMenu (ADR 0030) — поверхность контекстного меню.
 *
 * Сам плагин пунктов не даёт: он лишь ВКЛЮЧАЕТ поверхность (`enableContextMenu`),
 * а пункты контрибьютят другие плагины через канал `contextMenuActions` (напр.
 * cellSelection → «Копировать»). Триггер/позиционирование/рендер живут в
 * grid/contextMenu (читают presence по опции, ядро плагин не импортит).
 */
import { definePlugin } from '../../core/definePlugin'
import { noContextMenuActionsReason } from '../../core/pluginDiagnostics'
import type { ContextMenuOptions } from './types'

export const contextMenu = definePlugin<ContextMenuOptions>()({
  id: 'contextMenu',
  diagnose: noContextMenuActionsReason,
  options: o => ({ enableContextMenu: o.enabled !== false }),
})
