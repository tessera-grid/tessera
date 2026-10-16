/**
 * Запись плагина paginationModel на `definePlugin`: модель пагинации без интерфейса
 * (ADR 0038, ADR 0120). Строки — текущей страницы среза `pagination`, сброс страницы при
 * смене порядка строк; пейджер в нижней панели и колбэк пользователя — у `pagination`,
 * который включает эту модель.
 */
import {
  createPaginatedRowModel,
  type PaginationState,
  rowPaginationFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { paginationInertReason, resetPageOnReorder } from './model'

export const DEFAULT_PAGE_SIZE = 25

export interface PaginationModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /**
   * Начальный размер страницы в строках верхнего уровня (по умолчанию 25). Семя
   * состояния: текущим размером владеет срез `pagination` (ADR 0039).
   */
  initialPageSize?: number
  /** Серверная пагинация — v9 `manualPagination`: `data` — уже текущая страница. */
  server?: boolean
  /** Всего строк на сервере; обязателен при `server` (0, пока ответа нет). */
  rowCount?: number
  /** Страница и её размер: задаёт приложение; без него срез хранит грид. */
  pagination?: PaginationState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onPaginationChange?: (next: PaginationState) => void
  /** Начальное значение среза, которым владеет грид; главнее `initialPageSize`. */
  initialPagination?: PaginationState
}

/** Фичи модели пагинации; интерфейс несёт те же — по ним выводится тип среза. */
export const paginationModelFeatures = {
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
}

export const paginationModel = definePlugin<PaginationModelOptions>()({
  id: 'paginationModel',
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
  diagnose: paginationInertReason,
  features: paginationModelFeatures,
  slices: ['pagination'],
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними,
  // и `paginateExpandedRows: false` без нарезки спрятал бы раскрытые строки.
  options: o => {
    const enabled = o.enabled !== false
    const pageSize = o.initialPageSize ?? DEFAULT_PAGE_SIZE
    return {
      manualPagination: !enabled || !!o.server,
      rowCount: enabled && o.server ? o.rowCount : undefined,
      paginateExpandedRows: !enabled,
      // Стоковый сброс срабатывает на любую смену data (правка ячейки, перестановка
      // строки); страницу сбрасывает плагин — только при смене порядка строк.
      autoResetPageIndex: false,
      initialState: { pagination: { pageIndex: 0, pageSize } },
    }
  },
  setup: () => resetPageOnReorder,
})
