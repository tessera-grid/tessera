/**
 * ActionButton: инлайн-подача действия слота (иконка-кнопка с тултипом).
 * Реактивность даёт родительская ActionsZone (подписка на состояние).
 */
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { logWarn } from '../../core/logger'
import { useActionStatus } from './useActionStatus'
import { useMergedFlash } from './useKebabState'
import {
  pendingAttributes,
  useServerActionMarks,
} from '../../core/serverActions'
import { IconButton } from '../../ui/IconButton'
import {
  actionStatusKey,
  readSyncDisabled,
  runMenuAction,
  type ActionStatus,
  type SlotAction,
} from '../../core/headerActions'
import { actionDot } from './ActiveDot'

import styles from '../../grid/headerActions/ActionButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

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
  // Серверное действие, начатое этой кнопкой (ADR 0116, §3): свет и вспышка отказа.
  const server = useServerActionMarks(
    context.table,
    cause =>
      cause.control === action.id &&
      !cause.menu &&
      !!cause.columns?.includes(context.column?.id),
  )
  const errorFlash = useMergedFlash(entry?.flash, server.flash)

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
  const active = action.active?.(context) ?? false
  const label = action.label(context, labels)
  const ariaLabel = action.ariaLabel?.(context, labels) ?? label
  const adornment = action.adornment?.(context)

  const button = (
    <IconButton
      className={action.className?.(context)}
      active={active}
      onClick={event =>
        runMenuAction(action, context, event, { keepError: false })
      }
      pending={entry?.pending}
      errorFlash={errorFlash}
      {...pendingAttributes(server.pending)}
      disabled={disabled}
      aria-disabled={disabled}
      label={label}
      aria-label={ariaLabel}
    >
      {action.icon(context)}
      {actionDot(!!action.active, active, !!adornment)}
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
      {adornment ? (
        <span className={styles.anchor}>
          {button}
          {adornment}
        </span>
      ) : (
        button
      )}
    </div>
  )
}

ActionButton.displayName = 'ActionButton'
