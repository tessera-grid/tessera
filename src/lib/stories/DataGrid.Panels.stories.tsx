import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  enableStatusBarType,
  enableToolbarType,
} from './__mocks__/utils/argTypes'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { OwnPagerDemo } from './demos/panelsDemos'

/**
 * Тулбар и нижняя панель (ADR 0046): без флага панель есть, пока плагины дают ей
 * слоты; `enableToolbar` / `enableStatusBar` оставляют пустую панель или запрещают её.
 */

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 8,
  dataCount: 120,
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

export const PanelsFromPlugins: StoryObj<StoryProps> = {
  name: 'Panels — from plugins',
  args: {
    ...GRID,
    // Флагов нет: тулбар вызывают «Колонки» и «Экспорт», нижнюю панель — пагинация
    // и счётчик выбора. Переключите enableToolbar / enableStatusBar в off — панель
    // уйдёт (columnVisibility станет инертен), в on — останется и без плагинов.
    enableColumnVisibility: true,
    enableExport: true,
    enablePagination: true,
    enableRowSelection: true,
    showSelectedCount: true,
  },
  argTypes: {
    enableToolbar: enableToolbarType,
    enableStatusBar: enableStatusBarType,
  },
}

export const PanelsNarrowStatusBar: StoryObj<StoryProps> = {
  name: 'Panels — narrow status bar',
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
  name: 'Panels — status bar off (own pager)',
  args: GRID,
  // Нижняя панель запрещена, пагинация работает: свой пейджер над гридом листает
  // страницы через table.previousPage() / nextPage().
  render: args => <OwnPagerDemo {...normalizeArgs(args)} />,
}
