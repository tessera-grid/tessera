/**
 * Дескриптор действия группировки (ADR 0016). Инлайн — кнопка-тумблер группировки;
 * в кебаб — строка.
 */
import clsx from 'clsx'

import type { HeaderAction } from '../../core/headerActions'
import type { HeaderComponentProps } from '../../core/createSlots'
import { useIcons } from '../../ui/icons'

import styles from '../../plugins/rowGrouping/GroupButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/** Тематизируемая иконка группировки (читает `useIcons` как компонент). */
const GroupActionIcon = () => {
  const { group: GroupIcon } = useIcons()

  return <GroupIcon width={16} height={16} />
}

const isGrouped = ({ column }: HeaderComponentProps): boolean =>
  column.getIsGrouped()

export const groupHeaderAction: HeaderAction = {
  id: 'rowGrouping',
  slot: 'rightHeaderSlot',
  order: 2,
  visible: ({ column }) => column.getCanGroup(),
  icon: () => <GroupActionIcon />,
  label: (ctx, labels) => (isGrouped(ctx) ? labels.ungroup : labels.group),
  active: isGrouped,
  className: ctx =>
    clsx('column-group__button', styles.root, {
      [styles.active]: isGrouped(ctx),
    }),
  onSelect: ({ column }) => column.toggleGrouping(),
}
