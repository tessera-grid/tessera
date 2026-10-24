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
import { tableLabels } from '../labels'

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
      .toContain(tableLabels.loadFailed(tableLabels.moveColumn))
    await sleep(100)
    expect(handleMenu()).toBeNull()

    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.columnWidth))
    expect(gripWrapper().querySelector('[data-error-flash]')).toBeNull()
    expect(gripWrapper().hasAttribute('data-error-flash')).toBe(false)

    // Вспышка держится --tsr-comp-error-flash-duration (300 мс), затем гаснет. Ждём
    // конца затухания: снятие атрибута посреди нажатия убирает `::after`, и Firefox
    // отдаёт отпускание кнопки родителю по прежней раскладке.
    await expect.poll(flash, { timeout: 3000 }).toBeNull()
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect.poll(flash).toBe('on')
    announcements.stop()
    expect(handleMenu()).toBeNull()
  })
})
