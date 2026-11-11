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
import { groupTransform } from './grouping'
import { rowGroupingLabels } from './labels'
import { transformSection } from '../../shared/transformSection'

export interface RowGroupingOptions extends Omit<
  RowGroupingModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /**
   * Строка группы держится под шапкой, пока видны её строки; вложенные — стопкой
   * (ADR 0160, §3). По умолчанию выключено.
   */
  stickyRows?: boolean
  /** `false` — без числа строк данных в строке группы (ADR 0184, §8). */
  groupRowCount?: boolean
}

/** Раздел «Группировка» «Настроек вида» (ADR 0215, §1): уровни по порядку. */
const groupingSection = transformSection({
  id: 'grouping',
  order: 30,
  plugin: 'rowGrouping',
  icon: 'group',
  transform: groupTransform,
  slice: 'grouping',
  labels: labels => {
    const own = rowGroupingLabels(labels)
    return {
      title: own.grouping,
      remove: own.removeGrouping,
      reset: own.resetGrouping,
    }
  },
})

export const rowGrouping = definePlugin<RowGroupingOptions>()({
  id: 'rowGrouping',
  labels: [rowGroupingLabels],
  actions: {
    group: labels => rowGroupingLabels(labels).group,
    ungroup: labels => rowGroupingLabels(labels).ungroup,
  },
  // В серверной модели строк группирует сервер (ADR 0144); клиентская модель там инертна.
  diagnose: neverInert,
  model: {
    plugin: rowGroupingModel,
    keys: ['grouping', 'onGroupingChange', 'initialGrouping'],
  },
  features: rowGroupingModelFeatures,
  // Единый дескриптор: ядро решает подачу (инлайн-кнопка / строка меню).
  slotActions: [groupHeaderAction],
  // Группировка по колонке — факт ядра (ADR 0204, §2).
  columnTransforms: [groupTransform],
  viewSettingsSections: [groupingSection],
  // Липкие строки групп — факт ядра (ADR 0170, §2).
  options: o => ({
    stickyGroupRows: o.enabled !== false && !!o.stickyRows,
    groupRowCount: o.groupRowCount !== false,
  }),
})
