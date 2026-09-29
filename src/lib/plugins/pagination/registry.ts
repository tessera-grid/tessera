/**
 * Запись плагина pagination на `definePlugin` (ADR 0038): стоковые
 * `rowPaginationFeature` + `createPaginatedRowModel()`, контрол в нижней панели
 * (`statusBarSlot`, справа), сброс страницы при смене порядка строк.
 */
import {
  createPaginatedRowModel,
  rowPaginationFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { paginationInertReason, resetPageOnReorder } from './model'
import { PaginationControl } from './PaginationControl'
import type { PaginationHooks } from './types'

export const DEFAULT_PAGE_SIZE = 25
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export interface PaginationOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Строк верхнего уровня на странице (по умолчанию 25). */
  pageSize?: number
  /** Варианты выбора размера (по умолчанию 10/25/50/100); `false` — без выбора. */
  pageSizes?: number[] | false
  /** Серверная пагинация — v9 `manualPagination`: `data` — уже текущая страница. */
  server?: boolean
  /** Всего строк на сервере; обязателен при `server` (0, пока ответа нет). */
  rowCount?: number
  /** Бизнес-колбэк смены страницы (аргумент фабрики); читается живо. */
  onPageChange?: PaginationHooks['onPageChange']
}

export const pagination = definePlugin<PaginationOptions>()({
  id: 'pagination',
  diagnose: paginationInertReason,
  features: {
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
  },
  hooks: o => ({ onPageChange: o.onPageChange }),
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними,
  // и `paginateExpandedRows: false` без нарезки спрятал бы раскрытые строки.
  options: o => {
    const enabled = o.enabled !== false
    const pageSize = o.pageSize ?? DEFAULT_PAGE_SIZE
    return {
      manualPagination: !enabled || !!o.server,
      paginateExpandedRows: !enabled,
      // Стоковый сброс срабатывает на любую смену data (правка ячейки, перестановка
      // строки); страницу сбрасывает плагин — только при смене порядка строк.
      autoResetPageIndex: false,
      paginationPageSizes: o.pageSizes ?? DEFAULT_PAGE_SIZES,
      initialState: { pagination: { pageIndex: 0, pageSize } },
    }
  },
  // Итог приходит с каждым ответом сервера — опция живая, не по сигнатуре набора.
  liveOptions: o => ({
    rowCount: o.enabled !== false && o.server ? o.rowCount : undefined,
  }),
  slots: [
    {
      id: 'paginationControl',
      slot: 'statusBarSlot',
      align: 'end',
      component: PaginationControl,
    },
  ],
  setup: () => resetPageOnReorder,
})
