import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  contextMenu,
  dataCell,
  holdModule,
  releaseModule,
  renderContextMenuGrid,
  rightClick,
  sleep,
} from './lazy-helpers'

// Правый клик до загрузки модуля контекстного меню (ADR 0061, LZ7). Отдельный файл:
// модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

describe('Контекстное меню — правый клик до загрузки', () => {
  test('LZ7: правый клик до загрузки не теряется — меню открывается после загрузки в той же точке, системное меню браузера не показывается', async () => {
    await holdModule(MODULE.contextMenu)
    await renderContextMenuGrid()
    const cell = dataCell(1)
    const event = rightClick(cell)
    expect(event.defaultPrevented).toBe(true)
    await sleep(100)
    expect(contextMenu()).toBeNull()

    await releaseModule(MODULE.contextMenu)
    await expect.poll(contextMenu).not.toBeNull()
    // Меню у точки клика: она на его границе или внутри (у края экрана меню
    // разворачивается в другую сторону).
    const rect = cell.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const menu = contextMenu()!.getBoundingClientRect()
    const dx = Math.max(menu.left - x, 0, x - menu.right)
    const dy = Math.max(menu.top - y, 0, y - menu.bottom)
    expect(Math.hypot(dx, dy)).toBeLessThan(12)
  })
})
