import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  columnHandle,
  failModule,
  gripWrapper,
  handleCell,
  handleMenu,
  recordAnnouncements,
  releaseModule,
  renderHandleGrid,
  sleep,
} from './lazy-helpers'

// Ошибка загрузки меню ручек (ADR 0061, LZ14). Отдельный файл: модуль грузится один
// раз на документ.

afterEach(() => releaseModule(MODULE.handleMenu))

const flash = () => columnHandle().getAttribute('data-error-flash')

describe('Меню ручек — ошибка загрузки', () => {
  test('LZ14: ошибка загрузки меню — ручка вспыхивает ошибкой, грип без вспышки; объявление с подписью ручки или грипа; следующая попытка снова отвечает', async () => {
    await failModule(MODULE.handleMenu)
    await renderHandleGrid()
    const announcements = recordAnnouncements()

    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect.poll(flash).toBe('on')
    await expect
      .poll(() => announcements.messages)
      .toContain("Couldn't load Move column. Try again.")
    await sleep(100)
    expect(handleMenu()).toBeNull()

    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect
      .poll(() => announcements.messages)
      .toContain("Couldn't load Column width. Try again.")
    expect(gripWrapper().querySelector('[data-error-flash]')).toBeNull()
    expect(gripWrapper().hasAttribute('data-error-flash')).toBe(false)

    // Вспышка держится --tsr-comp-error-flash-duration (1200 мс).
    await expect.poll(flash, { timeout: 3000 }).not.toBe('on')
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect.poll(flash).toBe('on')
    announcements.stop()
    expect(handleMenu()).toBeNull()
  })
})
