/**
 * «Подогнать ширину» и «Подогнать все колонки» в кебабе заголовка (ADR 0217, §2): только строки
 * меню. У группы шапки «Подогнать ширину» подгоняет её листья.
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import type { HeaderAction } from '../../core/headerActions'
import { useIcons } from '../../ui/icons'
import {
  autosizableColumns,
  autosizeColumns,
  hasAutosizableColumns,
} from './autosize'
import { columnSizingLabels } from './labels'

const ColumnIcon = () => {
  const { autosizeColumn: Icon } = useIcons()
  return <Icon width={16} height={16} />
}

const AllIcon = () => {
  const { autosizeAllColumns: Icon } = useIcons()
  return <Icon width={16} height={16} />
}

const leafIdsOf = ({ column, table }: HeaderComponentProps) =>
  autosizableColumns(
    table,
    column.getLeafColumns().map(leaf => leaf.id),
  ).map(leaf => leaf.id)

export const autosizeHeaderActions: HeaderAction[] = [
  {
    id: 'columnSizing.autosize',
    slot: 'rightHeaderSlot',
    placement: 'menu',
    visible: ctx => leafIdsOf(ctx).length > 0,
    icon: () => <ColumnIcon />,
    label: labels => columnSizingLabels(labels).autosizeColumn,
    action: () => 'autosize',
    onSelect: async (ctx, event) => {
      await autosizeColumns(
        ctx.table,
        leafIdsOf(ctx),
        event?.detail === 0 ? 'keyboard' : 'pointer',
      )
    },
  },
  {
    id: 'columnSizing.autosizeAll',
    slot: 'rightHeaderSlot',
    placement: 'menu',
    visible: ctx => hasAutosizableColumns(ctx.table),
    icon: () => <AllIcon />,
    label: labels => columnSizingLabels(labels).autosizeAllColumns,
    action: () => 'autosizeAll',
    onSelect: async (ctx, event) => {
      await autosizeColumns(
        ctx.table,
        undefined,
        event?.detail === 0 ? 'keyboard' : 'pointer',
      )
    },
  },
]
