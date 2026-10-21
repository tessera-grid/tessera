import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { LAZY_PENDING_DELAY_MS } from '../../../core/lazyOpening'
import { humanClick, pendingArcOf } from '../helpers'
import {
  MODULE,
  columnsButton,
  columnsPopover,
  holdModule,
  pageSizeButton,
  pageSizeOptions,
  recordAttribute,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Ожидание загрузки модуля на кнопке (ADR 0061, LZ3). Отдельный файл: модуль
// грузится один раз на документ — долгая загрузка у «Колонок», быстрая у размера
// страницы.

afterEach(async () => {
  await releaseModule(MODULE.columns)
  await releaseModule(MODULE.pageSize)
})

describe('Ленивые поповеры — ожидание', () => {
  test('LZ3: загрузка дольше 150 мс — кнопка тулбара в ожидании (aria-busy, блик); быстрая загрузка ожидания не показывает', async () => {
    await holdModule(MODULE.columns)
    await holdModule(MODULE.pageSize)
    await renderToolbarGrid()

    await humanClick(columnsButton())
    expect(columnsButton().getAttribute('aria-busy')).toBeNull()
    await expect
      .poll(() => columnsButton().getAttribute('aria-busy'))
      .toBe('true')
    // Ожидание — дуга по контуру кнопки (ADR 0127).
    expect(pendingArcOf(columnsButton())?.dataset.phase).toBe('pending')
    await releaseModule(MODULE.columns)
    await expect.poll(columnsPopover).not.toBeNull()
    expect(columnsButton().getAttribute('aria-busy')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(columnsPopover).toBeNull()

    const busy = recordAttribute(pageSizeButton, 'aria-busy')
    await humanClick(pageSizeButton())
    await sleep(LAZY_PENDING_DELAY_MS / 3)
    await releaseModule(MODULE.pageSize)
    await expect.poll(pageSizeOptions).toBeGreaterThan(0)
    await sleep(LAZY_PENDING_DELAY_MS)
    busy.stop()
    expect(busy.values).not.toContain('true')
    await userEvent.keyboard('{Escape}')
  })
})
