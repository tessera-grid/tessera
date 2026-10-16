/**
 * Запись плагина cellSelectionModel на `definePlugin`: модель выделения ячеек без
 * интерфейса (ADR 0029, ADR 0120). Выделение — срез `cellSelection`; выделенные ячейки
 * подсвечены контуром диапазона. Мышь, синхронизация с клавиатурой, копирование и пункт
 * «Копировать» — у `cellSelection`, который включает эту модель.
 */
import {
  type CellSelectionState,
  cellSelectionFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'

/** Ячейка для предиката выбираемости — подмножество ячейки TanStack v9. */
export interface CellSelectionPredicateCell {
  id: string
  column: {
    id: string
    getIsActionsColumn: () => boolean
    getIsRowActionsColumn: () => boolean
  }
  row: { id: string; original: unknown; depth: number }
  getValue: () => unknown
}

export interface CellSelectionModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Сужает выбор; сервисные колонки (действия) не выбираются при любом предикате. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
  /** Диапазоны выделения: задаёт приложение; без него срез хранит грид. */
  cellSelection?: CellSelectionState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onCellSelectionChange?: (next: CellSelectionState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialCellSelection?: CellSelectionState
}

/** Фичи модели выделения; интерфейс несёт те же — по ним выводится тип среза. */
export const cellSelectionModelFeatures = { cellSelectionFeature }

/** Сервисные колонки (действия) невыбираемы — граница плагина, не настройка. */
const isServiceCell = (cell: CellSelectionPredicateCell): boolean =>
  cell.column.getIsActionsColumn() || cell.column.getIsRowActionsColumn()

export const cellSelectionModel = definePlugin<CellSelectionModelOptions>()({
  id: 'cellSelectionModel',
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canSelectCell'],
  diagnose: neverInert,
  features: cellSelectionModelFeatures,
  slices: ['cellSelection'],
  options: o => {
    const canSelect = o.canSelectCell
    return {
      // При disabled — false: v9 фиксирует набор фич на маунте, гейт — опцией.
      enableCellSelection:
        o.enabled === false
          ? false
          : (cell: CellSelectionPredicateCell) =>
              !isServiceCell(cell) && (canSelect?.(cell) ?? true),
    }
  },
})
