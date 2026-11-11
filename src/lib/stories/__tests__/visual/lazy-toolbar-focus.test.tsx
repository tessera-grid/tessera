import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { renderGrid, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { headCellById, renderColumnPinning } from './column-pinning-helpers'
import { waitForGrid } from './core-helpers'
import {
  MODULE,
  columnsButton,
  exportButton,
  holdModule,
  releaseModule,
  renderToolbarGrid,
} from './lazy-helpers'

// Фокус клавиатуры на заглушке переживает приход её модуля (ADR 0061, LZ25): кнопки тулбара,
// кебаб заголовка, инлайн-кнопка с мини-меню. Отдельный файл: модуль грузится один раз на
// документ.

afterEach(async () => {
  for (const module of [
    MODULE.columns,
    MODULE.export,
    MODULE.kebab,
    MODULE.inlineMenu,
  ])
    await releaseModule(module)
})

const isTrigger = (el: HTMLElement) =>
  el.hasAttribute('data-base-ui-click-trigger')

/** Фокус на заглушке, модуль приходит: фокус — на сменившем её элементе. */
const keepsFocus = async (
  module: string,
  target: () => HTMLElement,
  focus: () => Promise<void>,
) => {
  const placeholder = target()
  await focus()
  expect(document.activeElement).toBe(placeholder)
  await releaseModule(module)
  await expect.poll(() => target() !== placeholder).toBe(true)
  await expect.poll(() => document.activeElement).toBe(target())
}

describe('Ленивые поповеры — фокус', () => {
  test('LZ25: фокус клавиатуры на заглушке кнопки тулбара, кебаба заголовка или инлайн-кнопки остаётся на ней после загрузки модуля; стрелки тулбара ходят от неё; ушедший фокус не возвращается', async () => {
    // Тулбар: стрелкой с «Колонок» — на заглушку «Экспорта».
    await holdModule(MODULE.columns)
    await holdModule(MODULE.export)
    const toolbar = await renderToolbarGrid()
    expect(isTrigger(exportButton())).toBe(false)
    columnsButton().focus()
    await keepsFocus(MODULE.export, exportButton, () =>
      userEvent.keyboard('{ArrowRight}'),
    )
    expect(isTrigger(exportButton())).toBe(true)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(columnsButton())

    // Заглушка, ушедшая без фокуса, его не забирает.
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(exportButton())
    await releaseModule(MODULE.columns)
    await expect.poll(() => isTrigger(columnsButton())).toBe(true)
    expect(document.activeElement).toBe(exportButton())
    await toolbar.unmount()

    // Кебаб заголовка: фокус и начинает загрузку модуля.
    await holdModule(MODULE.kebab)
    const grid = renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()
    const kebab = () =>
      document.querySelector<HTMLElement>(
        `.data-grid__head-cell[data-column-id] [aria-label="${tableLabels.headerMenu}"]`,
      )!
    await keepsFocus(MODULE.kebab, kebab, async () => kebab().focus())
    await (await grid).unmount()

    // Инлайн-кнопка с мини-меню.
    await holdModule(MODULE.inlineMenu)
    const container = await renderColumnPinning()
    const cell = () => headCellById(container, 'firstName')
    const pin = () => cell().querySelector<HTMLElement>('.column-pin__button')!
    await revealCellButtons(cell())
    await keepsFocus(MODULE.inlineMenu, pin, async () => pin().focus())
  })
})
