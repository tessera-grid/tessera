import { createColumnHelper } from '@tanstack/react-table'

import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { ColorMode } from '../../../core/themeVariables'
import { useCreateTable } from '../../../../lib/core/useCreateTable'
import { DataGrid } from '../../../../lib/grid/DataGrid'
import { OverlayBodyRow } from '../../../../lib/grid/OverlayBodyRow'
import { OverlayHeadCell } from '../../../../lib/grid/OverlayHeadCell'
import '../../../core/themeVariables/theme.css'

// Простые колонки с ПЛОСКИМ `cell` (без подписок на store) — оверлеи рендерятся
// вне провайдеров грида, поэтому мок-ячейки с подпиской тут повисли бы.
const ch = createColumnHelper<any, { a: string; b: string }>()
const simpleColumns = [
  ch.accessor('a', { id: 'a', header: 'A', cell: c => c.getValue() }),
  ch.accessor('b', { id: 'b', header: 'B', cell: c => c.getValue() }),
]
const simpleData = [
  { id: 'r1', a: '1', b: '2' },
  { id: 'r2', a: '3', b: '4' },
]

// Матрица темизации, этап 6 — DnD-оверлеи и «края». Оверлеи живут только во время
// drag → рендерим сами компоненты (`OverlayBodyRow`/`OverlayHeadCell`) с реальными
// cell/header из таблицы, минуя дорогую и хрупкую симуляцию dnd-kit (её ПОВЕДЕНИЕ
// уже в D-тестах; здесь — только сверка стиля с токеном).

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

/** Оверлей строки/колонки уникально помечен opacity 0.95 (--draggable-opacity). */
const byDraggableOpacity = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('*')].find(
    el => getComputedStyle(el).opacity === '0.95',
  )!

const RowOverlayHarness = ({ colorMode }: { colorMode: ColorMode }) => {
  const table = useCreateTable({
    columns: simpleColumns as never,
    data: simpleData,
  }) as any
  const firstCell = table.getRowModel().rows[0].getVisibleCells()[0]
  return (
    <div className={themeClass(colorMode === 'dark')}>
      <OverlayBodyRow firstCell={firstCell} withCount subRowsCount={5} />
    </div>
  )
}

const HeadOverlayHarness = ({ colorMode }: { colorMode: ColorMode }) => {
  const table = useCreateTable({
    columns: simpleColumns as never,
    data: simpleData,
  }) as any
  const header = table.getHeaderGroups()[0].headers[0]
  const { leftHeaderSlot, rightHeaderSlot } = table.getRenderSlots()
  return (
    <div className={themeClass(colorMode === 'dark')}>
      <OverlayHeadCell
        header={header}
        leftHeaderSlot={leftHeaderSlot}
        rightHeaderSlot={rightHeaderSlot}
      />
    </div>
  )
}

const MODES: ColorMode[] = ['light', 'dark']

describe('Theming matrix — DnD overlays & edges', () => {
  describe.each(MODES)('mode=%s', mode => {
    const dark = mode === 'dark'

    test('TT-35 row drag overlay — draggable-cell-bg + opacity + shadow-drag', async () => {
      const { container } = await render(<RowOverlayHarness colorMode={mode} />)
      const overlay = byDraggableOpacity(container)
      expect(read(overlay, 'background-color')).toBe(
        resolveColor('--tsr-comp-draggable-cell-bg', dark),
      )
      expect(read(overlay, 'opacity')).toBe('0.95')
      // Тень drag завязана на --tsr-comp-shadow-color.
      expect(read(overlay, 'box-shadow')).toContain(
        resolveColor('--tsr-comp-shadow-color', dark),
      )
    })

    test('TT-36 drag bubble bg = --tsr-comp-accent', async () => {
      const { container } = await render(<RowOverlayHarness colorMode={mode} />)
      // Bubble — span со счётчиком (subRowsCount=5); в overlay есть и span
      // контента ячейки, поэтому целимся по тексту счётчика.
      const bubble = [...container.querySelectorAll('span')].find(
        s => s.textContent === '5',
      )!
      expect(bubble).toBeTruthy()
      expect(read(bubble, 'background-color')).toBe(
        resolveColor('--tsr-comp-accent', dark),
      )
    })

    test('TT-37 column drag overlay — draggable-cell-bg + shadow-drag', async () => {
      const { container } = await render(
        <HeadOverlayHarness colorMode={mode} />,
      )
      const overlay = byDraggableOpacity(container)
      expect(read(overlay, 'background-color')).toBe(
        resolveColor('--tsr-comp-draggable-cell-bg', dark),
      )
      expect(read(overlay, 'box-shadow')).toContain(
        resolveColor('--tsr-comp-shadow-color', dark),
      )
    })
  })

  // TT-38: облако на недопустимом месте — в тоне ошибки (ADR 0137).
  test('TT-38 invalid drop overlay token is defined and differs from the overlay background in both themes', () => {
    for (const dark of [false, true]) {
      const invalid = resolveColor(
        '--tsr-comp-row-drop-invalid-overlay-bg',
        dark,
      )
      expect(invalid).not.toBe('rgba(0, 0, 0, 0)')
      expect(invalid).not.toBe(
        resolveColor('--tsr-comp-draggable-cell-bg', dark),
      )
    }
  })

  // TT-40: scrollbar thumb — псевдоэлемент ::-webkit-scrollbar-thumb недоступен
  // getComputedStyle, поэтому проверяем инвариант значения: токен определён и
  // флипается light↔dark.
  test('TT-40 scrollbar thumb token is defined and flips light↔dark', () => {
    const light = resolveColor('--tsr-comp-scrollbar-thumb', false)
    const darkV = resolveColor('--tsr-comp-scrollbar-thumb', true)
    expect(light).not.toBe('rgba(0, 0, 0, 0)')
    expect(light).not.toBe(darkV)
  })

  // TT-41: угол, где сходятся полосы прокрутки, — пустая область контейнера, как и
  // дорожки: без своего правила Chromium закрашивает его белым квадратом. Headless
  // Chromium тестов полосы прячет, а псевдоэлементы недоступны getComputedStyle (как
  // TT-40), поэтому сверяем правила загруженных таблиц стилей.
  test('TT-41 scrollbar corner of the grid container is transparent like the tracks', async () => {
    const Grid = () => {
      const table = useCreateTable({
        columns: simpleColumns as never,
        data: simpleData,
      })
      return <DataGrid table={table as never} height={200} />
    }
    await render(<Grid />)
    const container = await expect
      .poll(() => document.querySelector<HTMLElement>('.data-grid__container'))
      .not.toBeNull()
      .then(() => document.querySelector<HTMLElement>('.data-grid__container')!)
    const pseudoBackground = (pseudo: string) =>
      [...document.styleSheets]
        .flatMap(sheet => {
          try {
            return [...sheet.cssRules]
          } catch {
            return []
          }
        })
        .filter(
          (rule): rule is CSSStyleRule =>
            rule instanceof CSSStyleRule &&
            rule.selectorText.endsWith(pseudo) &&
            container.matches(rule.selectorText.slice(0, -pseudo.length)),
        )
        .map(rule => rule.style.backgroundColor || rule.style.background)
    const transparent = (value: string) =>
      value === 'transparent' || value === 'rgba(0, 0, 0, 0)'
    expect(
      pseudoBackground('::-webkit-scrollbar-track').some(transparent),
    ).toBe(true)
    expect(
      pseudoBackground('::-webkit-scrollbar-corner').some(transparent),
    ).toBe(true)
  })
})
