import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick, renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'
import {
  MODULE,
  failModule,
  recordAnnouncements,
  releaseModule,
  sleep,
} from './lazy-helpers'

// Ошибка загрузки модуля кебаба заголовка (ADR 0061, LZ22). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.kebab))

const head = () =>
  document.querySelector<HTMLElement>('.data-grid__head-cell[data-column-id]')!
const kebab = () =>
  head().querySelector<HTMLElement>('[aria-label="Column options"]')!
const flash = () => kebab().getAttribute('data-error-flash')

describe('Кебаб заголовка — ошибка загрузки', () => {
  test('LZ22: ошибка загрузки модуля кебаба — меню не открывается, вспышка ошибки, объявление с подписью headerMenu; следующий клик снова отвечает', async () => {
    await failModule(MODULE.kebab)
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuOptions: { mode: 'always' },
    })
    await waitForGrid()
    const announcements = recordAnnouncements()

    await userEvent.hover(head())
    await humanClick(kebab())
    await expect.poll(flash).toBe('on')
    await expect
      .poll(() => announcements.messages)
      .toContain('Column options failed to load. Try again.')
    await sleep(100)
    expect(document.querySelector('[role="menu"]')).toBeNull()

    // Вспышка держится --tsr-comp-error-flash-duration (1200 мс).
    await expect.poll(flash, { timeout: 3000 }).not.toBe('on')
    await userEvent.hover(head())
    await humanClick(kebab())
    await expect.poll(flash).toBe('on')
    announcements.stop()
  })
})
