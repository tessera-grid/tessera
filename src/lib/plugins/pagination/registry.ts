/**
 * Запись плагина pagination на `definePlugin` (ADR 0038, ADR 0120): интерфейс пагинации —
 * пейджер в нижней панели (`statusBarSlot`, справа), варианты размера страницы и колбэк
 * пользователя. Модель — `paginationModel`, плагин её включает и передаёт ей режим данных
 * и срез.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import {
  DEFAULT_PAGE_SIZE,
  paginationModel,
  paginationModelFeatures,
  type PaginationModelOptions,
} from '../paginationModel/registry'
import { declareRevertOnReject } from '../../core/serverActions'
import { paginationInertReason } from '../paginationModel/model'
import { PaginationControl } from './PaginationControl'
import type { PaginationHooks } from './types'
import { paginationLabels } from './labels'

export { DEFAULT_PAGE_SIZE }
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export interface PaginationOptions extends Omit<
  PaginationModelOptions,
  'enabled'
> {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Варианты выбора размера (по умолчанию 10/25/50/100); `false` — без выбора. */
  pageSizes?: number[] | false
  /**
   * Переход на страницу (ADR 0192): `'buttons'` — ряд номеров вместо кнопок «первая» и
   * «последняя», `'input'` — поле номера, `false` — только четыре кнопки. По умолчанию
   * `'buttons'`; в узкой панели и при неизвестном итоге — четыре кнопки.
   */
  pageNumbers?: PageNumbersMode
  /**
   * Отказ промиса `onPageChange` при страницах с сервера возвращает прежнюю страницу и её
   * размер (по умолчанию true); `false` — страница остаётся новой (ADR 0116).
   */
  revertOnReject?: boolean
  /** Бизнес-колбэк смены страницы (аргумент фабрики); читается живо. */
  onPageChange?: PaginationHooks['onPageChange']
}

export type PageNumbersMode = 'buttons' | 'input' | false

export const pagination = definePlugin<PaginationOptions>()({
  id: 'pagination',
  labels: [paginationLabels],
  actions: {
    changePage: labels => paginationLabels(labels).actionChangePage,
    changePageSize: labels => paginationLabels(labels).actionChangePageSize,
  },
  diagnose: paginationInertReason,
  model: {
    plugin: paginationModel,
    keys: [
      'initialPageSize',
      'pagination',
      'onPaginationChange',
      'initialPagination',
    ],
  },
  features: paginationModelFeatures,
  hooks: o => ({ onPageChange: o.onPageChange }),
  setup: o => table =>
    declareRevertOnReject(table, 'pagination', o.revertOnReject !== false),
  options: o => ({
    paginationPageSizes: o.pageSizes ?? DEFAULT_PAGE_SIZES,
    paginationPageNumbers: o.pageNumbers ?? 'buttons',
  }),
  slots: [
    {
      id: 'paginationControl',
      slot: 'statusBarSlot',
      align: 'end',
      component: PaginationControl,
    },
  ],
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    paginationPlugin: {
      paginationPageSizes?: PaginationOptions['pageSizes']
      paginationPageNumbers?: PaginationOptions['pageNumbers']
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
