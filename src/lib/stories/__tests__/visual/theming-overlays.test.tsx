import { createColumnHelper } from '@tanstack/react-table'

import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { ColorMode } from '../../../core/themeVariables'
import { useCreateTable } from '../../../core/createTable'
import { OverlayBodyRow } from '../../../grid/BodyRow/OverlayBodyRow'
import { OverlayHeadCell } from '../../../grid/HeadCell/OverlayHeadCell'
import { getRowDraggableStyles } from '../../../plugins/rowDragging/getRowDraggableStyles'
import '../../../core/themeVariables/theme.css'

// Простые колонки с ПЛОСКИМ `cell` (без useSubscribeStore) — оверлеи рендерятся
// вне провайдеров грида, поэтому мок-ячейки с подпиской тут повисли бы.
const ch = createColumnHelper<{ a: string; b: string }>()
const simpleColumns = [
  ch.accessor('a', { id: 'a', header: 'A', cell: c => c.getValue() }),
  ch.accessor('b', { id: 'b', header: 'B', cell: c => c.getValue() }),
]
const simpleData = [
  { a: '1', b: '2' },
  { a: '3', b: '4' },
]

// Матрица темизации, этап 6 — DnD-оверлеи и «края». Оверлеи живут только во время
// drag → рендерим сами компоненты (`OverlayBodyRow`/`OverlayHeadCell`) с реальными
// cell/header из таблицы, минуя дорогую и хрупкую симуляцию dnd-kit (её ПОВЕДЕНИЕ
// уже в D-тестах; здесь — только сверка стиля с токеном, ADR 0009 R-B1/R-B3).

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
  const table = useCreateTable({ columns: simpleColumns, data: simpleData })
  const firstCell = table.getRowModel().rows[0].getVisibleCells()[0]
  return (
    <div className={themeClass(colorMode === 'dark')}>
      <OverlayBodyRow firstCell={firstCell} withCount subRowsCount={5} />
    </div>
  )
}

const HeadOverlayHarness = ({ colorMode }: { colorMode: ColorMode }) => {
  const table = useCreateTable({ columns: simpleColumns, data: simpleData })
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

describe('Theming matrix — DnD overlays & edges (ADR 0019, этап 6)', () => {
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

  // TT-38: accept/reject — чистая функция стилей строки при drag-over.
  test('TT-38 getRowDraggableStyles maps acceptable → accept/reject token', () => {
    const accept = getRowDraggableStyles({
      activeId: 'r1',
      acceptable: true,
      offsetLeft: 0,
    })
    const reject = getRowDraggableStyles({
      activeId: 'r1',
      acceptable: false,
      offsetLeft: 0,
    })
    expect(accept['--draggable-row-background-color']).toBe(
      'var(--tsr-comp-row-accept-draggable-bg)',
    )
    expect(reject['--draggable-row-background-color']).toBe(
      'var(--tsr-comp-row-not-accept-draggable-bg)',
    )
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
})
