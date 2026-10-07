import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  columnHandle,
  handleCell,
  handleMenu,
  holdModule,
  releaseModule,
  renderHandleGrid,
  sleep,
} from './lazy-helpers'

// Нажатие на ручку до загрузки модуля меню (ADR 0061, LZ12). Отдельный файл: модуль
// грузится один раз на документ. Клик по грипу до загрузки — в LZ13.

afterEach(() => releaseModule(MODULE.handleMenu))

const busy = () => columnHandle().getAttribute('aria-busy')

describe('Меню ручек — нажатие до загрузки', () => {
  test('LZ12: клик и Enter на ручке до загрузки не теряются — меню открывается после загрузки', async () => {
    await holdModule(MODULE.handleMenu)
    await renderHandleGrid()

    // Клик запускает ожидание открытия.
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect.poll(busy).toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(busy).toBeNull()

    // Enter до загрузки — меню откроется после неё.
    columnHandle().focus()
    await userEvent.keyboard('{Enter}')
    await sleep(100)
    expect(handleMenu()).toBeNull()
    await releaseModule(MODULE.handleMenu)
    await expect.poll(handleMenu).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(handleMenu).toBeNull()
  })
})
