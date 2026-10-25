/**
 * Запись плагина treeLines на `definePlugin`: линии дерева ADR 0102 у видимой иерархии —
 * дерева `rowExpandingModel`/`rowExpanding` и групп `rowGrouping` (ADR 0119). Сам ничего не
 * раскрывает.
 */
import { definePlugin } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'

export interface TreeLinesOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const treeLines = definePlugin<TreeLinesOptions>()({
  id: 'treeLines',
  // Проекция линий строится по массиву всех строк — в SSRM его нет (ADR 0138, §14).
  diagnose: serverRowModelReason,
  options: o => ({ enableTreeLines: o.enabled !== false }),
})
