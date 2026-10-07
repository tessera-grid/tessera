import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  dataCell,
  heldRequests,
  holdModule,
  releaseModule,
  renderContextMenuGrid,
  sleep,
} from './lazy-helpers'

// Загрузка модуля контекстного меню при наведении (ADR 0061, LZ6). Отдельный файл:
// модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

describe('Контекстное меню — загрузка при наведении', () => {
  test('LZ6: наведение на тело грида начинает загрузку модуля контекстного меню; без наведения и фокуса модуль не грузится', async () => {
    await holdModule(MODULE.contextMenu)
    await renderContextMenuGrid()
    await sleep(200)
    expect(await heldRequests(MODULE.contextMenu)).toBe(0)

    await userEvent.hover(dataCell())
    await expect.poll(() => heldRequests(MODULE.contextMenu)).toBeGreaterThan(0)
  })
})
