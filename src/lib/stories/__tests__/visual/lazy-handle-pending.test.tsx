import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  columnHandle,
  gripSeparator,
  gripWrapper,
  handleCell,
  handleMenu,
  holdModule,
  releaseModule,
  renderHandleGrid,
} from './lazy-helpers'

// Ожидание загрузки меню ручек (ADR 0061, LZ13). Отдельный файл: модуль грузится
// один раз на документ.

afterEach(() => releaseModule(MODULE.handleMenu))

const handleBusy = () => columnHandle().getAttribute('aria-busy')
const gripBusy = () => gripSeparator().getAttribute('aria-busy')

describe('Меню ручек — ожидание загрузки', () => {
  test('LZ13: ожидание меню дольше 150 мс — ручка в aria-busy с бликом без смены размера и положения, грип в aria-busy с курсором progress и меню после загрузки; Escape и уход фокуса отменяют ожидание', async () => {
    await holdModule(MODULE.handleMenu)
    await renderHandleGrid()
    await userEvent.hover(handleCell())
    const before = columnHandle().getBoundingClientRect()

    await humanClick(columnHandle())
    expect(handleBusy()).toBeNull()
    await expect.poll(handleBusy).toBe('true')
    expect(getComputedStyle(columnHandle(), '::after').opacity).toBe('1')
    const during = columnHandle().getBoundingClientRect()
    expect([during.left, during.top, during.width, during.height]).toEqual([
      before.left,
      before.top,
      before.width,
      before.height,
    ])
    await userEvent.keyboard('{Escape}')
    await expect.poll(handleBusy).toBeNull()

    await humanClick(columnHandle())
    await expect.poll(handleBusy).toBe('true')
    columnHandle().blur()
    await expect.poll(handleBusy).toBeNull()

    // Грип: клик до загрузки — ожидание, после загрузки — меню ширины.
    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect.poll(gripBusy).toBe('true')
    expect(getComputedStyle(gripSeparator()).cursor).toBe('progress')
    await releaseModule(MODULE.handleMenu)
    await expect.poll(handleMenu).not.toBeNull()
    expect(gripBusy()).toBeNull()
    expect(getComputedStyle(gripSeparator()).cursor).not.toBe('progress')
    await userEvent.keyboard('{Escape}')
  })
})
