import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { revealedHandleWidth } from '../helpers'

import type { DataMode } from '../../../core/dataMode'
import type { DebugAction, OnDebugAction } from '../../../core/debugActions'
import { definePlugin } from '../../../core/definePlugin'
import type { HeaderAction } from '../../../core/headerActions'
import { ActionButton } from '../../../grid/headerActions/ActionButton'
import { ActionsZone } from '../../../grid/headerActions/ActionsZone'
import { BodyCell } from '../../../grid/BodyCell'
import { CellWrapperContent } from '../../../grid/CellWrapperContent'
import { CellWrapperTitle } from '../../../grid/CellWrapperTitle'
import { RenderCellSlot, RenderSlot } from '../../../core/renderSlots'
import { defaultCell } from '../../../core/commonFeature'
import { windowBand } from '../../../core/virtualization/windowBand'
import { BodyRow, BodyRowCells } from '../../../grid/BodyRow'
import { SortableRow } from '../../../plugins/rowDragging/SortableRow'
import { ItemSortableContextProvider } from '../../../shared/dnd'
import { FooterCell } from '../../../grid/FooterCell'
import { Toolbar } from '../../../grid/Toolbar/Toolbar'
import { HeadCellView } from '../../../grid/HeadCell'
import { HeadSelectionComponent } from '../../../plugins/rowSelection/HeadSelectionComponent'
import { RowSelectionComponent } from '../../../plugins/rowSelection/RowSelectionComponent'
import {
  cellEditing,
  columnSorting,
  headerActionMenu,
  rowSelection,
  rowExpanding,
  serverRowModel,
  treeLines,
} from '../../../plugins'
import { LinearProgress } from '../../../ui/LinearProgress'
import { IconButton } from '../../../ui/IconButton'
import { RevealedIcon } from '../../../ui/IconButton/iconReveal'
import { SelectionHandle } from '../../../ui/SelectionHandle'
import { ColumnDraggingComponent } from '../../../plugins/columnDragging/ColumnDraggingComponent'
import { ColumnSizingComponent } from '../../../plugins/columnSizing/ColumnSizingComponent'
import { ResizeHandler } from '../../../plugins/columnSizing/ResizeHandler'
import { makeColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import type { FeatureToggles } from '../../__mocks__/utils/argsToPlugins'
import { ALL_PLUGINS, Grid, waitForQuietDocument } from '../memory.helpers'
import {
  describeWork,
  measureWork,
  renders,
  type MeasureOptions,
  type Work,
} from '../work.helpers'
import { tableLabels } from '../labels'
import { paginationLabels } from '../../../plugins/pagination/labels'
import { rowExpandingLabels } from '../../../plugins/rowExpanding/labels'

// Счётчики работы (ADR 0099, этап 2, PF2–PF11): работа ключевых действий считается —
// коммиты React, отрисованные компоненты, узлы, раскладки, пересборки моделей строк.
// Бюджеты — через окно виртуализации, а не числами под машину. PS10–PS13 — сдвиг окна
// при прокрутке (ADR 0149).

const browser = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
  realWheel: (
    at: { x: number; y: number },
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
}

// Окно шире грида: наведение не докручивает ячейку, а переходы не добавляют кадров
// пересчёта стилей — счёт не зависит от тайминга.
const viewport = { width: innerWidth, height: innerHeight }
beforeAll(async () => {
  await page.viewport(1280, 900)
  await browser.reducedMotion(true)
})
afterAll(async () => {
  await browser.reducedMotion(false)
  await page.viewport(viewport.width, viewport.height)
})

const mountGrid = async (
  toggles: FeatureToggles,
  data = getData(300),
  plugins?: readonly unknown[],
  onDebugAction?: OnDebugAction,
  columns?: unknown[],
  footer?: boolean,
  dataMode?: DataMode,
  rowCount?: number,
) => {
  const box: { table?: object } = {}
  const screen = await render(
    <Grid
      data={data}
      toggles={toggles}
      plugins={plugins}
      onDebugAction={onDebugAction}
      columns={columns}
      footer={footer}
      dataMode={dataMode}
      rowCount={rowCount}
      onTable={table => (box.table = table)}
    />,
  )
  // Ленивые модули, начатые при рендере, приходят один раз на документ.
  await waitForQuietDocument()
  const grid = document.querySelector<HTMLElement>('.data-grid__container')!
  const measure = (
    action: () => unknown,
    options: Omit<MeasureOptions, 'table'> = {},
  ) => measureWork(grid, action, { ...options, table: box.table })
  return { grid, data, screen, measure, table: () => box.table! }
}

/** Окно виртуализации: смонтированные строки тела и ячейки строки. */
const windowSize = () => {
  const rows = document.querySelectorAll('.data-grid__body-row')
  return {
    rows: rows.length,
    cells: rows[0].querySelectorAll('.data-grid__body-cell').length,
  }
}

// Строка с декоратором перетаскивания рисует и его, и BodyRow: строку считает BodyRow.
const rowRenders = (work: Work) => renders(work, BodyRow)

const checkbox = (index: number) =>
  document.querySelectorAll<HTMLElement>(
    '.data-grid__body-row [role="checkbox"]',
  )[index]

/** Ожидание с отчётом о работе: при падении видно, что отрисовалось. */
const within = (work: Work, actual: number, budget: number, what: string) =>
  expect(actual, `${what}: ${describeWork(work)}`).toBeLessThanOrEqual(budget)

/** Бюджет PF5: своя строка и флажок шапки, остальное тело и шапка — нет. */
const expectSelectionBudget = (work: Work) => {
  within(work, rowRenders(work), 1, 'строки')
  within(work, renders(work, BodyRowCells), 1, 'ячейки строк')
  within(work, renders(work, BodyCell), windowSize().cells, 'ячейки')
  within(work, renders(work, RowSelectionComponent), 1, 'флажки строк')
  within(work, renders(work, HeadSelectionComponent), 1, 'флажок шапки')
  within(work, renders(work, ActionsZone), 0, 'зоны действий')
  within(work, renders(work, HeadCellView), 0, 'ячейки шапки')
}

/** Пункт, заблокированный у колонки шире 300px. */
const wideOnly = (id: string): HeaderAction => ({
  id,
  slot: 'rightHeaderSlot',
  icon: () => <span aria-hidden>W</span>,
  label: () => 'Wide only',
  disabled: ctx =>
    (ctx as { column: { getSize: () => number } }).column.getSize() > 300
      ? { kind: 'forbidden', reason: 'Too wide' }
      : false,
  onSelect: () => {},
})

/** Ширина колонки через API: вид закрытой зоны от неё не зависит. */
const widen = (table: object) =>
  (
    table as { setColumnSizing: (sizing: Record<string, number>) => void }
  ).setColumnSizing({ country: 400 })

const headButton = async (label: string) => {
  const head = document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="country"]',
  )!
  await userEvent.hover(head)
  return head.querySelector<HTMLElement>(`[aria-label^="${label}"]`)!
}

const menuItem = (label: string) =>
  [...document.querySelectorAll('[role="menuitem"]')].find(el =>
    el.textContent?.includes(label),
  )

describe('Счётчики работы', () => {
  test('PF2: measureWork считает коммиты, компоненты, узлы, раскладки и пересчёты стилей; два одинаковых действия дают равные счётчики', async () => {
    const { measure } = await mountGrid({ enableRowSelection: true })
    // Первый выбор показывает счётчик выбранных — раскладка меняется один раз.
    await userEvent.click(checkbox(2))
    await userEvent.click(checkbox(2))
    const first = await measure(() => userEvent.click(checkbox(2)))
    await measure(() => userEvent.click(checkbox(2)))
    const second = await measure(() => userEvent.click(checkbox(2)))
    for (const counter of [
      'commits',
      'rendered',
      'nodesAdded',
      'nodesRemoved',
      'layouts',
      'styleRecalcs',
    ] as const) {
      expect(
        first[counter],
        `${counter}: ${describeWork(first)}`,
      ).toBeGreaterThan(0)
      expect(second[counter], counter).toBe(first[counter])
    }
    expect(second.components).toEqual(first.components)
  })

  test('PF3: подсаженная перерисовка всех строк на клик по флажку превышает бюджет сценария', async () => {
    const { measure, screen, data } = await mountGrid({
      enableRowSelection: true,
    })
    await userEvent.click(checkbox(2))
    await userEvent.click(checkbox(2))
    // Каждая строка — новым объектом: модель строк собирается заново, перерисовка всего
    // тела (новый массив с прежними строками тело не перерисовывает, ADR 0194).
    const planted = await measure(async () => {
      await userEvent.click(checkbox(2))
      await screen.rerender(
        <Grid
          data={data.map(row => ({ ...row }))}
          toggles={{ enableRowSelection: true }}
        />,
      )
    })
    expect(rowRenders(planted)).toBeGreaterThan(1)
    expect(() => expectSelectionBudget(planted)).toThrow()
  })

  test('PF4: сдвиг полосы окна строк монтирует только пришедшие строки ячеек видимых колонок; остальные строки окна не перерисовываются', async () => {
    const { grid, measure } = await mountGrid({})
    const box = grid.getBoundingClientRect()
    const at = { x: box.left + 200, y: box.top + 200 }
    const rowHeight = document
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    const indexes = () =>
      new Set(
        [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].map(
          row => row.dataset.index,
        ),
      )
    // Колесо не ждёт прокрутки: тик засчитан, когда `scrollTop` дошёл до цели, — иначе
    // под нагрузкой замер кончается раньше, чем строка смонтирована.
    let rows = 0
    const wheel = async () => {
      rows++
      await browser.realWheel(at, rowHeight, 1, 0)
      await expect.poll(() => grid.scrollTop).toBe(rowHeight * rows)
    }
    // Полоса окна (ADR 0202) держит запас: тики до её сдвига, по одному — спокойная прокрутка.
    const shift = async () => {
      const before = indexes()
      for (let i = 0; i < 12 && [...indexes()].every(k => before.has(k)); i++) {
        // eslint-disable-next-line no-await-in-loop
        await wheel()
        // eslint-disable-next-line no-await-in-loop
        await waitForQuietDocument(200)
      }
      return [...indexes()].filter(k => !before.has(k)).length
    }
    await shift()
    await waitForQuietDocument(500)
    const before = indexes()
    let added = 0
    const work = await measure(async () => {
      added = await shift()
    })
    expect(added, describeWork(work)).toBeGreaterThan(0)
    expect([...indexes()].some(k => before.has(k))).toBe(true)
    expect(rowRenders(work), describeWork(work)).toBe(added)
    expect(renders(work, BodyCell), describeWork(work)).toBe(
      added * windowSize().cells,
    )
  })

  test('PF5: клик по флажку выбора перерисовывает свою строку и флажок шапки, а не всё тело', async () => {
    const { measure } = await mountGrid({ enableRowSelection: true })
    await userEvent.click(checkbox(2))
    await userEvent.click(checkbox(2))
    const work = await measure(() => userEvent.click(checkbox(2)))
    expect(checkbox(2)).toHaveAttribute('aria-checked', 'true')
    expect(renders(work, RowSelectionComponent), describeWork(work)).toBe(1)
    expectSelectionBudget(work)
  })

  test('PF6: смена страницы строит модель строк один раз и монтирует не больше строк окна', async () => {
    const { measure } = await mountGrid({
      enablePagination: true,
      paginationInitialPageSize: 100,
    })
    const size = windowSize()
    const work = await measure(
      () =>
        userEvent.click(
          document.querySelector<HTMLElement>(
            `[aria-label="${paginationLabels(tableLabels).nextPage}"]`,
          )!,
        ),
      { models: ['coreRowModel', 'paginatedRowModel'] },
    )
    expect(
      document
        .querySelector('.data-grid__body-row')!
        .getAttribute('data-row-id'),
    ).toBe('item-id-100')
    expect(work.builds).toEqual({ coreRowModel: 0, paginatedRowModel: 1 })
    within(work, rowRenders(work), size.rows, 'строки')
    within(work, renders(work, BodyCell), size.rows * size.cells, 'ячейки')
  })

  test('PF7: приход ленивых детей — одна пересборка модели строк, отрисовка не больше окна', async () => {
    let answer!: (rows: unknown[]) => void
    const { measure } = await mountGrid({
      enableRowExpanding: true,
      rowExpandingHasChildren: (row: { id: string }) => row.id === 'item-id-2',
      rowExpandingLoadChildren: () =>
        new Promise(resolve => (answer = resolve as never)) as never,
    })
    await userEvent.click(
      document.querySelector<HTMLElement>(
        `[data-row-id="item-id-2"] [aria-label="${rowExpandingLabels(tableLabels).expandRow}"]`,
      )!,
    )
    await expect.poll(() => answer).toBeDefined()
    const children = getData(5).map((row, index) => ({
      ...row,
      id: `child-${index}`,
    }))
    const work = await measure(() => answer(children), {
      models: ['coreRowModel', 'expandedRowModel'],
    })
    expect(document.querySelector('[data-row-id="child-0"]')).not.toBeNull()
    expect(work.builds).toEqual({ coreRowModel: 1, expandedRowModel: 1 })
    const size = windowSize()
    within(work, rowRenders(work), size.rows, 'строки')
    within(work, renders(work, BodyCell), size.rows * size.cells, 'ячейки')
  })

  test('PF8: клик сортировки — одна сортировка модели, перерисовка в пределах окна', async () => {
    const { measure } = await mountGrid({ enableColumnSorting: true })
    const size = windowSize()
    const button = document.querySelector<HTMLElement>(
      '.data-grid__head-cell [aria-label^="Sort"]',
    )!
    const work = await measure(() => userEvent.click(button), {
      models: ['sortedRowModel'],
    })
    expect(
      document.querySelector(
        '[aria-sort="ascending"], [aria-sort="descending"]',
      ),
    ).not.toBeNull()
    expect(work.builds).toEqual({ sortedRowModel: 1 })
    within(work, rowRenders(work), size.rows, 'строки')
    within(work, renders(work, BodyCell), size.rows * size.cells, 'ячейки')
  })

  test('PF9: ввод в быстрый поиск — один проход фильтрации после дебаунса, а не на каждую букву', async () => {
    const { measure, data } = await mountGrid({ enableQuickSearch: true })
    const query = (data[5] as { firstName: string }).firstName.slice(0, 4)
    const field = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!
    const work = await measure(
      async () => {
        await userEvent.type(field, query)
        // Дольше дебаунса поиска (200 мс): проход фильтрации уже прошёл.
        await new Promise(resolve => setTimeout(resolve, 400))
      },
      { models: ['filteredRowModel'] },
    )
    expect(field.value).toBe(query)
    expect(query.length).toBeGreaterThan(1)
    expect(work.builds).toEqual({ filteredRowModel: 1 })
  })

  test('PF10: открытие меню колонки не перерисовывает тело', async () => {
    const { measure } = await mountGrid(ALL_PLUGINS)
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="country"]',
    )!
    await userEvent.hover(head)
    const button = head.querySelector<HTMLElement>(
      `[aria-label^="${tableLabels.headerMenu}"]`,
    )!
    await waitForQuietDocument(300)
    const work = await measure(() => userEvent.click(button))
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    expect(
      renders(work, BodyRow, SortableRow, BodyRowCells, BodyCell),
      describeWork(work),
    ).toBe(0)
  })

  test('PF11: наведение на другую ячейку той же строки — ноль коммитов React; на другую строку — перерисованы только значки скрытых кнопок двух строк', async () => {
    const { measure } = await mountGrid(ALL_PLUGINS)
    const row = (index: number) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-index="${index}"]`,
      )!
    const cell = (index: number, column: string) =>
      row(index).querySelector<HTMLElement>(
        `.data-grid__body-cell[data-column-id="${column}"]`,
      )!
    // Первое наведение грузит модули по намерению (ADR 0061) — один раз на документ.
    await userEvent.hover(cell(1, 'country'))
    await userEvent.hover(cell(2, 'country'))
    await userEvent.hover(cell(3, 'country'))
    await waitForQuietDocument(500)
    const sameRow = await measure(() => userEvent.hover(cell(3, 'firstName')))
    expect(sameRow.commits, describeWork(sameRow)).toBe(0)

    const buttons = row(3).querySelectorAll('.data-grid__icon-button').length
    const otherRow = await measure(() => userEvent.hover(cell(4, 'firstName')))
    expect(
      renders(otherRow, RevealedIcon),
      describeWork(otherRow),
    ).toBeGreaterThan(0)
    within(otherRow, renders(otherRow, RevealedIcon), buttons * 2, 'значки')
    within(otherRow, renders(otherRow, IconButton), 0, 'кнопки')
    within(otherRow, renders(otherRow, BodyCell), 0, 'ячейки')
    within(otherRow, rowRenders(otherRow), 0, 'строки')
  })

  test('PF23: открытое меню кебаба перечитывает пункты при смене состояния, которая не меняет вид закрытой зоны', async () => {
    const probe = definePlugin()({
      id: 'menuProbe',
      slotActions: [wideOnly('wideOnly')],
    })
    const { table } = await mountGrid({}, getData(30), [
      probe(),
      headerActionMenu({ mode: 'always' }),
    ])
    await userEvent.click(await headButton(tableLabels.headerMenu))
    await expect.poll(() => menuItem('Wide only')).toBeTruthy()
    expect(menuItem('Wide only')).not.toHaveAttribute('aria-disabled', 'true')
    widen(table())
    await expect
      .poll(() => menuItem('Wide only'))
      .toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Escape}')
  })

  test('PF24: открытое инлайн-меню раздела перечитывает пункты при смене состояния, которая не меняет вид закрытой зоны', async () => {
    const section: HeaderAction = {
      id: 'section',
      slot: 'rightHeaderSlot',
      icon: () => <span aria-hidden>S</span>,
      label: () => 'Section',
      submenu: () => ({ title: 'Section', items: [wideOnly('wideItem')] }),
      onSelect: () => {},
    }
    const probe = definePlugin()({ id: 'sectionProbe', slotActions: [section] })
    const { table } = await mountGrid({}, getData(30), [probe()])
    await userEvent.click(await headButton('Section'))
    await expect.poll(() => menuItem('Wide only')).toBeTruthy()
    expect(menuItem('Wide only')).not.toHaveAttribute('aria-disabled', 'true')
    widen(table())
    await expect
      .poll(() => menuItem('Wide only'))
      .toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Escape}')
  })

  test('PF25: открытая панель действия перечитывает содержимое при смене состояния, которая не меняет вид закрытой зоны', async () => {
    const panel: HeaderAction = {
      id: 'widthPanel',
      slot: 'rightHeaderSlot',
      icon: () => <span aria-hidden>P</span>,
      label: () => 'Width',
      panel: ctx => (
        <output data-testid="width-panel">
          {(ctx as { column: { getSize: () => number } }).column.getSize()}
        </output>
      ),
      onSelect: () => {},
    }
    const probe = definePlugin()({ id: 'panelProbe', slotActions: [panel] })
    const { table } = await mountGrid({}, getData(30), [probe()])
    await userEvent.click(await headButton('Width'))
    const content = () =>
      document.querySelector('[data-testid="width-panel"]')?.textContent
    await expect.poll(content).toBeTruthy()
    expect(content()).not.toBe('400')
    widen(table())
    await expect.poll(content).toBe('400')
    await userEvent.keyboard('{Escape}')
  })
})

/** Перерисовка приложения: каждый рендер даёт плагинам новые функции-колбэки. */
let rerenderApp = () => {}
const CallbacksApp = () => {
  const [tick, setTick] = useState(0)
  rerenderApp = () => setTick(value => value + 1)
  return (
    <Grid
      toggles={{}}
      plugins={[
        rowSelection({ onSelectRow: () => void tick }),
        cellEditing({ onCellEdit: () => void tick }),
      ]}
    />
  )
}

describe('Счётчики работы — бизнес-колбэки (ADR 0027)', () => {
  test('H7: новый бизнес-колбэк в аргументах фабрики на каждом рендере приложения не перерисовывает строк, ячеек и шапки грида', async () => {
    await render(<CallbacksApp />)
    await waitForQuietDocument()
    const grid = document.querySelector<HTMLElement>('.data-grid__container')!
    await expect.poll(() => checkbox(2)).toBeTruthy()
    const work = await measureWork(grid, () => {
      rerenderApp()
      rerenderApp()
    })
    expect(work.commits, describeWork(work)).toBeGreaterThan(0)
    expect(
      renders(
        work,
        BodyRow,
        BodyRowCells,
        BodyCell,
        HeadCellView,
        FooterCell,
        RowSelectionComponent,
        HeadSelectionComponent,
      ),
      describeWork(work),
    ).toBe(0)
  })
})

describe('Счётчики работы — кнопки заголовка по ширине (ADR 0111)', () => {
  test('GB8: протяжка ширины одной колонки перерисовывает зоны действий только её заголовка, зоны других колонок — нет', async () => {
    type Point = { x: number; y: number }
    const pointer = commands as unknown as {
      realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
      realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    const { measure, table } = await mountGrid({
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enableColumnPinning: true,
      enableColumnSizing: true,
      enableHeaderActionMenu: true,
      headerActionMenuThreshold: 10,
    })
    ;(
      table() as { setColumnSizing: (sizing: Record<string, number>) => void }
    ).setColumnSizing({ firstName: 260 })
    const head = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="firstName"]',
      )!
    // Кнопки действий в ряду; кебаб с пунктами подгонки ширины (ADR 0217) есть всегда.
    const inline = () =>
      head().querySelectorAll(
        `button[aria-label]:not([aria-label^="${tableLabels.headerMenu}"])`,
      ).length
    await expect.poll(inline).toBeGreaterThan(2)
    const before = inline()
    const r = head().getBoundingClientRect()
    const at = { x: r.right, y: r.top + r.height / 2 }
    await pointer.realMouseMove({ x: r.left + 8, y: at.y }, at, 4)
    // Сужение уводит кнопки в кебаб — у своего заголовка вид меняется.
    const work = await measure(async () => {
      await pointer.realDragHold(at, { x: at.x - 110, y: at.y }, 6)
      await pointer.realMouseUp()
    })
    await expect.poll(inline).toBeLessThan(before)
    // Раскладка кнопок сменилась у одной зоны — она и перерисовалась, не чаще, чем кнопки
    // уходили в кебаб; зоны других колонок — ни разу.
    expect(renders(work, ActionsZone), describeWork(work)).toBeLessThanOrEqual(
      before - inline(),
    )
  })
})

describe('Счётчики работы — линия границы колонки (ADR 0197)', () => {
  test('RL10: линия границы — один узел вне React: протяжка добавляет и убирает его, грип перерисовывается не чаще своего хоста', async () => {
    type Point = { x: number; y: number }
    const pointer = commands as unknown as {
      realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
      realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    const { measure } = await mountGrid({ enableColumnSizing: true })
    const head = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="firstName"]',
      )!
    const line = () =>
      document.querySelector('[data-column-resize-line]:not([hidden])')
    const separator = head().querySelector('[role="separator"]')!
    const r = separator.getBoundingClientRect()
    const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    await pointer.realMouseMove({ x: at.x - 40, y: at.y }, at, 4)
    let shown = false
    const work = await measure(async () => {
      await pointer.realDragHold(at, { x: at.x + 80, y: at.y }, 6)
      shown = line() !== null
      await pointer.realMouseUp()
    })
    expect(shown).toBe(true)
    const summary = describeWork(work)
    expect([work.nodesAdded, work.nodesRemoved], summary).toEqual([1, 1])
    expect(renders(work, ResizeHandler), summary).toBeLessThanOrEqual(
      renders(work, ColumnSizingComponent),
    )
  })
})

describe('Счётчики работы — включённые действия в ряду (ADR 0156)', () => {
  test('KA8: состояние «тронут» заголовка перерисовывает только его зону действий; зоны других заголовков — нет', async () => {
    const { measure, table } = await mountGrid({
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enableColumnPinning: true,
      enableColumnSizing: true,
      enableHeaderActionMenu: true,
      headerActionMenuThreshold: 10,
    })
    const api = table() as {
      setColumnSizing: (sizing: Record<string, number>) => void
      setSorting: (sorting: { id: string; desc: boolean }[]) => void
    }
    const head = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__head-cell[data-column-id="${id}"]`,
      )!
    const sortButton = () =>
      head('firstName').querySelector<HTMLElement>('.column-sort__button')
    const pinButton = () =>
      head('firstName').querySelector<HTMLElement>('.column-pin__button')
    // Узкие колонки: в ряду одна кнопка и кебаб; у первой включена сортировка.
    let width = 140
    for (; width <= 300; width += 5) {
      api.setColumnSizing({ firstName: width, lastName: width })
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      if (
        pinButton() &&
        head('firstName').querySelector('[data-action-menu]')
      ) {
        break
      }
    }
    api.setSorting([{ id: 'firstName', desc: false }])
    await expect.poll(sortButton).not.toBeNull()
    await userEvent.hover(head('lastName'))

    // Наведение, пока ряд не отстаёт от включённых, зону не перерисовывает.
    const hover = await measure(async () => {
      await userEvent.hover(head('firstName'))
    })
    expect(renders(hover, ActionsZone), describeWork(hover)).toBe(0)

    // Выключение под указателем: ряд ждёт ухода; уход перерисовывает одну зону.
    await userEvent.click(sortButton()!)
    await expect
      .poll(() => head('firstName').getAttribute('aria-sort'))
      .toBe('none')
    expect(sortButton()).not.toBeNull()
    const leave = await measure(async () => {
      await userEvent.hover(head('lastName'))
      await expect.poll(pinButton).not.toBeNull()
    })
    expect(
      renders(leave, ActionsZone),
      describeWork(leave),
    ).toBeLessThanOrEqual(2)
  })
})

describe('Счётчики работы — ручка колонки (ADR 0114)', () => {
  test('CO10: наведение на заголовок раскрывает ручку без перерисовок — ни зон действий, ни ручек, ни заголовков', async () => {
    const { measure } = await mountGrid({
      enableColumnDragging: true,
      enableColumnSorting: true,
    })
    const head = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__head-cell[data-column-id="${id}"]`,
      )!
    const handle = () =>
      head('lastName').querySelector<HTMLElement>('.drag__handler--column')!
    await userEvent.hover(head('firstName'))
    const work = await measure(async () => {
      await userEvent.hover(head('lastName'))
      await expect
        .poll(() => handle().parentElement!.getBoundingClientRect().width)
        .toBe(revealedHandleWidth(handle()))
    })
    expect(renders(work, ActionsZone), describeWork(work)).toBe(0)
    expect(renders(work, ColumnDraggingComponent), describeWork(work)).toBe(0)
    expect(renders(work, HeadCellView), describeWork(work)).toBe(0)
  })

  test('SA16: вход в ожидание серверного действия и выход из него перерисовывают свечение, но не строки тела', async () => {
    let answer!: () => void
    const { measure } = await mountGrid(
      {},
      getData(300),
      [
        columnSorting({
          onToggleColumnSort: () =>
            new Promise<void>(resolve => (answer = resolve)),
        }),
      ],
      undefined,
      undefined,
      undefined,
      { sorting: 'server' },
    )
    const button = document.querySelector<HTMLElement>(
      '.data-grid__head-cell [aria-label^="Sort"]',
    )!
    const glowing = () => !!document.querySelector('[data-refreshing]')
    const expectGlowOnly = (work: Work) => {
      expect(renders(work, LinearProgress), describeWork(work)).toBeGreaterThan(
        0,
      )
      expect(
        renders(work, BodyRow, SortableRow, BodyRowCells, BodyCell),
        describeWork(work),
      ).toBe(0)
    }
    // Свечение — после задержки `refreshOptions`: замер ждёт его появления и ухода.
    const entry = await measure(async () => {
      await userEvent.click(button)
      await expect.poll(glowing).toBe(true)
    })
    expectGlowOnly(entry)

    const exit = await measure(async () => {
      answer()
      await expect.poll(glowing).toBe(false)
    })
    expectGlowOnly(exit)
  })

  test('AL26: слушатель канала действий не добавляет гриду работы — коммиты, отрисовки и пересборки моделей при сортировке те же, что без него', async () => {
    const sortOnce = async (onDebugAction?: OnDebugAction) => {
      const { measure, screen } = await mountGrid(
        { enableColumnSorting: true },
        getData(300),
        undefined,
        onDebugAction,
      )
      const button = document.querySelector<HTMLElement>(
        '.data-grid__head-cell [aria-label^="Sort"]',
      )!
      // Полоса дорастает в следующем кадре после монтирования и после смены списка (ADR 0202, §1а):
      // замер — от покоя до покоя, иначе рост попадает в одну сторону сравнения.
      await waitForQuietDocument(300)
      const work = await measure(
        async () => {
          await userEvent.click(button)
          await waitForQuietDocument(300)
        },
        { models: ['sortedRowModel'] },
      )
      await screen.unmount()
      return work
    }
    // Первое монтирование в тесте дороже следующих — прогрев.
    await sortOnce()
    const base = await sortOnce()
    const actions: DebugAction[] = []
    const listened = await sortOnce(action => actions.push(action))
    // Вариант мерил заявленное: слушатель получил сортировку.
    expect(actions.map(action => action.action)).toContain('columnSorting')
    expect(listened.commits, describeWork(listened)).toBe(base.commits)
    expect(listened.rendered, describeWork(listened)).toBe(base.rendered)
    expect(listened.builds).toEqual(base.builds)
  })

  test('SD19: приход блока строит строки только этого блока и не перерисовывает строки других блоков', async () => {
    const all = getData(1000)
    const BLOCK = 100
    const held: { start: number; answer: () => void }[] = []
    const { grid, measure } = await mountGrid(
      {},
      [],
      [
        serverRowModel({
          blockSize: BLOCK,
          // Первый блок — сразу, остальные ждут ответа из теста.
          getRows: ({ start, end }) =>
            start === 0
              ? { rows: all.slice(start, end) }
              : new Promise(resolve => {
                  held.push({
                    start,
                    answer: () => resolve({ rows: all.slice(start, end) }),
                  })
                }),
        }),
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      all.length,
    )
    const rowAt = (index: number) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-index="${index}"]`,
      )
    await expect.poll(() => rowAt(0)?.dataset.rowId).toBe(all[0]!.id)
    // Окно на стыке: внизу блока 0 строки с данными, ниже — скелеты блока 1.
    grid.scrollTop = (BLOCK - 5) * rowAt(0)!.getBoundingClientRect().height
    await expect
      .poll(() => rowAt(BLOCK - 1)?.dataset.rowId)
      .toBe(all[BLOCK - 1]!.id)
    await expect.poll(() => held.some(call => call.start === BLOCK)).toBe(true)
    const kept = [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__body-row[data-row-id]',
      ),
    ]
    const work = await measure(() =>
      held.find(call => call.start === BLOCK)!.answer(),
    )
    await expect.poll(() => rowAt(BLOCK)?.dataset.rowId).toBe(all[BLOCK]!.id)
    const arrived = [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__body-row[data-row-id]',
      ),
    ].filter(row => Number(row.dataset.index) >= BLOCK).length
    // Перерисованы только пришедшие строки; строки блока 0 — те же узлы.
    expect(arrived).toBeGreaterThan(0)
    expect(renders(work, BodyRow), describeWork(work)).toBe(arrived)
    for (const row of kept) expect(row.isConnected).toBe(true)
  })
})

// Линии дерева в серверной модели (ADR 0161, TL14): раскрытие, приход блока и транзакция
// перерисовывают только строки окна, чьи линии или место изменились.
describe('линии дерева в серверной модели (ADR 0161)', () => {
  test('TL14: раскрытие, приход блока и транзакция перерисовывают только строки окна, чьи линии или место изменились', async () => {
    const roots = getData(40)
    const kids = getData(25)
    const BLOCK = 10
    const branch = roots[3]!.id
    const held: { start: number; answer: () => void }[] = []
    const { measure, table } = await mountGrid(
      {},
      roots,
      [
        serverRowModel({
          blockSize: BLOCK,
          // Корни и первый блок ветки — сразу, второй блок ветки ждёт ответа теста.
          getRows: ({ start, end, parentId }) => {
            if (!parentId) return { rows: roots.slice(start, end) }
            const rows = kids
              .slice(start, end)
              .map((row, k) => ({ ...row, id: `${parentId}.${start + k}` }))
            if (start === 0) return { rows, rowCount: kids.length }
            return new Promise(resolve => {
              held.push({
                start,
                answer: () => resolve({ rows, rowCount: kids.length }),
              })
            })
          },
        }),
        rowExpanding({
          hasChildren: (row: { depth: number }) => row.depth === 0,
        } as never),
        treeLines(),
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      roots.length,
    )
    const bodyRow = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${CSS.escape(id)}"]`,
      )
    /** Строки окна: место и части линий по id. */
    const snapshot = () =>
      new Map(
        [
          ...document.querySelectorAll<HTMLElement>(
            '.data-grid__body-row[data-row-id]',
          ),
        ].map(row => [
          row.dataset.rowId!,
          `${row.dataset.index}|${[
            ...row.querySelectorAll<HTMLElement>(
              '[data-tree-depth] [aria-hidden] > span:not([data-leaving])',
            ),
          ]
            .map(
              span =>
                span.className +
                span.style.getPropertyValue('--tsr-tree-level'),
            )
            .sort()
            .join(' ')}`,
        ]),
      )
    /**
     * Строки, у которых сменились место или линии, пришедшие в окно и ушедшие из него:
     * ушедшая успевает сдвинуться в промежуточном коммите.
     */
    const changed = (before: Map<string, string>) => {
      const after = snapshot()
      return (
        [...after].filter(([id, state]) => before.get(id) !== state).length +
        [...before.keys()].filter(id => !after.has(id)).length
      )
    }
    const expectOnlyChanged = (work: Work, before: Map<string, string>) => {
      const count = changed(before)
      expect(count, describeWork(work)).toBeGreaterThan(0)
      expect(rowRenders(work), describeWork(work)).toBeLessThanOrEqual(count)
    }
    await expect.poll(() => bodyRow(branch)).not.toBeNull()

    // Раскрытие: строки выше раскрытой не перерисовываются.
    let before = snapshot()
    let work = await measure(async () => {
      ;(table() as { getRow: (id: string) => { toggleExpanded: () => void } })
        .getRow(branch)
        .toggleExpanded()
      await expect.poll(() => bodyRow(`${branch}.0`)).not.toBeNull()
    })
    expectOnlyChanged(work, before)
    for (const id of roots.slice(0, 3).map(row => row.id))
      expect(before.get(id)).toBe(snapshot().get(id))

    // Приход блока ветки: строки на месте с прежними линиями не перерисовываются.
    await expect.poll(() => held.some(call => call.start === BLOCK)).toBe(true)
    before = snapshot()
    work = await measure(async () => {
      held.find(call => call.start === BLOCK)!.answer()
      await expect.poll(() => bodyRow(`${branch}.${BLOCK}`)).not.toBeNull()
    })
    expectOnlyChanged(work, before)

    // Транзакция: строка в начало ветки — строки выше ветки на месте.
    before = snapshot()
    work = await measure(async () => {
      ;(
        table() as {
          applyRowTransaction: (transaction: unknown) => unknown
        }
      ).applyRowTransaction({
        parentId: branch,
        add: [{ ...kids[0], id: `${branch}.new` }],
        index: 0,
      })
      await expect.poll(() => bodyRow(`${branch}.new`)).not.toBeNull()
    })
    expectOnlyChanged(work, before)
  })
})

// Цена плагинов при прокрутке (ADR 0149, этап 5, PS10–PS13): сдвиг окна строк или колонок
// перерисовывает новое, а не всё, что на экране.
describe('сдвиг окна при прокрутке (ADR 0149)', () => {
  const WIDE = makeColumns(30)
  /** Ширина колонки данных: колонки WIDE одной ширины, служебные уже. */
  const columnStep = () =>
    Math.max(
      ...[
        ...document.querySelectorAll(
          '.data-grid__body-row .data-grid__body-cell[data-column-id]',
        ),
      ].map(cell => cell.getBoundingClientRect().width),
    )
  const headIds = () =>
    [...document.querySelectorAll('.data-grid__head-cell[data-column-id]')]
      .map(cell => cell.getAttribute('data-column-id'))
      .join()
  /** Сдвиг на одну колонку, без скелетов. */
  const stepColumns = async (grid: HTMLElement) => {
    const before = grid.scrollLeft
    grid.scrollLeft = before + columnStep()
    await expect.poll(() => grid.scrollLeft).toBeGreaterThan(before)
  }
  /** Сдвиг по колонке, пока окно колонок не сменится: полоса окна (ADR 0202) держит запас. */
  const shiftColumns = async (grid: HTMLElement) => {
    const before = headIds()
    for (let i = 0; i < 12 && headIds() === before; i++) {
      // eslint-disable-next-line no-await-in-loop
      await stepColumns(grid)
      // eslint-disable-next-line no-await-in-loop
      await new Promise(requestAnimationFrame)
    }
    expect(headIds()).not.toBe(before)
  }
  const mountWide = async (toggles: FeatureToggles, footer = false) => {
    const mounted = await mountGrid(
      toggles,
      getData(300),
      undefined,
      undefined,
      WIDE,
      footer,
    )
    // Первый сдвиг грузит модули и прогревает окно; меряется второй.
    await shiftColumns(mounted.grid)
    await waitForQuietDocument(500)
    return mounted
  }

  test('PS10: сдвиг окна колонок перерисовывает у видимой строки только список её ячеек: компонент строки и её обёртки не перерисовываются — по счётчикам работы', async () => {
    const { grid, measure } = await mountWide(ALL_PLUGINS)
    const rows = windowSize().rows
    const work = await measure(() => shiftColumns(grid))
    expect(renders(work, BodyRowCells), describeWork(work)).toBeGreaterThan(0)
    within(
      work,
      renders(work, BodyRowCells),
      rows * work.commits,
      'списки ячеек',
    )
    within(work, rowRenders(work), 0, 'строки')
  })

  test('WB2: пока видимое внутри полосы и впереди не меньше половины запаса, прокрутка не перерисовывает ни строк, ни списков ячеек — по счётчикам работы', async () => {
    const { grid, measure } = await mountWide(ALL_PLUGINS)
    // Окно колонок только что сменилось: впереди полоса держит два запаса.
    const columns = await measure(() => stepColumns(grid))
    within(columns, renders(columns, BodyRowCells), 0, 'списки ячеек')
    within(columns, rowRenders(columns), 0, 'строки при сдвиге колонок')
    const box = grid.getBoundingClientRect()
    const rowHeight = document
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    const wheelRow = async () => {
      const before = grid.scrollTop
      await browser.realWheel(
        { x: box.left + 200, y: box.top + 200 },
        rowHeight,
        1,
        0,
      )
      await expect.poll(() => grid.scrollTop).toBe(before + rowHeight)
    }
    // Первый сдвиг по оси снимает покой и наращивает полосу строк впереди (ADR 0202, WB10).
    await wheelRow()
    await waitForQuietDocument(500)
    const rows = await measure(wheelRow)
    within(rows, rowRenders(rows), 0, 'строки при сдвиге строк')
    within(
      rows,
      renders(rows, BodyRowCells),
      0,
      'списки ячеек при сдвиге строк',
    )
  })

  test('TN1: ячейка тела ядра без слотов перерисовывается одним компонентом BodyCell — без компонентов обёрток, слотов и ячейки ядра — по счётчикам работы', async () => {
    // Колонки с ячейкой ядра; сортировка новыми строками перерисовывает ячейки окна.
    const columns = ['firstName', 'lastName', 'age', 'visits'].map(id => ({
      id,
      accessorKey: id,
      header: id,
    }))
    const { measure, table, screen } = await mountGrid(
      { enableColumnSorting: true },
      getData(300),
      undefined,
      undefined,
      columns,
    )
    await waitForQuietDocument(300)
    const api = table() as {
      setSorting: (sorting: { id: string; desc: boolean }[]) => void
    }
    const work = await measure(async () => {
      api.setSorting([{ id: 'firstName', desc: true }])
      await waitForQuietDocument(300)
    })
    expect(renders(work, BodyCell), describeWork(work)).toBeGreaterThan(0)
    // Обёртка и слоты — компоненты у шапки и футера: сортировка перерисовывает шапку. Компонент на
    // ячейку тела дал бы не меньше перерисовок, чем строк.
    for (const component of [CellWrapperContent, RenderSlot]) {
      expect(
        renders(work, component as never),
        describeWork(work),
      ).toBeLessThan(renders(work, BodyRow))
    }
    for (const component of [CellWrapperTitle, RenderCellSlot, defaultCell]) {
      expect(renders(work, component as never), describeWork(work)).toBe(0)
    }
    await screen.unmount()
  })

  test('WB11: в кадре смены списка строк — сортировки — перерисовывается не больше ячеек, чем окно без полосы, — по счётчикам работы', async () => {
    const sortedCells = async () => {
      const { measure, table, screen } = await mountGrid(
        { enableColumnSorting: true },
        getData(300),
        undefined,
        undefined,
        WIDE,
      )
      const first = () =>
        document
          .querySelector('.data-grid__body-row[data-index="0"]')
          ?.getAttribute('data-row-id')
      const api = table() as {
        setSorting: (sorting: { id: string; desc: boolean }[]) => void
      }
      // Полоса после монтирования выросла: смена списка — из полосы в покой.
      await waitForQuietDocument(300)
      const before = first()
      // Замер кончается коммитом смены — до кадра, в котором полоса дорастает (WB12).
      const work = await measure(
        () =>
          new Promise<void>(resolve => {
            const observer = new MutationObserver(() => {
              if (first() === before) return
              observer.disconnect()
              resolve()
            })
            observer.observe(document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ['data-row-id'],
            })
            api.setSorting([{ id: 'firstName', desc: true }])
          }),
        { quietFrames: 0 },
      )
      await screen.unmount()
      return { cells: renders(work, BodyCell), work }
    }
    const withBand = await sortedCells()
    windowBand.enabled = false
    try {
      const without = await sortedCells()
      // Вариант мерил заявленное: сортировка перерисовала ячейки окна.
      expect(without.cells).toBeGreaterThan(0)
      within(
        withBand.work,
        withBand.cells,
        without.cells,
        'ячейки в кадре сортировки',
      )
    } finally {
      windowBand.enabled = true
    }
  })

  test('PS11: обёртки перетаскивания строки перерисовываются только при смене своей строки, а не при сдвиге окна строк или колонок — по счётчикам работы', async () => {
    const { grid, measure } = await mountGrid({ enableRowDragging: true })
    const box = grid.getBoundingClientRect()
    const at = { x: box.left + 200, y: box.top + 200 }
    const rowHeight = document
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    const wheel = async (rows: number) => {
      await browser.realWheel(at, rowHeight, 1, 0)
      await expect.poll(() => grid.scrollTop).toBe(rowHeight * rows)
    }
    await wheel(1)
    await waitForQuietDocument(500)
    // Окно строк сдвинулось на одну: перерисована только пришедшая строка.
    const work = await measure(() => wheel(2))
    within(work, renders(work, SortableRow), 1, 'строки')
    within(
      work,
      renders(work, ItemSortableContextProvider),
      1,
      'обёртки перетаскивания',
    )
  })

  test('PS12: сдвиг окна строк и колонок не перерисовывает тулбар', async () => {
    const { grid, measure } = await mountWide(ALL_PLUGINS)
    expect(
      document.querySelector('[data-testid="data-grid-toolbar"]'),
    ).not.toBeNull()
    const columns = await measure(() => shiftColumns(grid))
    within(columns, renders(columns, Toolbar), 0, 'тулбар при сдвиге колонок')
    const box = grid.getBoundingClientRect()
    const rowHeight = document
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    const before = grid.scrollTop
    const rows = await measure(async () => {
      await browser.realWheel(
        { x: box.left + 200, y: box.top + 200 },
        rowHeight,
        1,
        0,
      )
      await expect.poll(() => grid.scrollTop).toBe(before + rowHeight)
    })
    within(rows, renders(rows, Toolbar), 0, 'тулбар при сдвиге строк')
  })

  test('PS13: при прокрутке ячейки футера перерисовываются только новые', async () => {
    const { grid, measure } = await mountWide({}, true)
    const footerIds = () =>
      new Set(
        [...document.querySelectorAll('.data-grid__footer-cell')].map(cell =>
          cell.getAttribute('data-column-id'),
        ),
      )
    const before = footerIds()
    const work = await measure(() => shiftColumns(grid))
    const added = [...footerIds()].filter(id => !before.has(id)).length
    expect(added, describeWork(work)).toBeGreaterThan(0)
    within(work, renders(work, FooterCell), added, 'ячейки футера')
  })
})

/** Перерисовки компонента по имени: вид грида не экспортируется. */
const rendersNamed = (work: Work, name: string) =>
  [...work.components].reduce(
    (sum, [type, count]) =>
      (type as { name?: string } | null)?.name === name ? sum + count : sum,
    0,
  )

describe('Счётчики работы — маркер угла выделения (ADR 0198)', () => {
  test('HN15: протяжка маркера перерисовывает только ячейки, чьё членство в диапазоне изменилось, и маркер; строки и заголовки — нет', async () => {
    type Point = { x: number; y: number }
    const pointer = commands as unknown as {
      realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    const { measure, table } = await mountGrid({ enableCellSelection: true })
    const cellAt = (row: number, column: number) =>
      document
        .querySelector(`.data-grid__body-row[data-index="${row}"]`)!
        .querySelectorAll<HTMLElement>('.data-grid__body-cell[data-column-id]')[
        column
      ]!
    const center = (el: Element): Point => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const handle = () =>
      document.querySelector<HTMLElement>('[data-range-handle]:not([hidden])')
    await userEvent.click(cellAt(1, 1))
    await expect.poll(handle).not.toBeNull()
    // Смены ячеек: членство в диапазоне (атрибут) или его кромка (переменные стиля).
    const joined = new Set<Element>()
    let cellChanges = 0
    const observer = new MutationObserver(records => {
      const touched = new Set<Element>()
      for (const record of records) {
        const cell = record.target as Element
        if (record.oldValue === cell.getAttribute(record.attributeName!))
          continue
        touched.add(cell)
        if (record.attributeName === 'data-cell-selected') joined.add(cell)
      }
      cellChanges += touched.size
    })
    observer.observe(document.querySelector('.data-grid__body')!, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-cell-selected', 'style'],
      subtree: true,
    })
    // Записи диапазона за протяжку.
    type Atom = { subscribe: (listener: () => void) => { unsubscribe(): void } }
    const atom = (table() as { atoms: { cellSelection: Atom } }).atoms
      .cellSelection
    let writes = 0
    const subscription = atom.subscribe(() => writes++)
    const work = await measure(async () => {
      await pointer.realDragHold(center(handle()!), center(cellAt(3, 2)), 6)
      await pointer.realMouseUp()
    })
    observer.disconnect()
    subscription.unsubscribe()
    const summary = `${describeWork(work)}; смен ячеек ${cellChanges}, записей ${writes}`
    expect(cellAt(3, 2).hasAttribute('data-cell-selected'), summary).toBe(true)
    expect(joined.size, summary).toBe(5)
    expect(renders(work, BodyCell), summary).toBeLessThanOrEqual(cellChanges)
    // Маркер — со сменой диапазона или вместе с гридом (объявление выделения), а не на
    // каждое движение указателя.
    expect(renders(work, SelectionHandle), summary).toBeGreaterThan(0)
    expect(renders(work, SelectionHandle), summary).toBeLessThanOrEqual(
      writes + rendersNamed(work, 'DataGridView'),
    )
    expect(
      renders(work, BodyRow, SortableRow, BodyRowCells, HeadCellView),
      summary,
    ).toBe(0)
  })
})
