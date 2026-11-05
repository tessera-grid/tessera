/**
 * ActionButton: инлайн-подача действия слота (иконка-кнопка с тултипом). Ожидание и отказ
 * действия кнопка не показывает — они на объекте действия (ADR 0177, §1); пока действие ждёт,
 * кнопка видна без наведения, повторное нажатие не принимается. Реактивность даёт родительская
 * ActionsZone (подписка на состояние).
 */
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { logWarn } from '../../util/logger'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import {
  actionStatusKey,
  readSyncDisabled,
  useActionStatus,
  runMenuAction,
  type ActionStatus,
  type SlotAction,
} from '../../core/headerActions'

import '../../ui/cellControls/buttonVisibility.css'
import { actionLook } from './actionLook'

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
  const { active, draft, shown, label, ariaLabel } = actionLook(
    action,
    context,
    labels,
  )

  const button = (
    <IconButton
      className={action.className?.(context)}
      active={active}
      draft={draft}
      count={action.count?.(context)}
      onClick={event =>
        runMenuAction(action, context, event, { keepError: false })
      }
      disabled={disabled}
      aria-disabled={disabled}
      label={label}
      aria-label={ariaLabel}
      data-action-id={action.id}
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
      data-button-active={shown || !!entry?.pending}
    >
      <HiddenButtonContext.Provider value={!(shown || !!entry?.pending)}>
        {button}
      </HiddenButtonContext.Provider>
    </div>
  )
}

ActionButton.displayName = 'ActionButton'
