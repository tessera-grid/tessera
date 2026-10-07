import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  holdModule,
  pageSizeButton,
  pageSizeOptions,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Ожидание загрузки выбора размера страницы (ADR 0061, LZ15). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.pageSize))

const busy = () => pageSizeButton().getAttribute('aria-busy')

describe('Размер страницы — ожидание загрузки', () => {
  test('LZ15: ожидание выбора размера страницы дольше 150 мс — кнопка в ожидании (aria-busy, блик); Escape и уход фокуса отменяют его, список после загрузки не открывается', async () => {
    await holdModule(MODULE.pageSize)
    await renderToolbarGrid()

    await humanClick(pageSizeButton())
    await expect.poll(busy).toBe('true')
    expect(getComputedStyle(pageSizeButton(), '::after').content).not.toBe(
      'none',
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(busy).toBeNull()

    await humanClick(pageSizeButton())
    await expect.poll(busy).toBe('true')
    pageSizeButton().blur()
    await expect.poll(busy).toBeNull()

    await releaseModule(MODULE.pageSize)
    await expect
      .poll(() => document.querySelector('[data-testid="page-size-select"]'))
      .not.toBeNull()
    await sleep(100)
    expect(pageSizeOptions()).toBe(0)
  })
})
