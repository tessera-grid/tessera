import { type ReactNode } from 'react'

import { userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type { ColorMode } from '../../../ui/theme'
import { DragHandler } from '../../../grid/dnd/DragHandler'
import { PinButton } from '../../../plugins/columnPinning/PinButton'
import { ResizeHandler } from '../../../plugins/columnSizing/ResizeHandler'
import { SortButton } from '../../../plugins/columnSorting/SortButton'
import { GroupButton } from '../../../plugins/rowGrouping/GroupButton'
import { renderHeaderButtons } from './header-buttons-helpers'
// Контролы рендерятся без DataGrid — тему подключаем явно (иначе токены не заданы).
import '../../../ui/theme/theme.css'

// Матрица темизации, этап 3 — контролы шапки: сортировка/пиннинг/группировка
// (base/active/hover), ресайз и drag (base/disabled). Публичные примитивы `/ui` —
// standalone в обёртке темы, состояние пропом; настоящие кнопки шапки — в гриде,
// включаются мышью. Сверка вычисленного стиля с резолвом токена, light+dark.

const themeClass = (dark: boolean) =>
  dark ? 'data-grid-theme dark' : 'data-grid-theme'

const resolveColor = (token: string, dark: boolean): string => {
  const el = document.createElement('div')
  el.className = themeClass(dark)
  el.style.backgroundColor = `var(${token})`
  document.body.appendChild(el)
  const value = getComputedStyle(el).backgroundColor
  el.remove()
  return value
}

const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

async function renderThemed(node: ReactNode, dark: boolean) {
  const { container } = await render(
    <div className={themeClass(dark)}>{node}</div>,
  )
  return container
}

let park: HTMLElement | null = null
beforeEach(async () => {
  park = document.createElement('div')
  park.style.cssText =
    'position:fixed;top:0;left:0;width:6px;height:6px;z-index:2147483647'
  document.body.appendChild(park)
  await userEvent.hover(park)
})
afterEach(() => {
  park?.remove()
  park = null
})

const noop = () => {}
const MODES: ColorMode[] = ['light', 'dark']

describe('Theming matrix — header controls', () => {
  describe.each(MODES)('mode=%s', mode => {
    const dark = mode === 'dark'

    // --- SortButton ------------------------------------------------------------
    test('TT-16 sort button base color = --tsr-comp-control-color', async () => {
      const c = await renderThemed(
        <SortButton operation={false} nextOperation="asc" onClick={noop} />,
        dark,
      )
      const btn = c.querySelector('.column-sort__button')!
      expect(read(btn, 'color')).toBe(
        resolveColor('--tsr-comp-control-color', dark),
      )
      const grid = await renderHeaderButtons(mode)
      expect(read(grid.button('sort'), 'color')).toBe(
        resolveColor('--tsr-comp-control-color', dark),
      )
    })

    test('TT-17 sort button sorted color = --tsr-comp-control-active-color', async () => {
      const c = await renderThemed(
        <SortButton operation="asc" nextOperation="desc" onClick={noop} />,
        dark,
      )
      const btn = c.querySelector('.column-sort__button')!
      expect(read(btn, 'color')).toBe(
        resolveColor('--tsr-comp-control-active-color', dark),
      )
      const grid = await renderHeaderButtons(mode)
      await grid.activate('sort')
      await expect
        .poll(() => read(grid.button('sort'), 'color'))
        .toBe(resolveColor('--tsr-comp-control-active-color', dark))
    })

    test('TT-18 sort button sorted hover bg = --tsr-comp-control-active-hover-bg', async () => {
      const c = await renderThemed(
        <SortButton operation="asc" nextOperation="desc" onClick={noop} />,
        dark,
      )
      const btn = c.querySelector<HTMLElement>('.column-sort__button')!
      await userEvent.hover(btn)
      await expect
        .poll(() => read(btn, 'background-color'), {
          timeout: 5000,
          interval: 100,
        })
        .toBe(resolveColor('--tsr-comp-control-active-hover-bg', dark))
      // Тултип отдельной кнопки открыт под ней и накрыл бы шапку грида: уводим указатель.
      await userEvent.hover(park!)
      await expect.poll(() => document.querySelector('[data-side]')).toBeNull()
      const grid = await renderHeaderButtons(mode)
      await grid.activate('sort')
      await userEvent.hover(grid.button('sort'))
      await expect
        .poll(() => read(grid.button('sort'), 'background-color'), {
          timeout: 5000,
          interval: 100,
        })
        .toBe(resolveColor('--tsr-comp-control-active-hover-bg', dark))
    })

    // --- PinButton -------------------------------------------------------------
    test('TT-19p pin button pinned color = --tsr-comp-control-active-color', async () => {
      const c = await renderThemed(<PinButton pinned onClick={noop} />, dark)
      const btn = c.querySelector('.column-pin__button')!
      expect(read(btn, 'color')).toBe(
        resolveColor('--tsr-comp-control-active-color', dark),
      )
      const grid = await renderHeaderButtons(mode)
      await grid.activate('pin')
      await expect
        .poll(() => read(grid.button('pin'), 'color'))
        .toBe(resolveColor('--tsr-comp-control-active-color', dark))
    })

    // --- GroupButton -----------------------------------------------------------
    test('TT-19g group button active color = --tsr-comp-control-active-color', async () => {
      const c = await renderThemed(<GroupButton grouped onClick={noop} />, dark)
      const btn = c.querySelector('.column-group__button')!
      expect(read(btn, 'color')).toBe(
        resolveColor('--tsr-comp-control-active-color', dark),
      )
      const grid = await renderHeaderButtons(mode)
      await grid.activate('group')
      await expect
        .poll(() => read(grid.button('group'), 'color'))
        .toBe(resolveColor('--tsr-comp-control-active-color', dark))
    })

    // --- DragHandler -----------------------------------------------------------
    test('TT-20 drag handler base color = --tsr-comp-control-color', async () => {
      const c = await renderThemed(
        <DragHandler id="c" type="column" onClick={noop} />,
        dark,
      )
      const el = c.querySelector('.drag__handler--column')!
      expect(read(el, 'color')).toBe(
        resolveColor('--tsr-comp-control-color', dark),
      )
    })

    test('TT-20d drag handler disabled color = --tsr-comp-control-disabled-color', async () => {
      const c = await renderThemed(
        <DragHandler id="c" type="column" disabled onClick={noop} />,
        dark,
      )
      const el = c.querySelector('.drag__handler--column')!
      expect(read(el, 'color')).toBe(
        resolveColor('--tsr-comp-control-disabled-color', dark),
      )
    })

    // --- ResizeHandler ---------------------------------------------------------
    test('TT-21 resize handler base color = --tsr-comp-control-color', async () => {
      const c = await renderThemed(
        <ResizeHandler
          isResizing={false}
          onResize={noop}
          onResizeEnd={noop}
          onResizeCancel={noop}
          onEscape={noop}
          onResetSize={noop}
          onResizeBy={noop}
          size={150}
          minSize={20}
        />,
        dark,
      )
      const wrapper = c.querySelector('[aria-disabled]')!
      expect(read(wrapper, 'color')).toBe(
        resolveColor('--tsr-comp-control-color', dark),
      )
    })
  })
})
