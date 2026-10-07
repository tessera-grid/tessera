import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  contextMenu,
  dataCell,
  gridScroller,
  holdModule,
  releaseModule,
  renderContextMenuGrid,
  rightClick,
  sleep,
} from './lazy-helpers'

// Отмена ожидания контекстного меню (ADR 0061, LZ9). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

const busy = () => gridScroller().getAttribute('aria-busy')

describe('Контекстное меню — отмена ожидания', () => {
  test('LZ9: Escape, прокрутка грида колесом и клик мимо отменяют ожидание контекстного меню — после загрузки меню не открывается', async () => {
    await holdModule(MODULE.contextMenu)
    await renderContextMenuGrid()

    rightClick(dataCell())
    await expect.poll(busy).toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(busy).toBeNull()

    rightClick(dataCell())
    await expect.poll(busy).toBe('true')
    gridScroller().dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true }),
    )
    await expect.poll(busy).toBeNull()

    rightClick(dataCell())
    await expect.poll(busy).toBe('true')
    await userEvent.click(document.body, { position: { x: 2, y: 2 } })
    await expect.poll(busy).toBeNull()

    await releaseModule(MODULE.contextMenu)
    await sleep(200)
    expect(contextMenu()).toBeNull()
  })
})
