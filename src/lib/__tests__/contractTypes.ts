/**
 * Типы контракта для стражей ADR 0163: опции и описание колонки стоковых фич TanStack,
 * карты фич (с дополнениями Tessera), опции ядра и запись плагина. В картах фич
 * дополнения Tessera видны всегда — стоковые записи отделяет файл объявления.
 */
import type {
  AccessorFnColumnDef,
  AccessorKeyColumnDef,
  ColumnDefBase_All,
  ColumnDef_FeatureMap,
  GroupColumnDef,
  RowData,
  StockFeatures,
  TableOptions_Core,
  TableOptions_FeatureMap,
} from '@tanstack/react-table'

export type StockTableOptionsCore = TableOptions_Core<StockFeatures, RowData>
export type TableOptionsFeatureMap = TableOptions_FeatureMap<
  StockFeatures,
  RowData
>
export type StockColumnDefBase = ColumnDefBase_All<StockFeatures, RowData>
export type StockAccessorKeyColumnDef = AccessorKeyColumnDef<
  StockFeatures,
  RowData
>
export type StockAccessorFnColumnDef = AccessorFnColumnDef<
  StockFeatures,
  RowData
>
export type StockGroupColumnDef = GroupColumnDef<StockFeatures, RowData>
export type ColumnDefFeatureMap = ColumnDef_FeatureMap<
  StockFeatures,
  RowData,
  unknown
>

export type { CommonOptions, CoreOptions } from '../core/commonFeature.types'
export type { TablePlugin, TesseraFeatureEntry } from '../core/features'
