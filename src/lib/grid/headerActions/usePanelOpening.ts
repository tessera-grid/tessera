// usePanelOpening: открытие поповера действия с панелью после `SlotAction.preload`
// (ADR 0024, AM28–AM30). Долгое ожидание видно кнопке как `pending`, его можно
// отменить, а ошибка загрузки не открывает поповер — кнопка вспыхивает, текст
// объявляется.
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { announceLabel } from '../../core/announcer'
import type { SlotAction } from '../../core/headerActions'

/** Ожидание короче этого не показывается — блик не мелькает на каждом клике. */
export const PANEL_PENDING_DELAY_MS = 150

interface Context {
  table: unknown
}

export const usePanelOpening = (context: Context) => {
  const [pending, setPending] = useState(false)
  const [errorFlash, setErrorFlash] = useState<number>()
  const stop = useRef<() => void>(undefined)

  const cancel = () => {
    stop.current?.()
    stop.current = undefined
    setPending(false)
  }

  /** Открыть панель `action`, когда загрузится её содержимое; `onFail` — при ошибке. */
  const request = (
    action: SlotAction,
    open: () => void,
    onFail?: () => void,
  ) => {
    cancel()
    if (!action.preload) {
      open()
      return
    }
    let active = true
    const timer = setTimeout(() => setPending(true), PANEL_PENDING_DELAY_MS)
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
    action.preload(context).then(
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
        announceLabel(context.table, labels =>
          labels.actionPanelLoadFailed(action.label(context, labels)),
        )
      },
    )
  }

  useEffect(() => () => stop.current?.(), [])

  return { request, cancel, pending, errorFlash }
}

/** Состояние открытия панели для её кнопки. */
export interface PanelButtonState {
  pending: boolean
  errorFlash?: number
  /** Наведение или фокус: пора грузить содержимое. */
  onIntent: () => void
  /** Escape или уход фокуса: отменить ожидание. */
  onCancel: () => void
}

/** Пропсы `IconButton` кнопки, открывающей панель. */
export const panelButtonProps = (state: PanelButtonState | undefined) =>
  state && {
    pending: state.pending,
    errorFlash: state.errorFlash,
    onPointerEnter: state.onIntent,
    onFocus: state.onIntent,
    onBlur: state.onCancel,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') state.onCancel()
    },
  }
