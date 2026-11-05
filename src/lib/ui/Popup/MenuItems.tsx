// MenuItems: пункты меню действий по готовой модели — кебаб, мини-меню и контекстное
// меню. Пункт показывает ожидание, причину блокировки (галочка «уже сделано», замок
// «запрещено») и отказ — значком у правого края, текст в тултипе (ADR 0078).
import { useId } from 'react'

import { Menu } from '@base-ui/react/menu'

import type { MenuGroupModel, MenuItemModel } from '../../util/menuModel'
import { Tooltip } from '../Tooltip'
import { PopupGroup } from './PopupGroup'
import { PopupItem, PopupItemMark, type PopupItemStatus } from './PopupItem'

const statusOf = (item: MenuItemModel): PopupItemStatus | undefined =>
  item.pending
    ? 'pending'
    : item.failed || item.checkFailed
      ? 'failed'
      : item.locked
        ? 'blocked'
        : item.section
          ? 'submenu'
          : item.done || item.active
            ? 'checked'
            : undefined

const MenuItem = ({ item }: { item: MenuItemModel }) => {
  const descriptionId = useId()
  const { tooltip, description } = item

  const node = (
    <PopupItem
      wrap
      render={
        <Menu.Item
          disabled={item.disabled}
          label={item.label}
          closeOnClick={item.closeOnClick}
          onClick={item.onClick}
        />
      }
      data-has-tooltip={tooltip ? '' : undefined}
      data-pending={item.pending || undefined}
      aria-busy={item.pending || undefined}
      aria-describedby={description ? descriptionId : undefined}
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
      icon={item.icon ?? null}
      label={item.label}
      hint={item.hint}
      end={
        <PopupItemMark
          status={statusOf(item)}
          data-action-failed={item.failed || undefined}
          data-check-failed={item.checkFailed || undefined}
          data-action-done={item.done || undefined}
          data-action-blocked={item.locked || undefined}
        />
      }
    />
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
    <PopupGroup
      key={group.key}
      render={<Menu.Group />}
      label={group.label || undefined}
      labelRender={<Menu.GroupLabel />}
      divided={group.divided}
    >
      {group.items.map(item => (
        <MenuItem key={item.key} item={item} />
      ))}
    </PopupGroup>
  ))
