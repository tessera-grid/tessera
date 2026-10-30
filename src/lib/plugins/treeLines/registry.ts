/**
 * Запись плагина treeLines на `definePlugin`: линии дерева ADR 0102 у видимой иерархии —
 * дерева `rowExpandingModel`/`rowExpanding` и групп `rowGrouping` (ADR 0119). Сам ничего не
 * раскрывает.
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'

export interface TreeLinesOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const treeLines = definePlugin<TreeLinesOptions>()({
  id: 'treeLines',
  // В серверной модели линии — по раскладке дерева (ADR 0161).
  diagnose: neverInert,
  options: o => ({ enableTreeLines: o.enabled !== false }),
})
