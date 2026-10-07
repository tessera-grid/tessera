import { afterEach, describe, expect, test } from 'vitest'

import {
  MODULE,
  contextMenu,
  dataCell,
  gridScroller,
  holdModule,
  releaseModule,
  renderContextMenuGrid,
  rightClick,
} from './lazy-helpers'

// Ожидание загрузки модуля контекстного меню (ADR 0061, LZ8). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.contextMenu))

describe('Контекстное меню — ожидание загрузки', () => {
  test('LZ8: ожидание контекстного меню дольше 150 мс — курсор progress над гридом и aria-busy на гриде; после загрузки они снимаются', async () => {
    await holdModule(MODULE.contextMenu)
    await renderContextMenuGrid()
    const cell = dataCell()
    rightClick(cell)
    expect(gridScroller().getAttribute('aria-busy')).toBeNull()
    await expect
      .poll(() => gridScroller().getAttribute('aria-busy'))
      .toBe('true')
    expect(getComputedStyle(cell).cursor).toBe('progress')
    expect(getComputedStyle(gridScroller()).cursor).toBe('progress')

    await releaseModule(MODULE.contextMenu)
    await expect.poll(contextMenu).not.toBeNull()
    expect(gridScroller().getAttribute('aria-busy')).toBeNull()
    expect(getComputedStyle(cell).cursor).not.toBe('progress')
  })
})
