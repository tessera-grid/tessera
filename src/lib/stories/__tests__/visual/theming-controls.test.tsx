import { type ReactNode } from 'react'

import { userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { RowButton } from '../../../grid/Actions/RowButton'
// Контролы рендерятся без DataGrid, поэтому глобальный слой темы подключаем явно
// (иначе токены не определены и сравнения проходят ложно — обе стороны transparent).
import '../../../core/themeVariables/theme.css'
import type { ColorMode } from '../../../core/themeVariables'
import { SelectCheckbox } from '../../../ui/SelectCheckbox/SelectCheckbox'
import { IconButton } from '../../../ui/IconButton'
import { Switch } from '../../../ui/Switch'

// Матрица темизации, этап 2 — форм-контролы. Рендерим каждый контрол напрямую
// внутри обёртки `.data-grid-theme[.dark]`, приводим в состояние пропом/интеракцией
// и сверяем вычисленный стиль с резолвом компонент-токена, в обоих режимах.
// Standalone-рендер надёжнее прогонки через грид: состояния (checked/indeterminate/
// disabled) задаются пропом, а не хрупкой последовательностью кликов.

const themeClass = (dark: boolean) =>
  dark ? 'data-grid-theme dark' : 'data-grid-theme'

/** Резолв цветового токена в контексте темы (та же сериализация, что у элемента). */
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

// Курсор переживает тест — паркуем на topmost-элемент в углу перед каждым тестом,
// иначе hover из прошлого теста «утечёт» в следующий.
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

const MODES: ColorMode[] = ['light', 'dark']

describe('Theming matrix — form controls', () => {
  describe.each(MODES)('mode=%s', mode => {
    const dark = mode === 'dark'

    // --- Checkbox (SelectCheckbox) ---------------------------------------------
    test('TT-22 checkbox base border = --tsr-comp-control-border', async () => {
      const c = await renderThemed(
        <SelectCheckbox selected={false} onClick={() => {}} />,
        dark,
      )
      const cb = c.querySelector('[role="checkbox"]')!
      expect(read(cb, 'border-top-color')).toBe(
        resolveColor('--tsr-comp-control-border', dark),
      )
    })

    test('TT-23 checkbox checked bg = --tsr-comp-checkbox-checked-bg', async () => {
      const c = await renderThemed(
        <SelectCheckbox selected onClick={() => {}} />,
        dark,
      )
      const cb = c.querySelector('[role="checkbox"]')!
      expect(read(cb, 'background-color')).toBe(
        resolveColor('--tsr-comp-checkbox-checked-bg', dark),
      )
    })

    test('TT-23b checkbox indeterminate bg = --tsr-comp-checkbox-checked-bg', async () => {
      const c = await renderThemed(
        <SelectCheckbox selected={false} indeterminate onClick={() => {}} />,
        dark,
      )
      const cb = c.querySelector('[role="checkbox"]')!
      expect(read(cb, 'background-color')).toBe(
        resolveColor('--tsr-comp-checkbox-checked-bg', dark),
      )
    })

    test('TT-25 checkbox hover border = --tsr-comp-control-active-color', async () => {
      const c = await renderThemed(
        <SelectCheckbox selected={false} onClick={() => {}} />,
        dark,
      )
      const cb = c.querySelector<HTMLElement>('[role="checkbox"]')!
      await userEvent.hover(cb)
      await expect
        .poll(() => read(cb, 'border-top-color'), {
          timeout: 5000,
          interval: 100,
        })
        .toBe(resolveColor('--tsr-comp-control-active-color', dark))
    })

    // --- Switch ----------------------------------------------------------------
    test('TT-26 switch off track = --tsr-comp-switch-track-off', async () => {
      const c = await renderThemed(<Switch defaultChecked={false} />, dark)
      const sw = c.querySelector('[role="switch"]')!
      expect(read(sw, 'background-color')).toBe(
        resolveColor('--tsr-comp-switch-track-off', dark),
      )
    })

    test('TT-27 switch on track = --tsr-comp-switch-track-on', async () => {
      const c = await renderThemed(<Switch defaultChecked />, dark)
      const sw = c.querySelector('[role="switch"]')!
      expect(read(sw, 'background-color')).toBe(
        resolveColor('--tsr-comp-switch-track-on', dark),
      )
    })

    test('TT-27t switch thumb = --tsr-comp-switch-thumb', async () => {
      const c = await renderThemed(<Switch defaultChecked />, dark)
      const thumb = c.querySelector('[role="switch"] > *')!
      expect(read(thumb, 'background-color')).toBe(
        resolveColor('--tsr-comp-switch-thumb', dark),
      )
    })

    // --- IconButton ------------------------------------------------------------
    test('TT-32 icon button hover bg = --tsr-comp-control-hover-bg', async () => {
      const c = await renderThemed(
        <IconButton>
          <span>x</span>
        </IconButton>,
        dark,
      )
      const btn = c.querySelector<HTMLElement>('button')!
      await userEvent.hover(btn)
      await expect
        .poll(() => read(btn, 'background-color'), {
          timeout: 5000,
          interval: 100,
        })
        .toBe(resolveColor('--tsr-comp-control-hover-bg', dark))
    })

    // --- Action button (RowButton) --------------------------------------------
    test('TT-29 row action button base color+bg', async () => {
      const c = await renderThemed(
        <RowButton
          label="a"
          icon={<span>i</span>}
          onClick={() => {}}
          revealOnHover={false}
        />,
        dark,
      )
      const btn = c.querySelector<HTMLElement>('button')!
      expect(read(btn, 'color')).toBe(
        resolveColor('--tsr-comp-action-button-color', dark),
      )
      expect(read(btn, 'background-color')).toBe(
        resolveColor('--tsr-comp-action-button-bg', dark),
      )
    })
  })
})
