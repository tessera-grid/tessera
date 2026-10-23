/**
 * Заглушка пустой таблицы по записи реестра (ADR 0123): тексты — из `localization`,
 * иллюстрация и иконка действия — из `icons`; своя заглушка приложения из пропа
 * `stubs` заменяет вид, получая действие записи и ошибку загрузки.
 */
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { useLocalization } from '../../core/localization'
import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'
import { useLatest } from '../../core/useLatest'
import type { StubContext, StubEntry, StubRender } from '../../core/stubs'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { Stub } from '../../ui/Stub'

interface EmptyStubProps {
  entry: StubEntry
  context: StubContext
  render?: StubRender
  className?: string
}

/**
 * Место заглушки под шапкой — видимая область без шапки и футера: заглушка в теле
 * занимает его, и иллюстрация `Stub` прячется, когда в нём не умещается.
 */
const useBodyRoom = (enabled: boolean) => {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<number>()
  useIsomorphicLayoutEffect(() => {
    const scroller = enabled
      ? ref.current?.closest<HTMLElement>('.data-grid__container')
      : null
    if (!scroller) return
    const head = scroller.querySelector<HTMLElement>('.data-grid__head')
    const footer = scroller.querySelector<HTMLElement>('.data-grid__footer')
    // До отрисовки кадра: иначе мелькнула бы заглушка выше своего места.
    const observer = new ResizeObserver(() => {
      const next =
        scroller.clientHeight -
        (head?.offsetHeight ?? 0) -
        (footer?.offsetHeight ?? 0)
      flushSync(() => setRoom(next))
    })
    for (const node of [scroller, head, footer])
      if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])
  return [ref, room] as const
}

export const EmptyStub = ({
  entry,
  context,
  render,
  className,
}: EmptyStubProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const [bodyRef, bodyRoom] = useBodyRoom(
    entry.placement === 'body' && render === undefined,
  )
  const action = entry.action?.(context, labels)
  const actionRef = useRef<HTMLButtonElement>(null)
  const focusOnMount = useLatest(action?.focusOnMount)
  // Только при появлении заглушки: запрос фокуса одноразовый.
  useEffect(() => {
    if (focusOnMount.current?.()) actionRef.current?.focus()
  }, [focusOnMount])
  const marks = {
    'data-testid': entry.testId ?? `${entry.id}-stub`,
    'data-stub': entry.id,
  }

  if (render !== undefined) {
    return (
      <div className={className} {...marks}>
        {typeof render === 'function'
          ? render({ action: action?.run, error: context.loadError.error })
          : render}
      </div>
    )
  }

  const Media = entry.media && icons[entry.media]
  const ActionIcon = action?.icon && icons[action.icon]
  return (
    <Stub
      ref={bodyRef}
      className={className}
      style={bodyRoom === undefined ? undefined : { height: bodyRoom }}
      {...marks}
      media={
        Media && (
          <span style={{ display: 'contents', color: entry.mediaColor }}>
            <Media width={entry.mediaSize} height={entry.mediaSize} />
          </span>
        )
      }
      title={entry.title(labels)}
      description={entry.description?.(context)}
      action={
        action && (
          <Button
            ref={actionRef}
            pending={action.pending}
            onClick={action.run}
            icon={
              ActionIcon && (
                <ActionIcon width={16} height={16} aria-hidden="true" />
              )
            }
            data-testid={action.testId}
          >
            {action.label}
          </Button>
        )
      }
    />
  )
}
