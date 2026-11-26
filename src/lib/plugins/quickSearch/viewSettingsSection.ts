/**
 * Раздел «Поиск» «Настроек вида» (ADR 0215, §1, VW10): только когда поиск активен, а поля поиска в тулбаре
 * нет — текст поиска тогда не виден на месте. Уровень — строка поиска, снятие — очистка поиска.
 */
import {
  toggleViewSettingsValue,
  type ViewSettingsSection,
} from '../../core/viewSettings'
import { searchOf, setSearchByUser } from '../../shared/filtering/filtering'
import { optionsLabels } from '../../shared/options/labels'
import { hasOwnToolbarSlot } from '../../shared/toolbarPlacement'
import { quickSearchLabels } from './labels'

export const searchSection: ViewSettingsSection = {
  id: 'search',
  order: 50,
  plugin: 'quickSearch',
  icon: 'search',
  slices: ['globalFilter'],
  label: labels => quickSearchLabels(labels).search,
  visible: table =>
    searchOf(table) !== '' && !hasOwnToolbarSlot(table, 'quickSearch'),
  active: table => searchOf(table) !== '',
  value: (table, labels) =>
    toggleViewSettingsValue(labels, searchOf(table) !== ''),
  levels: (table, labels) => [
    {
      id: 'search',
      label: `«${searchOf(table)}»`,
      removeLabel: optionsLabels(labels).clearSearch,
      remove: () => setSearchByUser(table, ''),
    },
  ],
}
