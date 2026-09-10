import { memo } from 'react'

import clsx from 'clsx'

import { SlotAction } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'

import styles from './ActionButton.module.css'
import '../cellControls/buttonVisibility.css'

interface ActionButtonProps {
  action: SlotAction
  /** Контекст слота (заголовок/ячейка) — прозрачно передаётся в признаки действия. */
  context: any
  /**
   * Контракт видимости обёртки: `cell` (ревил по hover ячейки, заголовки/ячейки)
   * или `row` (ревил по hover строки, действия строки). По умолчанию `cell`.
   */
  variant?: 'cell' | 'row'
}

/**
 * Инлайн-подача действия слота: иконка-кнопка с тултипом. Читает признаки
 * дескриптора (иконка/подпись/блокировка/состояние) и подписывается на его ключи
 * Pub-Sub, поэтому перерисовывается гранулярно при смене релевантного состояния.
 * Контекст-агностична (заголовок или строка/ячейка).
 */
export const ActionButton = memo(
  ({ action, context, variant = 'cell' }: ActionButtonProps) => {
    const labels = useLocalization()

    useSubscribeStore(() => action.subscribe?.(context) ?? [])

    if (action.visible?.(context) === false) {
      return null
    }

    const disabled = action.disabled?.(context) ?? false
    const active = action.active?.(context) ?? false
    const label = action.label(context, labels)
    const ariaLabel = action.ariaLabel?.(context, labels) ?? label
    const adornment = action.adornment?.(context)

    const button = (
      <IconButton
        className={action.className?.(context)}
        onClick={event => action.onSelect(context, event)}
        disabled={disabled}
        aria-disabled={disabled}
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
      <Tooltip title={label} disabled={disabled}>
        <div className={wrapperClassName} data-button-active={active}>
          {adornment ? (
            <span className={styles.anchor}>
              {button}
              {adornment}
            </span>
          ) : (
            button
          )}
        </div>
      </Tooltip>
    )
  },
)

ActionButton.displayName = 'ActionButton'
