// Модель пунктов меню действий — общая для кебаба, мини-меню и контекстного меню (ADR 0078,
// ADR 0079): подгруппы действий, доступность, ожидание, причина блокировки и отказ. Пункты
// рисует вид кита `ui/Popup/MenuItems`.
import { type KeyboardEvent, type MouseEvent, useReducer } from 'react'

import { actionDetailOf, actionOwnerOf } from '../actionOwners'
import { cancelSourceOf } from '../cancellation'
import { type DebugActionSource, reportAction, sourceOf } from '../debugActions'
import { useLocalization } from '../localization'
import { keyboardShortcut } from '../keyboardShortcut'
import {
  type Availability,
  type AvailabilityCheck,
  type AvailabilityChecks,
  actionErrorText,
  actionStatusKey,
  blockOf,
  cancelMenuAction,
  checkErrorText,
  resolveAvailability,
  runMenuAction,
} from './actionStatus'
import type { ActionStatus } from './actionStatusFeature'
import { menuGroups, preloadActionPanel } from './index'
import { toneOf } from './tone'
import type { MenuAction, SlotAction } from './types'
import { useActionStatus } from './useActionStatus'
import type { MenuGroupModel } from '../../util/menuModel'

export interface MenuItemGroupsOptions {
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
  sections?: {
    enter: (owner: MenuAction, source?: DebugActionSource) => void
    back: (source?: DebugActionSource) => boolean
    preload: (owner: MenuAction) => void
  }
  /** Умолчание раздела: `false` — выбор не закрывает меню (ADR 0079). */
  closeOnSelect?: boolean
}

const IDLE: Availability = {
  disabled: false,
  checking: false,
  checkFailed: false,
}

export const useMenuItemGroups = ({
  actions,
  context,
  session,
  close,
  onOpenPanel,
  sections,
  closeOnSelect: sectionCloses,
}: MenuItemGroupsOptions): MenuGroupModel[] => {
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

      const running = !!entry?.pending
      const pending = running || availability.checking
      const failed = !!entry?.failed && !running
      const checkFailed = availability.checkFailed && !pending
      const block = pending ? undefined : availability.block
      // Замок без текста ничего не объясняет — запрет без причины только гасит пункт.
      const locked = block?.kind === 'forbidden' && !!block.reason
      const errorText = failed
        ? actionErrorText(action, context, entry.error, labels)
        : checkFailed
          ? checkErrorText(action, context, availability.checkError, labels)
          : undefined
      const tooltip = errorText ?? block?.reason
      const description = running
        ? labels.actionRunning
        : availability.checking
          ? labels.availabilityChecking
          : tooltip
      // У раздела подсказка — значение перед шевроном, у пункта — вторая строка (ADR 0204, HT5).
      const hint = section ? action.hint?.(context, labels) : undefined
      const caption = section ? undefined : action.hint?.(context, labels)
      const shortcut = action.shortcut
        ? keyboardShortcut(
            (context as { table?: unknown }).table,
            labels,
            action.shortcut,
          )
        : undefined

      return {
        key: action.id,
        label: groupLabel,
        divided,
        items: items.map(item => ({
          key: item.id,
          actionId: action.id,
          itemId: item.id,
          icon: item.icon,
          // Одиночный пункт: доступность — итог сессии; разворот `menuItems` — свои
          // признаки. Ждущий пункт доступен: его выбор отменяет действие (ADR 0153, §3).
          label: running ? labels.cancelAction(item.label) : item.label,
          section,
          hint,
          shortcut,
          caption,
          tone: toneOf(action, context),
          checkbox: keepOpen && !!action.active,
          active: !!item.active,
          disabled:
            !running &&
            (action.menuItems ? !!item.disabled : availability.disabled),
          pending,
          failed,
          checkFailed,
          done: block?.kind === 'done',
          locked,
          closeOnClick:
            !withPanel && !section && !keepOpen && !availability.checkFailed,
          tooltip,
          description,
          preload,
          onKeyDown,
          onClick: entry?.pending
            ? (event: MouseEvent<HTMLElement>) =>
                cancelMenuAction(action, context, cancelSourceOf(event))
            : action.menuItems
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
                : select,
        })),
      }
    },
  )
}
