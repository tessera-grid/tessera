/**
 * Запись плагина paginationModel на `definePlugin`: модель пагинации без интерфейса
 * (ADR 0038, ADR 0120). Строки — текущей страницы среза `pagination`, сброс страницы при
 * смене порядка строк; пейджер в нижней панели и колбэк пользователя — у `pagination`,
 * который включает эту модель.
 */
import {
  type PaginationState,
  rowPaginationFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { paginationInertReason, resetPageOnReorder } from './model'
import { createPageStage } from './pageStage'
import { ownStage } from '../../core/rowEngine/engine'

export const DEFAULT_PAGE_SIZE = 25

export interface PaginationModelOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * Initial page size in top-level rows (25 by default). A state seed: the `pagination` slice owns
   * the current size (ADR 0039).
   */
  initialPageSize?: number
  /** Page and its size set by the application; without it the grid keeps the slice. */
  pagination?: PaginationState
  /** New slice value after each change from inside the grid. */
  onPaginationChange?: (next: PaginationState) => void
  /** Initial value of the slice the grid owns; takes precedence over `initialPageSize`. */
  initialPagination?: PaginationState
}

/** Фичи модели пагинации; интерфейс несёт те же — по ним выводится тип среза. */
export const paginationModelFeatures = {
  rowPaginationFeature,
  paginatedRowModel: ownStage('page', createPageStage()),
}

export const paginationModel = definePlugin<PaginationModelOptions>()({
  id: 'paginationModel',
  diagnose: paginationInertReason,
  features: paginationModelFeatures,
  slices: ['pagination'],
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними,
  // и `paginateExpandedRows: false` без нарезки спрятал бы раскрытые строки. Строки
  // показаны страницами — факт ядра `pagedRows`: без него страниц не режет ядро (ADR 0169, §6).
  options: o => {
    const enabled = o.enabled !== false
    const pageSize = o.initialPageSize ?? DEFAULT_PAGE_SIZE
    return {
      pagedRows: enabled,
      paginateExpandedRows: !enabled,
      // Стоковый сброс срабатывает на любую смену data (правка ячейки, перестановка
      // строки); страницу сбрасывает плагин — только при смене порядка строк.
      autoResetPageIndex: false,
      initialState: { pagination: { pageIndex: 0, pageSize } },
    }
  },
  setup: () => resetPageOnReorder,
})
