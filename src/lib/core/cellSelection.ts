/**
 * Ядровой шов выделения ячеек: гранулярная подписка BodyCell на членство в
 * выделении. Ядро НЕ импортит плагин cellSelection — presence читается по наличию
 * методов stock-фичи на объекте ячейки (`getIsSelected` и т.п.), ровно как
 * `DataGrid` читает слайс `rowDragging` через `?.` (см. ADR 0029 / ADR 0010).
 *
 * `useTableState` с selector'ом, возвращающим членство ЭТОЙ ячейки, даёт
 * по-ячеечную гранулярность: `useSelector` пере-выполняет selector на любое
 * изменение store, но `shallowEqual` пропускает ре-рендер, пока членство ячейки
 * не изменилось. Без фичи selector возвращает `null` (стабилен → ноль ре-рендеров).
 */
import { reportAction } from './debugActions'
import { isCellSelectionInteractive } from './pluginDiagnostics'
import { useTableState } from './reactivity'

/** Результат `useCellSelection` — данные для DOM ячейки; `null` без плагина. */
export interface CellSelectionRuntime {
  isSelected: boolean
  isFocused: boolean
  /** Roving tabindex: 0 для focused-ячейки, -1 для прочих выбираемых. */
  tabIndex: number
  /** Стороны ячейки на внешней границе выделения (spreadsheet-контур). */
  edgeTop: boolean
  edgeRight: boolean
  edgeBottom: boolean
  edgeLeft: boolean
  /** `mousedown` — начать выделение (shift/ctrl/cmd + drag внутри). */
  onMouseDown: (event: unknown) => void
  /** `mouseenter` — расширить активный диапазон во время drag. */
  onMouseEnter: (event: unknown) => void
}

/** Duck-typed поверхность stock-фичи на ячейке (наличие = плагин подключён). */
interface CellSelectionCell {
  getCanSelect?: () => boolean
  getIsSelected: () => boolean
  getIsFocused: () => boolean
  getTabIndex: () => number
  getSelectionEdges: () => {
    top: boolean
    right: boolean
    bottom: boolean
    left: boolean
  }
  getSelectionStartHandler: () => (event: unknown) => void
  getSelectionExtendHandler: () => (event: unknown) => void
  getContext: () => {
    table: { options: { cellSelectionInteraction?: boolean } }
  }
}

const IGNORE = () => {}

/**
 * Начало выделения мышью — жест в канале действий (ADR 0125, AL18): начало сейчас,
 * конец — при отпускании кнопки; с Shift — расширение выделения.
 */
const reportedStart = (table: unknown, cell: CellSelectionCell) => {
  const start = cell.getSelectionStartHandler()
  return (event: unknown) => {
    const id = (cell as { id?: string }).id
    if ((event as { shiftKey?: boolean }).shiftKey) {
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'extendSelection',
        detail: { cellId: id },
        source: 'pointer',
      })
    } else {
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'select',
        detail: { cellId: id },
        source: 'pointer',
        phase: 'start',
      })
      document.addEventListener(
        'mouseup',
        () =>
          reportAction(table, {
            plugin: 'cellSelection',
            action: 'select',
            source: 'pointer',
            phase: 'end',
          }),
        { once: true },
      )
    }
    start(event)
  }
}

interface Membership {
  isSelected: boolean
  isFocused: boolean
  tabIndex: number
  edgeTop: boolean
  edgeRight: boolean
  edgeBottom: boolean
  edgeLeft: boolean
}

const NO_EDGES = { top: false, right: false, bottom: false, left: false }

/**
 * Членство ячейки в выделении для DOM. `null`, если фича не зарегистрирована или
 * ячейка невыбираема (сервисные колонки) — BodyCell тогда не вешает ни атрибутов,
 * ни обработчиков, ни tabindex.
 */
export const useCellSelection = (
  cell: unknown,
): CellSelectionRuntime | null => {
  const c = cell as CellSelectionCell
  const table = c.getContext().table

  const membership = useTableState(table as never, (): Membership | null => {
    if (
      typeof c.getIsSelected !== 'function' ||
      (typeof c.getCanSelect === 'function' && !c.getCanSelect())
    ) {
      return null
    }
    const isSelected = c.getIsSelected()
    const edges = isSelected ? c.getSelectionEdges() : NO_EDGES
    return {
      isSelected,
      isFocused: c.getIsFocused(),
      tabIndex: c.getTabIndex(),
      edgeTop: edges.top,
      edgeRight: edges.right,
      edgeBottom: edges.bottom,
      edgeLeft: edges.left,
    }
  }) as Membership | null

  if (membership === null) {
    return null
  }

  // Обработчики стоковой фичи создаются заново на вызов — не реактивны, дёшевы,
  // BodyCell ре-рендерится редко (memo + гранулярная подписка выше). Без плагина
  // интерфейса мышь выделение не меняет: модель только показывает срез (ADR 0120).
  const interactive = isCellSelectionInteractive(table)
  return {
    ...membership,
    onMouseDown: interactive ? reportedStart(table, c) : IGNORE,
    onMouseEnter: interactive ? c.getSelectionExtendHandler() : IGNORE,
  }
}
