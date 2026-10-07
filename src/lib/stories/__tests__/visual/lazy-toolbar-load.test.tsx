import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  columnsButton,
  columnsPopover,
  heldRequests,
  holdModule,
  releaseModule,
  renderToolbarGrid,
} from './lazy-helpers'

// Модуль поповера кнопки тулбара грузится при её показе (ADR 0061, LZ1). Отдельный
// файл: модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.columns))

describe('Ленивые поповеры — загрузка при показе кнопки', () => {
  test('LZ1: модуль поповера кнопки тулбара начинает грузиться при показе кнопки, до клика', async () => {
    await holdModule(MODULE.columns)
    await renderToolbarGrid()
    await expect.poll(() => heldRequests(MODULE.columns)).toBeGreaterThan(0)
    expect(columnsPopover()).toBeNull()

    await releaseModule(MODULE.columns)
    await expect.poll(() => columnsButton().id.startsWith('base-ui')).toBe(true)
  })
})
