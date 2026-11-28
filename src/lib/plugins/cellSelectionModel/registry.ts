/**
 * Запись плагина cellSelectionModel на `definePlugin`: модель выделения ячеек без
 * интерфейса (ADR 0029, ADR 0120). Выделение — срез `cellSelection`; выделенные ячейки
 * подсвечены контуром диапазона; в серверной модели строк — по индексам (ADR 0146). Мышь, синхронизация с клавиатурой, копирование и пункт
 * «Копировать» — у `cellSelection`, который включает эту модель.
 */
import { cellSelectionFeature } from '@tanstack/react-table'

import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import {
  type CellSelectionState,
  followRowList,
  indexCellSelectionFeature,
} from './indexSelection'
import { cellSelectionModelBody } from './contribution'

export type { CellSelectionRange, CellSelectionState } from './indexSelection'

/** A cell for the selectability predicate — a subset of the TanStack v9 cell. */
export interface CellSelectionPredicateCell {
  id: string
  column: {
    id: string
    getIsActionsColumn: () => boolean
  }
  row: { id: string; original: unknown; depth: number }
  getValue: () => unknown
}

export interface CellSelectionModelOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Narrows selection; service columns (actions) are never selectable, whatever the predicate. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
  /** Selection ranges set by the application; without it the grid keeps the slice. */
  cellSelection?: CellSelectionState
  /** New slice value after each change from inside the grid. */
  onCellSelectionChange?: (next: CellSelectionState) => void
  /** Initial value of the slice the grid owns. */
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
  cell.column.getIsActionsColumn()

const cellSelectionModelEntry = definePlugin<CellSelectionModelOptions>()({
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
      // Смена data не сбрасывает выделение: углы следуют за своими строками (ADR 0194).
      autoResetCellSelection: false,
      // При disabled — false: v9 фиксирует набор фич на маунте, гейт — опцией.
      enableCellSelection:
        o.enabled === false
          ? false
          : (cell: CellSelectionPredicateCell) =>
              !isServiceCell(cell) && (canSelect?.(cell) ?? true),
    }
  },
})

/** Cell state and the root's `aria-multiselectable` — as a body contribution (ADR 0170, §5). */
export const cellSelectionModel = withBody(
  cellSelectionModelEntry,
  cellSelectionModelBody,
)
