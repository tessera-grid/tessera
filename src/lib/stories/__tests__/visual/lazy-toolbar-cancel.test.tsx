import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  columnsButton,
  columnsPopover,
  holdModule,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Отмена ожидания загрузки (ADR 0061, LZ4). Отдельный файл: модуль грузится один
// раз на документ.

afterEach(() => releaseModule(MODULE.columns))

describe('Ленивые поповеры — отмена ожидания', () => {
  test('LZ4: Escape и уход фокуса с кнопки тулбара отменяют ожидание — после загрузки поповер не открывается', async () => {
    await holdModule(MODULE.columns)
    await renderToolbarGrid()

    await humanClick(columnsButton())
    await expect
      .poll(() => columnsButton().getAttribute('aria-busy'))
      .toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => columnsButton().getAttribute('aria-busy'))
      .toBeNull()

    await humanClick(columnsButton())
    await expect
      .poll(() => columnsButton().getAttribute('aria-busy'))
      .toBe('true')
    columnsButton().blur()
    await expect
      .poll(() => columnsButton().getAttribute('aria-busy'))
      .toBeNull()

    await releaseModule(MODULE.columns)
    await expect.poll(() => columnsButton().id.startsWith('base-ui')).toBe(true)
    await sleep(100)
    expect(columnsPopover()).toBeNull()
  })
})
