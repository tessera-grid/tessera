// ActionPanel: инлайн-подача действия с панелью (`SlotAction.panel`) — иконка-кнопка
// открывает поповер с содержимым панели. Пока поповер открыт, кнопка видима.
import { useId, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import type { SlotAction } from '../../core/headerActions'
import { ErrorDot } from './ErrorDot'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useClosingVisible } from './useClosingVisible'
import { type PanelButtonState, panelButtonProps } from './usePanelOpening'
import { useStateWhileOpen } from './useStateWhileOpen'
import {
  pendingAttributes,
  serverActionReason,
  useServerActionMarks,
} from '../../core/serverActions'

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
  // Серверное действие из панели (фильтр колонки, ADR 0116, §3): свет и отметка отказа.
  const server = useServerActionMarks(
    context.table,
    cause =>
      cause.control === action.id &&
      !cause.menu &&
      !!cause.columns?.includes(context.column?.id),
  )
  // Отказ остаётся отметкой, пока его не снимет успех или закрытие плашки; в ожидании —
  // свет, а не отметка (ADR 0116, SA18, SA20).
  const failure = server.pending ? undefined : server.failure
  const reasonId = useId()

  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const active = action.active?.(context)

  const button = (
    <Popover.Trigger
      render={
        <IconButton
          ref={triggerRef}
          className={action.className?.(context)}
          active={active}
          count={action.count?.(context)}
          indicator={!failure}
          label={label}
          aria-label={ariaLabel}
          {...panelButtonProps(loading)}
          {...pendingAttributes(server.pending)}
          aria-describedby={failure ? reasonId : undefined}
        >
          {action.icon(context)}
          <ErrorDot shown={!!failure} />
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
        {button}
        {failure && (
          <span id={reasonId} className={gridStyles['visually-hidden']}>
            {serverActionReason(failure, labels)}
          </span>
        )}
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
