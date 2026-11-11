// Открытие ленивого поповера или меню после загрузки его модуля (ADR 0061, ADR 0024
// AM28–AM30): нажатие до загрузки не теряется, долгое ожидание видно, его можно
// отменить, ошибка загрузки не открывает поповер: дуга на элементе останавливается, текст
// объявляется, отказ — запись реестра отказов с повтором (ADR 0177, §2).
import { reportAction, userSourceOf } from './debugActions'
import {
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

import { announceLabel } from './announcer'
import {
  failureKeyOf,
  reportFailure,
  resolveFailure,
} from './failures/failuresFeature'
import { type Preloadable, usePreloaded } from '../util/preloadable'
import { type TableLabels, useLocalization } from './localization'
import type { ActionRef } from './actions'

/** Ожидание короче этого не показывается — блик не мелькает на каждом нажатии. */
export const LAZY_PENDING_DELAY_MS = 150

export interface LazyLoad {
  /** Загрузка модуля; уже загруженный модуль открывается без ожидания. */
  load: () => Promise<unknown>
  isReady?: () => boolean
  /** Подпись элемента для объявления ошибки. */
  label: (labels: TableLabels) => string
  /** Действие, открытие которого не удалось, — имя записи отказа (ADR 0182, §5). */
  action: ActionRef
}

export const useLazyOpening = (table: unknown) => {
  const labels = useLocalization()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
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
    // Новая попытка — повтор: прошлый отказ снимается.
    setFailed(false)
    const process = { process: `lazy:${lazy?.label(labels) ?? ''}` }
    if (lazy && table) resolveFailure(table, failureKeyOf(process))
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
        setFailed(true)
        if (table) {
          announceLabel(table, labels => labels.loadFailed(lazy.label(labels)))
          reportFailure(table, {
            action: lazy.action,
            target: process,
            reason: labels.loadFailed(lazy.label(labels)),
            retry: () => request(lazy, open, onFail),
          })
        }
      },
    )
  }

  useEffect(() => () => stop.current?.(), [])

  return { request, cancel, pending, failed }
}

/** Состояние ленивого открытия для элемента, который его запускает. */
export interface LazyTriggerState {
  pending: boolean
  /** Загрузка модуля отказала: дуга останавливается. */
  failed?: boolean
  /** Наведение или фокус: пора грузить модуль. */
  onIntent?: () => void
  /** Escape или уход фокуса: отменить ожидание. */
  onCancel: () => void
  /** Фокус на заглушке: передать его элементу, сменившему её с приходом модуля (LZ25). */
  onFocus?: (event: FocusEvent<HTMLElement>) => void
}

/** Обработчики элемента, запускающего ленивое открытие. */
export const lazyTriggerHandlers = (state: LazyTriggerState | undefined) =>
  state && {
    onPointerEnter: state.onIntent,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      state.onFocus?.(event)
      state.onIntent?.()
    },
    onBlur: state.onCancel,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') state.onCancel()
    },
  }

const FOCUSABLE = 'button, [href], input, [tabindex]'

/** Место заглушки: её предки снизу вверх и номер ребёнка на каждом шаге. */
interface Place {
  ancestors: Element[]
  indexes: number[]
}

interface FocusHandover {
  /** Заглушка, на которой был фокус. */
  placeholder: HTMLElement | null
  /** Место заглушки, когда модуль пришёл, а фокус был на ней. */
  place?: Place
}

/** Предков хватает, чтобы выйти из обёрток, которые меняются вместе с заглушкой. */
const PLACE_DEPTH = 4

/** Модуль пришёл, заглушка ещё в документе: фокус на ней — запомнить её место. */
const arriveWithFocus = (handover: FocusHandover) => {
  const el = handover.placeholder
  if (!el?.isConnected || !el.contains(document.activeElement)) return
  const place: Place = { ancestors: [], indexes: [] }
  let node: Element = el
  while (node.parentElement && place.ancestors.length < PLACE_DEPTH) {
    const parent: Element = node.parentElement
    place.ancestors.push(parent)
    place.indexes.push([...parent.children].indexOf(node))
    node = parent
  }
  handover.place = place
}

/**
 * Фокус заглушки переходит к элементу, сменившему её с приходом модуля (ADR 0061, LZ25): React
 * ставит новый узел, и фокус браузера с ушедшего падает в body. Преемник — на месте заглушки,
 * от ближайшего уцелевшего предка.
 */
const focusSuccessor = ({ ancestors, indexes }: Place) => {
  // Фокус уже ушёл сам (клик, Tab) — его не трогаем.
  const active = document.activeElement
  if (active && active !== document.body) return
  const level = ancestors.findIndex(ancestor => ancestor.isConnected)
  if (level < 0) return
  let next: Element | undefined = ancestors[level]
  for (let i = level; i >= 0 && next; i--) next = next.children[indexes[i]!]
  const focusable = next?.matches(FOCUSABLE)
    ? next
    : next?.querySelector(FOCUSABLE)
  ;(focusable as HTMLElement | null | undefined)?.focus()
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
  const handover = useRef<FocusHandover>({ placeholder: null })
  const ready = usePreloaded(module, enabled, () =>
    arriveWithFocus(handover.current),
  )
  useEffect(() => {
    const { place } = handover.current
    if (!ready || !place) return
    // Кадр спустя: тулбар Base UI учитывает новую кнопку после коммита, и фокус до этого
    // оставляет стрелки без хода.
    const frame = requestAnimationFrame(() => {
      handover.current.place = undefined
      focusSuccessor(place)
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])
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
        {
          load: module.reload,
          isReady: module.isLoaded,
          label,
          action: { plugin: owner?.plugin ?? 'core', action: 'openMenu' },
        },
        () => setOpen(true),
      )
    } else {
      opening.cancel()
      setOpen(false)
    }
  }

  const trigger = {
    pending: opening.pending,
    failed: opening.failed,
    // «Стоп» на кнопке-доме процесса (ADR 0177, §2).
    onCancel: opening.cancel,
    'aria-expanded': open,
    onClick: (event?: unknown) => onOpenChange(true, event),
    ...lazyTriggerHandlers({
      pending: opening.pending,
      onCancel: opening.cancel,
    }),
    // Заглушка с фокусом — запомнить её (LZ25); заглушки кебаба передают его через `onFocus`.
    onFocus: (event: FocusEvent<HTMLElement>) => {
      handover.current.placeholder = event.currentTarget
    },
  }

  return { open, onOpenChange, ready, trigger, opening }
}
