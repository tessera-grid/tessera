/**
 * Дескриптор действия группировки. Инлайн — кнопка-тумблер группировки;
 * в кебаб — строка.
 */

import type { HeaderAction } from '../../core/headerActions'
import type { HeaderComponentProps } from '../../core/createSlots'
import { useIcons } from '../../ui/icons'
import { changeGrouping } from './grouping'

import '../../ui/cellControls/buttonVisibility.css'
import { rowGroupingLabels } from './labels'

/** Тематизируемая иконка группировки; `grouped` — у сгруппированной колонки (ADR 0062, AI13). */
const GroupActionIcon = ({ grouped = false }: { grouped?: boolean }) => {
  const { group, grouped: groupedIcon } = useIcons()
  const Icon = grouped ? groupedIcon : group

  return <Icon width={16} height={16} />
}

const isGrouped = ({ column }: HeaderComponentProps): boolean =>
  column.getIsGrouped()

/** Группировка по колонке кнопкой или строкой кебаба. */
const toggleGrouping = (
  { column, table }: HeaderComponentProps,
  menu = false,
) =>
  changeGrouping(table, () => column.toggleGrouping(), {
    columns: [column.id],
    ...(menu ? { menu } : {}),
  })

export const groupHeaderAction: HeaderAction = {
  id: 'rowGrouping',
  slot: 'rightHeaderSlot',
  order: 2,
  visible: ({ column }) => column.getCanGroup(),
  icon: ctx => <GroupActionIcon grouped={isGrouped(ctx)} />,
  label: labels => rowGroupingLabels(labels).group,
  action: ctx => (isGrouped(ctx) ? 'ungroup' : 'group'),
  active: isGrouped,
  className: () => 'column-group__button',
  onSelect: ctx => toggleGrouping(ctx),
  // Строка меню — на базовой иконке: включённое там показывает галочка.
  menuItems: (ctx, labels) => [
    {
      id: 'rowGrouping',
      label: isGrouped(ctx)
        ? rowGroupingLabels(labels).ungroup
        : rowGroupingLabels(labels).group,
      icon: <GroupActionIcon />,
      onSelect: () => toggleGrouping(ctx, true),
      active: isGrouped(ctx),
    },
  ],
}
