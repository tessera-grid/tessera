import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import axe from 'axe-core'

import { Stories } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { pinViaPopover } from './column-pinning-helpers'

// Нативные спаны вложенной шапки (ADR 0049, HS2–HS6, HS9, HS11–HS13). HS1, HS7–HS8, HS14 —
// модульные (`src/lib/__tests__/headerSpans.test.ts`), HS10 — в `keyboard-wcag`.
// Геометрия читается из боксов ячеек: колонки `groupedColumns` — мелкий лист
// `country`, группа `name` над листьями глубины 1, ветка `info` глубины 3.

const GRID = { containerHeight: 600, height: 500, dataCount: 20 }

const HEAD = '.data-grid__head'
const HEAD_CELL = '.data-grid__head-cell'
const TITLE = '.data-grid__cell-wrapper-title'
const SORT_BUTTON = '.column-sort__button'
const RESIZE_GRIP = '.resize__handler--column'
const KEBAB = '[aria-label="Column options"]'
const SCROLLER = '.data-grid__container'

const headCells = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(HEAD_CELL)].filter(
    cell => cell.dataset.columnId === id,
  )
const head = (id: string) => headCells(id)[0]!
const box = (element: Element) => element.getBoundingClientRect()
const headBox = () => box(document.querySelector(HEAD)!)

/** Верх каждой строки шапки — по верхним краям ячеек (по возрастанию). */
const headerRowTops = () =>
  [
    ...new Set(
      [...document.querySelectorAll<HTMLElement>(HEAD_CELL)].map(cell =>
        Math.round(box(cell).top),
      ),
    ),
  ].sort((a, b) => a - b)

const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)

const mount = async (
  args: Partial<Parameters<typeof Stories.HeaderGroupsShallowLeaves>[0]> = {},
) => {
  const result = await render(
    <Stories.HeaderGroupsShallowLeaves {...GRID} {...args} />,
  )
  await expect.poll(() => headCells('age').length).toBe(1)
  return result
}

const menuItems = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map(item =>
    item.textContent?.trim(),
  )

/** Подписи кнопок ячейки и пункты её кебаба (меню открывается кликом). */
const actionsOf = async (id: string) => {
  const cell = head(id)
  await userEvent.hover(cell)
  const buttons = [...cell.querySelectorAll<HTMLElement>('button')]
    .map(button => button.getAttribute('aria-label'))
    .sort()
  await userEvent.click(cell.querySelector<HTMLElement>(KEBAB)!)
  await expect.poll(() => menuItems().length).toBeGreaterThan(0)
  const items = menuItems()
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => menuItems().length).toBe(0)
  return { buttons, items }
}

describe('Нативные спаны вложенной шапки', () => {
  test('HS2: мелкий лист без прокладок — одна ячейка на всю высоту шапки с подписью, сортировкой и ресайзом', async () => {
    // Без меню действий сортировка — кнопкой в ячейке, а не пунктом кебаба.
    await mount({
      enableColumnSorting: true,
      enableColumnResizing: true,
      enableHeaderActionMenu: false,
    })
    expect(headCells('country')).toHaveLength(1)
    const country = head('country')
    near(box(country).top, headBox().top)
    near(box(country).bottom, box(head('age')).bottom)
    expect(country.querySelector(TITLE)!.textContent).toBe('Country')
    expect(country.querySelector(RESIZE_GRIP)).not.toBeNull()

    expect(country.getAttribute('aria-sort')).toBe('none')
    await userEvent.hover(country)
    await userEvent.click(country.querySelector<HTMLElement>(SORT_BUTTON)!)
    await expect
      .poll(() => head('country').getAttribute('aria-sort'))
      .not.toBe('none')
  })

  test('HS3: подпись растянутого листа прижата к низу — на одной линии с подписью листа обычной высоты', async () => {
    await mount()
    const ageTitle = box(head('age').querySelector(TITLE)!)
    for (const id of ['country', 'firstName', 'visits', 'total']) {
      near(box(head(id).querySelector(TITLE)!).bottom, ageTitle.bottom)
    }
  })

  test('HS4: группа над мелкими листьями — одна строка прямо над ними, листья растянуты на оставшиеся строки', async () => {
    await mount()
    const [top, second] = headerRowTops()
    const name = box(head('name'))
    near(name.top, top)
    near(name.bottom, second)
    for (const id of ['firstName', 'lastName']) {
      near(box(head(id)).top, name.bottom)
      near(box(head(id)).bottom, box(head('age')).bottom)
    }
  })

  test('HS5: скрытие самой глубокой ветки через меню «Колонки» убирает строку шапки без дыр', async () => {
    await mount()
    expect(headerRowTops()).toHaveLength(3)
    const columnsButton = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-button"]',
      )
    await expect
      .poll(() => columnsButton()?.hasAttribute('data-base-ui-click-trigger'))
      .toBe(true)
    await userEvent.click(columnsButton()!)
    const menu = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-menu"]',
      )
    await expect.poll(() => menu()?.hasAttribute('data-open')).toBe(true)
    await userEvent.click(
      menu()!.querySelector<HTMLElement>(
        '[data-column-id="more-info"] [role="checkbox"]',
      )!,
    )
    await userEvent.keyboard('{Escape}')

    await expect.poll(() => headerRowTops()).toHaveLength(2)
    expect(headCells('more-info')).toHaveLength(0)
    const bottom = box(head('country')).bottom
    near(bottom, headBox().bottom)
    for (const id of ['firstName', 'lastName', 'visits', 'total']) {
      near(box(head(id)).bottom, bottom)
    }
  })

  test('HS6: под вложенной шапкой у каждой служебной колонки ровно одна ячейка шапки на всю высоту', async () => {
    await render(
      <Stories.HeaderGroups
        {...GRID}
        enableRowSelection
        enableRowExpanding
        enableRowDragging
        enableRowActions
      />,
    )
    const services = [
      'actionColumn__rowDragging',
      'actionColumn__rowSelection',
      'actionColumn__rowExpanding',
      'actionColumn__rowActions',
    ]
    await expect
      .poll(() => services.every(id => headCells(id).length > 0))
      .toBe(true)
    for (const id of services) {
      const cells = [...document.querySelectorAll<HTMLElement>(HEAD_CELL)]
        .filter(cell => cell.dataset.columnId?.startsWith(id))
        .map(box)
      expect(cells, id).toHaveLength(1)
      near(cells[0].top, headBox().top)
      near(cells[0].bottom, box(head('age')).bottom)
    }
  })

  test('HS9: aria-rowspan и aria-colspan ячеек шапки совпадают с их боксом, ячейка лежит в строке своей вершины', async () => {
    // Без колонки действий: она липнет к правому краю и попала бы в бокс соседей.
    await mount({ enableRowActions: false })
    const rowTops = headerRowTops()
    const bodyCells = [
      ...document.querySelector('.data-grid__body-row')!.children,
    ].filter(cell => cell.getAttribute('aria-colindex') !== null)
    for (const cell of document.querySelectorAll<HTMLElement>(HEAD_CELL)) {
      const rect = box(cell)
      const rows = rowTops.filter(
        top => top >= Math.round(rect.top) && top < Math.round(rect.bottom),
      ).length
      const columns = bodyCells.filter(body => {
        const center = box(body).left + box(body).width / 2
        return center > rect.left && center < rect.right
      }).length
      const id = cell.dataset.columnId
      expect(Number(cell.getAttribute('aria-rowspan') ?? 1), id).toBe(rows)
      expect(Number(cell.getAttribute('aria-colspan') ?? 1), id).toBe(columns)
      expect(
        Number(cell.closest('[role="row"]')!.getAttribute('aria-rowindex')),
        id,
      ).toBe(rowTops.indexOf(Math.round(rect.top)) + 1)
    }
  })

  test('HS11: закреплённый растянутый лист остаётся на месте при горизонтальной прокрутке во всех своих строках', async () => {
    await render(<Stories.HeaderGroupsPinning {...GRID} />)
    await expect.poll(() => headCells('total').length).toBe(1)
    await pinViaPopover(head('total'), 'Pin left')
    await expect
      .poll(() => head('total').getAttribute('data-cell-pinned'))
      .toBe('left')

    const before = box(head('total'))
    const scroller = document.querySelector<HTMLElement>(SCROLLER)!
    scroller.scrollLeft = scroller.scrollWidth
    await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)

    const after = box(head('total'))
    near(after.left, before.left)
    near(after.top, headBox().top)
    near(after.height, before.height)
    expect(
      document
        .elementFromPoint(after.left + 4, after.top + 4)
        ?.closest(HEAD_CELL),
    ).toBe(head('total'))
    expect(
      document
        .elementFromPoint(after.left + 4, after.bottom - 4)
        ?.closest(HEAD_CELL),
    ).toBe(head('total'))
  })

  test('HS12: axe с контрастом без нарушений для шапки с растянутыми листьями — роли table и grid, обе темы', async () => {
    for (const enableKeyboardNavigation of [false, true]) {
      // Без иерархии строк: с ней и навигацией роль — treegrid.
      const { unmount } = await mount({
        enableKeyboardNavigation,
        enableRowExpanding: false,
      })
      const role = enableKeyboardNavigation ? 'grid' : 'table'
      const grid = document.querySelector<HTMLElement>(`[role="${role}"]`)!
      expect(grid).not.toBeNull()
      await inBothThemes(async () => {
        const { violations } = await axe.run(grid, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(violations, role).toEqual([])
      })
      await unmount()
    }
  })

  test('HS13: кнопки и пункты кебаба растянутого листа те же, что у листа обычной высоты', async () => {
    await mount({ enableLeafPinning: true })
    const stretched = await actionsOf('visits')
    const regular = await actionsOf('age')
    expect(stretched).toEqual(regular)
    expect(stretched.items).toContain('Hide column')
    expect(stretched.buttons).toContain('Pin column')
  })
})
