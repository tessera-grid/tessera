import { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { bodyRow, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/**
 * Движение строк (ADR 0107): раскрытие, сортировка, поиск и перестановка двигают строки
 * к новым местам, уходящие гаснут. Выключите `enableRowAnimation`, чтобы сравнить с
 * мгновенной сменой.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Motion',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: '520',
  height: '440',
  maxHeight: '440',
  dataCount: 60,
}

const TOGGLE = '.row-expand-button'
const CHILD = 'item-id-0-0'

export const RowMotionTree: StoryObj<StoryProps> = {
  name: 'Tree',
  args: {
    ...GRID,
    dataNesting: 'nested',
    enableRowExpanding: true,
    enableColumnSorting: true,
  },
  // Дымовой сценарий (ADR 0107, RM21): раскрытие добавляет детей, сворачивание убирает
  // их вместе с призраками.
  parameters: {
    requirements: ['RM21'],
    ...showControls([
      'dataNesting',
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'rowExpandingTreeLines',
    ]),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const toggle = () => canvasElement.querySelector<HTMLElement>(TOGGLE)!
    await userEvent.click(toggle())
    await until(() => expect(bodyRow(canvasElement, CHILD)).not.toBeNull())
    await userEvent.click(toggle())
    await until(() => expect(bodyRow(canvasElement, CHILD)).toBeNull())
    await until(() =>
      expect(canvasElement.querySelector('[data-row-ghost]')).toBeNull(),
    )
    await settle()
  },
}

/** Поиск и фильтры: прошедшие строки переезжают, ушедшие гаснут, вернувшиеся проявляются. */
export const RowMotionSearch: StoryObj<StoryProps> = {
  name: 'Search and filter',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableQuickSearch',
    'quickSearchDebounceMs',
    'quickSearchFilteredCount',
    'enableColumnFiltering',
    'columnFilteringDebounceMs',
    'columnFilteringFilteredCount',
    'columnFilteringTimeZone',
  ]),
  args: {
    ...GRID,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    enableColumnSorting: true,
  },
}

/** Перестановка: соседи раздвигаются плавно, облако приземляется в слот. */
export const RowMotionDragging: StoryObj<StoryProps> = {
  name: 'Dragging',
  parameters: showControls([
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
  ]),
  args: {
    ...GRID,
    enableRowDragging: true,
  },
}

/** Без движения: `enableRowAnimation: false` — смены модели мгновенны. */
export const RowMotionOff: StoryObj<StoryProps> = {
  name: 'Off',
  parameters: showControls([
    'dataNesting',
    'enableRowAnimation',
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'rowExpandingTreeLines',
  ]),
  args: {
    ...GRID,
    dataNesting: 'nested',
    enableRowExpanding: true,
    enableColumnSorting: true,
    enableRowAnimation: false,
  },
}
