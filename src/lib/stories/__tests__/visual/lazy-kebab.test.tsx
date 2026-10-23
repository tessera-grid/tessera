import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick, renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'
import { MODULE, holdModule, releaseModule, sleep } from './lazy-helpers'
import { tableLabels } from '../labels'

// Кебаб заголовка до загрузки своего модуля (ADR 0061, LZ21). Отдельный файл: модуль
// грузится один раз на документ.

afterEach(() => releaseModule(MODULE.kebab))

const head = () =>
  document.querySelector<HTMLElement>('.data-grid__head-cell[data-column-id]')!
const kebab = () =>
  head().querySelector<HTMLElement>(`[aria-label="${tableLabels.headerMenu}"]`)!
const busy = () => kebab().getAttribute('aria-busy')
const menu = () => document.querySelector('[role="menu"]')

describe('Кебаб заголовка — загрузка модуля', () => {
  test('LZ21: клик по кебабу до загрузки модуля меню не теряется — меню открывается после загрузки; ожидание видно на кебабе; Escape и уход фокуса его отменяют', async () => {
    await holdModule(MODULE.kebab)
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()

    await userEvent.hover(head())
    await humanClick(kebab())
    await expect.poll(busy).toBe('true')
    expect(
      kebab().closest('.cell__button')!.getAttribute('data-button-active'),
    ).toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(busy).toBeNull()

    await humanClick(kebab())
    await expect.poll(busy).toBe('true')
    kebab().blur()
    await expect.poll(busy).toBeNull()

    await userEvent.hover(head())
    await humanClick(kebab())
    await expect.poll(busy).toBe('true')
    await sleep(50)
    expect(menu()).toBeNull()
    await releaseModule(MODULE.kebab)
    await expect.poll(menu).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(menu).toBeNull()
  })
})
