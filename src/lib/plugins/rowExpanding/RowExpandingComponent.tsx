/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`);
 * бизнес-колбэк — из пропса `hooks` (инъекция definePlugin).
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useSlice } from '../../core/reactivity'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import { toggleRowExpanded } from './toggleRowExpanded'
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

  const onExpand = () => toggleRowExpanded(row, hooks)

  return <ExpandButton expanded={row.getIsExpanded()} onClick={onExpand} />
}
