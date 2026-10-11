import { Meta, StoryObj } from '@storybook/react'
import { statusBarDemoPlugins } from './statusBarDemo'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { OwnPagerDemo } from './demos/panelsDemos'
import { vrStates } from './__mocks__/catalog'

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
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

export const WithStatusBar: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: vrStates('panel.statusBar'),
  args: {
    // Демо-слоты нижней панели: один слева, два справа (порядок по `order`).
    // Включите enableFooter — панель встанет под футером одной линией.
    extraPlugins: statusBarDemoPlugins,
  },
}

export const SelectedCount: StoryObj<StoryProps> = {
  name: 'Selected count',
  args: {
    // Счётчик выбранных строк слева в нижней панели, пагинация справа: выбор на
    // других страницах тоже считается.
    enableRowSelection: true,
    showSelectedCount: true,
    enablePagination: true,
    dataCount: 1000,
  },
}

export const PanelsNarrowStatusBar: StoryObj<StoryProps> = {
  name: 'Narrow',
  parameters: vrStates('panel.narrow'),
  // Узкая колонка (ADR 0038, SB7–SB13): нижняя панель в две строки — счётчик выбора
  // сверху, пагинация снизу, кнопки переносятся. Выберите строки, чтобы появился
  // счётчик; меняйте containerWidth, чтобы увидеть компактный и полный вид.
  args: {
    ...GRID,
    containerWidth: 320,
    enableRowSelection: true,
    showSelectedCount: true,
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
}
