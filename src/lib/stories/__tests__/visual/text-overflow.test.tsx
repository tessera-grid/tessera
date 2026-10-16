import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { beforeEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { MenuAction, RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnVisibility,
  contextMenu,
  dataExport,
  infiniteScroll,
  pagination,
  quickSearch,
  rowActionMenu,
  rowActions,
  rowSelection,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Длинный текст (ADR 0083; TX1–TX7, TX9–TX11, TX13). Модульный TX8 — в
// `textOverflow`, перф TX12 — в `interaction`.

const LONG =
  'Reassign the account to another manager in the same regional office'
const LONG_SUB =
  'Northern distribution network and its regional warehouses near the coast'
const LONG_OPTION = 'Awaiting review by the regional compliance department'
const LONG_HEADER = 'Customer account responsible for the regional contract'
const LONG_REASON =
  'Gateway timeout while the reporting service was rebuilding the regional index for the requested period, after the nightly import of contracts, invoices and shipments from every regional warehouse had been delayed by maintenance; try again in a minute'

const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
const leaf = (id: string, label: string): MenuAction => ({
  id,
  icon: icon(label[0]!),
  label: () => label,
  onSelect: () => {},
})

const ROW_ACTIONS: RowAction[] = [
  { ...leaf('reassign', LONG), slot: 'actionRowSlot', order: 0 },
  {
    ...leaf('move', `Move to ${LONG_SUB}`),
    hint: () => 'North',
    submenu: () => ({
      title: 'Move to',
      items: [leaf('north', LONG_SUB), leaf('south', 'South')],
    }),
    slot: 'actionRowSlot',
    order: 1,
  },
  {
    ...leaf('pin', `Keep ${LONG_SUB} pinned`),
    active: () => true,
    slot: 'actionRowSlot',
    order: 2,
  },
  { ...leaf('archive', 'Archive'), slot: 'actionRowSlot', order: 3 },
]

const longActions = definePlugin()({
  id: 'longActions',
  slotActions: ROW_ACTIONS,
  contextMenuActions: ROW_ACTIONS,
})

const OPTIONS = [
  { value: 'review', label: LONG_OPTION },
  {
    value: 'approved',
    label: 'Approved after the second round of negotiations with procurement',
  },
  { value: 'won', label: 'Won' },
]

interface Item {
  id: string
  account: string
  status: string
}

const DATA: Item[] = Array.from({ length: 120 }, (_, i) => ({
  id: `r${i}`,
  account: `Account ${i}`,
  status: i % 2 ? 'won' : 'review',
}))

const COLUMNS = [
  {
    id: 'account',
    accessorKey: 'account',
    header: LONG_HEADER,
    size: 200,
    filter: 'text',
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    size: 160,
    options: OPTIONS,
    filter: 'select',
  },
]

let table: any

const Grid = ({ width = 720 }: { width?: number }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      longActions(),
      rowActions(),
      rowActionMenu({ mode: 'always' }),
      contextMenu(),
      columnVisibility(),
      columnFiltering({ filteredCount: true }),
      quickSearch(),
      rowSelection({ selectedCount: true }),
      pagination(),
      dataExport({
        presets: [{ id: 'long', label: `Only ${LONG_SUB}` }],
      }),
    ] as never,
  })
  return (
    <div data-testid="host" style={{ width, height: 480 }}>
      <DataGrid
        table={table}
        localization={{
          search: 'Search accounts, managers, regions and contract numbers',
        }}
      />
    </div>
  )
}

let rejects: ((error: Error) => void)[] = []

const Feed = () => {
  const feed = useCreateTable({
    columns: COLUMNS as never,
    data: DATA.slice(0, 30),
    getRowId: (row: Item) => row.id,
    plugins: [
      infiniteScroll({
        hasMore: true,
        rowCount: 100_000,
        loadedCount: true,
        onLoadMore: () =>
          new Promise<void>((_resolve, reject) => rejects.push(reject)),
      }),
    ] as never,
  })
  return (
    <div data-testid="host" style={{ width: 480, height: 400 }}>
      <DataGrid table={feed as never} />
    </div>
  )
}

const frame = () => new Promise(requestAnimationFrame)
const frames = async (count = 3) => {
  for (let i = 0; i < count; i++) await frame()
}
const settle = async () => {
  await frame()
  await Promise.all(
    document
      .getAnimations()
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )
}

const mount = async (width?: number) => {
  await render(<Grid width={width} />)
  await waitForGrid()
}

const rect = (el: Element) => el.getBoundingClientRect()
/** Текст выше блока: Chromium и Firefox — по `scrollHeight`, WebKit — по `Range`. */
const clipped = (el: HTMLElement) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return (
    el.scrollHeight > el.clientHeight + 1 ||
    range.getBoundingClientRect().height > rect(el).height + lineHeight(el) / 2
  )
}
const lineHeight = (el: Element) => parseFloat(getComputedStyle(el).lineHeight)
const host = () => document.querySelector<HTMLElement>('[data-testid="host"]')!
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = () => [
  ...document.querySelectorAll<HTMLElement>(
    '[role="menuitem"], [role="menuitemcheckbox"]',
  ),
]
const labelOf = (el: Element) =>
  el.querySelector<HTMLElement>('[class*="itemLabel"]')!
const itemByText = (text: string) =>
  items().find(el => labelOf(el)?.textContent === text)!
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (id: string, column = 'account') =>
  rowEl(id).querySelector<HTMLElement>(`[data-column-id="${column}"]`)!
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const statusBar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')!
const layout = () => statusBar().getAttribute('data-status-bar-layout')
const setWidth = async (width: number) => {
  host().style.width = `${width}px`
  await frames(4)
}
const narrowUntil = async (target: string) => {
  for (let width = 900; width >= 100; width -= 10) {
    await setWidth(width)
    if (layout() === target) return
  }
  throw new Error(`layout ${target} not reached`)
}

const openRowMenu = async (id = 'r1') => {
  await userEvent.hover(cellEl(id))
  const kebab = () =>
    rowEl(id).querySelector<HTMLElement>('[aria-label^="Row options"]')
  await expect.poll(kebab).not.toBeNull()
  await humanClick(kebab()!)
  await expect.poll(() => items().length).toBeGreaterThan(0)
  await settle()
}
const closeMenu = async () => {
  for (let i = 0; i < 4 && items().length > 0; i++) {
    await userEvent.keyboard('{Escape}')
    await settle()
  }
}

/** Пункт в несколько строк: подпись выше одной строки, пункт выше минимума. */
const isWrapped = (item: HTMLElement) =>
  rect(labelOf(item)).height > lineHeight(labelOf(item)) * 1.5

const expectWrappedMenu = (popup: HTMLElement, label: string) => {
  expect(rect(popup).width).toBeLessThanOrEqual(320.5)
  expect(popup.scrollWidth).toBeLessThanOrEqual(popup.clientWidth + 0.5)
  const item = items().find(el => labelOf(el)?.textContent === label)!
  expect(isWrapped(item)).toBe(true)
  expect(rect(item).right).toBeLessThanOrEqual(rect(popup).right + 0.5)
}

/** Короткая форма счётчика — псевдоэлемент узла `aria-hidden`. */
const shortOf = (count: HTMLElement) =>
  count.querySelector<HTMLElement>('[aria-hidden="true"][data-short]')

/** Видимый текст счётчика: полная форма или короткая из псевдоэлемента. */
const shownForm = (count: HTMLElement) => {
  const short = shortOf(count)
  return !short || getComputedStyle(short).display === 'none'
    ? count.textContent
    : getComputedStyle(short, '::after').content.replace(/^"(.*)"$/, '$1')
}

const selectAll = () =>
  userEvent.click(
    document.querySelector<HTMLElement>('.data-grid__head [role="checkbox"]')!,
  )

beforeEach(async () => {
  rejects = []
  await cleanup()
})

describe('Длинный текст', () => {
  test('TX1: меню действий — кебаб, контекстное и панель экспорта — не шире 320px, длинная подпись переносится', async () => {
    await mount()
    await openRowMenu()
    expectWrappedMenu(menu()!, LONG)
    const short = itemByText('Archive')
    expect(isWrapped(short)).toBe(false)
    expect(Math.round(rect(short).height)).toBe(32)
    await closeMenu()

    await userEvent.click(cellEl('r2'), { button: 'right' })
    await expect.poll(() => items().length).toBeGreaterThan(0)
    await settle()
    expectWrappedMenu(menu()!, LONG)
    await closeMenu()

    const exportButton = () =>
      document.querySelector<HTMLElement>('[data-testid="export-button"]')
    await expect.poll(exportButton).not.toBeNull()
    await userEvent.click(exportButton()!)
    const preset = () =>
      document.querySelector<HTMLElement>('[data-testid="export-preset-long"]')
    await expect.poll(preset).not.toBeNull()
    await settle()
    const popup = preset()!.closest<HTMLElement>('[data-side]')!
    expect(rect(popup).width).toBeLessThanOrEqual(320.5)
    const label = labelOf(preset()!)
    expect(rect(label).height).toBeGreaterThan(lineHeight(label) * 1.5)
  })

  test('TX2: подсказка и шеврон раздела — в одну строку справа; иконка, галочка и шеврон — по первой строке подписи', async () => {
    await mount()
    await openRowMenu()
    const move = itemByText(`Move to ${LONG_SUB}`)
    const label = labelOf(move)
    expect(isWrapped(move)).toBe(true)
    const firstLine = rect(label).top + lineHeight(label) / 2
    const center = (el: Element) => (rect(el).top + rect(el).bottom) / 2
    const hint = move.querySelector<HTMLElement>('[class*="itemHint"]')!
    const chevron = move.querySelector<HTMLElement>('[class*="itemCheck"]')!
    const glyph = move.querySelector<HTMLElement>('[class*="itemIcon"]')!
    expect(hint.textContent).toBe('North')
    expect(rect(hint).height).toBeLessThan(lineHeight(label) * 1.5)
    expect(rect(hint).left).toBeGreaterThanOrEqual(rect(label).right - 0.5)
    expect(rect(chevron).left).toBeGreaterThanOrEqual(rect(hint).right - 0.5)
    for (const el of [hint, chevron, glyph])
      expect(Math.abs(center(el) - firstLine)).toBeLessThan(2)

    const pinned = itemByText(`Keep ${LONG_SUB} pinned`)
    const check = pinned.querySelector<HTMLElement>('[class*="itemCheck"]')!
    expect(check.querySelector('svg')).not.toBeNull()
    expect(
      Math.abs(
        center(check) -
          (rect(labelOf(pinned)).top + lineHeight(labelOf(pinned)) / 2),
      ),
    ).toBeLessThan(2)
  })

  test('TX3: раздел с многострочными пунктами — окно меню подстраивает высоту, пункты внутри, ширина не больше 320px', async () => {
    await mount()
    await openRowMenu()
    await humanClick(itemByText(`Move to ${LONG_SUB}`))
    await expect
      .poll(() => items().some(el => labelOf(el)?.textContent === LONG_SUB))
      .toBe(true)
    await settle()
    const popup = menu()!
    const level = popup.querySelector<HTMLElement>('[data-menu-level]')!
    const sections = popup.querySelector<HTMLElement>('[class*="sections"]')!
    expect(isWrapped(itemByText(LONG_SUB))).toBe(true)
    expect(Math.abs(rect(sections).height - rect(level).height)).toBeLessThan(1)
    expect(rect(itemByText('South')).bottom).toBeLessThanOrEqual(
      rect(sections).bottom + 0.5,
    )
    expect(rect(popup).width).toBeLessThanOrEqual(320.5)
  })

  test('TX4: «Колонки» и чек-лист вариантов — подпись в одну строку с многоточием, тултип только у обрезанной', async () => {
    await mount()
    const columnsButton = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-button"]',
      )
    await expect.poll(columnsButton).not.toBeNull()
    await userEvent.click(columnsButton()!)
    const columnLabel = (id: string) =>
      document.querySelector<HTMLElement>(
        `[data-testid="column-visibility-menu"] [data-column-id="${id}"] [class*="label"]`,
      )
    await expect.poll(() => columnLabel('account')).not.toBeNull()
    await settle()
    const long = columnLabel('account')!
    expect(getComputedStyle(long).textOverflow).toBe('ellipsis')
    expect(long.scrollWidth).toBeGreaterThan(long.clientWidth)
    await userEvent.hover(long)
    await expect.poll(tooltipShown(LONG_HEADER)).toBe(true)
    await userEvent.hover(columnLabel('status')!)
    await expect.poll(tooltipShown(LONG_HEADER)).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(tooltipShown('Status')()).toBe(false)
    await userEvent.keyboard('{Escape}')

    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="status"]',
    )!
    await userEvent.hover(head)
    const filterButton = () =>
      head.querySelector<HTMLElement>('.column-filter__button')
    await expect.poll(filterButton).not.toBeNull()
    await humanClick(filterButton()!)
    const optionLabel = (value: string) =>
      document.querySelector<HTMLElement>(
        `[data-testid="filter-panel"] [data-value="${value}"] [class*="label"]`,
      )
    await expect.poll(() => optionLabel('review')).not.toBeNull()
    await settle()
    const option = optionLabel('review')!
    expect(getComputedStyle(option).textOverflow).toBe('ellipsis')
    expect(option.scrollWidth).toBeGreaterThan(option.clientWidth)
    await userEvent.hover(option)
    await expect.poll(tooltipShown(LONG_OPTION)).toBe(true)
  })

  test('TX5: сводка фильтров — условие не больше двух строк с многоточием, полный текст в тултипе', async () => {
    await mount()
    table.setColumnFilters([
      {
        id: 'status',
        value: { operator: 'anyOf', value: ['review', 'approved'] },
      },
    ])
    const button = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="filter-summary-button"]',
      )
    await expect.poll(button).not.toBeNull()
    await humanClick(button()!)
    const condition = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="filter-summary"] [data-column-id="status"] [class*="condition"]',
      )
    await expect.poll(condition).not.toBeNull()
    await settle()
    const el = condition()!
    expect(el.textContent).toContain(LONG_OPTION)
    expect(rect(el).height).toBeLessThanOrEqual(lineHeight(el) * 2 + 1)
    expect(rect(el).height).toBeGreaterThan(lineHeight(el) * 1.5)
    expect(clipped(el)).toBe(true)
    await userEvent.hover(el)
    await expect.poll(tooltipShown(el.textContent!.trim())).toBe(true)
  })

  test('TX6: в компактном виде панели счётчики — короткая форма, полная — доступный текст', async () => {
    // Полный вид, где он помещается: при 720px счётчики фильтра и выбора его не вмещают.
    await mount(900)
    await selectAll()
    table.setColumnFilters([
      { id: 'status', value: { operator: 'anyOf', value: ['review'] } },
    ])
    const count = (id: string) =>
      statusBar().querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    await expect.poll(() => count('filtered-rows-count')).not.toBeNull()
    // Вид панель выбирает замером в следующем кадре после смены содержимого.
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    expect(layout()).toBe('full')
    expect(shownForm(count('selected-rows-count'))).toBe(
      '25 rows selected, 12 hidden by filters',
    )

    await narrowUntil('compact')
    expect(shownForm(count('selected-rows-count'))).toBe(
      '25 selected, 12 hidden',
    )
    expect(shownForm(count('filtered-rows-count'))).toBe('60 / 120')
    // Доступный текст — полная форма; короткая из него исключена.
    expect(count('selected-rows-count').textContent).toBe(
      '25 rows selected, 12 hidden by filters',
    )
    expect(
      shortOf(count('selected-rows-count'))!.getAttribute('aria-hidden'),
    ).toBe('true')
    await cleanup()

    await render(<Feed />)
    await waitForGrid()
    const loaded = () =>
      statusBar().querySelector<HTMLElement>(
        '[data-testid="loaded-rows-count"]',
      )!
    expect(shownForm(loaded())).toBe('Loaded 30 of 100,000')
    await narrowUntil('compact')
    expect(shownForm(loaded())).toBe('30 / 100,000')
    expect(loaded().textContent).toBe('Loaded 30 of 100,000')
  })

  test('TX7: числа счётчиков и диапазон пагинации не обрезаются ни в одном виде панели', async () => {
    await mount()
    await selectAll()
    table.setColumnFilters([
      { id: 'status', value: { operator: 'anyOf', value: ['review'] } },
    ])
    const notCut = (el: HTMLElement) =>
      el.scrollWidth <= el.clientWidth + 0.5 &&
      rect(el).right <= rect(statusBar()).right + 0.5 &&
      rect(el).left >= rect(statusBar()).left - 0.5
    const counts = () => [
      ...statusBar().querySelectorAll<HTMLElement>('[data-status-count]'),
    ]
    const range = () =>
      [...statusBar().querySelectorAll<HTMLElement>('span')].find(el =>
        /^\d+–\d+ of \d+$/.test(el.textContent ?? ''),
      )!
    for (const width of [900, 520, 360, 260]) {
      await setWidth(width)
      for (const el of [...counts(), range()])
        expect(notCut(el), `${width}px ${shownForm(el)}`).toBe(true)
    }
    expect(layout()).toBe('stacked')
  })

  test('TX9: плейсхолдер поиска в суженном поле — с многоточием', async () => {
    await mount(420)
    const search = () =>
      document.querySelector<HTMLInputElement>('input[type="search"]')
    await expect.poll(search).not.toBeNull()
    const input = search()!
    expect(input.placeholder).toBe(
      'Search accounts, managers, regions and contract numbers',
    )
    expect(getComputedStyle(input).textOverflow).toBe('ellipsis')
    const probe = document.createElement('span')
    probe.style.font = getComputedStyle(input).font
    probe.style.whiteSpace = 'nowrap'
    probe.textContent = input.placeholder
    document.body.appendChild(probe)
    const textWidth = rect(probe).width
    probe.remove()
    expect(textWidth).toBeGreaterThan(input.clientWidth)
  })

  test('TX10: причина отказа ленты — не больше двух строк с многоточием, тултип с полным текстом, высота строки прежняя', async () => {
    await render(<Feed />)
    await waitForGrid()
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = scroller.scrollHeight
    await expect.poll(() => rejects.length).toBe(1)
    rejects[0]!(new Error(LONG_REASON))
    const errorRow = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="infinite-scroll-error"]',
      )
    await expect.poll(errorRow).not.toBeNull()
    await frames()
    const reason = errorRow()!.querySelector<HTMLElement>(
      '[class*="error-reason"]',
    )!
    expect(rect(reason).height).toBeLessThanOrEqual(lineHeight(reason) * 2 + 1)
    expect(clipped(reason)).toBe(true)
    const row = errorRow()!.closest<HTMLElement>('[class*="error-row"]')!
    const token = getComputedStyle(row).getPropertyValue(
      '--tsr-comp-load-more-height',
    )
    const probe = document.createElement('div')
    probe.style.height = token
    row.parentElement!.appendChild(probe)
    expect(rect(row).height).toBeCloseTo(rect(probe).height, 0)
    probe.remove()
    expect(rect(errorRow()!).bottom).toBeLessThanOrEqual(rect(row).bottom + 0.5)
    await userEvent.hover(reason)
    await expect.poll(tooltipShown(LONG_REASON)).toBe(true)
  })

  test('TX11: axe с color-contrast в обеих темах — многострочный пункт меню, двухстрочное условие, короткая форма счётчиков', async () => {
    const run = (root: HTMLElement, state: string) =>
      inBothThemes(async () => {
        const { violations } = await axe.run(root, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(violations, state).toEqual([])
      })

    // Текст в поповерах axe часто относит к «не определено» — контраст меряем сами.
    const textContrast = (el: HTMLElement, state: string) =>
      inBothThemes(async () => {
        expect(
          contrast(toRgba(getComputedStyle(el).color), backgroundOf(el)),
          state,
        ).toBeGreaterThanOrEqual(4.5)
      })

    await mount()
    await openRowMenu()
    await run(menu()!, 'меню')
    await textContrast(labelOf(itemByText(LONG)), 'пункт меню')
    await closeMenu()

    table.setColumnFilters([
      { id: 'status', value: { operator: 'anyOf', value: ['review'] } },
    ])
    const button = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="filter-summary-button"]',
      )
    await expect.poll(button).not.toBeNull()
    await humanClick(button()!)
    const summary = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-summary"]')
    await expect.poll(summary).not.toBeNull()
    await settle()
    await run(summary()!, 'сводка')
    await textContrast(
      summary()!.querySelector<HTMLElement>('[class*="condition"]')!,
      'условие',
    )
    await userEvent.keyboard('{Escape}')

    await selectAll()
    await narrowUntil('compact')
    await run(statusBar(), 'панель')
    await textContrast(
      statusBar().querySelector<HTMLElement>('[data-status-count]')!,
      'счётчик',
    )
  })
})
