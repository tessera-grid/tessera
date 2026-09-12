import { stateUpdater } from '../../core/createState/stateUpdater'
import { logWarn } from '../../core/logger'
import { TablePlugin } from '../types'
import { RowDraggingComponent } from './RowDraggingComponent'
import { COLUMN_DRAGGING_ID } from './rowDraggingColumn'
import { DEFAULT_ROW_DRAG_OVERLAY_STATE } from './types'

export const rowDraggingPlugin: TablePlugin = {
  // Плагин сам сеет свой слайс overlay-состояния и его updater (ADR 0010): ядро
  // больше не управляет rowDragging вручную.
  getInitialState: state => ({
    rowDragging: DEFAULT_ROW_DRAG_OVERLAY_STATE,
    ...state,
  }),
  getDefaultOptions: table => ({
    onRowDraggingChange: stateUpdater('rowDragging', table),
  }),
  createRow: (_staticRow, table) => {
    _staticRow.getCanDrag = () => {
      // Опцию читаем в момент вызова (как columnDragging.getCanDrag), чтобы
      // live-тумблер плагина срабатывал без пересоздания строк.
      const enableRowDragging = table.options.enableRowDragging
      const wantsDrag =
        typeof enableRowDragging === 'function'
          ? enableRowDragging(_staticRow)
          : !!enableRowDragging

      // Предупреждаем только когда потребитель действительно включил drag —
      // иначе тишина о неподключённой фиче не нужна.
      if (!wantsDrag) {
        return false
      }

      if (table.getHeaderGroups().length !== 1) {
        logWarn(
          table,
          'rowDragging: перетаскивание строк не работает при многоуровневой шапке (getHeaderGroups().length > 1) и отключено. См. ADR 0022.',
          'rowDragging:multi-level-header',
        )
        return false
      }

      if ((table.getState().grouping?.length ?? 0) > 0) {
        logWarn(
          table,
          'rowDragging: перетаскивание строк несовместимо с активной группировкой и отключено — раскладкой строк владеет rowGrouping. Само включение плагина группировки drag не трогает. См. ADR 0022.',
          'rowDragging:grouping',
        )
        return false
      }

      if ((table.getState().sorting?.length ?? 0) > 0) {
        logWarn(
          table,
          'rowDragging: перетаскивание строк несовместимо с активной сортировкой (ручной порядок против авто-упорядочивания) и отключено. Сбросьте сортировку, чтобы перетаскивать. См. ADR 0022.',
          'rowDragging:sorting',
        )
        return false
      }

      return wantsDrag
    }
  },
  createCell: _staticCell => {
    if (_staticCell.column.id !== COLUMN_DRAGGING_ID) return

    _staticCell.renderComponent = RowDraggingComponent
  },
}
