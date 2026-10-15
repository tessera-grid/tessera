import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  expectPopupInCanvas,
  openPopup,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Видимость колонок (ADR 0035): меню «Колонки», вместе с меню заголовка. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Visibility',
} satisfies Meta<StoryProps>

export default meta

export const ColumnVisibility: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls([
    'enableColumnVisibility',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
  ]),
  args: {
    // Кнопка «Колонки» в тулбаре: поиск, дерево, «Показать все» / «Сбросить».
    // headerNesting: nested — меню покажет группы вложенной шапки.
    enableColumnVisibility: true,
    enableRowSelection: true,
  },
}

export const ColumnVisibilityWithHeaderMenu: StoryObj<StoryProps> = {
  name: 'With header menu',
  parameters: showControls([
    'enableColumnPinning',
    'columnPinningLeafPinning',
    'enableColumnVisibility',
    'enableHeaderActionMenu',
    'headerActionMenuMode',
    'headerActionMenuThreshold',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
  ]),
  args: {
    // Всё вместе: кнопка «Колонки» в тулбаре и «Скрыть колонку» в кебабе заголовка.
    // Пин — обычное действие, остаётся кнопкой; «Скрыть колонку» (`placement:
    // 'menu'`) — только в кебабе. Кебаб считается в пороге (3) одной кнопкой:
    // включите enableColumnSorting — пин + сортировка + кебаб = 3, всё уйдёт в кебаб.
    // headerNesting: nested — у групп в кебабе появится «Скрыть группу».
    enableColumnVisibility: true,
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableRowSelection: true,
  },
}

/** Открытое меню «Колонки» (ADR 0093, VR6). */
export const VisibilityStatePanel: StoryObj<StoryProps> = {
  name: 'State: columns panel',
  parameters: {
    ...vrStates('overlay.columns'),
    ...showControls(['enableColumnVisibility']),
  },
  args: {
    enableColumnVisibility: true,
    dataCount: 20,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const panel = await openPopup(() =>
      canvasElement.querySelector<HTMLElement>(
        '[data-testid="column-visibility-button"]',
      ),
    )
    expectPopupInCanvas(canvasElement, panel)
  },
}
