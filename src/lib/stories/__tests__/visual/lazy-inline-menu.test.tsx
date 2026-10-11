import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick, revealCellButtons } from '../helpers'
import { headCellById, renderColumnPinning } from './column-pinning-helpers'
import { MODULE, holdModule, releaseModule, sleep } from './lazy-helpers'

// Инлайн-кнопка с мини-меню до загрузки своего модуля (ADR 0061, LZ23): закрепление
// колонки, которую можно закрепить с обеих сторон. Отдельный файл: модуль грузится
// один раз на документ.

afterEach(() => releaseModule(MODULE.inlineMenu))

describe('Инлайн-кнопка с мини-меню — загрузка модуля', () => {
  test('LZ23: клик по инлайн-кнопке с мини-меню до загрузки модуля не теряется — меню открывается после загрузки; ожидание видно на кнопке', async () => {
    await holdModule(MODULE.inlineMenu)
    const container = await renderColumnPinning()
    const cell = () => headCellById(container, 'firstName')
    const pin = () => cell().querySelector<HTMLElement>('.column-pin__button')!

    // Клик посреди раскрытия кнопки уходит мимо (ADR 0076).
    await revealCellButtons(cell())
    await humanClick(pin())
    await expect.poll(() => pin().getAttribute('aria-busy')).toBe('true')
    await sleep(50)
    expect(document.querySelector('[role="menu"]')).toBeNull()

    await releaseModule(MODULE.inlineMenu)
    await expect
      .poll(() => document.querySelectorAll('[role="menuitem"]').length)
      .toBeGreaterThan(0)
    expect(pin().getAttribute('aria-busy')).toBeNull()
    await userEvent.keyboard('{Escape}')
  })
})
