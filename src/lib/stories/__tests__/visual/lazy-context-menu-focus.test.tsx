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

// Загрузка модуля контекстного меню при фокусе (ADR 0061, LZ19). Отдельный файл:
// модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

describe('Контекстное меню — загрузка при фокусе', () => {
  test('LZ19: фокус внутри грида без наведения начинает загрузку модуля контекстного меню', async () => {
    await holdModule(MODULE.contextMenu)
    await renderContextMenuGrid()
    await sleep(200)
    expect(await heldRequests(MODULE.contextMenu)).toBe(0)

    const cell = dataCell()
    if (!cell.hasAttribute('tabindex')) cell.tabIndex = -1
    cell.focus()
    await expect.poll(() => heldRequests(MODULE.contextMenu)).toBeGreaterThan(0)
  })
})
