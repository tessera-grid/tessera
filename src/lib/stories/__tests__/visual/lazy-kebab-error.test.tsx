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
import { tableLabels } from '../labels'

// Ошибка загрузки модуля кебаба заголовка (ADR 0061, LZ22). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.kebab))

const head = () =>
  document.querySelector<HTMLElement>('.data-grid__head-cell[data-column-id]')!
const kebab = () =>
  head().querySelector<HTMLElement>(`[aria-label="${tableLabels.headerMenu}"]`)!
const flash = () => kebab().getAttribute('data-error-flash')

describe('Кебаб заголовка — ошибка загрузки', () => {
  test('LZ22: ошибка загрузки модуля кебаба — меню не открывается, вспышка ошибки, объявление с подписью headerMenu; следующий клик снова отвечает', async () => {
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
    await expect.poll(flash).toBe('on')
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.headerMenu))
    await sleep(100)
    expect(document.querySelector('[role="menu"]')).toBeNull()

    // Вспышка держится --tsr-comp-error-flash-duration (300 мс), затем гаснет. Ждём
    // конца затухания: снятие атрибута посреди нажатия убирает `::after`, и Firefox
    // отдаёт отпускание кнопки родителю по прежней раскладке.
    await expect.poll(flash, { timeout: 3000 }).toBeNull()
    await userEvent.hover(head())
    await humanClick(kebab())
    await expect.poll(flash).toBe('on')
    announcements.stop()
  })
})
