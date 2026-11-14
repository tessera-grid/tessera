/**
 * Смена аргументов Storybook — действия истории в консоли (ADR 0124, CL16):
 * «Control enableRowDragging: true → false».
 */
import { useRef } from 'react'

import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { type ConsoleLog, preview } from './consoleLog'
import { shellText } from './storyShell'

/** Служебные пропсы истории, не контролы. */
const SKIP = new Set(['consoleLog', 'updateArgs', 'colorMode'])

export const useArgsActions = (log: ConsoleLog | undefined, args?: object) => {
  const last = useRef<Record<string, unknown> | undefined>(undefined)
  // До эффектов грида: запись контрола встаёт перед записями, которые он вызвал.
  useIsomorphicLayoutEffect(() => {
    const before = last.current
    const next = (args ?? {}) as Record<string, unknown>
    last.current = next
    if (!log || !before) return
    const keys = new Set([...Object.keys(before), ...Object.keys(next)])
    for (const key of keys) {
      const from = before[key]
      const to = next[key]
      if (SKIP.has(key) || Object.is(from, to)) continue
      if (typeof from === 'function' || typeof to === 'function') continue
      log.action({
        plugin: 'story',
        action: locale =>
          shellText(locale, 'consoleControl', {
            key,
            from: preview(from, 40),
            to: preview(to, 40),
          }),
        source: 'story',
      })
    }
  })
}
