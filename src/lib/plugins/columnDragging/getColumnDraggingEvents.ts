import { arrayMove } from '@dnd-kit/sortable'
import { Table, TableOptionsResolved } from '@tanstack/react-table'

export const getColumnDraggingEvents = (
  table: Table,
): Pick<TableOptionsResolved<any>, 'onColumnDragStart' | 'onColumnDragEnd'> => {
  const { onColumnDraggingActiveIdChange, onColumnOrderChange } = table.options

  const { columnDragging } = table.getHooks()
  const { onColumnDragEnd } = columnDragging

  return {
    onColumnDragStart: event => {
      document.body.style.cursor = 'grabbing'
      onColumnDraggingActiveIdChange?.(event.active.id)
    },
    onColumnDragEnd: event => {
      const { over } = event

      if (!over) {
        document.body.style.cursor = 'default'
        onColumnDraggingActiveIdChange?.(null)
      }

      const headers = table.getFlatHeaders()
      const { columnDraggingActiveId } = table.getState()

      const activeColumn = headers.find(
        header => header.column.id === columnDraggingActiveId,
      )?.column

      const activeOrderIndex = activeColumn?.getIndex()
      const activeDraggingIndex = activeColumn?.getDraggableIndex()

      const overOrderIndex: number | null = over?.data.current?.orderIndex
      const overDraggingIndex: number | null =
        over?.data.current?.draggableIndex
      const overIsDisabledSortable = !!over?.data.current?.disabledSortable

      const firstDraggableNotPinnedColumn = headers.find(
        header =>
          header.column.getCanDrag() && header.column.getIsPinned() === false,
      )?.column

      const lastDraggableNotPinnedColumn = [...headers]
        .reverse()
        .find(
          header =>
            header.column.getCanDrag() && header.column.getIsPinned() === false,
        )?.column

      if (activeOrderIndex === undefined || activeDraggingIndex === undefined) {
        return
      }

      if (overOrderIndex === null || overDraggingIndex === null) {
        return
      }

      if (!firstDraggableNotPinnedColumn || !lastDraggableNotPinnedColumn) {
        return
      }

      if (activeColumn?.id === over?.id) {
        return
      }

      onColumnOrderChange?.(prev => {
        if (!overIsDisabledSortable) {
          onColumnDragEnd?.({
            dragIndex: activeDraggingIndex,
            hoverIndex: overDraggingIndex,
          })

          return arrayMove(prev, activeOrderIndex, overOrderIndex)
        }

        const dragIsOutOfRangeStart =
          overOrderIndex < firstDraggableNotPinnedColumn.getIndex()

        const firstOrLastDraggableColumn = dragIsOutOfRangeStart
          ? firstDraggableNotPinnedColumn
          : lastDraggableNotPinnedColumn

        const firstOrLastDraggableIndex =
          firstOrLastDraggableColumn.getDraggableIndex()
        const firstOrLastIndex = firstOrLastDraggableColumn.getIndex()

        // TODO: мы должны отличать getIndex от getDraggableIndex, чтобы на сервере порядок колонок сохранялся
        //  правильным, то есть без учета локальных и хардкорных колонок внутри таблицы, например колонок с кнопками в начале списка
        onColumnDragEnd?.({
          dragIndex: activeDraggingIndex,
          hoverIndex: firstOrLastDraggableIndex,
        })

        return arrayMove(prev, activeOrderIndex, firstOrLastIndex)
      })

      document.body.style.cursor = 'default'
      onColumnDraggingActiveIdChange?.(null)
    },
  }
}
