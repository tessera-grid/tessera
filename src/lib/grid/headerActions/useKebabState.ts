// Состояние кебаба для асинхронных действий (ADR 0078): сессия проверки доступности
// (намерение → открытие → закрытие), ждущие и упавшие действия из среза
// `actionStatus`, увиденные отказы, имя и тултип кебаба.
import { useEffect, useState } from 'react'

import { useLocalization } from '../../core/localization'
import { useActionStatus } from './useActionStatus'
import { useLatest } from '../../core/useLatest'
import {
  type ActionStatus,
  type MenuAction,
  clearSeenActionErrors,
  kebabLabel,
  kebabStatus,
  markActionErrorsSeen,
} from '../../core/headerActions'
import { useAvailabilityChecks } from './useAvailabilityChecks'

/**
 * Ключ вспышки из нескольких источников: новое большее значение любого из них —
 * новая вспышка. Значения при монтировании вспышку не запускают.
 */
export const useMergedFlash = (...keys: (number | undefined)[]) => {
  const [state, setState] = useState({
    keys,
    merged: undefined as number | undefined,
  })
  if (keys.some((key, index) => key !== state.keys[index])) {
    const fired = keys.some(
      (key, index) =>
        key !== undefined &&
        (state.keys[index] === undefined || key > state.keys[index]!),
    )
    const next = {
      keys,
      merged: fired ? (state.merged ?? 0) + 1 : state.merged,
    }
    setState(next)
    return next.merged
  }
  return state.merged
}

export interface KebabState {
  /** Доступное имя кебаба. */
  ariaLabel: string
  /** Тултип кебаба. */
  title: string
  /** Ждёт хотя бы одно действие. */
  running: boolean
  /** Есть неувиденный отказ — отметка ошибки. */
  failed: boolean
  flash?: number
  /** Сессия проверки доступности: итоги и повторная проверка пункта. */
  session: Pick<ReturnType<typeof useAvailabilityChecks>, 'checks' | 'recheck'>
  /** Наведение или фокус: начать проверку доступности. */
  intent: () => void
  /** Указатель или фокус ушли: без открытого меню проверка прерывается. */
  leave: () => void
  /** Обёртка `onOpenChange` меню: сессия и увиденные отказы. */
  openChange: (next: boolean) => void
  /** Меню закрылось до конца: увиденные отказы убираются. */
  closed: () => void
}

export const useKebabState = (
  actions: MenuAction[],
  context: { table: unknown },
  base: { label: string; ariaLabel: string },
  open: boolean,
  onOpenChange: (next: boolean) => void,
): KebabState => {
  const labels = useLocalization()
  const session = useAvailabilityChecks()
  const status = useActionStatus(context.table, (value: ActionStatus) => value)
  const kebab = kebabStatus(status, actions, context)
  const openRef = useLatest(open)
  // Фокус, вернувшийся на кебаб после закрытия, — не намерение открыть снова.
  const [returning, setReturning] = useState(false)

  const openChange = (next: boolean) => {
    if (next) {
      session.start(actions, context)
      markActionErrorsSeen(actions, context)
    } else {
      session.stop()
      setReturning(true)
    }
    onOpenChange(next)
  }

  // Отказ, пришедший при открытом меню, виден в пункте — отметка на кебабе не нужна.
  const unseen = kebab.failed.length
  useEffect(() => {
    if (open && unseen > 0) markActionErrorsSeen(actions, context)
  }, [open, unseen, actions, context])

  return {
    ariaLabel: kebabLabel(base.ariaLabel, kebab, context, labels),
    title: kebabLabel(base.label, kebab, context, labels),
    running: kebab.running.length > 0,
    failed: kebab.failed.length > 0,
    flash: kebab.flash,
    session: { checks: session.checks, recheck: session.recheck },
    intent: () => {
      if (!returning) session.start(actions, context)
    },
    leave: () => {
      setReturning(false)
      if (!openRef.current) session.stop()
    },
    openChange,
    closed: () => clearSeenActionErrors(actions, context),
  }
}
