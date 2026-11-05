import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { useState } from 'react'

import { definePlugin, isSkeletonShown } from '../../../../index'
import { Skeleton } from '../../../../ui'
import type { MenuAction, RowAction } from '../../../core/headerActions'
import { ENGLISH_LABELS } from '../../../core/localization'
import { isSkeletonParentRow } from '../../../core/skeletonOptions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { SKELETON_WAVE_ANIMATION } from '../../../grid/useSkeletonWave'
import { rowActionMenu, rowActions } from '../../../plugins'
import { Stories, getScroller, humanClick } from '../helpers'
import { statusBarDemoPlugins } from '../../statusBarDemo'
import { AXE_OPTIONS } from './a11y-helpers'
import { HANDLE, pointer, slot } from './row-drop-helpers'
import { tableLabels } from '../labels'

// Скелет первой загрузки по раскладке грида (ADR 0060). Скелет и грид после загрузки —
// один экземпляр таблицы: тест переключает `loading` и сравнивает геометрию.
// SL2, SL5, SL6, SL8, SL9 — в `play` историй сценариев скелета.

type Args = Partial<Parameters<typeof Stories.DataGridPlayground>[0]>

const BASE: Args = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 40,
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const SKELETON_ROW = '.data-grid__body-row--skeleton'
const SKELETON_CELL = '.data-grid__body-cell--skeleton'

const skeletonRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>(SKELETON_ROW))
const cellsOf = (row: Element, selector: string) =>
  Array.from(row.querySelectorAll<HTMLElement>(selector))
const headCellsNow = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.data-grid__head-cell'))
/** Полоска или квадрат скелета внутри ячейки. */
const shapeOf = (cell: Element) =>
  cell.querySelector<HTMLElement>('span[style*="width"]')

const box = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { left: Math.round(r.left), width: Math.round(r.width) }
}
const geometry = (cells: HTMLElement[]) =>
  cells.map(cell => ({ id: cell.dataset.columnId, ...box(cell) }))

/** Грид с переключаемым `loading: 'initial'` на одном экземпляре таблицы. */
const renderToggle = async (args: Args, skeleton = true) => {
  const props = (on: boolean) => ({
    ...BASE,
    ...args,
    loading: (on ? 'initial' : false) as 'initial' | false,
  })
  const screen = await render(
    <Stories.DataGridPlayground {...props(skeleton)} />,
  )
  const set = async (on: boolean) => {
    await screen.rerender(<Stories.DataGridPlayground {...props(on)} />)
  }
  return { screen, set }
}

/** Первая строка скелета с квадратом раскрытия. */
const firstParentRow = () =>
  skeletonRows().findIndex((_, index) => isSkeletonParentRow(index))

const waitSkeleton = () =>
  expect.poll(() => skeletonRows().length).toBeGreaterThan(0)
const waitData = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)

/** Действие строки с разделом, чьи пункты ещё не пришли: строки меню — скелеты. */
const pendingSection = definePlugin()({
  id: 'pendingSection',
  slotActions: [
    {
      id: 'move',
      slot: 'actionRowSlot',
      order: 0,
      icon: () => <span aria-hidden>M</span>,
      label: () => 'Move to',
      onSelect: () => {},
      submenu: () => ({
        title: 'Move to',
        items: () => new Promise<MenuAction[]>(() => {}),
      }),
    } satisfies RowAction,
  ],
})

/** Слот автора плагина: число строк — скелетом в первой загрузке, кнопка — как есть. */
const rowsInfo = definePlugin()({
  id: 'rowsInfo',
  slots: [
    {
      id: 'rowsInfo',
      slot: 'statusBarSlot',
      component: ({ table }) => (
        <span data-testid="rows-info">
          {isSkeletonShown(table) ? (
            <Skeleton
              width={64}
              height="var(--tsr-comp-skeleton-text-height)"
            />
          ) : (
            `Rows: ${table.getRowModel().rows.length}`
          )}
          <button type="button">Reload</button>
        </span>
      ),
    },
  ],
})

type SlotGridProps = {
  data: { id: string; name: string }[]
  loading?: 'initial' | 'refresh' | false
  loadError?: unknown
}

const SlotGrid = ({ data, loading, loadError }: SlotGridProps) => {
  // Набор плагинов — договор на время жизни таблицы: стенд его не меняет.
  const [plugins] = useState(() => [rowsInfo()])
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
    loading,
    loadError,
    onRetry: () => {},
  })
  return (
    <div style={{ width: 640, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const MENU_DATA = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))

const PendingMenuGrid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: MENU_DATA,
    getRowId: (row: (typeof MENU_DATA)[number]) => row.id,
    plugins: [
      pendingSection(),
      rowActions(),
      rowActionMenu({ mode: 'always' }),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Скелет первой загрузки (ADR 0060)', () => {
  test('SL1: колонки скелета совпадают с колонками грида — число, порядок и ширина, включая заданную и изменённую пользователем', async () => {
    const { set } = await renderToggle({ enableColumnSizing: true }, false)
    await waitData()

    // Пользователь расширил колонку First Name протяжкой грипа.
    const head = headCellsNow().find(
      cell => cell.dataset.columnId === 'firstName',
    )!
    await userEvent.hover(head)
    const grip = head.querySelector<HTMLElement>('.resize__handler--column')!
    const r = grip.getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y = r.top + r.height / 2
    const mouse = (type: string, target: Element | Document, x: number) =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: type === 'mouseup' ? 0 : 1,
          clientX: x,
          clientY: y,
        }),
      )
    mouse('mousedown', grip, x0)
    await nextFrame()
    mouse('mousemove', document, x0 + 60)
    await nextFrame()
    mouse('mousemove', document, x0 + 60)
    await nextFrame()
    mouse('mouseup', document, x0 + 60)
    await nextFrame()

    const dataRow = document.querySelector('.data-grid__body-row')!
    const loaded = geometry(cellsOf(dataRow, '.data-grid__body-cell'))
    expect(loaded.find(cell => cell.id === 'firstName')!.width).toBe(210)
    // Заданная `size` колонки Country (200) отличается от остальных (150).
    expect(loaded.find(cell => cell.id === 'country')!.width).toBe(200)

    await set(true)
    await waitSkeleton()
    expect(geometry(cellsOf(skeletonRows()[0], SKELETON_CELL))).toEqual(loaded)
  })

  test('SL3: закреплённые колонки скелета остаются на месте при горизонтальной прокрутке', async () => {
    await renderToggle({
      columnCount: 20,
      enableColumnPinning: true,
      initialColumnPinning: { start: ['country'], end: [] },
    })
    await waitSkeleton()
    const cell = (id: string) =>
      cellsOf(skeletonRows()[0]!, SKELETON_CELL).find(
        each => each.dataset.columnId === id,
      )
    expect(cell('country')!.dataset.cellPinned).toBe('left')
    const pinnedBefore = box(cell('country')!).left
    const centerBefore = box(cell('firstName')!).left

    getScroller().scrollLeft = 300
    await nextFrame()
    await nextFrame()
    expect(box(cell('country')!).left).toBe(pinnedBefore)
    expect(cell('country')!.dataset.cellPinned).toBe('left')
    // Незакреплённая колонка уехала вместе с прокруткой.
    const firstName = cell('firstName')
    expect(firstName ? box(firstName).left : -Infinity).toBeLessThan(
      centerBefore,
    )
  })

  test('SL4: шапка скелета — настоящие названия и строки вложенной шапки, без кнопок плагинов; высота как после загрузки', async () => {
    const args: Args = {
      headerNesting: 'nested',
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableColumnFiltering: true,
      enableHeaderActionMenu: true,
    }
    const { set } = await renderToggle(args, false)
    await waitData()
    const head = () => document.querySelector<HTMLElement>('.data-grid__head')!
    const loadedTitles = headCellsNow().map(cell => cell.textContent?.trim())
    const loadedRows = head().querySelectorAll('[role="row"]').length
    const loadedHeight = head().offsetHeight
    expect(loadedRows).toBeGreaterThan(1)
    expect(head().querySelectorAll('button').length).toBeGreaterThan(0)

    await set(true)
    await waitSkeleton()
    expect(headCellsNow().map(cell => cell.textContent?.trim())).toEqual(
      loadedTitles,
    )
    expect(head().querySelectorAll('[role="row"]').length).toBe(loadedRows)
    expect(head().querySelectorAll('button').length).toBe(0)
    expect(head().offsetHeight).toBe(loadedHeight)
  })

  test('SL7: длина полоски своя у каждой колонки (40–90 %) и одинаковая во всех строках колонки', async () => {
    await renderToggle({ columnCount: 8 })
    await waitSkeleton()
    const rows = skeletonRows()
    const ratios = (row: Element) =>
      cellsOf(row, SKELETON_CELL).map(cell => {
        const wrapper = cell.firstElementChild!
        const style = getComputedStyle(wrapper)
        const content =
          wrapper.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight)
        return Math.round(
          (shapeOf(cell)!.getBoundingClientRect().width / content) * 100,
        )
      })
    const first = ratios(rows[0])
    for (const row of rows.slice(1)) {
      expect(ratios(row)).toEqual(first)
    }
    for (const ratio of first) {
      expect(ratio).toBeGreaterThanOrEqual(39)
      expect(ratio).toBeLessThanOrEqual(91)
    }
    expect(new Set(first).size).toBeGreaterThan(1)
  })

  test('SL10: рисуются только видимые колонки; прокрутка вправо показывает следующие', async () => {
    await renderToggle({ columnCount: 200 })
    await waitSkeleton()
    const ids = () =>
      cellsOf(skeletonRows()[0]!, SKELETON_CELL).map(
        cell => cell.dataset.columnId!,
      )
    const before = ids()
    expect(before.length).toBeLessThan(50)
    expect(before.length).toBe(headCellsNow().length)

    const scroller = getScroller()
    scroller.scrollLeft = scroller.scrollWidth
    await expect.poll(() => ids().some(id => !before.includes(id))).toBe(true)
  })

  test('SL11: пагинатор и счётчик выбранного — скелет вместо чисел; кнопки тулбара и свой слот — как обычно', async () => {
    const args: Args = {
      enablePagination: true,
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
      enableColumnVisibility: true,
      // Демо-слоты нижней панели флаг скелета не читают.
      extraPlugins: statusBarDemoPlugins,
    }
    const { set } = await renderToggle(args, false)
    await waitData()
    const demoSlots = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid^="status-bar-demo"]',
        ),
      ).map(el => el.textContent)
    const range = () =>
      document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    const count = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="selected-rows-count"]',
      )!
    const toolbarButtons = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button'),
      ).map(button => [button.textContent, button.disabled])
    // Тулбар — ленивый чанк.
    await expect.poll(() => toolbarButtons().length).toBeGreaterThan(0)
    const loadedButtons = toolbarButtons()
    const loadedDemo = demoSlots()
    expect(range().textContent).toMatch(/\d/)
    expect(loadedDemo.length).toBeGreaterThan(0)

    await set(true)
    await waitSkeleton()
    expect(range().textContent).toBe('')
    expect(shapeOf(range())).toBeTruthy()
    expect(shapeOf(count())).toBeTruthy()
    expect(toolbarButtons()).toEqual(loadedButtons)
    expect(demoSlots()).toEqual(loadedDemo)
  })

  test('SL12: скелет вместе с шапкой скрыт от скринридера, загрузка объявляется статусом; axe чистый в обеих темах', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await render(
        <Stories.DataGridPlayground
          {...BASE}
          loading="initial"
          enableRowSelection
          enableColumnSorting
          colorMode={colorMode}
        />,
      )
      // eslint-disable-next-line no-await-in-loop
      await waitSkeleton()
      const status = Array.from(
        document.querySelectorAll<HTMLElement>('[role="status"]'),
      ).find(el => el.textContent === ENGLISH_LABELS.loading)!
      expect(status).toBeTruthy()
      for (const part of [
        '.data-grid__head--skeleton',
        '.data-grid__body--skeleton',
      ]) {
        const el = document.querySelector<HTMLElement>(part)!
        expect(el.getAttribute('aria-hidden')).toBe('true')
        expect(el.inert).toBe(true)
      }
      expect(
        document.querySelector(
          '[role="table"], [role="grid"], [role="treegrid"]',
        ),
      ).toBeNull()
      // eslint-disable-next-line no-await-in-loop
      const { violations } = await axe.run(status.parentElement!, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(violations, colorMode).toEqual([])
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })

  test('SL16: строк скелета больше видимой части — лишние обрезаны, вертикальной прокрутки нет, место полосы прокрутки держится и при приходе данных колонки не сдвигаются', async () => {
    const { set } = await renderToggle({
      skeletonOptions: { rowsCount: 40 },
      enableRowActions: true,
      enableColumnPinning: true,
    })
    await waitSkeleton()
    expect(skeletonRows()).toHaveLength(40)
    const scroller = getScroller()
    // Строки ниже края есть, но прокручивать нечего.
    const bottom = scroller.getBoundingClientRect().bottom
    expect(skeletonRows().at(-1)!.getBoundingClientRect().top).toBeGreaterThan(
      bottom,
    )
    expect(scroller.scrollHeight).toBe(scroller.clientHeight)
    scroller.scrollTop = 400
    await nextFrame()
    expect(scroller.scrollTop).toBe(0)
    // Место полосы прокрутки — как у грида с данными: правая закреплённая колонка
    // действий и шапка не сдвигаются при приходе строк.
    const gutter = scroller.offsetWidth - scroller.clientWidth
    const head = geometry(headCellsNow())

    await set(false)
    await waitData()
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(scroller.offsetWidth - scroller.clientWidth).toBe(gutter)
    expect(geometry(headCellsNow())).toEqual(head)
  })

  test("SL18: skeletonCell — 'bar' полоска, 'control' квадрат, 'none' пусто; по умолчанию полоска у данных, пусто у служебных, квадрат у выбора и раскрытия; так в первой загрузке и в слоте броска", async () => {
    const columns = [
      { id: 'name', accessorKey: 'firstName', header: 'Name', size: 180 },
      {
        id: 'flag',
        accessorFn: () => 'yes',
        header: 'Flag',
        size: 120,
        skeletonCell: 'control',
      },
      {
        id: 'photo',
        accessorFn: () => 'img',
        header: 'Photo',
        size: 120,
        skeletonCell: 'none',
      },
      {
        id: 'note',
        accessorFn: () => 'n',
        header: 'Note',
        skeletonCell: 'bar',
      },
    ]
    const { set } = await renderToggle({
      columnsOverride: columns as never,
      enableRowSelection: true,
      enableRowExpanding: true,
      rowExpandingColumn: 'always',
      enableRowDragging: true,
      enableRowActions: true,
    })
    await waitSkeleton()
    const control = Number.parseFloat(
      getComputedStyle(getScroller()).getPropertyValue(
        '--tsr-comp-skeleton-control-size',
      ),
    )
    /** Вид ячейки по содержимому: полоска, квадрат или пусто. */
    const kindOf = (cell: HTMLElement) => {
      const shape = cell.querySelector<HTMLElement>('[data-skeleton]')
      if (!shape) return 'none'
      const r = shape.getBoundingClientRect()
      return Math.round(r.width) === control && Math.round(r.height) === control
        ? 'control'
        : 'bar'
    }
    const kinds = (row: Element) =>
      Object.fromEntries(
        Array.from(row.querySelectorAll<HTMLElement>('[data-column-id]')).map(
          cell => [cell.dataset.columnId!, kindOf(cell)],
        ),
      )
    const service = (all: Record<string, string>, part: string) =>
      Object.entries(all).find(([id]) => id.includes(part))![1]

    // Квадрат раскрытия — у строк, которым хэш номера дал подстроки (SL25).
    const firstLoad = kinds(skeletonRows()[firstParentRow()])
    expect(firstLoad).toMatchObject({
      name: 'bar',
      flag: 'control',
      photo: 'none',
      note: 'bar',
    })
    expect(service(firstLoad, 'rowSelection')).toBe('control')
    expect(service(firstLoad, 'rowExpanding')).toBe('control')
    expect(service(firstLoad, 'rowDragging')).toBe('none')
    expect(service(firstLoad, 'rowActions')).toBe('none')

    // Слот броска строки: колонки данных — по тому же признаку, служебные пусты (PV1).
    await set(false)
    await waitData()
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
    )
    // Наведение — на ячейку ручки: середина всей строки может быть за краем окна, и
    // прокрутка к ней увела бы первую колонку из окна виртуализации.
    const handleEl = rows[0].querySelector<HTMLElement>(HANDLE)!
    await userEvent.hover(handleEl.closest('.data-grid__body-cell')!)
    const handle = handleEl.getBoundingClientRect()
    const from = {
      x: handle.left + handle.width / 2,
      y: handle.top + handle.height / 2,
    }
    const over = rows[3].getBoundingClientRect()
    await pointer.realDragHold(from, {
      x: from.x,
      y: over.top + over.height / 2,
    })
    try {
      await expect.poll(() => slot()).not.toBeNull()
      const inSlot = kinds(slot()!)
      expect(inSlot).toMatchObject({
        name: 'bar',
        flag: 'control',
        photo: 'none',
        note: 'bar',
      })
      for (const part of [
        'rowSelection',
        'rowExpanding',
        'rowDragging',
        'rowActions',
      ]) {
        expect(service(inSlot, part), part).toBe('none')
      }
    } finally {
      await pointer.realMouseUp()
    }
  })

  test('SL20: размеры скелетов — из токенов по роли (ячейка, текст панели, строка меню, квадрат, скругление), волна — из токенов движения', async () => {
    const style = document.createElement('style')
    style.textContent = `.data-grid-theme {
      --tsr-comp-skeleton-cell-height: 22px;
      --tsr-comp-skeleton-text-height: 11px;
      --tsr-comp-skeleton-menu-height: 9px;
      --tsr-comp-skeleton-control-size: 20px;
      --tsr-comp-skeleton-radius: 7px;
      --tsr-comp-motion-duration: 300ms;
    }`
    document.head.append(style)
    try {
      const screen = await render(
        <Stories.DataGridPlayground
          {...BASE}
          loading="initial"
          enableRowSelection
          rowSelectionSelectedCount
          enablePagination
        />,
      )
      await waitSkeleton()
      const row = skeletonRows()[0]
      const bar = row.querySelector<HTMLElement>(
        '[data-column-id="firstName"] [data-skeleton]',
      )!
      expect(Math.round(bar.getBoundingClientRect().height)).toBe(22)
      expect(getComputedStyle(bar).borderTopLeftRadius).toBe('7px')
      const square = Array.from(
        row.querySelectorAll<HTMLElement>('[data-column-id]'),
      )
        .find(cell => cell.dataset.columnId!.includes('rowSelection'))!
        .querySelector<HTMLElement>('[data-skeleton]')!
      const sq = square.getBoundingClientRect()
      expect([Math.round(sq.width), Math.round(sq.height)]).toEqual([20, 20])
      for (const id of ['pagination-range', 'selected-rows-count']) {
        const text = document
          .querySelector(`[data-testid="${id}"]`)!
          .querySelector<HTMLElement>('[data-skeleton]')!
        expect(Math.round(text.getBoundingClientRect().height), id).toBe(11)
      }
      // Волна: проход рамки и пауза — от базовой длительности движения (×16 и ×10/3,
      // общая волна рамки, ADR 0121).
      await expect
        .poll(() =>
          document
            .getAnimations()
            .find(
              animation =>
                animation.id === SKELETON_WAVE_ANIMATION &&
                (animation.effect as KeyframeEffect).target === bar,
            ),
        )
        .toBeDefined()
      const wave = document
        .getAnimations()
        .find(
          animation =>
            animation.id === SKELETON_WAVE_ANIMATION &&
            (animation.effect as KeyframeEffect).target === bar,
        )!
        .effect!.getComputedTiming()
      expect(wave.duration).toBe(4800)
      expect(wave.delay).toBe(1000)
      await screen.unmount()

      // Строка меню, пока раздел ждёт пунктов.
      await render(<PendingMenuGrid />)
      const nameCell = () =>
        document.querySelector<HTMLElement>(
          '.data-grid__body-row [data-column-id="name"]',
        )
      await expect.poll(nameCell).not.toBeNull()
      await userEvent.hover(nameCell()!)
      const kebab = () =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row [aria-label^="${tableLabels.rowMenu}"]`,
        )
      await expect.poll(kebab).not.toBeNull()
      await humanClick(kebab()!)
      const moveTo = () =>
        Array.from(
          document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ).find(el => el.textContent?.includes('Move to'))
      await expect.poll(moveTo).toBeTruthy()
      await humanClick(moveTo()!)
      const menuRow = () =>
        document.querySelector<HTMLElement>(
          '[data-menu-skeleton] [data-skeleton]',
        )
      await expect.poll(menuRow).not.toBeNull()
      expect(Math.round(menuRow()!.getBoundingClientRect().height)).toBe(9)
      await userEvent.keyboard('{Escape}')
      await userEvent.keyboard('{Escape}')
    } finally {
      style.remove()
    }
  })

  test("SL21: слот плагина definePlugin при loading 'initial' показывает значения из данных скелетом через isSkeletonShown и Skeleton, контролы не меняет; при 'refresh' и ошибке — без скелета", async () => {
    const info = () =>
      document.querySelector<HTMLElement>('[data-testid="rows-info"]')!
    const shown = () => shapeOf(info()) !== null
    const screen = await render(<SlotGrid data={[]} loading="initial" />)
    await waitSkeleton()
    await expect
      .poll(() => document.querySelector('[data-testid="rows-info"]'))
      .not.toBeNull()
    expect(shown()).toBe(true)
    expect(info().textContent).toBe('Reload')
    expect(info().querySelector('button')!.disabled).toBe(false)

    await screen.rerender(<SlotGrid data={MENU_DATA} />)
    await waitData()
    expect(shown()).toBe(false)
    expect(info().textContent).toBe('Rows: 5Reload')

    await screen.rerender(<SlotGrid data={MENU_DATA} loading="refresh" />)
    expect(shown()).toBe(false)
    expect(info().textContent).toBe('Rows: 5Reload')

    await screen.rerender(
      <SlotGrid data={[]} loading="initial" loadError={new Error('Down')} />,
    )
    await expect
      .poll(() => document.querySelector('[data-empty-stub="loadError"]'))
      .not.toBeNull()
    expect(skeletonRows()).toHaveLength(0)
    expect(shown()).toBe(false)
    expect(info().textContent).toBe('Rows: 0Reload')
  })

  test('SL23: при модели дерева и expanded: true подстроки скелета сдвинуты в колонке отступа на шаг вложенности, строки верхнего уровня — без сдвига; иначе скелет плоский', async () => {
    const barLefts = () =>
      skeletonRows().map(row =>
        Math.round(
          cellsOf(row, SKELETON_CELL)
            .find(cell => cell.dataset.columnId === 'country')!
            .querySelector<HTMLElement>('[data-skeleton]')!
            .getBoundingClientRect().left,
        ),
      )
    const screen = await render(
      <Stories.DataGridPlayground
        {...BASE}
        loading="initial"
        enableRowExpandingModel
        expandAll
      />,
    )
    await waitSkeleton()
    const lefts = barLefts()
    const root = Math.min(...lefts)
    const indent = Number.parseFloat(
      getComputedStyle(getScroller()).getPropertyValue(
        '--tsr-comp-row-nesting-indent',
      ),
    )
    expect(indent).toBeGreaterThan(0)
    const depths = lefts.map(left => Math.round((left - root) / indent))
    expect(new Set(depths)).toEqual(new Set([0, 1]))
    for (const [index, left] of lefts.entries()) {
      expect(left - root, `строка ${index}`).toBeCloseTo(
        depths[index]! * indent,
        0,
      )
    }
    // Подстроки идут сразу за своей строкой верхнего уровня.
    expect(depths[0]).toBe(0)
    await screen.unmount()

    // Модель есть, но дерево придёт свёрнутым — скелет плоский.
    await render(
      <Stories.DataGridPlayground
        {...BASE}
        loading="initial"
        enableRowExpandingModel
      />,
    )
    await waitSkeleton()
    expect(new Set(barLefts()).size).toBe(1)
  })

  test('SL26: смена rowHeight и headerHeight на лету пересчитывает число строк скелета', async () => {
    const props = (extra: Args) => ({
      ...BASE,
      loading: 'initial' as const,
      dataOverride: [],
      ...extra,
    })
    const head = () =>
      document.querySelector<HTMLElement>('.data-grid__head')!.offsetHeight
    const fit = () =>
      Math.ceil(
        (getScroller().clientHeight - head()) / skeletonRows()[0]!.offsetHeight,
      )
    // Шапка задана явно: смена высоты строки её не двигает.
    const screen = await render(
      <Stories.DataGridPlayground {...props({ headerHeight: 60 })} />,
    )
    await waitSkeleton()
    expect(skeletonRows()).toHaveLength(fit())
    const before = skeletonRows().length
    const headBefore = head()

    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ headerHeight: 60, rowHeight: 80 })}
      />,
    )
    await expect.poll(() => skeletonRows()[0]?.offsetHeight).toBe(80)
    expect(head()).toBe(headBefore)
    await expect.poll(() => skeletonRows().length).toBe(fit())
    const tall = skeletonRows().length
    expect(tall).toBeLessThan(before)

    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ headerHeight: 200, rowHeight: 80 })}
      />,
    )
    await expect.poll(head).toBeGreaterThanOrEqual(200)
    await expect.poll(() => skeletonRows().length).toBe(fit())
    expect(skeletonRows().length).toBeLessThan(tall)
  })

  test('SL27: без колонок скелет рисует columnsCount одинаковых колонок; при известных колонках columnsCount не действует', async () => {
    const props = (extra: Args) => ({
      ...BASE,
      loading: 'initial' as const,
      dataOverride: [],
      skeletonOptions: { rowsCount: 'auto' as const, columnsCount: 4 },
      ...extra,
    })
    const cells = () => cellsOf(skeletonRows()[0]!, SKELETON_CELL)
    const screen = await render(
      <Stories.DataGridPlayground {...props({ columnsOverride: [] })} />,
    )
    await waitSkeleton()
    expect(cells()).toHaveLength(4)
    expect(new Set(cells().map(cell => box(cell).width)).size).toBe(1)

    // Колонки пришли — скелет по ним, а не по columnsCount.
    await screen.rerender(<Stories.DataGridPlayground {...props({})} />)
    await expect
      .poll(() => cells().map(cell => cell.dataset.columnId))
      .toEqual(headCellsNow().map(cell => cell.dataset.columnId))
    expect(cells()).toHaveLength(BASE.columnCount!)
  })

  test('SL24: линии дерева у скелета — при treeLines (поворот к подстроке, продолжение ветки к сестре, отросток у родителя), без treeLines линий нет', async () => {
    const props = (treeLines: boolean) => ({
      ...BASE,
      loading: 'initial' as const,
      dataOverride: [],
      expandAll: true,
      enableRowExpanding: true,
      enableTreeLines: treeLines,
    })
    const screen = await render(<Stories.DataGridPlayground {...props(true)} />)
    await waitSkeleton()
    const indentCell = (row: Element) =>
      cellsOf(row, SKELETON_CELL).find(
        cell => cell.dataset.columnId === 'country',
      )!
    const parts = (row: Element) =>
      Array.from(indentCell(row).querySelectorAll('span[class]'))
        .map(part => part.className)
        .filter(name => /elbow|rail|stub/i.test(name))
        .map(name =>
          /joinedElbow/i.test(name)
            ? 'joined'
            : /elbow/i.test(name)
              ? 'elbow'
              : /stub/i.test(name)
                ? 'stub'
                : 'rail',
        )
    const rows = skeletonRows()
    const depth = (row: Element) => indentCell(row).dataset.treeDepth
    const children = rows.filter(row => depth(row) === '1')
    expect(children.length).toBeGreaterThan(1)
    // У подстроки — поворот; у не последней сестры — ещё и продолжение ветки.
    for (const row of children) {
      expect(
        parts(row).some(part => part === 'elbow' || part === 'joined'),
      ).toBe(true)
    }
    expect(children.some(row => parts(row).includes('joined'))).toBe(true)
    // У строки с подстроками — отросток к ним.
    expect(
      rows.some(row => depth(row) === '0' && parts(row).includes('stub')),
    ).toBe(true)

    await screen.rerender(<Stories.DataGridPlayground {...props(false)} />)
    await expect
      .poll(() => skeletonRows().filter(row => depth(row) !== undefined).length)
      .toBe(0)
    expect(skeletonRows().flatMap(parts)).toEqual([])
  })

  test("SL25: колонка раскрытия в скелете зависит от включённости раскрытия строк — при rowExpanding есть и без данных при 'auto', без плагина нет; квадрат у части строк по номеру, при expanded: true — у строк с подстроками; пришло дерево — колонки не сдвигаются; после загрузки — по данным", async () => {
    const props = (extra: Args) => ({
      ...BASE,
      enableRowExpanding: true,
      enableRowSelection: true,
      dataNesting: 'nested' as const,
      expandAll: true,
      ...extra,
    })
    // Первая загрузка как у приложения: данных ещё нет — один и тот же пустой массив.
    const noRows: never[] = []
    const screen = await render(
      <Stories.DataGridPlayground
        {...props({ loading: 'initial', dataOverride: noRows })}
      />,
    )
    await waitSkeleton()
    const expandHead = () =>
      headCellsNow().find(cell =>
        cell.dataset.columnId?.includes('rowExpanding'),
      )
    expect(expandHead()).toBeTruthy()
    // Квадрат раскрытия — у строк с подстроками: у них в колонке отступа отросток
    // нужен не всегда, поэтому родитель — строка, за которой идёт сдвинутая.
    const lefts = skeletonRows().map(row =>
      Math.round(
        cellsOf(row, SKELETON_CELL)
          .find(cell => cell.dataset.columnId === 'country')!
          .querySelector<HTMLElement>('[data-skeleton]')!
          .getBoundingClientRect().left,
      ),
    )
    const root = Math.min(...lefts)
    const squares = skeletonRows().map(
      row =>
        !!cellsOf(row, SKELETON_CELL)
          .find(cell => cell.dataset.columnId?.includes('rowExpanding'))!
          .querySelector('[data-skeleton]'),
    )
    const parents = lefts.map(
      (left, index) =>
        left === root && index + 1 < lefts.length && lefts[index + 1]! > root,
    )
    expect(parents.some(Boolean)).toBe(true)
    expect(squares.slice(0, -1)).toEqual(parents.slice(0, -1))

    // Пустой ответ при тех же данных: загрузка кончилась — колонки нет.
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ loading: false, dataOverride: noRows })}
      />,
    )
    await expect.poll(() => expandHead()).toBeUndefined()
    // Дерево придёт свёрнутым — скелет плоский, но раскрытие включено — колонка есть, квадрат вразброс:
    // у строк, которым хэш номера дал бы подстроки, и так при каждой отрисовке.
    const flat = () =>
      props({
        loading: 'initial',
        dataOverride: noRows,
        expandAll: false,
      })
    await screen.rerender(<Stories.DataGridPlayground {...flat()} />)
    await waitSkeleton()
    await expect.poll(() => expandHead()).toBeTruthy()
    const flatSquares = () =>
      skeletonRows().map(
        row =>
          !!cellsOf(row, SKELETON_CELL)
            .find(cell => cell.dataset.columnId?.includes('rowExpanding'))!
            .querySelector('[data-skeleton]'),
      )
    const scattered = flatSquares()
    expect(scattered).toEqual(scattered.map((_, i) => isSkeletonParentRow(i)))
    expect(new Set(scattered)).toEqual(new Set([true, false]))
    await screen.rerender(
      <Stories.DataGridPlayground {...flat()} rowHeight={52} />,
    )
    await waitSkeleton()
    expect(flatSquares().slice(0, scattered.length)).toEqual(
      scattered.slice(0, flatSquares().length),
    )
    // Раскрытие строк выключено — колонки нет и в скелете.
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({
          loading: 'initial',
          dataOverride: noRows,
          enableRowExpanding: false,
        })}
      />,
    )
    await expect.poll(() => expandHead()).toBeUndefined()
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ loading: 'initial', dataOverride: noRows })}
      />,
    )
    await expect.poll(() => expandHead()).toBeTruthy()
    const head = geometry(headCellsNow())

    // Пришло дерево: колонка раскрытия на месте, остальные не сдвинулись.
    await screen.rerender(
      <Stories.DataGridPlayground {...props({ loading: false })} />,
    )
    await waitData()
    expect(geometry(headCellsNow())).toEqual(head)

    // Пришли плоские данные: колонки раскрытия нет (RE14).
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ loading: false, dataNesting: 'flat' })}
      />,
    )
    await expect.poll(() => expandHead()).toBeUndefined()
  })
})
