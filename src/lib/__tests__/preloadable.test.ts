import { describe, expect, test, vi } from 'vitest'

import { preloadable } from '../core/preloadable'

// LZ18 (ADR 0061): повтор загрузки модуля после ошибки — только по `reload()`.
describe('preloadable — повтор после ошибки', () => {
  test('LZ18: load() после ошибки возвращает ту же ошибку без новой загрузки, reload() после ошибки вызывает загрузку модуля заново', async () => {
    const Panel = () => null
    const factory = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(Panel)
    const module = preloadable(factory)

    await expect(module.load()).rejects.toThrow('chunk failed')
    await expect(module.load()).rejects.toThrow('chunk failed')
    expect(factory).toHaveBeenCalledTimes(1)
    expect(module.isLoaded()).toBe(false)

    await module.reload()
    expect(factory).toHaveBeenCalledTimes(2)
    expect(module.isLoaded()).toBe(true)

    // Загруженный модуль не грузится повторно.
    await module.reload()
    await module.load()
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
