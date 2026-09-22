/**
 * Запись плагина cellSelection на `definePlugin`.
 *
 * Всю механику несёт стоковый `cellSelectionFeature` (слайс `cellSelection`,
 * по-ячеечные getIsSelected/getSelectionEdges/getTabIndex, мышиные хендлеры,
 * getSelectedCellRangesData). Плагин лишь регистрирует фичу и гейтит её опциями;
 * DOM-швы (атрибуты/обработчики/tabindex, copy-хендлер) живут в ядре
 * (core/cellSelection.ts, core/clipboard.ts) и читают presence duck-typed —
 * ядро плагин не импортит (ADR 0029 / ADR 0010).
 *
 * Сервисной колонки нет: выделение — свойство самих ячеек тела.
 */
import { cellSelectionFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { copyContextAction } from './contextActions'
import type { CellSelectionOptions, CellSelectionPredicateCell } from './types'

/** По умолчанию сервисные колонки (действия) невыбираемы. */
const defaultCanSelect = (cell: CellSelectionPredicateCell): boolean =>
  !cell.column.getIsActionsColumn() && !cell.column.getIsRowActionsColumn()

// TOptions задаётся ОДИН раз дженериком; `o` в полях выводится (DP12).
export const cellSelection = definePlugin<CellSelectionOptions>()({
  id: 'cellSelection',
  features: { cellSelectionFeature },
  options: o => {
    // При disabled — все enable* жёстко false: v9 фиксирует набор фич на маунте,
    // рантайм-гейт present-but-disabled — только опцией (ADR 0010).
    const off = o.enabled === false
    const canSelect = o.canSelectCell ?? defaultCanSelect
    return {
      enableCellSelection: off
        ? false
        : (cell: CellSelectionPredicateCell) => canSelect(cell),
      enableCellRangeSelection: off ? false : (o.rangeSelection ?? true),
      enableCellSelectionDrag: off ? false : (o.dragSelection ?? true),
      enableMultiCellRangeSelection: off ? false : (o.multiRange ?? true),
    }
  },
  // Вклад в контекстное меню (ADR 0030): «Копировать». Показывается только при
  // активном плагине contextMenu; отключённый cellSelection пунктов не даёт.
  contextMenuActions: [copyContextAction],
})
