/**
 * Плагин valueChangeFlash (ADR 0221): отмечает свои записи и добавляет настройки вспышек
 * в определение колонки.
 */
import { trackOwnWrites } from '../../shared/ownWrites'
import type { RowData, TableFeature, TableFeatures } from '../../types'

export const valueChangeFlashFeature: TableFeature = {
  constructTableAPIs: trackOwnWrites,
}

export interface ValueChangeFlashColumnDef {
  /** `false` — the column doesn't flash; `'direction'` — tone and arrow for up or down. */
  changeFlash?: boolean | 'direction'
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    valueChangeFlashFeature: TableFeature
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    valueChangeFlashFeature: ValueChangeFlashColumnDef
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
