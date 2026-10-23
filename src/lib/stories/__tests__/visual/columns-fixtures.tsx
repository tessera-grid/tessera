import type { StoryProps } from '../../DataGridStory.types'
import { composed } from '../stories'

type Args = Partial<StoryProps>

const GRID = {
  containerHeight: '400',
  height: '300',
  maxHeight: '300',
} satisfies Args

/** Протяжка ширины без переноса: тело с отрисованными ячейками (ADR 0013, CR8). */
export const ColumnResizingGrid = (args: Args) => (
  <composed.ColumnResizingPlayground
    {...GRID}
    enableColumnSizing
    enableColumnDragging={false}
    dataCount={30}
    {...args}
  />
)

/** Перенос без протяжки: прокрутка по обеим осям для автопрокрутки (ADR 0006, D26–D28). */
export const ColumnDraggingGrid = (args: Args) => (
  <composed.ColumnDraggingPlayground
    {...GRID}
    enableColumnDragging
    enableColumnSizing={false}
    dataCount={60}
    {...args}
  />
)

/** Перенос под вложенной шапкой с ручкой строк (ADR 0052). */
export const HeaderGroupsDraggingGrid = (args: Args) => (
  <composed.ColumnDraggingPlayground
    {...GRID}
    headerNesting="nested"
    enableColumnDragging
    enableColumnSizing={false}
    enableRowDragging
    dataCount={40}
    {...args}
  />
)
