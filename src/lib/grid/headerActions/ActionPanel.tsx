// ActionPanel: инлайн-подача действия с панелью (`SlotAction.panel`) — иконка-кнопка
// открывает поповер с содержимым панели. Пока поповер открыт, кнопка видима. Ожидание и
// отказ запроса из панели (фильтр колонки) — под шапкой таблицы, а не на кнопке (ADR 0177, §1).
import { useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import { type SlotAction, toneOf } from '../../core/headerActions'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useClosingVisible } from './useClosingVisible'
import { type PanelButtonState, panelButtonProps } from './usePanelOpening'
import { useStateWhileOpen } from './useStateWhileOpen'

import '../../ui/cellControls/buttonVisibility.css'
import { actionLook } from './actionLook'

export interface ActionPanelProps {
  action: SlotAction
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Загрузка содержимого панели перед открытием (`SlotAction.preload`). */
  loading?: PanelButtonState
}

export const ActionPanel = ({
  action,
  context,
  variant = 'cell',
  open,
  onOpenChange,
  loading,
}: ActionPanelProps) => {
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [visible, onOpenChangeComplete] = useClosingVisible(open)
  useStateWhileOpen(context.table, visible)

  const { active, draft, shown, label, ariaLabel } = actionLook(
    action,
    context,
    labels,
  )

  const button = (
    <Popover.Trigger
      render={
        <IconButton
          ref={triggerRef}
          className={action.className?.(context)}
          active={active}
          draft={draft}
          tone={toneOf(action, context)}
          count={action.count?.(context)}
          label={label}
          aria-label={ariaLabel}
          {...panelButtonProps(loading)}
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
    <Popover.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <div
        className={clsx(wrapperBase, hiddenClass)}
        data-button-active={shown || visible || !!loading?.pending}
      >
        <HiddenButtonContext.Provider
          value={!(shown || visible || !!loading?.pending)}
        >
          {button}
        </HiddenButtonContext.Provider>
        {/* Попап — внутри обёртки: служебные узлы портала не встают между кнопками ряда. */}
        <ActionPanelPopup
          action={action}
          context={context}
          anchorRef={triggerRef}
          close={() => onOpenChange(false)}
        />
      </div>
    </Popover.Root>
  )
}

ActionPanel.displayName = 'ActionPanel'
