/**
 * Запись плагина cellSelection на `definePlugin` (ADR 0029, ADR 0120): интерфейс
 * выделения ячеек — мышь (диапазон Shift, протяжка, Ctrl/Cmd), синхронизация с
 * клавиатурной навигацией, копирование и пункт «Копировать» контекстного меню. Модель —
 * `cellSelectionModel`, плагин её включает и передаёт ей предикат и срез. Мышь,
 * копирование, автопрокрутка и клавиши — вкладом в тело (ADR 0170, §5).
 *
 * Сервисной колонки нет: выделение — свойство самих ячеек тела.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  cellSelectionModel,
  cellSelectionModelFeatures,
} from '../cellSelectionModel/registry'
import { cellSelectionBody } from './body'
import {
  clearContextAction,
  copyContextAction,
  cutContextAction,
  pasteContextAction,
} from './contextActions'
import { DEFAULT_MAX_COPY_ROWS } from './copy'
import type { CellSelectionOptions, ParseClipboard } from './types'
import { cellSelectionLabels } from './labels'

// TOptions задаётся ОДИН раз дженериком; `o` в полях выводится (DP12).
const cellSelectionEntry = definePlugin<CellSelectionOptions>()({
  id: 'cellSelection',
  labels: [cellSelectionLabels],
  actions: {
    select: labels => cellSelectionLabels(labels).actionSelect,
    extendSelection: labels =>
      cellSelectionLabels(labels).actionExtendSelection,
    copy: labels => cellSelectionLabels(labels).copy,
    resizeRange: labels => cellSelectionLabels(labels).actionResizeRange,
    paste: labels => cellSelectionLabels(labels).paste,
    cut: labels => cellSelectionLabels(labels).cut,
    clear: labels => cellSelectionLabels(labels).clear,
  },
  diagnose: neverInert,
  model: {
    plugin: cellSelectionModel,
    keys: [
      'canSelectCell',
      'cellSelection',
      'onCellSelectionChange',
      'initialCellSelection',
    ],
  },
  features: cellSelectionModelFeatures,
  options: o => {
    // При disabled — жесты жёстко false: v9 фиксирует набор фич на маунте,
    // рантайм-гейт present-but-disabled — только опцией (ADR 0010).
    const off = o.enabled === false
    return {
      cellSelectionInteraction: !off,
      enableCellRangeSelection: off ? false : (o.rangeSelection ?? true),
      enableCellSelectionDrag: off ? false : (o.dragSelection ?? true),
      enableMultiCellRangeSelection: off ? false : (o.multiRange ?? true),
      cellSelectionMaxCopyRows: o.maxCopyRows ?? DEFAULT_MAX_COPY_ROWS,
      cellSelectionPaste: !off && o.paste !== false,
      ...(o.parseClipboard
        ? { cellSelectionParseClipboard: o.parseClipboard }
        : {}),
      cellSelectionHandle: {
        mouse: !off && o.handle !== false && (o.handle?.mouse ?? true),
        touch: !off && o.handle !== false && (o.handle?.touch ?? true),
      },
    }
  },
  // Вклад в контекстное меню (ADR 0030): «Копировать». Показывается только при
  // активном плагине contextMenu; отключённый cellSelection пунктов не даёт.
  // «Вставить», «Вырезать», «Очистить» — только с плагином правки (ADR 0219, WR17).
  contextMenuActions: [
    copyContextAction,
    cutContextAction,
    pasteContextAction,
    clearContextAction,
  ],
})

export const cellSelection = withBody(cellSelectionEntry, cellSelectionBody)

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    cellSelectionPlugin: {
      /** Жесты выделения включены: `false` у выключенного плагина. */
      cellSelectionInteraction?: boolean
      cellSelectionMaxCopyRows?: number
      /** Для каких указателей показан маркер угла выделения (ADR 0198). */
      cellSelectionHandle?: { mouse: boolean; touch: boolean }
      /** Вставка, вырезание и очистка выделения включены (ADR 0219). */
      cellSelectionPaste?: boolean
      /** Свой разбор буфера при вставке (ADR 0219, WR3). */
      cellSelectionParseClipboard?: ParseClipboard
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
