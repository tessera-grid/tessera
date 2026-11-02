import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { failureShownOn, humanClick } from '../helpers'
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

const failed = () => failureShownOn(columnHandle())

describe('Меню ручек — ошибка загрузки', () => {
  test('LZ14: ошибка загрузки меню — ни на ручке, ни у грипа отметки нет; объявление с подписью ручки или грипа; следующая попытка снова отвечает', async () => {
    await failModule(MODULE.handleMenu)
    await renderHandleGrid()
    const announcements = recordAnnouncements()

    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.moveColumn))
    expect(failed()).toBe(false)
    await sleep(100)
    expect(handleMenu()).toBeNull()

    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.columnWidth))
    expect(gripWrapper().querySelector('[data-failure-indicator]')).toBeNull()

    const before = announcements.messages.length
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect
      .poll(() => announcements.messages.length)
      .toBeGreaterThan(before)
    expect(failed()).toBe(false)
    announcements.stop()
    expect(handleMenu()).toBeNull()
  })
})
