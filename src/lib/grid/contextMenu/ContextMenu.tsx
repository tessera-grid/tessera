// ContextMenu (эагерный): слушатель contextmenu + состояние открытия. Base UI-меню
// (ContextMenuPopup) грузится лениво, монтируется только когда меню открыто —
// floating-ui в базовый бандл не тянется. Рендерится DataGrid'ом при активном
// плагине contextMenu (`enableContextMenu`). ADR 0030.
import { Suspense, lazy, useEffect, useState } from 'react'

import { useLocalization } from '../../core/localization'
import {
  resolveVisibleActions,
  type ContextMenuAction,
  type ContextMenuContext,
} from '../../core/headerActions'

const ContextMenuPopupImpl = lazy(() =>
  import('./ContextMenuPopup').then(m => ({ default: m.ContextMenuPopup })),
)

const CELL = '.data-grid__body-cell[data-column-id]'

interface OpenState {
  x: number
  y: number
  actions: ContextMenuAction[]
  context: ContextMenuContext
}

/** Duck-typed поверхность таблицы (ядро плагин не импортит). */
interface ContextMenuTable {
  getContextMenuActions?: () => ContextMenuAction[] | undefined
  getRow?: (id: string) => {
    getAllCells?: () => {
      column: { id: string }
      getContext: () => ContextMenuContext
      getIsSelected?: () => boolean
      getCanSelect?: () => boolean
    }[]
  }
  setFocusedCell?: (rowId: string, columnId: string) => void
  getSelectedCellCount?: () => number
}

/**
 * Строит контекст пункта: контекст ячейки под курсором + сводка выбора.
 *
 * Выбираемость ячейки решает сама фича (`getCanSelect`): сервисные колонки
 * (чекбокс/действия) невыбираемы, поэтому их правый клик НЕ трогает выделение и
 * `isInSelection=false` — пункты, гейтящиеся на выделении (напр. «Копировать»),
 * там не показываются, и меню уступает нативному (CM5/CM10). CM7: правый клик по
 * выбираемой, но невыделенной ячейке сначала выделяет её.
 */
const buildContext = (
  t: ContextMenuTable,
  rowId: string,
  columnId: string,
): ContextMenuContext | null => {
  const cell = t
    .getRow?.(rowId)
    ?.getAllCells?.()
    .find(c => c.column.id === columnId)
  if (!cell) {
    return null
  }
  const featureOn = typeof cell.getIsSelected === 'function'
  const canSelect = featureOn && (cell.getCanSelect?.() ?? true)
  const wasSelected = featureOn ? cell.getIsSelected!() : false
  if (canSelect && !wasSelected && typeof t.setFocusedCell === 'function') {
    t.setFocusedCell(rowId, columnId)
  }
  // Выбираемая ячейка после авто-выделения входит в выделение; сервисная — нет.
  const isInSelection = canSelect ? true : wasSelected
  const count = canSelect
    ? wasSelected
      ? (t.getSelectedCellCount?.() ?? 1)
      : 1
    : featureOn
      ? (t.getSelectedCellCount?.() ?? 0)
      : 0
  return {
    ...cell.getContext(),
    selection: {
      count,
      isSingle: count === 1,
      isMultiple: count > 1,
      isInSelection,
    },
  }
}

export interface ContextMenuProps {
  table: unknown
  getScrollElement: () => HTMLElement | null
}

export const ContextMenu = ({ table, getScrollElement }: ContextMenuProps) => {
  const [state, setState] = useState<OpenState | null>(null)
  const labels = useLocalization()

  useEffect(() => {
    const t = table as ContextMenuTable
    const onContextMenu = (event: MouseEvent) => {
      const scroller = getScrollElement()
      const cellEl = (event.target as Element | null)?.closest?.(CELL)
      const rowEl = cellEl?.closest?.('[data-row-id]')
      // Вне тела нашего грида — уступаем нативному меню браузера.
      if (!scroller || !cellEl || !rowEl || !scroller.contains(cellEl)) {
        return
      }
      const rowId = rowEl.getAttribute('data-row-id')
      const columnId = cellEl.getAttribute('data-column-id')
      if (!rowId || !columnId) {
        return
      }
      const context = buildContext(t, rowId, columnId)
      if (!context) {
        return
      }
      const actions = resolveVisibleActions(
        t.getContextMenuActions?.() ?? [],
        context,
      )
      // Пустое меню — не открываем, уступаем нативному (CM5).
      if (actions.length === 0) {
        return
      }
      event.preventDefault()
      setState({ x: event.clientX, y: event.clientY, actions, context })
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [table, getScrollElement])

  if (!state) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <ContextMenuPopupImpl
        x={state.x}
        y={state.y}
        actions={state.actions}
        context={state.context}
        labels={labels}
        onClose={() => setState(null)}
      />
    </Suspense>
  )
}

ContextMenu.displayName = 'ContextMenu'
