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
  /**
   * Начальный размер страницы в строках верхнего уровня (по умолчанию 25). Семя
   * состояния: текущим размером владеет срез `pagination` (ADR 0039).
   */
  initialPageSize?: number
  /** Варианты выбора размера (по умолчанию 10/25/50/100); `false` — без выбора. */
  pageSizes?: number[] | false
  /** Серверная пагинация — v9 `manualPagination`: `data` — уже текущая страница. */
  server?: boolean
  /** Всего строк на сервере; обязателен при `server` (0, пока ответа нет). */
  rowCount?: number
  /**
   * Отказ промиса `onPageChange` в серверном режиме возвращает прежнюю страницу и её
   * размер (по умолчанию true); `false` — страница остаётся новой (ADR 0116).
   */
  revertOnReject?: boolean
  /** Бизнес-колбэк смены страницы (аргумент фабрики); читается живо. */
  onPageChange?: PaginationHooks['onPageChange']
}

export const pagination = definePlugin<PaginationOptions>()({
  id: 'pagination',
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
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
    const pageSize = o.initialPageSize ?? DEFAULT_PAGE_SIZE
    return {
      manualPagination: !enabled || !!o.server,
      rowCount: enabled && o.server ? o.rowCount : undefined,
      paginationRevertOnReject: o.revertOnReject !== false,
      paginateExpandedRows: !enabled,
      // Стоковый сброс срабатывает на любую смену data (правка ячейки, перестановка
      // строки); страницу сбрасывает плагин — только при смене порядка строк.
      autoResetPageIndex: false,
      paginationPageSizes: o.pageSizes ?? DEFAULT_PAGE_SIZES,
      initialState: { pagination: { pageIndex: 0, pageSize } },
    }
  },
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
