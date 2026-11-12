import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  settingsButton,
  settingsPopover,
  holdModule,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Отмена ожидания загрузки (ADR 0061, LZ4). Отдельный файл: модуль грузится один
// раз на документ.

afterEach(() => releaseModule(MODULE.settings))

describe('Ленивые поповеры — отмена ожидания', () => {
  test('LZ4: Escape и уход фокуса с кнопки тулбара отменяют ожидание — после загрузки поповер не открывается', async () => {
    await holdModule(MODULE.settings)
    await renderToolbarGrid()

    await humanClick(settingsButton())
    await expect
      .poll(() => settingsButton().getAttribute('aria-busy'))
      .toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => settingsButton().getAttribute('aria-busy'))
      .toBeNull()

    await humanClick(settingsButton())
    await expect
      .poll(() => settingsButton().getAttribute('aria-busy'))
      .toBe('true')
    settingsButton().blur()
    await expect
      .poll(() => settingsButton().getAttribute('aria-busy'))
      .toBeNull()

    await releaseModule(MODULE.settings)
    await expect
      .poll(() => settingsButton().id.startsWith('base-ui'))
      .toBe(true)
    await sleep(100)
    expect(settingsPopover()).toBeNull()
  })
})
