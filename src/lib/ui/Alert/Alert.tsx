/**
 * Плашка (ADR 0096, §9): иконка, заголовок, описание одной строкой, действие и кнопка
 * закрытия. Появляется и уходит плавно; уходя, держит последний вид и не
 * откликается на указатель. Положение задаёт потребитель (`className`), ширину
 * ограничивает и `--tsr-alert-cap`. Тоны успеха и нейтральный, самостоятельный уход — ADR 0227, §8.
 */
import {
  type FocusEvent,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react'

import clsx from 'clsx'

import { useLatest } from '../../util/useLatest'
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
  /**
   * Тон: успех — иконка (по умолчанию `alertSuccess`) цветом успеха; нейтральный — иконка
   * (по умолчанию `alertNeutral`) приглушённым цветом. Без тона иконка — цветом ошибки.
   */
  tone?: 'success' | 'neutral'
  /** Через столько мс видимая плашка зовёт `onHide`; под указателем и с фокусом внутри отсчёт стоит. */
  hideAfter?: number
  onHide?: () => void
}

export const Alert = ({
  shown,
  icon: liveIcon,
  title: liveTitle,
  description: liveDescription,
  action: liveAction,
  dismiss,
  tone: liveTone,
  hideAfter,
  onHide,
  className,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}: AlertProps) => {
  const {
    clear: DismissIcon,
    alertSuccess: SuccessIcon,
    alertNeutral: NeutralIcon,
  } = useIcons()
  const { mounted, leaving, ref } = usePresence<HTMLDivElement>(shown)
  const titleId = useId()
  const [pointerInside, setPointerInside] = useState(false)
  const [focusInside, setFocusInside] = useState(false)
  const onHideRef = useLatest(onHide)
  const counting =
    shown && hideAfter !== undefined && !pointerInside && !focusInside
  // Уход указателя или фокуса запускает отсчёт заново, с полного срока.
  useEffect(() => {
    if (!counting) {
      return
    }
    const timer = setTimeout(() => onHideRef.current?.(), hideAfter)
    return () => clearTimeout(timer)
  }, [counting, hideAfter, onHideRef])
  // Уходя, плашка держит последний вид: причину и кнопку снимает тот, кто её закрыл, а
  // без них она сжалась бы к центру, и текст поехал бы (LE24).
  // Тон и иконка — тоже: снятый тон подставил бы иконку отказа на время ухода.
  const [held, setHeld] = useState({
    title: liveTitle,
    description: liveDescription,
    action: liveAction,
    tone: liveTone,
    icon: liveIcon,
  })
  if (
    shown &&
    (held.title !== liveTitle ||
      held.description !== liveDescription ||
      !held.action !== !liveAction ||
      held.tone !== liveTone ||
      !held.icon !== !liveIcon)
  ) {
    setHeld({
      title: liveTitle,
      description: liveDescription,
      action: liveAction,
      tone: liveTone,
      icon: liveIcon,
    })
  }
  const title = shown ? liveTitle : held.title
  const description = shown ? liveDescription : held.description
  const action = shown ? liveAction : held.action
  const tone = shown ? liveTone : held.tone
  const icon = shown ? liveIcon : held.icon
  const shownIcon =
    icon ??
    (tone === 'success' ? (
      <SuccessIcon data-icon="alertSuccess" width={16} height={16} />
    ) : tone === 'neutral' ? (
      <NeutralIcon data-icon="alertNeutral" width={16} height={16} />
    ) : undefined)
  if (!mounted) {
    // Ушедшая плашка не держит указатель и фокус до следующего показа.
    if (pointerInside || focusInside) {
      setPointerInside(false)
      setFocusInside(false)
    }
    return null
  }
  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={titleId}
      className={clsx(styles.alert, className)}
      data-leaving={leaving || undefined}
      data-tone={tone}
      onPointerEnter={(event: PointerEvent<HTMLDivElement>) => {
        setPointerInside(true)
        onPointerEnter?.(event)
      }}
      onPointerLeave={(event: PointerEvent<HTMLDivElement>) => {
        setPointerInside(false)
        onPointerLeave?.(event)
      }}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        setFocusInside(true)
        onFocus?.(event)
      }}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusInside(false)
        }
        onBlur?.(event)
      }}
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
      {shownIcon && (
        <span className={styles.icon} aria-hidden="true">
          {shownIcon}
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
