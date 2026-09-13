/**
 * Фаза E — запись плагина columnSizing для v9 (порт registry.ts, ADR 0013).
 *
 * Отличия от v8:
 *  - в v9 sizing/resizing РАЗДЕЛЕНЫ на две фичи; ресайз требует размеров, поэтому
 *    слот несёт обе: `columnSizingFeature` + `columnResizingFeature`
 *    (prereq columnResizingFeature → columnSizingFeature проверяется типами);
 *  - имена опций (enableColumnResizing/columnResizeMode) совпали с v8;
 *  - state ресайза переименован columnSizingInfo→columnResizing (компонент читает
 *    методы колонки, поэтому на порт не влияет).
 */
import { columnResizingFeature, columnSizingFeature } from '@tanstack/table-v9'

import type { TesseraFeatureEntry } from '../../core/features'
import { ColumnSizingComponent } from './ColumnSizingComponent'

export interface ColumnSizingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const columnSizing = (opts: ColumnSizingOptions = {}) =>
  ({
    id: 'columnSizing',
    enabled: opts.enabled,
    slot: {
      columnSizingFeature,
      columnResizingFeature,
    },
    slots: [
      {
        id: 'columnSizingPlugin',
        slot: 'rightHeaderSlot',
        order: 'last',
        component: ColumnSizingComponent,
        // Resize-грип — кромочный аффорданс, а не иконка-кнопка: инлайн, но НЕ
        // учитывается в пороге схлопывания кебаба (иначе «крал» бы место).
        countsAsHeaderAction: false,
      },
    ],
    options: {
      enableColumnResizing: true,
      columnResizeMode: 'onChange',
    },
  }) satisfies TesseraFeatureEntry<{
    columnSizingFeature: typeof columnSizingFeature
    columnResizingFeature: typeof columnResizingFeature
  }>
