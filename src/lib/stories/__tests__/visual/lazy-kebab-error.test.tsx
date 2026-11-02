import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { failureShownOn, humanClick, renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'
import {
  MODULE,
  failModule,
  recordAnnouncements,
  releaseModule,
  sleep,
} from './lazy-helpers'
import { tableLabels } from '../labels'

// Ошибка загрузки модуля кебаба заголовка (ADR 0061, LZ22). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.kebab))

const head = () =>
  document.querySelector<HTMLElement>('.data-grid__head-cell[data-column-id]')!
const kebab = () =>
  head().querySelector<HTMLElement>(`[aria-label="${tableLabels.headerMenu}"]`)!
const failed = () => failureShownOn(kebab())

describe('Кебаб заголовка — ошибка загрузки', () => {
  test('LZ22: ошибка загрузки модуля кебаба — меню не открывается, объявление с подписью headerMenu, отметки на кебабе нет; следующий клик снова отвечает', async () => {
    await failModule(MODULE.kebab)
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()
    const announcements = recordAnnouncements()

    await userEvent.hover(head())
    await humanClick(kebab())
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.headerMenu))
    expect(failed()).toBe(false)
    await sleep(100)
    expect(document.querySelector('[role="menu"]')).toBeNull()

    const before = announcements.messages.length
    await userEvent.hover(head())
    await humanClick(kebab())
    await expect
      .poll(() => announcements.messages.length)
      .toBeGreaterThan(before)
    expect(failed()).toBe(false)
    announcements.stop()
  })
})
