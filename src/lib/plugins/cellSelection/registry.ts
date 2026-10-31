/**
 * Запись плагина cellSelection на `definePlugin` (ADR 0029, ADR 0120): интерфейс
 * выделения ячеек — мышь (диапазон Shift, протяжка, Ctrl/Cmd), синхронизация с
 * клавиатурной навигацией, копирование и пункт «Копировать» контекстного меню. Модель —
 * `cellSelectionModel`, плагин её включает и передаёт ей предикат и срез. DOM-швы
 * (обработчики, copy-хендлер) живут в ядре и читают `cellSelectionInteraction`.
 *
 * Сервисной колонки нет: выделение — свойство самих ячеек тела.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  cellSelectionModel,
  cellSelectionModelFeatures,
} from '../cellSelectionModel/registry'
import { copyContextAction } from './contextActions'
import type { CellSelectionOptions } from './types'

/** Предел строк выделения для буфера (ADR 0146, §5). */
const DEFAULT_MAX_COPY_ROWS = 10_000

// TOptions задаётся ОДИН раз дженериком; `o` в полях выводится (DP12).
export const cellSelection = definePlugin<CellSelectionOptions>()({
  id: 'cellSelection',
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
    }
  },
  // Вклад в контекстное меню (ADR 0030): «Копировать». Показывается только при
  // активном плагине contextMenu; отключённый cellSelection пунктов не даёт.
  contextMenuActions: [copyContextAction],
})

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
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
