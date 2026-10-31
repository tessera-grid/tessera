import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { handleMenuModule } from '../../../shared/handleMenu/HandleMenu'
import {
  MODULE,
  columnHandle,
  gripSeparator,
  gripWrapper,
  handleCell,
  heldRequests,
  holdModule,
  releaseModule,
  renderHandleGrid,
  sleep,
} from './lazy-helpers'

// Загрузка модуля меню ручек при наведении и фокусе (ADR 0061, LZ11). Отдельный
// файл: модуль грузится один раз на документ. Модуль один на все ручки, поэтому
// каждое приближение считается по вызову загрузки, а сеть — по первому запросу.

afterEach(async () => {
  vi.restoreAllMocks()
  await releaseModule(MODULE.handleMenu)
})

describe('Меню ручек — загрузка заранее', () => {
  test('LZ11: наведение и фокус на ручке перетаскивания и на грипе ширины начинают загрузку модуля меню', async () => {
    await holdModule(MODULE.handleMenu)
    await renderHandleGrid()
    await sleep(200)
    expect(await heldRequests(MODULE.handleMenu)).toBe(0)
    const load = vi.spyOn(handleMenuModule, 'load')

    await userEvent.hover(handleCell())
    await userEvent.hover(columnHandle())
    expect(load).toHaveBeenCalledTimes(1)
    await expect.poll(() => heldRequests(MODULE.handleMenu)).toBeGreaterThan(0)

    columnHandle().focus()
    expect(load).toHaveBeenCalledTimes(2)

    await userEvent.hover(gripWrapper())
    expect(load).toHaveBeenCalledTimes(3)

    gripSeparator().focus()
    expect(load).toHaveBeenCalledTimes(4)
  })
})
