/**
 * Запись плагина cellSelectionModel на `definePlugin`: модель выделения ячеек без
 * интерфейса (ADR 0029, ADR 0120). Выделение — срез `cellSelection`; выделенные ячейки
 * подсвечены контуром диапазона; в серверной модели строк — по индексам (ADR 0146). Мышь, синхронизация с клавиатурой, копирование и пункт
 * «Копировать» — у `cellSelection`, который включает эту модель.
 */
import { cellSelectionFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  type CellSelectionState,
  followRowList,
  indexCellSelectionFeature,
} from './indexSelection'

export type { CellSelectionRange, CellSelectionState } from './indexSelection'

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

/**
 * Фичи модели выделения; интерфейс несёт те же — по ним выводится тип среза. Выделение
 * по индексам строк стоит после стоковой фичи (ADR 0146).
 */
export const cellSelectionModelFeatures = {
  cellSelectionFeature,
  indexCellSelectionFeature,
}

/** Сервисные колонки (действия) невыбираемы — граница плагина, не настройка. */
const isServiceCell = (cell: CellSelectionPredicateCell): boolean =>
  cell.column.getIsActionsColumn() || cell.column.getIsRowActionsColumn()

export const cellSelectionModel = definePlugin<CellSelectionModelOptions>()({
  id: 'cellSelectionModel',
  diagnose: neverInert,
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canSelectCell'],
  features: cellSelectionModelFeatures,
  slices: ['cellSelection'],
  // Выделение по индексам следует за списком строк (ADR 0146, §6).
  setup: () => followRowList,
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
