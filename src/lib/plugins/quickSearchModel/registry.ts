/**
 * Запись плагина quickSearchModel на `definePlugin`: модель быстрого поиска без интерфейса
 * (ADR 0045, §6; ADR 0120). Строки отфильтрованы по срезу `globalFilter` по видимым
 * колонкам, с фильтрами колонок — через И; поле поиска и колбэк пользователя — у
 * `quickSearch`, который включает эту модель.
 */
import { globalFilteringFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { createSearchAwareFilteredRowModel } from '../../core/filteredRowModel'
import { neverInert } from '../../core/pluginDiagnostics'
import { canSearchColumn, quickSearchFilter } from './search'

export interface QuickSearchModelOptions {
  /** `false` — плагин отключён: поиск не применяется. */
  enabled?: boolean
  /**
   * Серверный поиск — v9 `manualFiltering`: грид не ищет. Режим данных общий с
   * фильтрами колонок (ADR 0045, §10).
   */
  server?: boolean
  /** Строка поиска: задаёт приложение; без него срез хранит грид. */
  globalFilter?: string
  /** Новое значение среза после каждого изменения изнутри грида. */
  onGlobalFilterChange?: (next: string) => void
  /** Начальное значение среза, которым владеет грид. */
  initialGlobalFilter?: string
}

/** Фичи модели поиска; интерфейс несёт те же — по ним выводится тип среза. */
export const quickSearchModelFeatures = {
  globalFilteringFeature,
  filteredRowModel: createSearchAwareFilteredRowModel(),
}

export const quickSearchModel = definePlugin<QuickSearchModelOptions>()({
  id: 'quickSearchModel',
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
  diagnose: neverInert,
  features: quickSearchModelFeatures,
  slices: ['globalFilter'],
  // Выключенная модель не ищет: эффективный срез пуст, сохранённый не меняется
  // (ADR 0039) — включили снова, поиск вернулся.
  narrow: o => (o.enabled === false ? { globalFilter: () => '' } : undefined),
  options: o => ({
    enableGlobalFilter: o.enabled !== false,
    // В дереве родитель виден, если поиск находит потомка (FL22).
    filterFromLeafRows: true,
    globalFilterFn: quickSearchFilter,
    getColumnCanGlobalFilter: canSearchColumn,
    quickSearchServer: !!o.server,
    ...(o.server ? { manualFiltering: true } : {}),
  }),
})
