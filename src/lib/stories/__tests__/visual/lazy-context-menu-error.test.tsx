import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  contextMenu,
  dataCell,
  failModule,
  recordAnnouncements,
  releaseModule,
  renderContextMenuGrid,
  rightClick,
  sleep,
} from './lazy-helpers'
import { tableLabels } from '../labels'
import { contextMenuLabels } from '../../../plugins/contextMenu/labels'

// Ошибка загрузки модуля контекстного меню (ADR 0061, LZ10). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

const MESSAGE = tableLabels.loadFailed(
  contextMenuLabels(tableLabels).contextMenu,
)

describe('Контекстное меню — ошибка загрузки', () => {
  test('LZ10: ошибка загрузки контекстного меню — меню не открывается, объявление с подписью меню; следующий правый клик снова отвечает', async () => {
    await failModule(MODULE.contextMenu)
    await renderContextMenuGrid()
    const announcements = recordAnnouncements()

    rightClick(dataCell())
    await expect
      .poll(() => announcements.messages, { timeout: 3000 })
      .toContain(MESSAGE)
    await sleep(100)
    expect(contextMenu()).toBeNull()

    const before = announcements.messages.length
    rightClick(dataCell(1))
    await expect
      .poll(() => announcements.messages.slice(before))
      .toContain(MESSAGE)
    announcements.stop()
    expect(contextMenu()).toBeNull()
  })
})
