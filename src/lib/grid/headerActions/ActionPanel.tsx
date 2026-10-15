// ActionPanel: инлайн-подача действия с панелью (`SlotAction.panel`) — иконка-кнопка
// открывает поповер с содержимым панели. Пока поповер открыт, кнопка видима.
import { useId, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import type { SlotAction } from '../../core/headerActions'
import { actionDot, ErrorDot } from './ActiveDot'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useClosingVisible } from './useClosingVisible'
import { type PanelButtonState, panelButtonProps } from './usePanelOpening'
import { useStateWhileOpen } from './useStateWhileOpen'
import { useMergedFlash } from './useKebabState'
import {
  pendingAttributes,
  serverActionReason,
  useServerActionMarks,
} from '../../core/serverActions'

import buttonStyles from '../../grid/headerActions/ActionButton.module.css'
import gridStyles from '../../grid/DataGrid/DataGrid.module.css'
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
  useStateWhileOpen(context.table, visible)
  // Серверное действие из панели (фильтр колонки, ADR 0116, §3): свет и вспышка отказа.
  const server = useServerActionMarks(
    context.table,
    cause =>
      cause.control === action.id &&
      !cause.menu &&
      !!cause.columns?.includes(context.column?.id),
  )
  const errorFlash = useMergedFlash(loading?.errorFlash, server.flash)
  // Отказ остаётся отметкой, пока его не снимет успех или закрытие плашки; в ожидании —
  // свет, а не отметка (ADR 0116, SA18, SA20).
  const failure = server.pending ? undefined : server.failure
  const reasonId = useId()

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
          active={active}
          label={label}
          aria-label={ariaLabel}
          {...panelButtonProps(loading)}
          errorFlash={errorFlash}
          {...pendingAttributes(server.pending)}
          aria-describedby={failure ? reasonId : undefined}
        >
          {action.icon(context)}
          {actionDot(!!action.active, active && !failure, !!adornment)}
          <ErrorDot shown={!!failure} delayed />
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
        data-button-active={
          active || visible || !!loading?.pending || server.pending
        }
      >
        {adornment ? (
          <span className={buttonStyles.anchor}>
            {button}
            {adornment}
          </span>
        ) : (
          button
        )}
        {failure && (
          <span id={reasonId} className={gridStyles['visually-hidden']}>
            {serverActionReason(failure, labels)}
          </span>
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
