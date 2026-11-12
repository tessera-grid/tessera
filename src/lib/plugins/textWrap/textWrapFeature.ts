/**
 * Поля колонки плагина textWrap (ADR 0218, §2): перенос текста в ячейке и высота строки по
 * содержимому. Фича без поведения — только поля в карте фич.
 */
import type { RowData, TableFeature, TableFeatures } from '../../types'

export const textWrapFeature: TableFeature = {}

/** Высота строки по содержимому ячейки колонки; `maxLines` — свой предел строк. */
export type AutoHeight = boolean | { maxLines?: number }

export interface TextWrapColumnDef {
  /** Перенос текста ячейки в высоте строки: целые строки, последняя — с `…`. */
  wrapText?: boolean
  /** Колонка задаёт высоту строки по содержимому; текст переносится сам. */
  autoHeight?: AutoHeight
  /** Перенос подписи заголовка в высоте строки шапки: целые строки, последняя — с `…`. */
  wrapHeaderText?: boolean
  /** Заголовок задаёт высоту своего уровня шапки по содержимому; подпись переносится сама. */
  autoHeaderHeight?: boolean
}

/** Вид переноса ячейки колонки: по содержимому, в высоте строки или нет. */
export const wrapModeOf = (columnDef: TextWrapColumnDef) =>
  columnDef.autoHeight ? 'auto' : columnDef.wrapText ? 'clamp' : undefined

/** Вид переноса подписи заголовка: по содержимому, в высоте строки шапки или нет. */
export const headWrapModeOf = (columnDef: TextWrapColumnDef) =>
  columnDef.autoHeaderHeight
    ? 'auto'
    : columnDef.wrapHeaderText
      ? 'clamp'
      : undefined

/** Свой предел строк колонки `autoHeight`. */
export const maxLinesOf = (columnDef: TextWrapColumnDef) =>
  typeof columnDef.autoHeight === 'object'
    ? columnDef.autoHeight.maxLines
    : undefined

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    textWrapFeature: TableFeature
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    textWrapFeature: TextWrapColumnDef
  }
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    textWrapPlugin: {
      /** Предел строк ячейки `autoHeight` по умолчанию. */
      textWrapMaxLines?: number
      /** Предел строк заголовка `autoHeaderHeight`. */
      textWrapHeaderMaxLines?: number
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
