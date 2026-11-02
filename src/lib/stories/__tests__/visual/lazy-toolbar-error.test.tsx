import { afterEach, describe, expect, test } from 'vitest'

import { failureShownOn, humanClick } from '../helpers'
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
  test('LZ5: ошибка загрузки у кнопки тулбара — поповер не открывается, объявление с подписью кнопки, отметки на кнопке нет; следующий клик снова пытается загрузить', async () => {
    await failModule(MODULE.columns)
    await renderToolbarGrid()
    const announcements = recordAnnouncements()

    await humanClick(columnsButton())
    await expect
      .poll(() => announcements.messages)
      .toContain(tableLabels.loadFailed(tableLabels.columns))
    expect(failureShownOn(columnsButton())).toBe(false)
    await sleep(100)
    expect(columnsPopover()).toBeNull()
    expect(columnsButton().getAttribute('aria-busy')).toBeNull()

    // Следующий клик — новая попытка, а не мёртвый клик: модуль снова грузится, отказ
    // объявляется ещё раз.
    await humanClick(columnsButton())
    await expect
      .poll(
        () =>
          announcements.messages.filter(
            text => text === tableLabels.loadFailed(tableLabels.columns),
          ).length,
      )
      .toBeGreaterThanOrEqual(2)
    expect(failureShownOn(columnsButton())).toBe(false)
    announcements.stop()
  })
})
