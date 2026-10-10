import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  failModule,
  pageSizeButton,
  pageSizeOptions,
  recordAnnouncements,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Ошибка загрузки выбора размера страницы (ADR 0061, LZ16). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.pageSize))

const flash = () => pageSizeButton().getAttribute('data-error-flash')

describe('Размер страницы — ошибка загрузки', () => {
  test('LZ16: ошибка загрузки выбора размера страницы — список не открывается, вспышка ошибки, объявление с подписью rowsPerPage; следующий клик снова грузит', async () => {
    await failModule(MODULE.pageSize)
    await renderToolbarGrid()
    const announcements = recordAnnouncements()

    await humanClick(pageSizeButton())
    await expect.poll(flash).toBe('on')
    await expect
      .poll(() => announcements.messages)
      .toContain("Couldn't load Rows per page. Try again.")
    await sleep(100)
    expect(pageSizeOptions()).toBe(0)
    // Вспышка держится --tsr-comp-error-flash-duration (1200 мс), затем гаснет. Ждём
    // конца затухания: снятие атрибута посреди нажатия убирает `::after`, и Firefox
    // отдаёт отпускание кнопки родителю по прежней раскладке.
    await expect.poll(flash, { timeout: 3000 }).toBeNull()

    await humanClick(pageSizeButton())
    await expect.poll(flash).toBe('on')
    announcements.stop()
  })
})
