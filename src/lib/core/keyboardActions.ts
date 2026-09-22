/**
 * Канал клавиатурных действий плагинов (ADR 0021): что делают `Space`/`Enter`/`F2`
 * на ячейке тела или листового заголовка. Действие объявляет плагин-владелец
 * ячейки; резолвер клавиатурной навигации берёт первое применимое.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import type { CellComponentProps, HeaderComponentProps } from './createSlots'

interface KeyboardActionBase<TCtx> {
  /** Идентификатор; при свёртке дубли по id заменяются последним. */
  id: string
  /** Значения `KeyboardEvent.key`, на которые откликается действие (`' '` — пробел). */
  keys: string[]
  /** Применимо ли действие к этой ячейке. По умолчанию — всегда. */
  visible?: (ctx: TCtx) => boolean
  run: (ctx: TCtx, event: ReactKeyboardEvent<HTMLElement>) => void
}

/** Действие на ячейке тела; контекст — `cell.getContext()`. */
export interface CellKeyboardAction extends KeyboardActionBase<CellComponentProps> {
  scope: 'cell'
}

/** Действие на ячейке листового заголовка; контекст — `header.getContext()`. */
export interface HeaderKeyboardAction extends KeyboardActionBase<HeaderComponentProps> {
  scope: 'header'
}

export type KeyboardAction = CellKeyboardAction | HeaderKeyboardAction

/** Добавить действия в общий список с дедупом по id (последний побеждает). */
export const registerKeyboardActionsInto = (
  target: KeyboardAction[],
  actions: KeyboardAction[] | undefined,
): void => {
  actions?.forEach(action => {
    const index = target.findIndex(a => a.id === action.id)
    if (index === -1) {
      target.push(action)
    } else {
      target[index] = action
    }
  })
}
