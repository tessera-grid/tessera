import { type ReactNode } from 'react'

import { userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type { ColorMode } from '../../../core/themeVariables'
import { Tooltip } from '../../../ui/Tooltip'
import { LinearProgress } from '../../../ui/LinearProgress'
import { Skeleton } from '../../../ui/Skeleton'
import { SvgIcon } from '../../../ui/icons'
// Компоненты рендерятся без DataGrid — тему подключаем явно.
import '../../../core/themeVariables/theme.css'

// Матрица темизации, этап 4 — загрузка, tooltip, иконки. LinearProgress/Skeleton/
// SvgIcon — обычный standalone-рендер; Tooltip особый: popup уходит в ПОРТАЛ
// (document.body) вне обёртки темы, поэтому popup сам несёт класс `data-grid-theme`
// (иначе токены не резолвятся) — тест это и проверяет через реальное открытие.

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

const MODES: ColorMode[] = ['light', 'dark']

describe('Theming matrix — loading / tooltip / icons (ADR 0019, этап 4)', () => {
  describe.each(MODES)('mode=%s', mode => {
    const dark = mode === 'dark'

    test('TT-33 linear progress track = --tsr-comp-loader-track', async () => {
      const c = await renderThemed(<LinearProgress />, dark)
      const track = c.querySelector('[role="progressbar"]')!
      expect(read(track, 'background-color')).toBe(
        resolveColor('--tsr-comp-loader-track', dark),
      )
    })

    test('TT-33b linear progress bar = --tsr-comp-loader-bar', async () => {
      const c = await renderThemed(<LinearProgress />, dark)
      const bar = c.querySelector('[role="progressbar"] > div')!
      expect(read(bar, 'background-color')).toBe(
        resolveColor('--tsr-comp-loader-bar', dark),
      )
    })

    test('TT-34 skeleton bg = --tsr-comp-skeleton-bg', async () => {
      const c = await renderThemed(
        <Skeleton width={80} height={16} className="skel-probe" />,
        dark,
      )
      const skel = c.querySelector('.skel-probe')!
      expect(read(skel, 'background-color')).toBe(
        resolveColor('--tsr-comp-skeleton-bg', dark),
      )
    })

    test('TT-icon SvgIcon inherits control-color via currentColor', async () => {
      const c = await renderThemed(
        <div style={{ color: 'var(--tsr-comp-control-color)' }}>
          <SvgIcon />
        </div>,
        dark,
      )
      const svg = c.querySelector('svg')!
      // fill=currentColor → вычисленный fill = унаследованный цвет контрола.
      expect(read(svg, 'fill')).toBe(
        resolveColor('--tsr-comp-control-color', dark),
      )
    })
  })

  // Tooltip: popup уходит в портал → сам несёт `data-grid-theme` (инверсная
  // поверхность, всегда light-скоуп). Проверяем на реальном открытии, что popup
  // ТЕМИЗИРОВАН (не прозрачный) и берёт токены tooltip.
  test('TT-tooltip open popup is themed (bg/fg from tooltip tokens, not transparent)', async () => {
    const { getByRole } = await render(
      <div className="data-grid-theme">
        <Tooltip title="hi">
          <button type="button">trigger</button>
        </Tooltip>
      </div>,
    )
    await userEvent.hover(getByRole('button').element())

    // Popup уходит в портал (вне контейнера) и несёт класс `data-grid-theme`
    // (фикс токенизации) + текст подсказки — по ним и находим его.
    const findPopup = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid-theme')].find(el =>
        (el.textContent ?? '').includes('hi'),
      ) ?? null
    await expect.poll(findPopup, { timeout: 5000 }).not.toBeNull()
    const popup = findPopup()!

    const bg = read(popup, 'background-color')
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).toBe(resolveColor('--tsr-comp-tooltip-bg', false))
    expect(read(popup, 'color')).toBe(
      resolveColor('--tsr-comp-tooltip-fg', false),
    )
  })

  test('TT-icon-size SvgIcon default size is 24x24', async () => {
    const c = await renderThemed(<SvgIcon />, false)
    const svg = c.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })
})
