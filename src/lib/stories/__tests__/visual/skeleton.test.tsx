import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { DEFAULT_LABELS } from '../../../core/localization'
import { Stories, getScroller } from '../helpers'
import { statusBarDemoPlugins } from '../../statusBarDemo'
import { AXE_OPTIONS } from './a11y-helpers'
import { PIN_BUTTON } from './column-pinning-helpers'

// SL1–SL12: скелет первой загрузки по раскладке грида (ADR 0060). Скелет и грид
// после загрузки — один экземпляр таблицы: тест переключает `enableSkeleton` и
// сравнивает геометрию.

type Args = Partial<Parameters<typeof Stories.AllFeatures>[0]>

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

/** Грид с переключаемым `enableSkeleton` на одном экземпляре таблицы. */
const renderToggle = async (args: Args, skeleton = true) => {
  const props = (on: boolean) => ({ ...BASE, ...args, enableSkeleton: on })
  const screen = await render(<Stories.AllFeatures {...props(skeleton)} />)
  const set = async (on: boolean) => {
    await screen.rerender(<Stories.AllFeatures {...props(on)} />)
  }
  return { screen, set }
}

const waitSkeleton = () =>
  expect.poll(() => skeletonRows().length).toBeGreaterThan(0)
const waitData = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)

describe('Скелет первой загрузки (ADR 0060)', () => {
  test('SL1: колонки скелета совпадают с колонками грида — число, порядок и ширина, включая заданную и изменённую пользователем', async () => {
    const { set } = await renderToggle({ enableColumnResizing: true }, false)
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

  test('SL2: служебные колонки на своих местах и ширинах — выбор и раскрытие квадратом, ручка и действия пустые', async () => {
    const args: Args = {
      enableRowSelection: true,
      enableRowExpanding: true,
      rowExpandingColumn: 'always',
      enableRowDragging: true,
      enableRowActions: true,
    }
    const { set } = await renderToggle(args, false)
    await waitData()
    const dataRow = document.querySelector('.data-grid__body-row')!
    const loaded = geometry(cellsOf(dataRow, '.data-grid__body-cell'))

    await set(true)
    await waitSkeleton()
    const cells = cellsOf(skeletonRows()[0], SKELETON_CELL)
    expect(geometry(cells)).toEqual(loaded)

    const byId = (part: string) =>
      cells.find(cell => cell.dataset.columnId?.includes(part))!
    for (const control of ['rowSelection', 'rowExpanding']) {
      const shape = shapeOf(byId(control))!
      expect(box(shape).width).toBe(16)
      expect(Math.round(shape.getBoundingClientRect().height)).toBe(16)
    }
    for (const empty of ['rowDragging', 'rowActions']) {
      expect(shapeOf(byId(empty))).toBeNull()
    }
  })

  test('SL3: закреплённые колонки скелета остаются на месте при горизонтальной прокрутке', async () => {
    const { set } = await renderToggle(
      { columnCount: 20, enableColumnPinning: true },
      false,
    )
    await waitData()
    const countryHead = () =>
      headCellsNow().find(cell => cell.dataset.columnId === 'country')!
    countryHead().querySelector<HTMLElement>(PIN_BUTTON)!.click()
    await expect.poll(() => countryHead().dataset.cellPinned).toBe('left')

    await set(true)
    await waitSkeleton()
    const cell = (id: string) =>
      cellsOf(skeletonRows()[0], SKELETON_CELL).find(
        c => c.dataset.columnId === id,
      )!
    const pinnedBefore = box(cell('country')).left
    const centerBefore = box(cell('firstName')).left

    getScroller().scrollLeft = 300
    await nextFrame()
    await nextFrame()
    expect(box(cell('country')).left).toBe(pinnedBefore)
    expect(cell('country').dataset.cellPinned).toBe('left')
    // Незакреплённая колонка уехала вместе с прокруткой.
    expect(cellsOf(skeletonRows()[0], SKELETON_CELL).length).toBeGreaterThan(1)
    const firstName = cellsOf(skeletonRows()[0], SKELETON_CELL).find(
      c => c.dataset.columnId === 'firstName',
    )
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

  test('SL5: строк — сколько помещается по высоте; с пагинацией — не больше страницы; число в rowsCount переопределяет', async () => {
    const fit = await render(<Stories.AllFeatures {...BASE} enableSkeleton />)
    await waitSkeleton()
    const scroller = getScroller()
    const headHeight =
      document.querySelector<HTMLElement>('.data-grid__head')!.offsetHeight
    const rowHeight = skeletonRows()[0].offsetHeight
    const expected = Math.ceil((scroller.clientHeight - headHeight) / rowHeight)
    expect(skeletonRows().length).toBe(expected)
    // Строки заполняют область до низа.
    const lastRow = skeletonRows().at(-1)!.getBoundingClientRect()
    expect(lastRow.bottom).toBeGreaterThanOrEqual(
      scroller.getBoundingClientRect().top + scroller.clientHeight - 1,
    )
    await fit.unmount()

    const paged = await render(
      <Stories.AllFeatures
        {...BASE}
        enableSkeleton
        enablePagination
        paginationPageSize={5}
      />,
    )
    await waitSkeleton()
    expect(skeletonRows().length).toBe(5)
    await paged.unmount()

    await render(
      <Stories.AllFeatures
        {...BASE}
        enableSkeleton
        skeletonOptions={{ rowsCount: 3 }}
      />,
    )
    await waitSkeleton()
    expect(skeletonRows().length).toBe(3)
  })

  test('SL6: смена скелета на данные без задержки и без сдвига шапки и колонок', async () => {
    const { set } = await renderToggle({ enableRowSelection: true })
    await waitSkeleton()
    const headBefore = geometry(headCellsNow())
    const columnsBefore = geometry(cellsOf(skeletonRows()[0], SKELETON_CELL))

    await set(false)
    // Без ожидания: скелет снят в том же рендере.
    expect(skeletonRows().length).toBe(0)
    const dataRow = document.querySelector('.data-grid__body-row')!
    expect(dataRow).toBeTruthy()
    expect(geometry(headCellsNow())).toEqual(headBefore)
    expect(geometry(cellsOf(dataRow, '.data-grid__body-cell'))).toEqual(
      columnsBefore,
    )
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

  test('SL8: при enableFooter футер — ячейки-скелеты в колонках, где задан footer', async () => {
    const { set } = await renderToggle(
      { enableFooter: true, enableRowSelection: true, columnCount: 8 },
      false,
    )
    await waitData()
    const footer = Array.from(
      document.querySelectorAll<HTMLElement>('.data-grid__footer-cell'),
    )
    // Колонки, где задан footer, — те, у которых в футере после загрузки есть текст.
    const withFooter = new Set(
      footer
        .filter(cell => cell.textContent?.trim())
        .map(cell => cell.dataset.columnId!),
    )
    expect(withFooter.size).toBeGreaterThan(0)
    const loaded = geometry(footer)

    await set(true)
    await waitSkeleton()
    const cells = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.data-grid__footer-cell--skeleton',
      ),
    )
    expect(geometry(cells)).toEqual(loaded)
    for (const cell of cells) {
      expect(!!shapeOf(cell), cell.dataset.columnId).toBe(
        withFooter.has(cell.dataset.columnId!),
      )
    }
  })

  test('SL9: без колонок скелет рисует columnsCount одинаковых колонок, по умолчанию 8', async () => {
    const empty = await render(
      <Stories.AllFeatures {...BASE} enableSkeleton columnsOverride={[]} />,
    )
    await waitSkeleton()
    const widths = () =>
      cellsOf(skeletonRows()[0], SKELETON_CELL).map(cell => box(cell).width)
    expect(widths()).toHaveLength(8)
    expect(new Set(widths()).size).toBe(1)
    await empty.unmount()

    await render(
      <Stories.AllFeatures
        {...BASE}
        enableSkeleton
        columnsOverride={[]}
        skeletonOptions={{ columnsCount: 3 }}
      />,
    )
    await waitSkeleton()
    expect(widths()).toHaveLength(3)
  })

  test('SL10: рисуются только видимые колонки; прокрутка вправо показывает следующие', async () => {
    await renderToggle({ columnCount: 200 })
    await waitSkeleton()
    const ids = () =>
      cellsOf(skeletonRows()[0], SKELETON_CELL).map(
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
      showSelectedCount: true,
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
        <Stories.AllFeatures
          {...BASE}
          enableSkeleton
          enableRowSelection
          enableColumnSorting
          colorMode={colorMode}
        />,
      )
      // eslint-disable-next-line no-await-in-loop
      await waitSkeleton()
      const status = Array.from(
        document.querySelectorAll<HTMLElement>('[role="status"]'),
      ).find(el => el.textContent === DEFAULT_LABELS.loading)!
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
})
