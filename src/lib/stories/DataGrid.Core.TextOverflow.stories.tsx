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
import { expect, userEvent } from 'storybook/test'
import {
  openPopup,
  orderedRows,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

const lineHeight = (el: Element) => parseFloat(getComputedStyle(el).lineHeight)

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
  name: 'Default',
  args: {
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    containerWidth: 560,
    columnsOverride: textOverflowColumns,
    dataOverride: textOverflowData,
    extraPlugins: textOverflowPlugins,
    localization: textOverflowLocalization,
    actionsDemo: 'none',
    enableToolbar: true,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    columnFilteringFilteredCount: true,
    enableColumnVisibility: true,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    enableRowActions: true,
    enableRowActionMenu: true,
    enablePagination: true,
  },
  // Дымовой тест (ADR 0083, TX13): меню строки не шире 320px, длинный пункт переносится.
  parameters: {
    requirements: ['TX13'],
    ...showControls([
      'enableToolbar',
      'enableColumnVisibility',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowActions',
      'rowActionsWidth',
      'rowActionsCollapsedWidth',
      'rowActionsColumn',
      'enableRowActionMenu',
      'rowActionMenuMode',
      'rowActionMenuThreshold',
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'enablePagination',
      'paginationInitialPageSize',
      'paginationPageSizes',
      'paginationRevertOnReject',
      'containerWidth',
    ]),
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    await waitForRows(canvasElement)
    const row = () => orderedRows(canvasElement)[0]!
    await userEvent.hover(row().querySelector('[data-column-id="account"]')!)
    const menu = await openPopup(
      () =>
        row()?.querySelector<HTMLElement>('[aria-label^="Row options"]') ??
        null,
      'menu',
    )
    expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(320.5)
    const label = [
      ...menu.querySelectorAll<HTMLElement>('[class*="itemLabel"]'),
    ].find(
      el =>
        el.textContent ===
        'Reassign the account to another manager in the same regional office',
    )!
    expect(label.getBoundingClientRect().height).toBeGreaterThan(
      lineHeight(label) * 1.5,
    )
  },
}

export const TextOverflowFeedError: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Feed error',
  parameters: showControls(
    [
      'containerWidth',
      'serverDelayMs',
      'blockSize',
      'failFirstAttempt',
      'failureReason',
    ],
    {
      dataCount: 'данные подаёт демо',
      columnCount: 'колонки задаёт демо',
    },
  ),
  // Длинная причина отказа ленты: две строки и многоточие, полный текст — в тултипе.
  args: {
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    containerWidth: 480,
    serverDelayMs: 300,
    blockSize: 50,
    failFirstAttempt: true,
    failureReason:
      'Gateway timeout while the reporting service was rebuilding the regional index for the requested period, after the nightly import of contracts, invoices and shipments from every regional warehouse had been delayed by maintenance; try again in a minute',
  },
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
  // Причина отказа в конце ленты обрезана до двух строк.
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const scroller = canvasElement.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = scroller.scrollHeight
    const reason = () =>
      canvasElement.querySelector<HTMLElement>(
        '[data-testid="infinite-scroll-error"] [class*="error-reason"]',
      )
    await until(() => expect(reason()).not.toBeNull())
    const el = reason()!
    const range = document.createRange()
    range.selectNodeContents(el)
    const clipped =
      el.scrollHeight > el.clientHeight + 1 ||
      range.getBoundingClientRect().height >
        el.getBoundingClientRect().height + lineHeight(el) / 2
    expect(clipped).toBe(true)
    await settle()
  },
}
