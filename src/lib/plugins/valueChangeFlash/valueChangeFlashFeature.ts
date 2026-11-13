/**
 * Поле колонки плагина valueChangeFlash (ADR 0221, §2): какие колонки вспыхивают при смене
 * значения извне и с направлением ли. Фича без поведения — только поле в карте фич.
 */
import type { RowData, TableFeature, TableFeatures } from '../../types'

export const valueChangeFlashFeature: TableFeature = {}

export interface ValueChangeFlashColumnDef {
  /** `false` — колонка не вспыхивает; `'direction'` — тон и стрелка роста или падения. */
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
