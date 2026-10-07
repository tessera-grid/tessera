// Открытие ленивого поповера или меню после загрузки его модуля (ADR 0061, ADR 0024
// AM28–AM30): нажатие до загрузки не теряется, долгое ожидание видно, его можно
// отменить, ошибка загрузки не открывает поповер — элемент вспыхивает, текст
// объявляется.
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { announceLabel } from './announcer'
import { type Preloadable, usePreloaded } from './preloadable'
import type { TableLabels } from './localization'

/** Ожидание короче этого не показывается — блик не мелькает на каждом нажатии. */
export const LAZY_PENDING_DELAY_MS = 150

export interface LazyLoad {
  /** Загрузка модуля; уже загруженный модуль открывается без ожидания. */
  load: () => Promise<unknown>
  isReady?: () => boolean
  /** Подпись элемента для объявления ошибки. */
  label: (labels: TableLabels) => string
}

export const useLazyOpening = (table: unknown) => {
  const [pending, setPending] = useState(false)
  const [errorFlash, setErrorFlash] = useState<number>()
  const stop = useRef<() => void>(undefined)

  const cancel = () => {
    stop.current?.()
    stop.current = undefined
    setPending(false)
  }

  /** Открыть (`open`), когда загрузится модуль; `onFail` — при ошибке загрузки. */
  const request = (
    lazy: LazyLoad | undefined,
    open: () => void,
    onFail?: () => void,
  ) => {
    cancel()
    if (!lazy || lazy.isReady?.()) {
      open()
      return
    }
    let active = true
    const timer = setTimeout(() => setPending(true), LAZY_PENDING_DELAY_MS)
    const finish = () => {
      active = false
      clearTimeout(timer)
      stop.current = undefined
      setPending(false)
    }
    stop.current = () => {
      active = false
      clearTimeout(timer)
    }
    lazy.load().then(
      () => {
        if (!active) return
        finish()
        open()
      },
      () => {
        if (!active) return
        finish()
        onFail?.()
        setErrorFlash(key => (key ?? 0) + 1)
        if (table) {
          announceLabel(table, labels => labels.loadFailed(lazy.label(labels)))
        }
      },
    )
  }

  useEffect(() => () => stop.current?.(), [])

  return { request, cancel, pending, errorFlash }
}

/** Состояние ленивого открытия для элемента, который его запускает. */
export interface LazyTriggerState {
  pending: boolean
  errorFlash?: number
  /** Наведение или фокус: пора грузить модуль. */
  onIntent?: () => void
  /** Escape или уход фокуса: отменить ожидание. */
  onCancel: () => void
}

/** Обработчики элемента, запускающего ленивое открытие. */
export const lazyTriggerHandlers = (state: LazyTriggerState | undefined) =>
  state && {
    onPointerEnter: state.onIntent,
    onFocus: state.onIntent,
    onBlur: state.onCancel,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') state.onCancel()
    },
  }

/**
 * Поповер из ленивого модуля с кнопкой-заглушкой (ADR 0061): пока модуль не пришёл,
 * стоит заглушка; нажатие на неё открывает поповер после загрузки, долгое ожидание
 * и ошибка видны на ней. `trigger` — пропсы заглушки.
 */
export const useLazyPopover = (
  table: unknown,
  module: Preloadable,
  label: (labels: TableLabels) => string,
  /** `false` — поповер не нужен (модуль не грузится). */
  enabled = true,
) => {
  const [open, setOpen] = useState(false)
  const ready = usePreloaded(module, enabled)
  const opening = useLazyOpening(table)

  const onOpenChange = (next: boolean) => {
    if (next) {
      opening.request(
        { load: module.reload, isReady: module.isLoaded, label },
        () => setOpen(true),
      )
    } else {
      opening.cancel()
      setOpen(false)
    }
  }

  const trigger = {
    pending: opening.pending,
    errorFlash: opening.errorFlash,
    'aria-expanded': open,
    onClick: () => onOpenChange(true),
    ...lazyTriggerHandlers({
      pending: opening.pending,
      onCancel: opening.cancel,
    }),
  }

  return { open, onOpenChange, ready, trigger, opening }
}
