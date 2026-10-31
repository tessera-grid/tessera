/**
 * Запись плагина treeLines на `definePlugin`: линии дерева ADR 0102 у видимой иерархии —
 * дерева `rowExpandingModel`/`rowExpanding` и групп `rowGrouping` (ADR 0119). Сам ничего не
 * раскрывает. Линии рисует вклад в тело (ADR 0170, §5).
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { treeLinesBody } from './body'

export interface TreeLinesOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

const treeLinesEntry = definePlugin<TreeLinesOptions>()({
  id: 'treeLines',
  // В серверной модели линии — по раскладке дерева (ADR 0161).
  diagnose: neverInert,
  options: o => ({ enableTreeLines: o.enabled !== false }),
})

/** Ветки строк окна, слой в ячейке отступа и атрибут темы — вкладом в тело (ADR 0170, §5). */
export const treeLines = withBody(treeLinesEntry, treeLinesBody)

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    treeLinesPlugin: {
      enableTreeLines?: boolean
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
