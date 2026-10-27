import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import type { DebugAction } from '../../../core/debugActions'
import type { TesseraFeatureEntry } from '../../../core/features'
import { setSearchByUser } from '../../../core/filtering'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnSorting,
  keyboardNavigation,
  quickSearchModel,
  rowExpanding,
  rowGrouping,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS } from './a11y-helpers'

// Серверная группировка на гриде (ADR 0144, GS3–GS9): кнопка группировки серверным
// действием, строки-группы с числом строк и агрегатами, ветки групп, вложенные уровни,
// раскрытие при смене выборки, итог в футере, выбор строк данных.

interface Item {
  id: string
  name: string
  city: string
  kind: string
  amount: number
  count?: number
}

const TOTAL = 7000
const BLOCK = 100
const CITIES = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']

const itemAt = (index: number): Item => ({
  id: `r${index}`,
  name: `N${index}`,
  city: CITIES[index % CITIES.length]!,
  kind: index % 2 ? 'B' : 'A',
  amount: index % 10,
})
let items: Item[] | undefined
const allItems = () =>
  (items ??= Array.from({ length: TOTAL }, (_, i) => itemAt(i)))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'kind', accessorKey: 'kind', header: 'Kind' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    aggregationFn: 'sum',
  },
]
const NO_DATA: Item[] = []

const sumOf = (rows: readonly Item[]) =>
  rows.reduce((sum, row) => sum + row.amount, 0)

/** Ответ «сервера»: группы уровня или строки данных выборки, итоги — у корня. */
const answerOf = (
  request: ServerRowsRequest,
  { totals = true }: { totals?: boolean } = {},
): ServerRowsResponse<Item> => {
  const query = request.globalFilter.toLowerCase()
  const selection = allItems().filter(
    item =>
      (!query || item.name.toLowerCase().includes(query)) &&
      request.groupKeys.every(
        (value, level) => item[request.grouping[level] as keyof Item] === value,
      ),
  )
  const level = request.groupKeys.length
  let rows: Item[] = selection
  if (level < request.grouping.length) {
    const column = request.grouping[level] as keyof Item
    const groups = new Map<unknown, Item[]>()
    for (const item of selection) {
      groups.set(item[column], [...(groups.get(item[column]) ?? []), item])
    }
    rows = [...groups]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([value, members]) => ({
        id: '',
        name: '',
        city: column === 'city' ? (value as string) : '',
        kind: column === 'kind' ? (value as string) : '',
        amount: sumOf(members),
        count: members.length,
      }))
  }
  return {
    rows: rows.slice(request.start, request.end),
    rowCount: rows.length,
    ...(level === 0 &&
      totals && {
        totals: { amount: sumOf(selection), name: selection.length },
        leafCount: selection.length,
      }),
  }
}

type Answer = ServerRowsResponse<Item> | Error

interface Call {
  request: ServerRowsRequest
  settle: (answer: Answer) => void
}

/** «Сервер» по команде теста: `reply` отвечает сразу или ждёт (`undefined`). */
const server = (reply: (request: ServerRowsRequest) => Answer | undefined) => {
  const calls: Call[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const settle = (answer: Answer) =>
        answer instanceof Error ? reject(answer) : resolve(answer)
      calls.push({ request, settle })
      const now = reply(request)
      if (now) settle(now)
    })
  return { calls, getRows }
}

interface GridTable {
  store: { get: () => Record<string, unknown> }
  getColumnTotal: (columnId: string) => unknown
}

const Grid = ({
  getRows,
  plugins = [],
  grouping = [],
  columns = COLUMNS,
  maxBlocks,
  colorMode,
  onTable,
  onDebugAction,
  footer = false,
}: {
  getRows: ReturnType<typeof server>['getRows']
  plugins?: readonly TesseraFeatureEntry[]
  grouping?: string[]
  columns?: readonly object[]
  maxBlocks?: number
  colorMode?: 'light' | 'dark'
  onTable?: (table: GridTable) => void
  onDebugAction?: (action: DebugAction) => void
  footer?: boolean
}) => {
  const table = useCreateTable({
    columns: columns as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    enableFooter: footer,
    onDebugAction: onDebugAction as never,
    // Свечение обновления сразу, без задержки показа (ADR 0094).
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      serverRowModel({
        getRows,
        blockSize: BLOCK,
        maxBlocks,
        getGroupChildCount: (row: Item) => row.count,
      }),
      rowGrouping({ initialGrouping: grouping }),
      rowExpanding(),
      ...plugins,
    ] as never,
  })
  onTable?.(table as unknown as GridTable)
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const body = () => q('.data-grid__body')!
const nextFrame = () => new Promise(requestAnimationFrame)
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
const groupId = (...keys: unknown[]) => `group:${JSON.stringify(keys)}`
const rowOf = (id: string) => q(`.data-grid__body-row[data-row-id='${id}']`)
const cellOf = (id: string, columnId: string) =>
  rowOf(id)?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) ??
  null
const textOf = (id: string, columnId: string) =>
  cellOf(id, columnId)?.textContent?.trim() ?? ''
const toggleOf = (id: string) =>
  rowOf(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const groupRows = () => [
  ...document.querySelectorAll<HTMLElement>(
    '.data-grid__body-row[data-group-row="true"]',
  ),
]
const skeletonRows = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__body-row--skeleton'),
]
const errorRow = () => q('[data-testid="rows-load-error"]')
const glowing = () => !!q('[data-refreshing]')
const banner = () => q('[data-testid="load-error-banner"]')
const groupButton = () =>
  q('.data-grid__head-cell[data-column-id="city"] .column-group__button')
const lit = (element: Element | null) =>
  element?.getAttribute('aria-busy') === 'true'
const groupActive = () =>
  groupButton()
    ?.closest('[data-button-active]')
    ?.getAttribute('data-button-active')
const footerOf = (columnId: string) =>
  q(
    `.data-grid__footer-cell[data-column-id="${columnId}"]`,
  )?.textContent?.trim() ?? ''
const indentOf = (id: string) => {
  const cell = cellOf(id, 'name')!
  const content = cell.firstElementChild as HTMLElement
  return (
    content.getBoundingClientRect().left - cell.getBoundingClientRect().left
  )
}
const press = (keys: string) => userEvent.keyboard(keys)
/** Число группы: «C1 (1,000)» в любой локали чисел. */
const countOf = (count: number) =>
  new RegExp(`\\(${String(count).replace(/\B(?=(\d{3})+$)/g, '\\D?')}\\)$`)
const cityCount = (city: string) =>
  allItems().filter(item => item.city === city).length
const citySum = (city: string) =>
  sumOf(allItems().filter(item => item.city === city))

/** Нажать кнопку группировки колонки города (кнопки шапки — из ленивого модуля). */
const clickGroup = async () => {
  await expect.poll(groupButton).not.toBeNull()
  await revealCellButtons(q('.data-grid__head-cell[data-column-id="city"]')!)
  await humanClick(groupButton()!)
}

/** Раскрыть строку кнопкой и прочитать число строк, как тело. */
const expandRow = async (id: string) => {
  await expect.poll(() => toggleOf(id)).not.toBeNull()
  await humanClick(toggleOf(id)!)
  await expect
    .poll(() => toggleOf(id)?.getAttribute('aria-expanded'))
    .toBe('true')
}

describe('Серверная группировка (ADR 0144)', () => {
  test('GS3: кнопка группировки в SSRM — серверное действие: прежние строки под свечением, новая выборка с начала, раскрытие групп сброшено; отказ — откат среза и плашка; действие — в канале отладки', async () => {
    let refuse = false
    let hold = false
    const { calls, getRows } = server(request => {
      if (refuse && request.grouping.length > 0 && !request.parentId) {
        return new Error('Grouping is not available')
      }
      return hold && request.start === 0 && !request.parentId
        ? undefined
        : answerOf(request)
    })
    const actions: DebugAction[] = []
    let table: GridTable | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        onTable={t => (table = t)}
        onDebugAction={action => actions.push(action)}
      />,
    )
    const expanded = () => table!.store.get().expanded
    try {
      await expect.poll(() => rowOf('r0')).not.toBeNull()
      scroller().scrollTop = 500 * rowHeight()
      await expect.poll(() => rowOf('r500')).not.toBeNull()

      // Группировка: «сервер» держит ответ — прежние строки под свечением, кнопка ждёт.
      hold = true
      await clickGroup()
      await expect.poll(glowing).toBe(true)
      expect(lit(groupButton())).toBe(true)
      const request = calls.at(-1)!.request
      expect(request).toMatchObject({ start: 0, grouping: ['city'] })
      // Новая выборка — с начала списка; до ответа на экране начало прежнего.
      await expect.poll(() => scroller().scrollTop).toBe(0)
      await expect.poll(() => rowOf('r0')).not.toBeNull()
      expect(groupRows()).toHaveLength(0)
      expect(glowing()).toBe(true)
      hold = false
      calls.at(-1)!.settle(answerOf(request))
      await expect.poll(() => groupRows().length).toBe(CITIES.length)
      expect(glowing()).toBe(false)
      expect(groupActive()).toBe('true')
      expect(
        actions.some(
          action =>
            action.plugin === 'rowGrouping' &&
            action.action === 'serverRequest',
        ),
      ).toBe(true)

      // Раскрытая группа сбрасывается со сменой группировки.
      await expandRow(groupId('C1'))
      expect(expanded()).toEqual({ [groupId('C1')]: true })
      await clickGroup()
      await expect.poll(() => groupRows().length).toBe(0)
      await expect.poll(() => rowOf('r0')).not.toBeNull()
      expect(expanded()).toEqual({})

      // Отказ: срез группировки — назад, плашка с причиной.
      refuse = true
      await clickGroup()
      await expect.poll(banner).not.toBeNull()
      expect(banner()!.textContent).toContain('Grouping is not available')
      expect(groupActive()).toBe('false')
      expect(table!.store.get().grouping).toEqual([])
      expect(groupRows()).toHaveLength(0)
      expect(rowOf('r0')).not.toBeNull()
      expect(
        actions.some(
          action =>
            action.plugin === 'rowGrouping' &&
            action.action === 'serverRejected',
        ),
      ).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('GS4: строка-группа показывает значение группы, число строк из getGroupChildCount и агрегаты в ячейках колонок', async () => {
    const { getRows } = server(request => answerOf(request))
    const columns = COLUMNS.map(column =>
      column.id === 'amount'
        ? {
            ...column,
            cell: ({ getValue }: { getValue: () => unknown }) =>
              `Σ ${String(getValue())}`,
          }
        : column,
    )
    const screen = await render(
      <Grid getRows={getRows} grouping={['city']} columns={columns} />,
    )
    try {
      await expect.poll(() => rowOf(groupId('C1'))).not.toBeNull()
      expect(rowOf(groupId('C1'))!.getAttribute('data-group-row')).toBe('true')
      expect(textOf(groupId('C1'), 'city')).toMatch(/^C1 /)
      expect(textOf(groupId('C1'), 'city')).toMatch(countOf(cityCount('C1')))
      // Агрегат рисует ячейка колонки — со своим видом.
      expect(textOf(groupId('C1'), 'amount')).toBe(`Σ ${citySum('C1')}`)
    } finally {
      await screen.unmount()
    }
  })

  test('GS5: раскрытие группы — хранилище ветки: запрос с путём groupKeys, скелеты на высоту из числа строк группы, блоки, вытеснение и отказ блока — как у корней', async () => {
    let failParent: string | undefined
    let hold = true
    const { calls, getRows } = server(request => {
      if (!request.parentId) return answerOf(request)
      if (hold) return undefined
      if (request.parentId === failParent && request.start === BLOCK) {
        return new Error('Block failed')
      }
      return answerOf(request)
    })
    const screen = await render(
      <Grid getRows={getRows} grouping={['city']} maxBlocks={3} />,
    )
    try {
      await expect.poll(() => rowOf(groupId('C1'))).not.toBeNull()
      const before = body().getBoundingClientRect().height
      await expandRow(groupId('C1'))
      const branch = () =>
        calls.filter(call => call.request.parentId === groupId('C1'))
      await expect.poll(() => branch().length).toBe(1)
      expect(branch()[0]!.request).toMatchObject({
        groupKeys: ['C1'],
        start: 0,
        end: BLOCK,
      })
      // До ответа — скелеты на всю группу: тело выросло на её строки.
      await expect.poll(() => skeletonRows().length).toBeGreaterThan(0)
      expect(body().getBoundingClientRect().height - before).toBeCloseTo(
        cityCount('C1') * rowHeight(),
        -1,
      )
      hold = false
      failParent = groupId('C1')
      branch()[0]!.settle(answerOf(branch()[0]!.request))
      await expect.poll(() => rowOf('r1')).not.toBeNull()

      // Второй блок ветки отказал: строка ошибки в её строках.
      const index = Number(rowOf(groupId('C1'))!.dataset.index)
      scroller().scrollTop = (index + BLOCK + 5) * rowHeight()
      await expect.poll(errorRow).not.toBeNull()
      failParent = undefined

      // Вытеснение: блоки дальше в ветке уходят за предел, возврат к началу — новый запрос.
      for (const block of [3, 5, 7]) {
        scroller().scrollTop = (index + block * BLOCK + 5) * rowHeight()
        await nextFrame()
        await expect
          .poll(() =>
            branch().some(call => call.request.start === block * BLOCK),
          )
          .toBe(true)
      }
      const firstRequests = () =>
        branch().filter(call => call.request.start === 0).length
      const was = firstRequests()
      scroller().scrollTop = index * rowHeight()
      await expect.poll(firstRequests).toBe(was + 1)
    } finally {
      await screen.unmount()
    }
  })

  test('GS6: вложенные группы любой глубины — уровень отступом, кнопка и клавиши раскрытия, aria-level, aria-posinset и aria-setsize у групп и строк данных в роли treegrid; axe и контраст', async () => {
    const { getRows } = server(request => answerOf(request))
    for (const colorMode of ['light', 'dark'] as const) {
      const screen = await render(
        <Grid
          getRows={getRows}
          grouping={['city', 'kind']}
          plugins={[keyboardNavigation()]}
          colorMode={colorMode}
        />,
      )
      try {
        await expect.poll(() => rowOf(groupId('C1'))).not.toBeNull()
        await expandRow(groupId('C1'))
        await expect.poll(() => rowOf(groupId('C1', 'A'))).not.toBeNull()
        // Второй уровень — клавишей: Enter на ячейке раскрытия.
        await humanClick(cellOf(groupId('C1', 'A'), 'name')!)
        await press('{ArrowLeft}')
        await expect
          .poll(() =>
            document.activeElement?.contains(toggleOf(groupId('C1', 'A'))),
          )
          .toBe(true)
        await press('{Enter}')
        await expect.poll(() => rowOf('r8')).not.toBeNull()

        expect(q('[role="treegrid"]')).not.toBeNull()
        const aria = (id: string) => {
          const row = rowOf(id)!
          return [
            row.getAttribute('aria-level'),
            row.getAttribute('aria-posinset'),
            row.getAttribute('aria-setsize'),
          ]
        }
        expect(aria(groupId('C1'))).toEqual(['1', '2', String(CITIES.length)])
        expect(aria(groupId('C1', 'A'))).toEqual(['2', '1', '2'])
        const leaves = allItems().filter(
          item => item.city === 'C1' && item.kind === 'A',
        )
        expect(aria('r8')).toEqual(['3', '1', String(leaves.length)])
        // Отступ — шаг уровня у каждого уровня.
        const step = indentOf(groupId('C1', 'A')) - indentOf(groupId('C1'))
        expect(step).toBeGreaterThan(0)
        expect(indentOf('r8') - indentOf(groupId('C1', 'A'))).toBe(step)

        const { violations } = await axe.run(q('.data-grid-theme')!, {
          ...AXE_OPTIONS,
          runOnly: {
            type: 'rule',
            values: [
              'color-contrast',
              'aria-required-children',
              'aria-allowed-attr',
            ],
          },
        })
        expect(violations.map(v => `${colorMode}: ${v.id}`)).toEqual([])
      } finally {
        await screen.unmount()
      }
    }
  })

  test('GS7: смена сортировки, фильтра или поиска сохраняет раскрытые группы; их строки запрашиваются заново, когда ветка в окне', async () => {
    const { calls, getRows } = server(request => answerOf(request))
    let table: GridTable | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        plugins={[columnSorting(), quickSearchModel()]}
        onTable={t => (table = t)}
      />,
    )
    const branchRequests = () =>
      calls.filter(call => call.request.parentId === groupId('C1')).length
    try {
      await expandRow(groupId('C1'))
      await expect.poll(() => rowOf('r1')).not.toBeNull()

      // Сортировка кнопкой шапки.
      let was = branchRequests()
      const sort = () =>
        q('.data-grid__head-cell[data-column-id="name"] .column-sort__button')
      await expect.poll(sort).not.toBeNull()
      await revealCellButtons(
        q('.data-grid__head-cell[data-column-id="name"]')!,
      )
      await humanClick(sort()!)
      await expect.poll(branchRequests).toBe(was + 1)
      expect(calls.at(-1)!.request.sorting).toMatchObject([{ id: 'name' }])
      expect(table!.store.get().expanded).toEqual({ [groupId('C1')]: true })
      await expect
        .poll(() => toggleOf(groupId('C1'))?.getAttribute('aria-expanded'))
        .toBe('true')

      // Поиск — тот же путь: раскрытие на месте, строки ветки заново.
      was = branchRequests()
      setSearchByUser(table as never, 'N1')
      await expect.poll(branchRequests).toBe(was + 1)
      expect(calls.at(-1)!.request.globalFilter).toBe('N1')
      expect(table!.store.get().expanded).toEqual({ [groupId('C1')]: true })
    } finally {
      await screen.unmount()
    }
  })

  test('GS8: totals ответа корня — в футере колонок: колонка без footer показывает значение итога, своя функция footer читает его table.getColumnTotal; новая выборка — новый итог', async () => {
    const { getRows } = server(request => answerOf(request))
    let table: GridTable | undefined
    const columns = COLUMNS.map(column =>
      column.id === 'name'
        ? {
            ...column,
            footer: ({ table: t }: { table: GridTable }) =>
              `Rows: ${String(t.getColumnTotal('name'))}`,
          }
        : column,
    )
    const screen = await render(
      <Grid
        getRows={getRows}
        columns={columns}
        footer
        plugins={[quickSearchModel()]}
        onTable={t => (table = t)}
      />,
    )
    try {
      await expect
        .poll(() => footerOf('amount'))
        .toBe(String(sumOf(allItems())))
      expect(footerOf('name')).toBe(`Rows: ${TOTAL}`)
      expect(footerOf('city')).toBe('')
      const found = allItems().filter(item => item.name.includes('N1'))
      setSearchByUser(table as never, 'N1')
      await expect.poll(() => footerOf('amount')).toBe(String(sumOf(found)))
      expect(footerOf('name')).toBe(`Rows: ${found.length}`)
    } finally {
      await screen.unmount()
    }
  })

  test('GS9: флажки — только у строк данных; «выбрать всё, кроме» выбирает строки данных выборки, счётчик — из leafCount, без него — «все, кроме k»', async () => {
    for (const totals of [true, false]) {
      const { getRows } = server(request => answerOf(request, { totals }))
      const changes: unknown[] = []
      const screen = await render(
        <Grid
          getRows={getRows}
          grouping={['city']}
          plugins={[
            rowSelection({
              selectedCount: true,
              onRowSelectionChange: next => changes.push(next),
            }),
          ]}
        />,
      )
      const checkbox = (id: string) =>
        rowOf(id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
      const count = () =>
        q('[data-testid="selected-rows-count"]')?.textContent?.trim() ?? ''
      try {
        await expandRow(groupId('C1'))
        await expect.poll(() => rowOf('r1')).not.toBeNull()
        expect(checkbox(groupId('C1'))).toBeNull()
        expect(checkbox('r1')).not.toBeNull()

        await userEvent.click(q('.data-grid__head-cell .row-select-checkbox')!)
        await expect
          .poll(() => changes.at(-1))
          .toEqual({ all: true, except: [] })
        expect(rowOf('r1')!.getAttribute('data-selected')).toBe('true')
        expect(rowOf(groupId('C1'))!.getAttribute('data-selected')).not.toBe(
          'true',
        )
        await userEvent.click(checkbox('r1')!)
        await expect
          .poll(() => changes.at(-1))
          .toEqual({ all: true, except: ['r1'] })
        await expect
          .poll(count)
          .toBe(
            totals
              ? tableLabels.selectedRows(TOTAL - 1)
              : tableLabels.selectedAllExcept(1),
          )
      } finally {
        await screen.unmount()
      }
    }
  })
})
