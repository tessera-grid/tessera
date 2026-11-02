import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { failureShownOn, humanClick, renderGrid } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import {
  MODULE,
  columnHandle,
  failModule,
  handleCell,
  holdModule,
  pageSizeButton,
  releaseModule,
} from './lazy-helpers'

// Доступность новых состояний загрузки (ADR 0061, LZ17): ожидание и вспышка ручки
// перетаскивания и кнопки выбора размера страницы — axe с контрастом в обеих темах.
// Отдельный файл: модули грузятся один раз на документ.

afterEach(async () => {
  await releaseModule(MODULE.pageSize)
  await releaseModule(MODULE.handleMenu)
})

const OPTIONS = {
  ...AXE_OPTIONS,
  rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
}

const passesAxe = (root: Element) =>
  inBothThemes(async () => {
    expect((await axe.run(root, OPTIONS)).violations).toEqual([])
  })

const pagination = () =>
  document.querySelector<HTMLElement>('nav[data-testid="pagination"]')!

describe('Ленивые поповеры — доступность состояний', () => {
  test('LZ17: ожидание и отказ загрузки ручки перетаскивания и кнопки выбора размера страницы проходят axe с color-contrast в светлой и тёмной теме', async () => {
    await holdModule(MODULE.pageSize)
    await holdModule(MODULE.handleMenu)
    renderGrid({
      columnCount: 5,
      dataCount: 60,
      enablePagination: true,
      enableColumnDragging: true,
    })
    await waitForGrid()

    // Ожидание.
    await humanClick(pageSizeButton())
    await expect
      .poll(() => pageSizeButton().getAttribute('aria-busy'))
      .toBe('true')
    await passesAxe(pagination())
    await userEvent.keyboard('{Escape}')

    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect
      .poll(() => columnHandle().getAttribute('aria-busy'))
      .toBe('true')
    await passesAxe(handleCell())
    await userEvent.keyboard('{Escape}')

    // Отказ загрузки: дуга остановилась, отметки нет (ADR 0177, §2).
    await humanClick(pageSizeButton())
    await failModule(MODULE.pageSize)
    await expect
      .poll(() => pageSizeButton().hasAttribute('aria-busy'))
      .toBe(false)
    expect(failureShownOn(pageSizeButton())).toBe(false)
    await passesAxe(pagination())

    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await failModule(MODULE.handleMenu)
    await expect
      .poll(() => columnHandle().hasAttribute('aria-busy'))
      .toBe(false)
    expect(failureShownOn(columnHandle())).toBe(false)
    await passesAxe(handleCell())
  })
})
