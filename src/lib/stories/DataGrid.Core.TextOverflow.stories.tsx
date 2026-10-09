import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  textOverflowColumns,
  textOverflowData,
  textOverflowLocalization,
  textOverflowPlugins,
} from './__mocks__/textOverflowData'
import {
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
} from './demos/infiniteScrollDemos'

/**
 * Длинный текст (ADR 0083): где высота задана — `…` с тултипом, где свободна — перенос.
 * Откройте кебаб строки, меню «Колонки», фильтр Status и сводку фильтров; сужайте
 * containerWidth — счётчики панели перейдут на короткую форму.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Text overflow',
} satisfies Meta<StoryProps>

export default meta

export const TextOverflow: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
    containerWidth: 560,
    columnsOverride: textOverflowColumns,
    dataOverride: textOverflowData,
    extraPlugins: textOverflowPlugins,
    localization: textOverflowLocalization,
    actionsDemo: 'none',
    enableToolbar: true,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    columnFilteringOptions: { filteredCount: true },
    enableColumnVisibility: true,
    enableRowSelection: true,
    showSelectedCount: true,
    enableRowActions: true,
    enableRowActionMenu: true,
    enablePagination: true,
  },
}

export const TextOverflowFeedError: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Feed error',
  // Длинная причина отказа ленты: две строки и многоточие, полный текст — в тултипе.
  args: {
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
    containerWidth: 480,
    serverDelayMs: 300,
    blockSize: 50,
    failFirstAttempt: true,
    failureReason:
      'Gateway timeout while the reporting service was rebuilding the regional index for the requested period, after the nightly import of contracts, invoices and shipments from every regional warehouse had been delayed by maintenance; try again in a minute',
  },
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}
