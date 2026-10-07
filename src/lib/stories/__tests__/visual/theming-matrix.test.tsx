import { memo } from 'react'

import { userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { useRowSelectionState } from '../../../../lib/core/createState'
import { useCreateTable } from '../../../../lib/core/useCreateTable'
import type { ColorMode } from '../../../core/themeVariables'
import { DataGrid } from '../../../../lib/grid/DataGrid'
import { rowActions, rowSelection } from '../../../../lib/plugins'
import { useColumns } from '../../__mocks__/columns'
import { useData } from '../../__mocks__/data'

// Матрица темизации: для КАЖДОГО компонента в КАЖДОМ состоянии
// сверяем вычисленный стиль реального DOM-элемента с резолвом его компонент-токена,
// в ОБОИХ режимах (light/dark). Рендерим грид напрямую (не через историю) — так
// проп `colorMode` управляет темой без форсящего декоратора Storybook. global.css
// НЕ подключён → semantic-роли берут наш primitive-дефолт (self-contained путь).

const Grid = memo(({ colorMode }: { colorMode: ColorMode }) => {
  const columns = useColumns(6)
  const { data } = useData({ count: 6, showStub: false })
  const { rowSelection: selection, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: { rowSelection: selection },
    handlers: { onRowSelectionChange },
    plugins: [rowSelection(), rowActions({ width: 40 })],
  })

  return (
    <DataGrid
      table={table as never}
      height={400}
      maxHeight={400}
      colorMode={colorMode}
    />
  )
})
Grid.displayName = 'ThemeMatrixGrid'

/** Резолвит цветовой токен в rgb ровно в контексте темы (та же сериализация,
 * что и у проверяемого элемента, — поэтому color-mix сравнивается без хрупкой
 * математики: обе стороны сериализуются Chromium одинаково). */
const resolveColor = (token: string, dark: boolean): string => {
  const el = document.createElement('div')
  el.className = dark ? 'data-grid-theme dark' : 'data-grid-theme'
  el.style.backgroundColor = `var(${token})`
  document.body.appendChild(el)
  const value = getComputedStyle(el).backgroundColor
  el.remove()
  return value
}

const bg = (el: Element) => getComputedStyle(el).backgroundColor

async function renderGrid(colorMode: ColorMode) {
  const { container } = await render(<Grid colorMode={colorMode} />)
  await expect
    .poll(() => container.querySelector('.data-grid__body-row'))
    .not.toBeNull()
  return container
}

const MODES: ColorMode[] = ['light', 'dark']

// Курсор в браузере переживает тест — `userEvent.hover` из предыдущего теста
// оставил бы указатель над строкой, и следующий (статический) тест поймал бы её
// в hover-состоянии. Паркуем курсор на topmost-элемент в углу перед КАЖДЫМ тестом.
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

describe('Theming matrix — DOM ↔ component token ↔ state', () => {
  describe.each(MODES)('mode=%s', mode => {
    const dark = mode === 'dark'

    test(`TT-01 body row base bg = --tsr-comp-row-bg`, async () => {
      const c = await renderGrid(mode)
      const evenRow = c.querySelector<HTMLElement>(
        ".data-grid__body-row:not([data-row-odd='true'])",
      )!
      // poll: под нагрузкой фон может ещё «досаживаться» на первом кадре.
      await expect
        .poll(() => bg(evenRow), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-row-bg', dark))
    })

    test(`TT-02 odd row bg = --tsr-comp-row-odd-bg`, async () => {
      const c = await renderGrid(mode)
      const oddRow = c.querySelector<HTMLElement>(
        ".data-grid__body-row[data-row-odd='true']",
      )!
      expect(oddRow).not.toBeNull()
      await expect
        .poll(() => bg(oddRow), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-row-odd-bg', dark))
    })

    test(`TT-12 head bg = --tsr-comp-head-bg`, async () => {
      const c = await renderGrid(mode)
      const head = c.querySelector<HTMLElement>('.data-grid__head')!
      await expect
        .poll(() => bg(head), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-head-bg', dark))
    })

    test(`TT-03 row hover bg = --tsr-comp-row-hovered-bg`, async () => {
      const c = await renderGrid(mode)
      // Не первую строку: index 0 перекрыт sticky-шапкой (курсор попал бы в неё).
      // index 2 — чётная (не odd), ниже шапки.
      const row = c.querySelector<HTMLElement>(
        ".data-grid__body-row[data-index='2']",
      )!
      expect(row).not.toBeNull()
      const cell = row.querySelector<HTMLElement>('.data-grid__body-cell')!
      await userEvent.hover(cell)
      await expect
        .poll(() => bg(row), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-row-hovered-bg', dark))
    })

    test(`TT-13 head cell hover bg = --tsr-comp-head-cell-hovered-bg`, async () => {
      const c = await renderGrid(mode)
      const cell = c.querySelector<HTMLElement>(
        ".data-grid__head-cell:not([data-actions-column-cell='true'])",
      )!
      await userEvent.hover(cell)
      await expect
        .poll(() => bg(cell), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-head-cell-hovered-bg', dark))
    })

    test(`TT-04 selected row bg = --tsr-comp-row-selected-bg`, async () => {
      const c = await renderGrid(mode)
      // Клик по чекбоксу «выбрать все» в шапке → все строки выбраны.
      const headCheckbox = c.querySelector<HTMLElement>(
        '.data-grid__head [role="checkbox"], .data-grid__head .checkbox',
      )!
      expect(headCheckbox).not.toBeNull()
      await userEvent.click(headCheckbox)

      const selectedRow = c.querySelector<HTMLElement>(
        ".data-grid__body-row[data-selected='true']:not([data-row-odd='true'])",
      )
      await expect
        .poll(
          () =>
            selectedRow ??
            c.querySelector(".data-grid__body-row[data-selected='true']"),
        )
        .not.toBeNull()
      const row = c.querySelector<HTMLElement>(
        ".data-grid__body-row[data-selected='true']:not([data-row-odd='true'])",
      )!
      // Уводим курсор, чтобы не сработал selected-hovered.
      await userEvent.hover(c.querySelector<HTMLElement>('.data-grid__head')!)
      await expect
        .poll(() => bg(row), { timeout: 5000, interval: 100 })
        .toBe(resolveColor('--tsr-comp-row-selected-bg', dark))
    })
  })

  test('base row bg differs between light and dark (sanity: theme actually flips)', async () => {
    expect(resolveColor('--tsr-comp-row-bg', false)).not.toBe(
      resolveColor('--tsr-comp-row-bg', true),
    )
  })

  test('TT-Z zebra is visible: row-bg ≠ row-odd-bg (token relationship, both modes)', () => {
    // Отношение двух зебра-токенов (видимость зебры) — вотчина темизации; ядро
    // (R16) проверяет только структуру чередования `data-row-odd`.
    for (const dark of [false, true]) {
      expect(resolveColor('--tsr-comp-row-bg', dark)).not.toBe(
        resolveColor('--tsr-comp-row-odd-bg', dark),
      )
    }
  })
})
