// ActionMenuItems: пункты меню действий — общие для кебаба, мини-меню и контекстного
// меню. Каждое действие — подгруппа (`menuItems` или одна строка). Пункт показывает
// проверку доступности, ожидание, причину блокировки (галочка «уже сделано», замок
// «запрещено») и отказ действия или проверки — значком у правого края, текст в тултипе
// (ADR 0078).
import { type KeyboardEvent, type MouseEvent, useId, useReducer } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { actionOwnerOf, actionDetailOf } from '../../core/actionOwners'
import { reportAction, sourceOf } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { useActionStatus } from './useActionStatus'
import type { MenuSections } from './useMenuSections'
import {
  type ActionStatus,
  type ActionStatusEntry,
  type Availability,
  type AvailabilityCheck,
  type AvailabilityChecks,
  type HeaderMenuItem,
  type MenuAction,
  type SlotAction,
  actionErrorText,
  actionStatusKey,
  blockOf,
  checkErrorText,
  menuGroups,
  preloadActionPanel,
  resolveAvailability,
  runMenuAction,
} from '../../core/headerActions'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'

import styles from '../../grid/headerActions/ActionMenu.module.css'

export interface ActionMenuItemsProps {
  actions: MenuAction[]
  context: unknown
  /** Сессия проверки доступности: итоги и повторная проверка одного пункта. */
  session?: {
    checks: AvailabilityChecks | null
    recheck: (
      action: MenuAction,
      context: unknown,
      onSettled: (check: AvailabilityCheck) => void,
    ) => void
  }
  /** Закрыть меню — после повторной проверки, разрешившей действие. */
  close?: () => void
  /** Пункт действия с панелью открывает её вместо `onSelect`. */
  onOpenPanel?: (action: SlotAction) => void
  /** Разделы меню (ADR 0079): вход, возврат, загрузка заранее. */
  sections?: Pick<MenuSections, 'enter' | 'back' | 'preload'>
  /** Умолчание раздела: `false` — выбор не закрывает меню (ADR 0079). */
  closeOnSelect?: boolean
}

interface ItemProps {
  action: MenuAction
  item: HeaderMenuItem
  context: unknown
  availability: Availability
  entry: ActionStatusEntry | undefined
  onClick: (event: MouseEvent<HTMLElement>) => void
  closeOnClick: boolean
  preload?: () => void
  /** Пункт-раздел: шеврон и `hint`, `aria-haspopup`. */
  section?: boolean
  /** Флажок меню: пункт с `active`, не закрывающий меню. */
  checkbox?: boolean
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
}

const ActionMenuItem = ({
  action,
  item,
  context,
  availability,
  entry,
  onClick,
  closeOnClick,
  preload,
  section = false,
  checkbox = false,
  onKeyDown,
}: ItemProps) => {
  const labels = useLocalization()
  const {
    actionFailed: FailedIcon,
    actionBlocked: BlockedIcon,
    submenu: SubmenuIcon,
  } = useIcons()
  const hint = section ? action.hint?.(context, labels) : undefined
  const descriptionId = useId()

  const running = !!entry?.pending
  const pending = running || availability.checking
  const failed = !!entry?.failed && !running
  const checkFailed = availability.checkFailed && !pending
  const block = pending ? undefined : availability.block
  // Замок без текста ничего не объясняет — запрет без причины только гасит пункт.
  const locked = block?.kind === 'forbidden' && !!block.reason
  // Одиночный пункт: доступность — итог сессии; разворот `menuItems` — свои признаки.
  const disabled =
    (action.menuItems ? !!item.disabled : availability.disabled) || running
  const errorText = failed
    ? actionErrorText(action, context, entry.error, labels)
    : checkFailed
      ? checkErrorText(action, context, availability.checkError, labels)
      : undefined
  // Полный текст отказа или причины — в тултипе: строка меню не меняет высоту.
  const tooltip = errorText ?? block?.reason
  const description = running
    ? labels.actionRunning
    : availability.checking
      ? labels.availabilityChecking
      : tooltip

  const node = (
    <Menu.Item
      className={styles.item}
      data-has-tooltip={tooltip ? '' : undefined}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      label={item.label}
      closeOnClick={closeOnClick}
      onClick={onClick}
      onPointerEnter={preload}
      onFocus={preload}
      onKeyDown={onKeyDown}
      aria-haspopup={section ? 'menu' : undefined}
      // Только у флажка: `role={undefined}` перебил бы роль menuitem от Base UI.
      {...(checkbox && {
        role: 'menuitemcheckbox',
        'aria-checked': !!item.active,
      })}
      data-action-id={action.id}
    >
      <span className={styles.itemIcon} aria-hidden>
        {item.icon}
      </span>
      <span className={styles.itemLabel}>{item.label}</span>
      {hint && (
        <span className={styles.itemHint} aria-hidden>
          {hint}
        </span>
      )}
      <span
        className={clsx(
          styles.itemCheck,
          (failed || checkFailed) && styles.itemFailed,
          locked && styles.itemBlocked,
        )}
        aria-hidden
        data-action-failed={failed || undefined}
        data-check-failed={checkFailed || undefined}
        data-action-done={block?.kind === 'done' || undefined}
        data-action-blocked={locked || undefined}
      >
        {pending ? (
          <span className={styles.itemSpinner} data-item-spinner="" />
        ) : failed || checkFailed ? (
          <FailedIcon width={14} height={14} />
        ) : locked ? (
          <BlockedIcon width={14} height={14} />
        ) : section ? (
          <SubmenuIcon width={14} height={14} />
        ) : (
          (block?.kind === 'done' || item.active) && (
            <Check width={14} height={14} />
          )
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

const IDLE: Availability = {
  disabled: false,
  checking: false,
  checkFailed: false,
}

export const ActionMenuItems = ({
  actions,
  context,
  session,
  close,
  onOpenPanel,
  sections,
  closeOnSelect: sectionCloses,
}: ActionMenuItemsProps) => {
  const labels = useLocalization()
  // Состояние пунктов часто живёт у приложения: после выбора без закрытия меню
  // перерисовывает пункты само.
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  const status = useActionStatus(
    (context as { table: unknown }).table,
    (value: ActionStatus) => value,
  )

  return menuGroups(actions, context, labels).map(
    ({ action, items, groupLabel, divided }) => {
      const slotAction = action as SlotAction
      const withPanel = !!slotAction.panel && !!onOpenPanel
      const section = !!action.submenu && !!sections && !action.menuItems
      const preload = section
        ? () => sections!.preload(action)
        : slotAction.preload
          ? () => preloadActionPanel(slotAction, context)
          : undefined
      // Разворот `menuItems` несёт свои признаки пунктов — синхронные по контракту.
      const availability = action.menuItems
        ? IDLE
        : resolveAvailability(action, context, session?.checks)
      const entry = action.menuItems
        ? undefined
        : status[actionStatusKey(action, context)]
      const keepOpen =
        !section &&
        !withPanel &&
        (action.closeOnSelect ?? sectionCloses ?? true) === false
      const select = section
        ? (event?: MouseEvent<HTMLElement>) =>
            sections!.enter(action, sourceOf(event))
        : withPanel
          ? () => onOpenPanel!(slotAction)
          : keepOpen
            ? (event?: MouseEvent<HTMLElement>) => {
                runMenuAction(action, context, event as never)
                refresh()
              }
            : (event?: MouseEvent<HTMLElement>) =>
                runMenuAction(action, context, event as never)
      const onKeyDown = sections
        ? (event: KeyboardEvent<HTMLElement>) => {
            if (event.key === 'ArrowRight' && section) {
              event.preventDefault()
              sections.enter(action, 'keyboard')
            } else if (event.key === 'ArrowLeft' && sections.back('keyboard')) {
              event.preventDefault()
            }
          }
        : undefined
      // Проверка не удалась: нажатие проверяет заново и при «можно» выполняет действие.
      const recheck = () =>
        session?.recheck(action, context, check => {
          if (check.status !== 'done' || blockOf(check.result)) return
          select()
          if (!withPanel && !section) close?.()
        })

      return (
        <Menu.Group
          key={action.id}
          className={clsx(styles.group, divided && styles.divided)}
        >
          {groupLabel && (
            <Menu.GroupLabel className={styles.groupLabel}>
              {groupLabel}
            </Menu.GroupLabel>
          )}
          {items.map(item => (
            <ActionMenuItem
              key={item.id}
              action={action}
              item={item}
              context={context}
              availability={availability}
              entry={entry}
              closeOnClick={
                !withPanel && !section && !keepOpen && !availability.checkFailed
              }
              checkbox={keepOpen && !!action.active}
              preload={preload}
              section={section}
              onKeyDown={onKeyDown}
              onClick={
                action.menuItems
                  ? (event: MouseEvent<HTMLElement>) => {
                      // Подпункт разворота (`menuItems`) — действие владельца с id пункта.
                      reportAction((context as { table?: unknown }).table, {
                        plugin: actionOwnerOf(action),
                        action: `${action.id}:${item.id}`,
                        detail: () => actionDetailOf(context),
                        source: sourceOf(event),
                      })
                      item.onSelect()
                    }
                  : availability.checkFailed
                    ? recheck
                    : select
              }
            />
          ))}
        </Menu.Group>
      )
    },
  )
}
