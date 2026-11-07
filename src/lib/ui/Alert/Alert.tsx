/**
 * Плашка (ADR 0096, §9): иконка, заголовок, описание одной строкой, действие и кнопка
 * закрытия. Появляется и уходит плавно; уходя, держит последний вид и не
 * откликается на указатель. Положение задаёт потребитель (`className`), ширину
 * ограничивает и `--tsr-alert-cap`.
 */
import { type HTMLAttributes, type ReactNode, useId, useState } from 'react'

import clsx from 'clsx'

import { IconButton } from '../IconButton'
import { useIcons } from '../icons'
import { Tooltip } from '../Tooltip'
import { usePresence } from '../usePresence'

import styles from './Alert.module.css'

export interface AlertProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'children'
> {
  /** Плашка видна; уход — плавный. */
  shown: boolean
  icon?: ReactNode
  title: string
  /** Подробности одной строкой; длинные — `…` и полный текст в тултипе. */
  description?: string
  /** Действие — кнопка кита. */
  action?: ReactNode
  /** Закрытие: квадратная кнопка-крестик с подписью; без него кнопки нет. */
  dismiss?: { label: string; onClick: () => void }
}

export const Alert = ({
  shown,
  icon,
  title: liveTitle,
  description: liveDescription,
  action: liveAction,
  dismiss,
  className,
  ...rest
}: AlertProps) => {
  const { clear: DismissIcon } = useIcons()
  const { mounted, leaving, ref } = usePresence<HTMLDivElement>(shown)
  const titleId = useId()
  // Уходя, плашка держит последний вид: причину и кнопку снимает тот, кто её закрыл, а
  // без них она сжалась бы к центру, и текст поехал бы (LE24).
  const [held, setHeld] = useState({
    title: liveTitle,
    description: liveDescription,
    action: liveAction,
  })
  if (
    shown &&
    (held.title !== liveTitle ||
      held.description !== liveDescription ||
      !held.action !== !liveAction)
  ) {
    setHeld({
      title: liveTitle,
      description: liveDescription,
      action: liveAction,
    })
  }
  const title = shown ? liveTitle : held.title
  const description = shown ? liveDescription : held.description
  const action = shown ? liveAction : held.action
  if (!mounted) {
    return null
  }
  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={titleId}
      className={clsx(styles.alert, className)}
      data-leaving={leaving || undefined}
      // Кнопка последнего вида уже ничего не значит: Enter на ней не повторяет действие.
      onClickCapture={
        leaving
          ? event => {
              event.preventDefault()
              event.stopPropagation()
            }
          : undefined
      }
      {...rest}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <div className={styles.text}>
        <span id={titleId} className={styles.title}>
          {title}
        </span>
        {description && (
          <Tooltip title={description} overflowOnly>
            <span className={styles.description} data-alert-description="">
              {description}
            </span>
          </Tooltip>
        )}
      </div>
      {action}
      {dismiss && (
        <IconButton
          label={dismiss.label}
          shape="square"
          className={styles.dismiss}
          onClick={dismiss.onClick}
          data-alert-dismiss=""
        >
          <DismissIcon width={16} height={16} />
        </IconButton>
      )}
    </div>
  )
}
