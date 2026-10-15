import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Высота строк и шапки, ширина колонок по умолчанию (ADR 0077). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Sizing',
} satisfies Meta<StoryProps>

export default meta

const SIZE = { containerHeight: '560', height: '460', maxHeight: '460' }

export const RowHeight: StoryObj<StoryProps> = {
  name: 'Row height',
  parameters: showControls([
    'dataNesting',
    'enableFooter',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'rowExpandingTreeLines',
  ]),
  args: {
    // Строки тела и футера по 40px (минимум); меняйте rowHeight в Controls на лету.
    rowHeight: 40,
    enableFooter: true,
    enableRowExpanding: true,
    dataNesting: 'nested',
    dataCount: 200,
    columnCount: 8,
    ...SIZE,
  },
}

export const HeaderHeight: StoryObj<StoryProps> = {
  name: 'Header height',
  parameters: showControls(
    [
      'headerNesting',
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
    ],
    { columnCount: 'колонки задаёт вложенная шапка' },
  ),
  args: {
    // Шапка выше строк: 72px на каждую строку вложенной шапки при строках по 44px.
    rowHeight: 44,
    headerHeight: 72,
    headerNesting: 'nested',
    enableColumnSorting: true,
    ...SIZE,
  },
}

/** Колонки без своего `size`: ширина из `defaultColumn`, у колонки со своим — своя. */
export const DefaultColumnWidth: StoryObj<StoryProps> = {
  name: 'Default column width',
  parameters: showControls(['enableColumnSizing']),
  args: {
    defaultColumn: { size: 220 },
    columnsOverride: [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      { id: 'company', accessorKey: 'company', header: 'Company' },
      {
        id: 'city',
        accessorKey: 'city',
        header: 'City (size: 100)',
        size: 100,
      },
    ],
    dataOverride: [
      { id: '1', name: 'Ann', company: 'Acme', city: 'Oslo' },
      { id: '2', name: 'Bob', company: 'Globex', city: 'Rome' },
    ],
    enableColumnSizing: true,
    ...SIZE,
  },
}
