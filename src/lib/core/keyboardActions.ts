/**
 * Канал клавиатурных действий плагинов (ADR 0021, ADR 0031): что делают
 * `Space`/`Enter`/`F2` и сочетания с `Alt` на ячейке тела или заголовка.
 * Действие объявляет плагин-владелец ячейки; резолвер клавиатурной навигации
 * берёт применимое с наибольшим `priority`, при равенстве — первое по порядку `plugins`.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { actionDetailOf, actionOwnerOf } from './actionOwners'
import type { CellComponentProps, HeaderComponentProps } from './createSlots'
import { type DebugActionSource, reportAction } from './debugActions'

interface KeyboardActionBase<TCtx> {
  /** Идентификатор; при свёртке дубли по id заменяются последним. */
  id: string
  /**
   * Значения `KeyboardEvent.key` (`' '` — пробел) или сочетания в форме
   * `keyComboOf` — `'Alt+Shift+ArrowUp'`; сочетания срабатывают только с `Alt`.
   */
  keys: string[]
  /**
   * Действие раскрывает/сворачивает строку: его вызывает и фокус на строке
   * treegrid (`→`/`←`, ADR 0032, W16), не зная плагина-владельца.
   */
  expands?: boolean
  /** Кто побеждает, если на одной клавише применимы несколько действий. По умолчанию `0`. */
  priority?: number
  /** Применимо ли действие к этой ячейке. По умолчанию — всегда. */
  visible?: (ctx: TCtx) => boolean
  run: (ctx: TCtx, event: ReactKeyboardEvent<HTMLElement>) => void
}

/** Действие на ячейке тела; контекст — `cell.getContext()`. */
export interface CellKeyboardAction extends KeyboardActionBase<CellComponentProps> {
  scope: 'cell'
}

/** Действие на ячейке заголовка; контекст — `header.getContext()`. */
export interface HeaderKeyboardAction extends KeyboardActionBase<HeaderComponentProps> {
  scope: 'header'
}

export type KeyboardAction = CellKeyboardAction | HeaderKeyboardAction

/** Сочетание клавиш события: модификаторы в порядке Ctrl, Alt, Shift, Meta и `key`. */
export const keyComboOf = (event: {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}): string =>
  [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Meta',
    event.key,
  ]
    .filter(Boolean)
    .join('+')

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

/** Упорядочить по убыванию `priority`; сортировка стабильна — равные сохраняют порядок `plugins`. */
export const sortKeyboardActionsByPriority = (
  actions: KeyboardAction[],
): KeyboardAction[] =>
  actions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

/**
 * Пользователь раскрывает строки сам: есть действие раскрытия — переключатель
 * `rowExpanding` (ADR 0119). Без него дерево `rowExpandingModel` раскрыто только по `expanded`.
 */
export const hasExpandToggle = (table: unknown): boolean =>
  (
    (
      table as { getKeyboardActions?: () => KeyboardAction[] | undefined }
    ).getKeyboardActions?.() ?? []
  ).some(action => action.expands === true)

/** Выполнить клавиатурное действие и сообщить его в канал действий (ADR 0125, AL4). */
export const runKeyboardAction = (
  table: unknown,
  action: KeyboardAction,
  ctx: unknown,
  event: ReactKeyboardEvent<HTMLElement>,
  source: DebugActionSource = 'keyboard',
): void => {
  reportAction(table, {
    plugin: actionOwnerOf(action),
    action: action.id,
    detail: () => ({
      ...actionDetailOf(ctx),
      ...(source === 'keyboard' && { key: keyComboOf(event) }),
    }),
    source,
  })
  action.run(ctx as never, event)
}

/**
 * Раскрыть или свернуть строку тем же путём, что и её кнопка: действие канала с флагом
 * `expands`, применимое к одной из ячеек строки. Так переключают фокус на строке treegrid и
 * шеврон липкой копии, когда кнопки строки нет в DOM (ADR 0160, EA12). `false` — нечем.
 */
export const toggleRowByAction = (
  table: unknown,
  row: { getVisibleCells: () => unknown[] } | undefined,
  event: ReactKeyboardEvent<HTMLElement>,
  source: DebugActionSource,
): boolean => {
  const actions = (
    (
      table as { getKeyboardActions?: () => KeyboardAction[] | undefined }
    ).getKeyboardActions?.() ?? []
  ).filter(action => action.scope === 'cell' && action.expands)
  for (const cell of (row?.getVisibleCells() ?? []) as {
    getContext?: () => unknown
  }[]) {
    const ctx = cell.getContext?.()
    const action = actions.find(a => a.visible?.(ctx as never) ?? true)
    if (ctx && action) {
      runKeyboardAction(table, action, ctx, event, source)
      return true
    }
  }
  return false
}
