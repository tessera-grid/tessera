// MenuItems: пункты меню действий по готовой модели — кебаб, мини-меню и контекстное
// меню. Пункт показывает ожидание, причину блокировки (галочка «уже сделано», замок
// «запрещено») и отказ — значком у правого края, текст в тултипе (ADR 0078).
import { useId } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import type { MenuGroupModel, MenuItemModel } from '../../util/menuModel'
import { Tooltip } from '../Tooltip'
import { useIcons } from '../icons'

import styles from './ActionMenu.module.css'

const MenuItem = ({ item }: { item: MenuItemModel }) => {
  const {
    actionFailed: FailedIcon,
    actionBlocked: BlockedIcon,
    submenu: SubmenuIcon,
  } = useIcons()
  const descriptionId = useId()
  const { tooltip, description } = item

  const node = (
    <Menu.Item
      className={styles.item}
      data-has-tooltip={tooltip ? '' : undefined}
      data-pending={item.pending || undefined}
      aria-busy={item.pending || undefined}
      aria-describedby={description ? descriptionId : undefined}
      disabled={item.disabled}
      label={item.label}
      closeOnClick={item.closeOnClick}
      onClick={item.onClick}
      onPointerEnter={item.preload}
      onFocus={item.preload}
      onKeyDown={item.onKeyDown}
      aria-haspopup={item.section ? 'menu' : undefined}
      // Только у флажка: `role={undefined}` перебил бы роль menuitem от Base UI.
      {...(item.checkbox && {
        role: 'menuitemcheckbox',
        'aria-checked': item.active,
      })}
      data-action-id={item.actionId}
      data-item-id={item.itemId}
    >
      <span className={styles.itemIcon} aria-hidden>
        {item.icon}
      </span>
      <span className={styles.itemLabel}>{item.label}</span>
      {item.hint && (
        <span className={styles.itemHint} aria-hidden>
          {item.hint}
        </span>
      )}
      <span
        className={clsx(
          styles.itemCheck,
          (item.failed || item.checkFailed) && styles.itemFailed,
          item.locked && styles.itemBlocked,
        )}
        aria-hidden
        data-action-failed={item.failed || undefined}
        data-check-failed={item.checkFailed || undefined}
        data-action-done={item.done || undefined}
        data-action-blocked={item.locked || undefined}
      >
        {item.pending ? (
          <span className={styles.itemSpinner} data-item-spinner="" />
        ) : item.failed || item.checkFailed ? (
          <FailedIcon width={14} height={14} />
        ) : item.locked ? (
          <BlockedIcon width={14} height={14} />
        ) : item.section ? (
          <SubmenuIcon width={14} height={14} />
        ) : (
          (item.done || item.active) && <Check width={14} height={14} />
        )}
      </span>
    </Menu.Item>
  )

  return (
    <>
      <Tooltip title={tooltip} side="right">
        {node}
      </Tooltip>
      {description && (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
    </>
  )
}

export const MenuItems = ({ groups }: { groups: MenuGroupModel[] }) =>
  groups.map(group => (
    <Menu.Group
      key={group.key}
      className={clsx(styles.group, group.divided && styles.divided)}
    >
      {group.label && (
        <Menu.GroupLabel className={styles.groupLabel}>
          {group.label}
        </Menu.GroupLabel>
      )}
      {group.items.map(item => (
        <MenuItem key={item.key} item={item} />
      ))}
    </Menu.Group>
  ))
