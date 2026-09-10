import clsx from 'clsx'

import { HeaderAction } from '../../core/headerActions'
import { HeaderComponentProps } from '../types'
import { useIcons } from '../../ui/icons'

import styles from './GroupButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/** Тематизируемая иконка группировки (читает `useIcons` как компонент). */
const GroupActionIcon = () => {
  const { group: GroupIcon } = useIcons()

  return <GroupIcon width={16} height={16} />
}

const isGrouped = ({ column }: HeaderComponentProps): boolean =>
  column.getIsGrouped()

/**
 * Действие группировки как единый дескриптор (ADR 0016): применимость
 * (`getCanGroup`), тумблер группировки, подпись и иконка — данными; ядро решает
 * подачу (инлайн-кнопка или строка кебаб-меню). Инлайн воспроизводит DOM
 * `GroupButton` (класс `column-group__button`, иконка `group` 16×16, акцент
 * сгруппированного состояния).
 */
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
  subscribe: ({ column, table }) => [
    column.getIsGrouped(),
    column.getCanGroup(),
    table.options.enableGrouping,
  ],
  onSelect: ({ column }) => column.toggleGrouping(),
}
