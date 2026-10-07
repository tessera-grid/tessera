/**
 * Дескриптор действия группировки. Инлайн — кнопка-тумблер группировки;
 * в кебаб — строка.
 */
import clsx from 'clsx'

import type { HeaderAction } from '../../core/headerActions'
import type { HeaderComponentProps } from '../../core/createSlots'
import { useIcons } from '../../ui/icons'

import styles from '../../plugins/rowGrouping/GroupButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/** Тематизируемая иконка группировки; `grouped` — у сгруппированной колонки (ADR 0062, AI13). */
const GroupActionIcon = ({ grouped = false }: { grouped?: boolean }) => {
  const { group, grouped: groupedIcon } = useIcons()
  const Icon = grouped ? groupedIcon : group

  return <Icon width={16} height={16} />
}

const isGrouped = ({ column }: HeaderComponentProps): boolean =>
  column.getIsGrouped()

export const groupHeaderAction: HeaderAction = {
  id: 'rowGrouping',
  slot: 'rightHeaderSlot',
  order: 2,
  visible: ({ column }) => column.getCanGroup(),
  icon: ctx => <GroupActionIcon grouped={isGrouped(ctx)} />,
  label: (ctx, labels) => (isGrouped(ctx) ? labels.ungroup : labels.group),
  active: isGrouped,
  className: ctx =>
    clsx('column-group__button', styles.root, {
      [styles.active]: isGrouped(ctx),
    }),
  onSelect: ({ column }) => column.toggleGrouping(),
  // Строка меню — на базовой иконке: включённое там показывает галочка.
  menuItems: (ctx, labels) => [
    {
      id: 'rowGrouping',
      label: isGrouped(ctx) ? labels.ungroup : labels.group,
      icon: <GroupActionIcon />,
      onSelect: () => ctx.column.toggleGrouping(),
      active: isGrouped(ctx),
    },
  ],
}
