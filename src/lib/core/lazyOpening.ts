// Открытие ленивого поповера или меню после загрузки его модуля (ADR 0061, ADR 0024
// AM28–AM30): нажатие до загрузки не теряется, долгое ожидание видно, его можно
// отменить, ошибка загрузки не открывает поповер — на элементе отметка отказа, текст
// объявляется (ADR 0136).
import { reportAction, userSourceOf } from './debugActions'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { announceLabel } from './announcer'
import { type Preloadable, usePreloaded } from './preloadable'
import { type TableLabels, useLocalization } from './localization'

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
  const labels = useLocalization()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string>()
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
    // Новая попытка — повтор: отметка прошлого отказа снимается (IR13).
    setFailure(undefined)
    if (!lazy || lazy.isReady?.()) {
      open()
      return
    }
    let active = true
    const timer = setTimeout(() => setPending(true), LAZY_PENDING_DELAY_MS)
    // Отмена слушается и на документе: Safari не фокусирует кнопку по клику, и её
    // Escape и blur ожидание не отменили бы. Уход — Tab или нажатие указателем.
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') cancel()
    }
    const listen = (on: boolean) => {
      if (on) {
        document.addEventListener('keydown', onKeyDown, true)
        document.addEventListener('pointerdown', cancel, true)
      } else {
        document.removeEventListener('keydown', onKeyDown, true)
        document.removeEventListener('pointerdown', cancel, true)
      }
    }
    listen(true)
    const finish = () => {
      active = false
      clearTimeout(timer)
      listen(false)
      stop.current = undefined
      setPending(false)
    }
    stop.current = () => {
      active = false
      clearTimeout(timer)
      listen(false)
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
        setFailure(labels.loadFailed(lazy.label(labels)))
        if (table) {
          announceLabel(table, labels => labels.loadFailed(lazy.label(labels)))
        }
      },
    )
  }

  useEffect(() => () => stop.current?.(), [])

  return { request, cancel, pending, failure }
}

/** Состояние ленивого открытия для элемента, который его запускает. */
export interface LazyTriggerState {
  pending: boolean
  /** Текст отметки отказа загрузки модуля. */
  failure?: string
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
  /** Владелец поповера в канале действий: открытие и закрытие (ADR 0125). */
  owner?: { plugin: string; detail?: () => unknown },
) => {
  const [open, setOpen] = useState(false)
  const ready = usePreloaded(module, enabled)
  const opening = useLazyOpening(table)

  // `details` — событие нажатия или подробности Base UI (`{ event }`).
  const onOpenChange = (next: boolean, details?: unknown) => {
    if (owner && next !== open) {
      reportAction(table, {
        plugin: owner.plugin,
        action: next ? 'openMenu' : 'closeMenu',
        detail: owner.detail,
        // Без подробностей (кебаб, заглушка) — последний ввод пользователя.
        source: userSourceOf(
          (details as { event?: Event } | undefined)?.event ?? details,
        ),
      })
    }
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
    failure: opening.failure,
    'aria-expanded': open,
    onClick: (event?: unknown) => onOpenChange(true, event),
    ...lazyTriggerHandlers({
      pending: opening.pending,
      onCancel: opening.cancel,
    }),
  }

  return { open, onOpenChange, ready, trigger, opening }
}
