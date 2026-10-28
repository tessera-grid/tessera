// ActionInlineMenu: инлайн-действие как мини-меню (поповер) — сама иконка-кнопка
// служит триггером, раскрывая menuItems тем же телом, что и кебаб. Применяется при
// неоднозначном инлайн-клике (закрепление при обеих сторонах, inlineAsMenu).
import { useEffect } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'
import { useLatest } from '../../core/useLatest'
import { useCloseOnGridScroll } from './useCloseOnGridScroll'
import { useClosingVisible } from './useClosingVisible'
import { GRID_SCROLL_REASON, useMenuLeave } from './useMenuLeave'
import { useAvailabilityChecks } from './useAvailabilityChecks'
import { useMenuSections } from './useMenuSections'
import { useStateWhileOpen } from './useStateWhileOpen'

import '../../grid/cellControls/buttonVisibility.css'

export interface ActionInlineMenuProps {
  action: SlotAction
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ActionInlineMenu = ({
  action,
  context,
  variant = 'cell',
  open,
  onOpenChange,
}: ActionInlineMenuProps) => {
  const labels = useLocalization()
  const [visible, onOpenChangeComplete] = useClosingVisible(open)
  useStateWhileOpen(context.table, visible)
  // Действие с разделом: мини-меню открывается сразу в нём (ADR 0079).
  const section = action.submenu ? action : undefined
  const checks = useAvailabilityChecks()
  const { extend } = checks
  const sections = useMenuSections([action], context, labels, section, items =>
    extend(items, context),
  )
  // Открытие (и первое — через ленивую заглушку): сессия проверок и загрузка раздела.
  const opened = useLatest(() => {
    if (!section) return
    checks.start([], context)
    sections.prime()
  })
  useEffect(() => {
    if (open) opened.current()
  }, [open, opened])

  const leave = useMenuLeave()
  const onMenuOpenChange = (next: boolean, details?: { reason?: string }) => {
    leave.track(next, details?.reason)
    if (!next && details?.reason === 'escape-key' && sections.back()) return
    if (!next) {
      checks.stop()
      sections.abort()
    }
    onOpenChange(next)
  }

  useCloseOnGridScroll(open, () =>
    onMenuOpenChange(false, { reason: GRID_SCROLL_REASON }),
  )

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context)

  const button = (
    <Menu.Trigger
      render={
        <IconButton
          className={action.className?.(context)}
          active={active}
          count={action.count?.(context)}
          label={label}
          aria-label={ariaLabel}
        >
          {action.icon(context)}
        </IconButton>
      }
    />
  )

  const hiddenClass =
    variant === 'row' ? 'row__button--hidden' : 'cell__button--hidden'
  const wrapperBase = variant === 'row' ? 'row__button' : 'cell__button'

  return (
    <Menu.Root
      modal={false}
      open={open}
      onOpenChange={onMenuOpenChange}
      onOpenChangeComplete={next => {
        onOpenChangeComplete(next)
        if (!next) sections.reset()
      }}
    >
      {/* Попап — внутри обёртки: служебные узлы портала не встают между кнопками ряда. */}
      <div
        className={clsx(wrapperBase, !visible && hiddenClass)}
        data-button-active={active}
      >
        <HiddenButtonContext.Provider value={!visible && !active}>
          {button}
        </HiddenButtonContext.Provider>
        {section ? (
          <ActionMenuPopup
            actions={[action]}
            context={context}
            session={checks}
            sections={sections}
            close={() => onMenuOpenChange(false)}
            finalFocus={leave.returnFocus}
            popupRef={leave.popupRef}
          />
        ) : (
          <ActionMenuPopup
            actions={[action]}
            context={context}
            finalFocus={leave.returnFocus}
            popupRef={leave.popupRef}
          />
        )}
      </div>
    </Menu.Root>
  )
}

ActionInlineMenu.displayName = 'ActionInlineMenu'
