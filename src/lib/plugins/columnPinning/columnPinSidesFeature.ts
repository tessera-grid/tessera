/**
 * Поле колонки `pinSides` плагина columnPinning (ADR 0165, §4): стороны закрепления в меню и
 * кнопке колонки. Фича без поведения — только поле в карте фич, рядом со стоковым
 * `enablePinning`.
 */
import type { RowData, TableFeature, TableFeatures } from '../../types'
import type { PinSides } from './types'

export const columnPinSidesFeature: TableFeature = {}

interface ColumnPinSidesColumnDef {
  /** Стороны закрепления колонки в UI плагина; по умолчанию `both`. */
  pinSides?: PinSides
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    columnPinSidesFeature: TableFeature
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    columnPinSidesFeature: ColumnPinSidesColumnDef
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
