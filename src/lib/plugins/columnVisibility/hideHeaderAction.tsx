/**
 * «Скрыть колонку» / «Скрыть группу» в кебабе заголовка (ADR 0035, CV14). Только
 * строка меню (`placement: 'menu'`): иконки-глаза в каждом заголовке нет, без
 * плагина-меню заголовка пункт не показывается, без тулбара — тоже (CV19).
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import type { HeaderAction } from '../../core/headerActions'
import { isCoveredHeader } from '../../core/headerSpans'
import { useIcons } from '../../ui/icons'
import {
  countVisibleColumns,
  getHide,
  type VisibilityColumn,
} from './columnTree'
import { requestStubFocus } from './columnsHiddenStub'
import { columnVisibilityInertReason } from './inertReason'
import {
  setColumnsVisible,
  type VisibilityControlTable,
} from './applyVisibility'

const HideIcon = () => {
  const { hideColumn: Icon } = useIcons()
  return <Icon width={16} height={16} />
}

const leavesOf = ({ column }: HeaderComponentProps) =>
  column.getLeafColumns() as unknown as VisibilityColumn[]

const hideIds = (ctx: HeaderComponentProps) =>
  ctx.header && isCoveredHeader(ctx.header) ? null : getHide(leavesOf(ctx))

const isGroup = ({ column }: HeaderComponentProps) => column.columns.length > 0

export const hideHeaderAction: HeaderAction = {
  id: 'columnVisibility.hide',
  slot: 'rightHeaderSlot',
  placement: 'menu',
  visible: ctx =>
    columnVisibilityInertReason(ctx.table) === undefined &&
    hideIds(ctx) !== null,
  icon: () => <HideIcon />,
  label: (ctx, labels) => (isGroup(ctx) ? labels.hideGroup : labels.hideColumn),
  onSelect: ctx => {
    const ids = hideIds(ctx)
    if (!ids) return
    const table = ctx.table as unknown as VisibilityControlTable
    if (countVisibleColumns(table) === ids.length) requestStubFocus(table)
    setColumnsVisible(table, ids, false)
  },
}
