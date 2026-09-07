import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetLogger,
  __setLoggerProduction,
  logError,
  logInfo,
  logWarn,
  type LogLevel,
} from './logger'

const host = (logLevel?: LogLevel) => ({ options: { logLevel } })

describe('logger', () => {
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>
  let info: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetLogger()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
    info.mockRestore()
  })

  it('PC8: один и тот же ключ печатается один раз, разные — каждый', () => {
    logWarn(host(), 'first', 'a')
    logWarn(host(), 'again', 'a')
    logWarn(host(), 'second', 'b')

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenNthCalledWith(1, '[tessera] first')
    expect(warn).toHaveBeenNthCalledWith(2, '[tessera] second')
  })

  it('PC7: в проде по умолчанию молчит', () => {
    __setLoggerProduction(true)

    try {
      logWarn(host(), 'should not print', 'prod')
      logError(host(), 'nor this', 'prod-err')
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally {
      __setLoggerProduction(undefined)
    }
  })

  it('PC9: порог отсекает сообщения ниже уровня', () => {
    // logLevel 'error' → error проходит, warn ниже порога и молчит.
    logError(host('error'), 'boom')
    logWarn(host('error'), 'muted')

    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('PC10: явный logLevel переопределяет дефолт (silent глушит даже в dev)', () => {
    logWarn(host('silent'), 'muted')
    expect(warn).not.toHaveBeenCalled()

    // 'debug' поднимает порог — проходит и info.
    logInfo(host('debug'), 'visible')
    expect(info).toHaveBeenCalledTimes(1)
  })
})
