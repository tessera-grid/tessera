import { Meta, StoryObj } from '@storybook/react'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

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
  rowExpandingTreeLines: true,
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
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

export const IncreasedContrast: StoryObj<StoryProps> = {
  name: 'Basic',
  args,
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
  args,
  decorators: [
    Story => (
      <div className="contrast-recipe">
        <style>{RECIPE}</style>
        <Story />
      </div>
    ),
  ],
}
