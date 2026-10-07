// ActionPanel: инлайн-подача действия с панелью (`SlotAction.panel`) — иконка-кнопка
// открывает поповер с содержимым панели. Пока поповер открыт, кнопка видима.
import { useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import type { SlotAction } from '../../core/headerActions'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useClosingVisible } from './useClosingVisible'
import { type PanelButtonState, panelButtonProps } from './usePanelOpening'

import buttonStyles from '../../grid/headerActions/ActionButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

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

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context) ?? false
  const adornment = action.adornment?.(context)

  const button = (
    <Popover.Trigger
      render={
        <IconButton
          ref={triggerRef}
          className={action.className?.(context)}
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
        data-button-active={active || visible || !!loading?.pending}
      >
        {adornment ? (
          <span className={buttonStyles.anchor}>
            {button}
            {adornment}
          </span>
        ) : (
          button
        )}
      </div>
      <ActionPanelPopup
        action={action}
        context={context}
        anchorRef={triggerRef}
        close={() => onOpenChange(false)}
      />
    </Popover.Root>
  )
}

ActionPanel.displayName = 'ActionPanel'
