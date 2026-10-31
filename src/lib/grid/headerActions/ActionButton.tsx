/**
 * ActionButton: инлайн-подача действия слота (иконка-кнопка с тултипом).
 * Реактивность даёт родительская ActionsZone (подписка на состояние).
 */
import clsx from 'clsx'

import { cancelSourceOf } from '../../core/cancellation'
import { useLocalization } from '../../core/localization'
import { logWarn } from '../../util/logger'
import { useActionStatus } from '../../core/headerActions'
import {
  pendingAttributes,
  serverActionReason,
  serverCancelProps,
  useServerActionMarks,
} from '../../core/serverActions'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import {
  actionErrorText,
  actionStatusKey,
  cancelMenuAction,
  readSyncDisabled,
  runMenuAction,
  type ActionStatus,
  type SlotAction,
} from '../../core/headerActions'

import '../../ui/cellControls/buttonVisibility.css'

interface ActionButtonProps {
  action: SlotAction
  context: any
  variant?: 'cell' | 'row'
}

// НЕ memo: реактивность даёт родительская ActionsZone (подписка на состояние).
// Дескрипторы читают ЖИВЫЕ методы колонки/строки (getIsSorted и т.п.) через
// `context`, чья ссылка может не меняться — memo по context заморозил бы иконку.
export const ActionButton = ({
  action,
  context,
  variant = 'cell',
}: ActionButtonProps) => {
  const labels = useLocalization()
  const entry = useActionStatus(
    context.table,
    (status: ActionStatus) => status[actionStatusKey(action, context)],
  )
  // Серверное действие, начатое этой кнопкой (ADR 0116, §3): свет и отметка отказа.
  const server = useServerActionMarks(
    context.table,
    cause =>
      cause.control === action.id &&
      !cause.menu &&
      !!cause.columns?.includes(context.column?.id),
  )
  // Отметка отказа (ADR 0136): своего действия или серверного; снимают повтор и успех.
  const failure =
    entry?.failed && !entry.pending
      ? labels.actionFailedRetry(
          actionErrorText(action, context, entry.error, labels),
        )
      : server.failure && !server.pending
        ? labels.actionFailedRetry(serverActionReason(server.failure, labels))
        : undefined

  if (action.visible?.(context) === false) {
    return null
  }

  const syncDisabled = readSyncDisabled(action, context)
  if (syncDisabled === 'async') {
    logWarn(
      context.table,
      `Действие «${action.id}»: асинхронный disabled поддержан только в меню — инлайн-кнопка заблокирована (ADR 0078).`,
      `async-disabled-inline:${action.id}`,
    )
  }
  const disabled = syncDisabled !== false
  const active = action.active?.(context)
  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label

  const button = (
    <IconButton
      className={action.className?.(context)}
      active={active}
      count={action.count?.(context)}
      onClick={event =>
        runMenuAction(action, context, event, { keepError: false })
      }
      pending={entry?.pending}
      {...serverCancelProps(context.table, server.pending, () =>
        labels.cancelAction(label),
      )}
      {...(entry?.pending && {
        onCancel: event =>
          cancelMenuAction(action, context, cancelSourceOf(event)),
        cancelLabel: labels.cancelAction(label),
      })}
      failure={failure}
      {...pendingAttributes(server.pending)}
      disabled={disabled}
      aria-disabled={disabled}
      label={label}
      aria-label={ariaLabel}
    >
      {action.icon(context)}
    </IconButton>
  )

  const wrapperClassName =
    variant === 'row'
      ? clsx('row__button', 'row__button--hidden')
      : clsx('cell__button', 'cell__button--hidden')

  return (
    <div
      className={wrapperClassName}
      data-button-active={active || !!entry?.pending || server.pending}
    >
      <HiddenButtonContext.Provider
        value={!(active || !!entry?.pending || server.pending)}
      >
        {button}
      </HiddenButtonContext.Provider>
    </div>
  )
}

ActionButton.displayName = 'ActionButton'
