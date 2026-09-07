import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetDevWarn, __setDevWarnProduction, devWarn } from './devWarn'

describe('devWarn', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDevWarn()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('PC8: один и тот же ключ печатается один раз, разные — каждый', () => {
    devWarn('a', 'first')
    devWarn('a', 'again')
    devWarn('b', 'second')

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenNthCalledWith(1, '[tessera] first')
    expect(warn).toHaveBeenNthCalledWith(2, '[tessera] second')
  })

  it('PC7: в проде молчит', () => {
    __setDevWarnProduction(true)

    try {
      devWarn('prod', 'should not print')
      expect(warn).not.toHaveBeenCalled()
    } finally {
      __setDevWarnProduction(undefined)
    }
  })
})
