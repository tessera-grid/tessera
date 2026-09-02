import { ROW_ACTIONS_COLUMN_ID, checkIsActionColumn } from './createColumns'
import {
  type RegisterCellSlotParams,
  type RegisterHeaderSlotParams,
  registerSlot,
} from './createSlots'
import { TablePlugin } from './pluginContract'

// Always-on baseline-фича ядра (ADR 0010, R5): не входит в список плагинов
// потребителя, вклеивается ядром всегда. Живёт в ядре (не в plugins/), т.к. это
// инфраструктура ядра, а не opt-in фича.
export const commonPlugin: TablePlugin = {
  createTable: table => {
    // The built-in Headers feature (applied before user features) already builds
    // header groups in pinned left → center → right order. We only wrap it to
    // tag each group with first/last flags.
    const getBaseHeaderGroups = table.getHeaderGroups

    table.getHeaderGroups = (...args) => {
      const headerGroups = getBaseHeaderGroups(...args)

      return headerGroups.map((headerGroup, index) => {
        headerGroup.getIsFirstGroup = () => index === 0
        headerGroup.getIsLastGroup = () => index === headerGroups.length - 1

        return headerGroup
      })
    }

    table.getIsAnyColumnResizing = () =>
      table.getVisibleLeafColumns().some(column => column.getIsResizing())

    table.getHooks = () => table.options.hooks

    table.getRenderSlots = () => table.options.slots
    table.setRenderSlot = (
      props:
        | Omit<RegisterHeaderSlotParams, 'table'>
        | Omit<RegisterCellSlotParams, 'table'>,
    ) => registerSlot({ ...props, table })
  },
  createColumn: _staticColumn => {
    _staticColumn.getIsActionsColumn = () =>
      checkIsActionColumn(_staticColumn.id)
    _staticColumn.getIsRowActionsColumn = () =>
      _staticColumn.id.includes(ROW_ACTIONS_COLUMN_ID)
  },
  createHeader: (_staticHeader, table) => {
    if (_staticHeader.render) {
      _staticHeader.column.columnDef.header = _staticHeader.render(
        _staticHeader.getContext(),
      )
    }

    _staticHeader.getIsFirstHeader = () =>
      _staticHeader.headerGroup.headers.at(0)?.id === _staticHeader.id
    _staticHeader.getIsLastHeader = () =>
      _staticHeader.headerGroup.headers.at(-1)?.id === _staticHeader.id

    _staticHeader.getIsFullHeightHeader = () =>
      _staticHeader.column.columnDef?.rowSpan === table.getHeaderGroups().length
  },
  createRow: (_staticRow, table) => {
    _staticRow.getIsLastSubRow = () => {
      if (_staticRow.parentId === null) {
        return false
      }

      const parentRow = _staticRow.getParentRow()

      return _staticRow.id === parentRow?.subRows.at(-1)?.id
    }

    _staticRow.getIsFirstRow = () => {
      const rows = table.getRowModel().rows

      return rows[0]?.id === _staticRow.id
    }

    _staticRow.getIsLastRow = () => {
      const rows = table.getRowModel().rows

      return rows.at(-1)?.id === _staticRow.id
    }
  },
  createCell: _staticCell => {
    if (_staticCell.render) {
      _staticCell.column.columnDef.cell = _staticCell.render(
        _staticCell.getContext(),
      )
    }
  },
}
