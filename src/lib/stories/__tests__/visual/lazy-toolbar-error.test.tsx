import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  columnsButton,
  columnsPopover,
  failModule,
  recordAnnouncements,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'
import { tableLabels } from '../labels'

// Ошибка загрузки модуля поповера (ADR 0061, LZ5). Отдельный файл: модуль грузится
// один раз на документ.

afterEach(() => releaseModule(MODULE.columns))

describe('Ленивые поповеры — ошибка загрузки', () => {
  test('LZ5: ошибка загрузки у кнопки тулбара — поповер не открывается, вспышка ошибки, объявление с подписью кнопки; следующий клик снова пытается загрузить', async () => {
    await failModule(MODULE.columns)
    await renderToolbarGrid()
    const announcements = recordAnnouncements()

    await humanClick(columnsButton())
    await expect
      .poll(() => columnsButton().getAttribute('data-error-flash'))
      .toBe('on')
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.columns))
    await sleep(100)
    expect(columnsPopover()).toBeNull()
    expect(columnsButton().getAttribute('aria-busy')).toBeNull()
    // Вспышка держится --tsr-comp-error-flash-duration (300 мс), затем гаснет. Ждём
    // конца затухания: снятие атрибута посреди нажатия убирает `::after`, и Firefox
    // отдаёт отпускание кнопки группе тулбара по прежней раскладке.
    await expect
      .poll(() => columnsButton().hasAttribute('data-error-flash'), {
        timeout: 3000,
      })
      .toBe(false)

    // Следующий клик — новая попытка: снова вспышка, а не мёртвый клик.
    await humanClick(columnsButton())
    await expect
      .poll(() => columnsButton().getAttribute('data-error-flash'))
      .toBe('on')
    announcements.stop()
    expect(
      announcements.messages.filter(
        text => text === tableLabels.loadFailed(tableLabels.columns),
      ).length,
    ).toBeGreaterThanOrEqual(1)
  })
})
