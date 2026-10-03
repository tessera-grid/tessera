/**
 * Запись плагина quickSearch на `definePlugin` (ADR 0045, §6): стоковые
 * `globalFilteringFeature` и общая отфильтрованная модель строк; срез `globalFilter`.
 * С фильтрами колонок объединяется через И.
 */
import { globalFilteringFeature } from '@tanstack/react-table'

import { definePlugin, readPluginHooks } from '../../core/definePlugin'
import { createSearchAwareFilteredRowModel } from '../../core/filteredRowModel'
import type { PluginInertReason } from '../../core/pluginDiagnostics'
import { canSearchColumn, quickSearchFilter } from './search'
import { SearchField } from './SearchField'
import { filteredRowsCountSlot } from '../../grid/filtering/FilteredRowsCount'

export interface QuickSearchOptions {
  /** `false` — плагин отключён: поиск не применяется. */
  enabled?: boolean
  /** Задержка применения ввода в поле поиска, мс (по умолчанию 200). */
  debounceMs?: number
  /** «Показано N из M» в нижней панели при активном поиске (по умолчанию нет). */
  filteredCount?: boolean
  /**
   * Серверный поиск — v9 `manualFiltering`: грид не ищет, строка поиска уходит в
   * `onSearchChange`. Режим данных общий с `columnFiltering` (ADR 0045, §10).
   */
  server?: boolean
  /** Бизнес-колбэк: пользователь изменил строку поиска (после дебаунса). */
  onSearchChange?: (search: string) => void
}

/** Сервер без колбэка — поиск некуда отправить (FL31); без тулбара поиск работает программно (PB9). */
const quickSearchInertReason = (
  table: unknown,
): PluginInertReason | undefined => {
  const t = table as {
    options: { quickSearchServer?: boolean }
    getHooks: () => unknown
  }
  return t.options.quickSearchServer &&
    !readPluginHooks<{ onSearchChange?: unknown }>(t, 'quickSearch')
      .onSearchChange
    ? 'noOnSearchChange'
    : undefined
}

export const quickSearch = definePlugin<QuickSearchOptions>()({
  id: 'quickSearch',
  lifetime: ['server'],
  diagnose: quickSearchInertReason,
  hooks: o => ({ onSearchChange: o.onSearchChange }),
  features: {
    globalFilteringFeature,
    filteredRowModel: createSearchAwareFilteredRowModel(),
  },
  // Выключенный плагин не ищет: эффективный срез пуст, сохранённый не меняется
  // (ADR 0039) — включили снова, поиск вернулся.
  narrow: o => (o.enabled === false ? { globalFilter: () => '' } : undefined),
  options: o => ({
    enableGlobalFilter: o.enabled !== false,
    // В дереве родитель виден, если поиск находит потомка (FL22).
    filterFromLeafRows: true,
    globalFilterFn: quickSearchFilter,
    getColumnCanGlobalFilter: canSearchColumn,
    quickSearchDebounceMs: o.debounceMs,
    quickSearchServer: !!o.server,
    ...(o.server ? { manualFiltering: true } : {}),
  }),
  // Счётчик — opt-in: у гридов с поиском нижняя панель не появляется сама.
  slots: o => [
    {
      id: 'quickSearchField',
      slot: 'toolbarSlot',
      align: 'start',
      group: 'search',
      order: 0,
      component: SearchField,
    },
    ...(o.filteredCount ? [filteredRowsCountSlot] : []),
  ],
})
