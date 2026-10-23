import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { makeData } from '../../__mocks__/data'
import { getScroller, renderGrid } from '../helpers'
import { composed } from '../stories'

// Высота строк и шапки, ширина колонок по умолчанию (ADR 0077, RH1–RH6, CW2).

/** Колонки без своего size и одна со своим — ширина из defaultColumn (CW2). */
const DEFAULT_COLUMN_WIDTH = {
  defaultColumn: { size: 220 },
  columnsOverride: [
    { id: 'name', accessorKey: 'name', header: 'Name' },
    { id: 'company', accessorKey: 'company', header: 'Company' },
    { id: 'city', accessorKey: 'city', header: 'City (size: 100)', size: 100 },
  ],
  dataOverride: [
    { id: '1', name: 'Ann', company: 'Acme', city: 'Oslo' },
    { id: '2', name: 'Bob', company: 'Globex', city: 'Rome' },
  ],
  enableColumnSizing: true,
}

const BODY_ROW = '.data-grid__body-row'
const HEAD = '.data-grid__head'
const HEAD_CELL = ".data-grid__head-cell[data-actions-column-cell='false']"

const heightOf = (element: Element) =>
  Math.round(element.getBoundingClientRect().height)

const rows = () => [...document.querySelectorAll<HTMLElement>(BODY_ROW)]

const cssVar = (name: string) =>
  getComputedStyle(getScroller()).getPropertyValue(name).trim()

const waitForRows = () => expect.poll(() => rows().length).toBeGreaterThan(3)

let injected: HTMLStyleElement | undefined
afterEach(() => {
  injected?.remove()
  injected = undefined
})

describe('Высота строк и шапки, ширина колонок по умолчанию', () => {
  test('RH1: rowHeight задаёт высоту строк тела, футера и скелета; без него — 50px', async () => {
    const view = await render(
      <composed.SizingPlayground rowHeight={60} enableFooter />,
    )
    await waitForRows()
    expect(new Set(rows().map(heightOf))).toEqual(new Set([60]))
    expect(heightOf(document.querySelector('.data-grid__footer')!)).toBe(60)
    await view.unmount()

    const skeleton = await render(
      <composed.SizingPlayground rowHeight={60} loading="initial" />,
    )
    await expect
      .poll(
        () =>
          document.querySelectorAll('.data-grid__body-row--skeleton').length,
      )
      .toBeGreaterThan(3)
    for (const row of document.querySelectorAll(
      '.data-grid__body-row--skeleton',
    )) {
      expect(heightOf(row)).toBe(60)
    }
    await skeleton.unmount()

    await render(
      <composed.SizingPlayground rowHeight={undefined} enableFooter />,
    )
    await waitForRows()
    expect(new Set(rows().map(heightOf))).toEqual(new Set([50]))
    expect(heightOf(document.querySelector('.data-grid__footer')!)).toBe(50)
  })

  test('RH2: headerHeight задаёт высоту каждой строки шапки и --tsr-comp-head-height; без него — как rowHeight', async () => {
    const view = await render(
      <composed.SizingPlayground
        rowHeight={44}
        headerHeight={72}
        headerNesting="nested"
      />,
    )
    await waitForRows()
    // Вложенная шапка мока: Info → More Info → Age — три строки.
    const depth = 3
    expect(cssVar('--tsr-comp-head-height')).toBe(`${depth * 72 + depth}px`)
    // Разделители — только между строками шапки.
    expect(heightOf(document.querySelector(HEAD)!)).toBe(depth * 72 + depth - 1)
    expect(new Set(rows().map(heightOf))).toEqual(new Set([44]))
    await view.unmount()

    await render(<composed.SizingPlayground rowHeight={60} />)
    await waitForRows()
    expect(cssVar('--tsr-comp-head-height')).toBe('61px')
    for (const cell of document.querySelectorAll(HEAD_CELL)) {
      expect(heightOf(cell)).toBe(60)
    }
  })

  test('RH3: токены высоты в CSS темы без пропов дают ту же высоту строк, шапки и оценки виртуализатора', async () => {
    injected = document.createElement('style')
    injected.textContent =
      '.data-grid-theme.data-grid-theme { --tsr-comp-row-height: 60px; --tsr-comp-head-row-height: 70px; }'
    document.head.append(injected)
    const data = makeData({ shape: 'flat', count: 1000 })
    await renderGrid({ columnCount: 4, dataOverride: data })
    await waitForRows()

    expect(new Set(rows().map(heightOf))).toEqual(new Set([60]))
    expect(heightOf(document.querySelector(HEAD)!)).toBe(70)
    expect(cssVar('--tsr-comp-head-height')).toBe('71px')
    expect(cssVar('--tsr-comp-body-height')).toBe(`${1000 * 60}px`)
  })

  test('RH4: полная высота тела на 100 000 строк верна с первого кадра и не меняется после замера строк', async () => {
    const data = makeData({ shape: 'flat', count: 100_000 })
    await renderGrid({ columnCount: 5, dataOverride: data, rowHeight: 60 })
    const expected = `${100_000 * 60}px`
    await expect.poll(() => rows().length).toBeGreaterThan(0)
    expect(cssVar('--tsr-comp-body-height')).toBe(expected)

    getScroller().scrollTop = 3_000_000
    await expect
      .poll(() => Number(rows()[0]?.getAttribute('data-index')))
      .toBeGreaterThan(1000)
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(cssVar('--tsr-comp-body-height')).toBe(expected)
  })

  test('RH5: смена высоты на лету не пересоздаёт таблицу, перерисовывает строки и шапку, полная высота пересчитана, пустых полос нет', async () => {
    const view = await render(
      <composed.SizingPlayground
        rowHeight={50}
        dataNesting="flat"
        dataCount={200}
      />,
    )
    await waitForRows()
    const scroller = getScroller()

    await view.rerender(
      <composed.SizingPlayground
        rowHeight={70}
        dataNesting="flat"
        dataCount={200}
      />,
    )
    await expect
      .poll(() => new Set(rows().map(heightOf)))
      .toEqual(new Set([70]))
    expect(getScroller()).toBe(scroller)
    expect(cssVar('--tsr-comp-body-height')).toBe(`${200 * 70}px`)
    expect(cssVar('--tsr-comp-head-height')).toBe('71px')

    const bottom =
      scroller.getBoundingClientRect().top +
      scroller.clientTop +
      scroller.clientHeight
    const lastBottom = Math.max(
      ...rows().map(row => row.getBoundingClientRect().bottom),
    )
    expect(lastBottom).toBeGreaterThanOrEqual(bottom)
  })

  test('RH6: PageUp/PageDown листают на число строк новой высоты', async () => {
    await render(<composed.KeyboardPlayground rowHeight={80} />)
    await waitForRows()
    const cell = document.querySelector<HTMLElement>(
      `${BODY_ROW}[data-index='0'] .data-grid__body-cell[data-kn-cell][data-actions-column-cell='false']`,
    )!
    await userEvent.click(cell)
    await expect.poll(() => document.activeElement).toBe(cell)
    const scroller = getScroller()
    const top = document.querySelector(HEAD)!.getBoundingClientRect().bottom
    const bottom =
      scroller.getBoundingClientRect().top +
      scroller.clientTop +
      scroller.clientHeight
    const pageRows = Math.floor((bottom - top) / 80)

    await userEvent.keyboard('{PageDown}')
    await expect
      .poll(() =>
        Number(
          document.activeElement?.closest(BODY_ROW)?.getAttribute('data-index'),
        ),
      )
      .toBe(pageRows)
    await userEvent.keyboard('{PageUp}')
    await expect
      .poll(() =>
        Number(
          document.activeElement?.closest(BODY_ROW)?.getAttribute('data-index'),
        ),
      )
      .toBe(0)
  })

  test('RH9: при наименьшей высоте со всеми плагинами, раскрытой строкой и ячейкой в правке содержимое умещается без прокрутки, кнопки с контуром фокуса — в границах ячейки', async () => {
    await render(
      <composed.DataGridPlayground
        rowHeight={40}
        headerHeight={36}
        enableRowSelection
        enableRowExpanding
        enableRowDragging
        enableRowActions
        enableColumnSorting
        enableColumnPinning
        enableColumnSizing
        enableColumnDragging
        enableHeaderActionMenu
        enableCellEditing
        cellEditingCanEditCell={() => true}
        enableRowGrouping
        enableColumnFiltering
        enableFooter
        enableKeyboardNavigation
      />,
    )
    await expect
      .poll(() => document.querySelectorAll('.row-expand-button').length)
      .toBeGreaterThan(0)

    // Раскрытая строка: дети с отступом вложенности.
    await userEvent.click(document.querySelector('.row-expand-button')!)
    await expect
      .poll(() =>
        document.querySelector('.row-expand-button[aria-expanded="true"]'),
      )
      .not.toBeNull()
    // Ячейка в правке: поле ввода вместо текста.
    const editable = document.querySelector<HTMLElement>(
      `${BODY_ROW} .data-grid__body-cell[data-column-id='firstName']`,
    )!
    await userEvent.hover(editable)
    await userEvent.click(editable.querySelector('.cell__button button')!)
    await expect.poll(() => editable.querySelector('input')).not.toBeNull()

    const ring = parseFloat(
      getComputedStyle(getScroller()).getPropertyValue(
        '--tsr-comp-focus-ring-width',
      ),
    )
    const cells = [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__head-cell, .data-grid__body-cell, .data-grid__footer [data-column-id]',
      ),
    ]
    expect(cells.length).toBeGreaterThan(10)
    const overflowing: string[] = []
    const clipped: string[] = []
    for (const cell of cells) {
      const where = `${cell.className.split(' ')[0]}[${cell.getAttribute('data-column-id')}]`
      for (const box of [
        cell,
        ...cell.querySelectorAll<HTMLElement>(
          '.data-grid__cell-wrapper-content',
        ),
      ]) {
        if (box.scrollHeight > box.clientHeight) {
          overflowing.push(`${where} ${box.scrollHeight}>${box.clientHeight}`)
        }
      }
      const { top, bottom } = cell.getBoundingClientRect()
      for (const button of cell.querySelectorAll('button')) {
        const rect = button.getBoundingClientRect()
        if (rect.height === 0) continue
        if (rect.top - ring < top - 0.5 || rect.bottom + ring > bottom + 0.5) {
          clipped.push(`${where} ${button.className.split(' ')[0]}`)
        }
      }
    }
    expect(overflowing).toEqual([])
    expect(clipped).toEqual([])
  })

  test('CW2: колонки без своего size получают defaultColumn.size, со своим — свой; size меньше прежнего минимума соблюдается', async () => {
    await render(<composed.SizingPlayground {...DEFAULT_COLUMN_WIDTH} />)
    await expect.poll(() => document.querySelectorAll(HEAD_CELL).length).toBe(3)
    const widths = [...document.querySelectorAll<HTMLElement>(HEAD_CELL)]
      .sort(
        (a, b) =>
          a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      )
      .map(cell => Math.round(cell.getBoundingClientRect().width))
    expect(widths).toEqual([220, 220, 100])
  })
})
