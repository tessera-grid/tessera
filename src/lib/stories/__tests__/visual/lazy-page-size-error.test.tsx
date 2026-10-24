import { afterEach, describe, expect, test } from 'vitest'

import { failureShownOn, humanClick } from '../helpers'
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
import { tableLabels } from '../labels'

// Ошибка загрузки выбора размера страницы (ADR 0061, LZ16). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.pageSize))

const failed = () => failureShownOn(pageSizeButton())

describe('Размер страницы — ошибка загрузки', () => {
  test('LZ16: ошибка загрузки выбора размера страницы — список не открывается, отметка отказа, объявление с подписью rowsPerPage; следующий клик снова грузит', async () => {
    await failModule(MODULE.pageSize)
    await renderToolbarGrid()
    const announcements = recordAnnouncements()

    await humanClick(pageSizeButton())
    await expect.poll(failed).toBe(true)
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.rowsPerPage))
    await sleep(100)
    expect(pageSizeOptions()).toBe(0)

    const before = announcements.messages.length
    await humanClick(pageSizeButton())
    await expect
      .poll(() => announcements.messages.length)
      .toBeGreaterThan(before)
    await expect.poll(failed).toBe(true)
    announcements.stop()
  })
})
