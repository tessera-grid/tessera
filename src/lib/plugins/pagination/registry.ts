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
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Page size options (10/25/50/100 by default); `false` — no select. */
  pageSizes?: number[] | false
  /**
   * Going to a page (ADR 0192): `'buttons'` — a row of numbers instead of the "first" and "last"
   * buttons, `'input'` — a number field, `false` — only four buttons. `'buttons'` by default; in a
   * narrow bar and with an unknown total — four buttons.
   */
  pageNumbers?: PageNumbersMode
  /**
   * With pages from the server, a rejection of the `onPageChange` promise returns the previous page
   * and its size (true by default); `false` — the new page stays (ADR 0116).
   */
  revertOnReject?: boolean
  /** Page change business callback (a factory argument); read live. */
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
