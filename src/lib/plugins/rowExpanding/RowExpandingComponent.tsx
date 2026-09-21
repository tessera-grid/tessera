/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`);
 * бизнес-колбэк — из пропса `hooks` (инъекция definePlugin).
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useSlice } from '../../core/reactivity'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import type { RowExpandingHooks } from './types'

export const RowExpandingComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<RowExpandingHooks>) => {
  useSlice(table, 'expanded')

  if (!row.getCanExpand()) {
    return null
  }

  const onExpand = () => {
    row.getToggleExpandedHandler()()
    hooks.onExpandRow(row, !row.getIsExpanded())
  }

  return <ExpandButton expanded={row.getIsExpanded()} onClick={onExpand} />
}
