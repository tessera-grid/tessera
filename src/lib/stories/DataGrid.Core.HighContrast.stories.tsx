import { Meta, StoryObj } from '@storybook/react'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/**
 * Демо-состояния: две выбранные строки, подсветка строки и блик колонки — один раз на
 * таблицу, как только появились строки (история подаёт данные эффектом).
 */
const highContrastDemo: TesseraFeatureEntry = {
  id: 'highContrastDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      setRowSelection?: (value: Record<string, boolean>) => void
      highlight: (target: object, options?: object) => unknown
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.setRowSelection?.({ 'item-id-1': true, 'item-id-2': true })
      t.highlight({ row: 'item-id-3' }, { tone: 'danger' })
      t.highlight(
        { column: 'age' },
        { tone: 'success', shimmer: { repeat: 'infinite' } },
      )
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/**
 * Высокая контрастность (ADR 0087): выбор, подсветка, линии дерева и выделение ячеек
 * на одном экране. Включите в DevTools Rendering → «Emulate CSS media feature
 * forced-colors: active» или контрастную тему Windows; выделите ячейки мышью,
 * наведите на строку, откройте кебаб заголовка.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/High contrast',
} satisfies Meta<StoryProps>

export default meta

export const HighContrast: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    dataNesting: 'nested',
    enableRowExpanding: true,
    rowExpandingTreeLines: true,
    initialExpanded: true,
    enableRowSelection: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableCellSelection: true,
    enableKeyboardNavigation: true,
    enableHeaderActionMenu: true,
    extraPlugins: [highContrastDemo],
    columnCount: 8,
    dataCount: 40,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}
