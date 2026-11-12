import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  settingsButton,
  settingsPopover,
  heldRequests,
  holdModule,
  releaseModule,
  renderToolbarGrid,
} from './lazy-helpers'

// Модуль поповера кнопки тулбара грузится при её показе (ADR 0061, LZ1). Отдельный
// файл: модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.settings))

describe('Ленивые поповеры — загрузка при показе кнопки', () => {
  test('LZ1: модуль поповера кнопки тулбара начинает грузиться при показе кнопки, до клика', async () => {
    await holdModule(MODULE.settings)
    await renderToolbarGrid()
    await expect.poll(() => heldRequests(MODULE.settings)).toBeGreaterThan(0)
    expect(settingsPopover()).toBeNull()

    await releaseModule(MODULE.settings)
    await expect
      .poll(() => settingsButton().id.startsWith('base-ui'))
      .toBe(true)
  })
})
