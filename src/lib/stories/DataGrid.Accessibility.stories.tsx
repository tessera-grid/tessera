import { Meta, StoryObj } from '@storybook/react'
import { Grid } from './_shims'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { showControls } from './__mocks__/utils/dataGridControls'

/**
 * Доступность (ADR 0020, ADR 0021): роль таблицы в покое. Стенды ручной проверки со
 * скринридером — в `Tessera/Common/Screen readers`.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Accessibility',
} satisfies Meta<StoryProps>

export default meta

/**
 * Роль таблицы: без клавиатурной навигации — `table`, с ней — `grid`, с иерархией
 * (дерево или группы) — `treegrid`. Проверяйте вкладкой Accessibility и скринридером.
 */
export const AccessibilityPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableKeyboardNavigation',
    'dataNesting',
    'enableRowExpanding',
    'enableTreeLines',
    'enableRowGrouping',
    'enableRowSelection',
    'enableCellSelection',
    'enableColumnSorting',
    'enableFooter',
  ]),
  args: {
    enableKeyboardNavigation: true,
    columnCount: 8,
    dataCount: 30,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}
