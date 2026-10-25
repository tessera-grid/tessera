import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { RowGroupingPlayground } from './DataGrid.Rows.Grouping.stories'
import { showControls } from './__mocks__/utils/dataGridControls'

/**
 * Стенды ручной проверки со скринридером (ADR 0020, ADR 0021, ADR 0031,
 * docs/testing/screen-readers.md): grid, treegrid, перестановка с клавиатуры. Файл
 * `*.dev.stories.tsx` — только в `storybook dev` и тестах, в сборку Storybook не попадает.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Common/Screen readers',
} satisfies Meta<StoryProps>

export default meta

export const A11yGrid: StoryObj<StoryProps> = {
  name: 'Grid',
  parameters: showControls([
    'enableFooter',
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableColumnPinning',
    'columnPinningLeafPinning',
    'enableColumnSizing',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableCellEditing',
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
    'enableContextMenu',
    'enableKeyboardNavigation',
  ]),
  args: {
    // Сценарии чеклиста для скринридеров: навигация, сортировка, выбор строк и
    // ячеек, правка с проверкой значения, закрепление, ширина, контекстное меню,
    // футер. Немного строк и колонок — чтобы дерево было обозримым.
    enableKeyboardNavigation: true,
    enableColumnSorting: true,
    enableColumnPinning: true,
    enableColumnSizing: true,
    enableRowSelection: true,
    enableCellSelection: true,
    enableCellEditing: true,
    enableContextMenu: true,
    enableFooter: true,
    validateCellEdit: (value: string) =>
      value.trim() ? null : 'Value is required',
    columnCount: 8,
    dataCount: 30,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

export const A11yTreeGrid: StoryObj<StoryProps> = {
  name: 'Tree grid',
  parameters: showControls([
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
    'enableRowGrouping',
    'enableKeyboardNavigation',
  ]),
  args: {
    // treegrid: группировка по gender с раскрытием — уровни строк и фокус на строке.
    ...RowGroupingPlayground.args,
    enableKeyboardNavigation: true,
    enableRowExpanding: true,
    initialGrouping: ['gender'],
    initialExpanded: undefined,
  },
}

export const A11yRowMoving: StoryObj<StoryProps> = {
  name: 'Row moving',
  parameters: showControls([
    'dataNesting',
    'enableColumnDragging',
    'columnDraggingRevertOnReject',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
    'enableKeyboardNavigation',
  ]),
  args: {
    // Перестановка строк и колонок с клавиатуры (Alt+Shift+стрелки) на дереве.
    dataNesting: 'nested',
    enableKeyboardNavigation: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnDragging: true,
    initialExpanded: true,
    dataCount: 20,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}
