/**
 * Запись плагина rowGrouping на `definePlugin` (ADR 0016, ADR 0120): интерфейс
 * группировки — кнопка в заголовке (инлайн или строка кебаба). Модель —
 * `rowGroupingModel`, плагин её включает и передаёт ей срез.
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  rowGroupingModel,
  rowGroupingModelFeatures,
  type RowGroupingModelOptions,
} from '../rowGroupingModel/registry'
import { groupHeaderAction } from './groupHeaderAction'

export interface RowGroupingOptions extends Omit<
  RowGroupingModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const rowGrouping = definePlugin<RowGroupingOptions>()({
  id: 'rowGrouping',
  diagnose: neverInert,
  model: {
    plugin: rowGroupingModel,
    keys: ['grouping', 'onGroupingChange', 'initialGrouping'],
  },
  features: rowGroupingModelFeatures,
  // Единый дескриптор: ядро решает подачу (инлайн-кнопка / строка меню).
  slotActions: [groupHeaderAction],
})
