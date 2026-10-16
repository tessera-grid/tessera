import { Meta, StoryObj } from '@storybook/react'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect } from 'storybook/test'
import { settle, until, waitForRows } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

const gridTheme = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>('.data-grid-theme[class*="theme-wrapper"]')!

/** Две выбранные строки — один раз, как только появились строки. */
const selectionDemo: TesseraFeatureEntry = {
  id: 'increasedContrastDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      setRowSelection?: (value: Record<string, boolean>) => void
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.setRowSelection?.({ 'item-id-1': true, 'item-id-2': true })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/**
 * Повышенный контраст (ADR 0088): рамки и разделители, наведение и выбор строки с
 * контуром, закреплённые колонки, линии дерева. Переключите `contrast`: `auto` следует
 * системе (DevTools Rendering → «prefers-contrast: more»), `standard` — обычный вид.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Increased contrast',
} satisfies Meta<StoryProps>

export default meta

const args: Partial<StoryProps> = {
  contrast: 'more',
  dataNesting: 'nested',
  enableRowExpanding: true,
  enableTreeLines: true,
  initialExpanded: true,
  enableRowSelection: true,
  enableColumnPinning: true,
  enableColumnSorting: true,
  enableKeyboardNavigation: true,
  enableHeaderActionMenu: true,
  enableColumnVisibility: true,
  extraPlugins: [selectionDemo],
  columnCount: 8,
  dataCount: 40,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

export const IncreasedContrast: StoryObj<StoryProps> = {
  name: 'Basic',
  args,
  // Дымовой тест (ADR 0088, MC11): режим включён, выбор — контуром, дерево на месте.
  parameters: {
    requirements: ['MC11'],
    ...showControls([
      'dataNesting',
      'contrast',
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableColumnVisibility',
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
      'enableKeyboardNavigation',
    ]),
  },
  play: async ({ canvasElement }) => {
    const selected = () =>
      canvasElement.querySelector<HTMLElement>(
        '.data-grid__body-row[data-selected="true"]',
      )
    await until(() => expect(selected()).not.toBeNull())
    expect(gridTheme(canvasElement)).toHaveAttribute(
      'data-tsr-contrast',
      'more',
    )
    expect(getComputedStyle(selected()!).outlineStyle).toBe('solid')
    expect(canvasElement.querySelector('[data-tree-depth]')).not.toBeNull()
    await settle()
  },
}

/**
 * Рецепт приложения: свои рычаги и своя рамка палитры поверх надстройки — правило
 * приложения перебивает её без `!important`.
 */
const RECIPE = `
.contrast-recipe .data-grid-theme[data-tsr-contrast='more'] {
  --tsr-sys-tint-hover: 10%;
  --tsr-sys-tint-selected: 14%;
  --border: #1d4ed8;
}
`

export const IncreasedContrastRecipe: StoryObj<StoryProps> = {
  name: 'Own levers and palette',
  parameters: showControls([
    'dataNesting',
    'contrast',
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableColumnPinning',
    'columnPinningLeafPinning',
    'enableColumnVisibility',
    'enableHeaderActionMenu',
    'headerActionMenuMode',
    'headerActionMenuThreshold',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
    'enableKeyboardNavigation',
  ]),
  args,
  decorators: [
    Story => (
      <div className="contrast-recipe">
        <style>{RECIPE}</style>
        <Story />
      </div>
    ),
  ],
  // Рамка палитры приложения перебивает надстройку.
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    expect(getComputedStyle(gridTheme(canvasElement)).borderTopColor).toBe(
      'rgb(29, 78, 216)',
    )
  },
}
