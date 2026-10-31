/**
 * Перехват dev-warn'ов инертности (ADR 0022) в headless-тестах: чистый dedup и
 * dev-режим логгера на каждый тест, `console.warn` заглушён.
 */
import { afterEach, beforeEach, type MockInstance, vi } from 'vitest'

import { __resetLogger, __setLoggerProduction } from '../util/logger'

export const captureInertWarnings = () => {
  let spy: MockInstance<typeof console.warn>

  beforeEach(() => {
    __resetLogger()
    __setLoggerProduction(false)
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
    __setLoggerProduction(undefined)
    __resetLogger()
  })

  return (): string[] => spy.mock.calls.map(call => String(call[0]))
}
