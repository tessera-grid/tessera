import { Meta, StoryObj } from '@storybook/react'
import { statusBarDemoPlugins } from './statusBarDemo'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { OwnPagerDemo } from './demos/panelsDemos'
import { expect, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import { byTestId, firstRowText, settle, until } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { seed } from './__mocks__/seed'

/** Нижняя панель (ADR 0038): счётчик выбора, узкая ширина, своя пагинация вместо панели. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Status bar',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 8,
  dataCount: 120,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

export const WithStatusBar: StoryObj<StoryProps> = {
  name: 'Default',
  parameters: { ...vrStates('panel.statusBar'), ...showControls([]) },
  args: {
    // Демо-слоты нижней панели: один слева, два справа (порядок по `order`).
    // Включите enableFooter — панель встанет под футером одной линией.
    extraPlugins: statusBarDemoPlugins,
  },
}

export const SelectedCount: StoryObj<StoryProps> = {
  name: 'Selected count',
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enablePagination',
    'paginationInitialPageSize',
    'paginationPageSizes',
    'paginationRevertOnReject',
  ]),
  args: {
    // Счётчик выбранных строк слева в нижней панели, пагинация справа: выбор на
    // других страницах тоже считается.
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    enablePagination: true,
    dataCount: 1000,
  },
}

export const PanelsNarrowStatusBar: StoryObj<StoryProps> = {
  name: 'Narrow',
  parameters: {
    ...vrStates('panel.narrow'),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
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
  // Узкая колонка (ADR 0038, SB7–SB13): нижняя панель в две строки — счётчик выбора
  // сверху, пагинация снизу, кнопки переносятся. Меняйте containerWidth, чтобы увидеть
  // компактный и полный вид.
  args: {
    ...GRID,
    extraPlugins: [
      seed(
        'narrowSelection',
        (table: {
          setRowSelection?: (value: Record<string, boolean>) => void
        }) => table.setRowSelection?.({ 'item-id-1': true, 'item-id-2': true }),
      ),
    ],
    containerWidth: 320,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    enableColumnFiltering: true,
    enablePagination: true,
  },
}

export const PanelsOwnPager: StoryObj<StoryProps> = {
  name: 'Off (own pager)',
  args: GRID,
  // Нижняя панель запрещена, пагинация работает: свой пейджер над гридом листает
  // страницы через table.previousPage() / nextPage().
  render: args => <OwnPagerDemo {...normalizeArgs(args)} />,
  // Сценарий истории (ADR 0046, PB12): нижней панели нет, свой пейджер листает страницы.
  parameters: { requirements: ['PB12'], ...showControls([]) },
  play: async ({ canvasElement }) => {
    const firstName = () => firstRowText(canvasElement, 'name')
    await until(() =>
      expect(
        canvasElement.querySelectorAll('.data-grid__body-row'),
      ).toHaveLength(10),
    )
    expect(byTestId('data-grid-status-bar')).toBeNull()
    expect(byTestId('own-pager-label')).toHaveTextContent('Page 1 of 10')
    expect(firstName()).toBe('Alice 0')

    await userEvent.click(byTestId('own-pager-next')!)
    await until(() => expect(firstName()).toBe('Dave 10'))
    expect(byTestId('own-pager-label')).toHaveTextContent('Page 2 of 10')

    await userEvent.click(byTestId('own-pager-prev')!)
    await until(() => expect(firstName()).toBe('Alice 0'))
    await settle()
  },
}
