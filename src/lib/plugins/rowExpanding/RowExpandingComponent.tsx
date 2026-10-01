/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`) и на
 * ожидании своей строки; бизнес-колбэк — из пропса `hooks` (инъекция definePlugin).
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useSlice, useSliceProjection } from '../../core/reactivity'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import { toggleRowExpanded } from './toggleRowExpanded'
import type { RowExpandingHooks } from './types'

export const RowExpandingComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<Partial<RowExpandingHooks>>) => {
  useSlice(table, 'expanded')
  const pending = useSliceProjection(
    table,
    'rowExpandPending',
    (value: Record<string, number> | undefined) => !!value?.[row.id],
  )

  if (!row.getCanExpand()) {
    return null
  }

  const onExpand = () => toggleRowExpanded(row, hooks)

  return (
    <ExpandButton
      expanded={row.getIsExpanded()}
      pending={pending}
      onClick={onExpand}
    />
  )
}
