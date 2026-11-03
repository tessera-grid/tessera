import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, server as browser, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { DebugAction } from '../../../core/debugActions'
import type { TesseraFeatureEntry } from '../../../core/features'
import { setSearchByUser } from '../../../shared/filtering/filtering'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnSorting,
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
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Серверная группировка на гриде (ADR 0144, GS3–GS9): кнопка группировки серверным
// действием, строки-группы с числом строк и агрегатами, ветки групп, вложенные уровни,
// раскрытие при смене выборки, итог в футере, выбор строк данных. Выбор группы целиком —
// ADR 0148 (GX1–GX3, GX5–GX8, GX10–GX11, GX13); GX4, GX9, GX14 — модульный groupSelection.dom,
// GX12 — перф в scroll.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

/** Системный цвет палитры, как его отдаёт браузер. */
const systemColor = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

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
  keyboard,
  grouping = [],
  columns = COLUMNS,
  maxBlocks,
  colorMode,
  onTable,
  onDebugAction,
  footer = false,
  groupCounts = true,
  dataTypes,
}: {
  getRows: ReturnType<typeof server>['getRows']
  plugins?: readonly TesseraFeatureEntry[]
  /** Клавиатурная навигация (ADR 0170, §1). */
  keyboard?: boolean
  grouping?: string[]
  columns?: readonly object[]
  maxBlocks?: number
  colorMode?: 'light' | 'dark'
  onTable?: (table: GridTable) => void
  onDebugAction?: (action: DebugAction) => void
  footer?: boolean
  /** Сервер присылает число строк групп. */
  groupCounts?: boolean
  dataTypes?: Record<string, object>
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: columns as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    enableFooter: footer,
    dataTypes: dataTypes as never,
    onDebugAction: onDebugAction as never,
    // Свечение обновления сразу, без задержки показа (ADR 0094).
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      serverRowModel({
        getRows,
        blockSize: BLOCK,
        maxBlocks,
        getGroupChildCount: groupCounts ? (row: Item) => row.count : undefined,
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

      // Группировка: «сервер» держит ответ — прежние строки под свечением, у кнопки ожидания
      // нет (ADR 0177, §1).
      hold = true
      await clickGroup()
      await expect.poll(glowing).toBe(true)
      expect(lit(groupButton())).toBe(false)
      // Прежняя выборка ещё догружает окно: её запросы могут прийти после запроса новой.
      // Запрос новой выборки уходит с окном — под нагрузкой позже свечения.
      await expect
        .poll(() => calls.some(call => call.request.grouping.length > 0))
        .toBe(true)
      const request = calls
        .filter(call => call.request.grouping.length > 0)
        .at(-1)!.request
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
          keyboard
          plugins={[]}
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

  test('GS14: итог колонки без footer показан текстом по её типу — как значение её ячейки, с форматом и языком таблицы', async () => {
    const { getRows } = server(request => answerOf(request))
    const money = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    })
    const screen = await render(
      <Grid
        getRows={getRows}
        columns={COLUMNS.map(column =>
          column.id === 'amount' ? { ...column, dataType: 'money' } : column,
        )}
        dataTypes={{
          money: {
            extends: 'number',
            format: { style: 'currency', currency: 'USD' },
          },
        }}
        footer
      />,
    )
    try {
      await expect
        .poll(() => footerOf('amount'))
        .toBe(money.format(sumOf(allItems())))
    } finally {
      await screen.unmount()
    }
  })

  test('GS9: у строк данных — флажки; «выбрать всё, кроме» выбирает строки данных выборки, снятая строка — исключение в узле её группы; счётчик — из leafCount, без него — «все, кроме k»', async () => {
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
        expect(checkbox('r1')).not.toBeNull()

        await userEvent.click(q('.data-grid__head-cell .row-select-checkbox')!)
        await expect
          .poll(() => changes.at(-1))
          .toEqual({ all: true, except: [] })
        expect(rowOf('r1')!.getAttribute('data-selected')).toBe('true')
        await userEvent.click(checkbox('r1')!)
        await expect
          .poll(() => changes.at(-1))
          .toEqual({
            all: true,
            except: [],
            groups: [{ keys: ['C1'], all: true, except: ['r1'] }],
          })
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

describe('Выбор группы целиком (ADR 0148)', () => {
  const checkbox = (id: string) =>
    rowOf(id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
  const checked = (id: string) => checkbox(id)?.getAttribute('aria-checked')
  const count = () =>
    q('[data-testid="selected-rows-count"]')?.textContent?.trim() ?? ''
  const headCheckbox = () => q('.data-grid__head-cell .row-select-checkbox')!

  test('GX1: при серверной группировке и rowSelection у строки-группы есть флажок: нажатие выбирает группу целиком без загрузки её строк, повторное — снимает', async () => {
    const { calls, getRows } = server(request => answerOf(request))
    const changes: unknown[] = []
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        plugins={[
          rowSelection({ onRowSelectionChange: next => changes.push(next) }),
        ]}
      />,
    )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      expect(checked(groupId('C1'))).toBe('false')
      await humanClick(checkbox(groupId('C1'))!)
      await expect
        .poll(() => changes.at(-1))
        .toEqual({
          all: false,
          except: [],
          groups: [{ keys: ['C1'], all: true, except: [] }],
        })
      expect(checked(groupId('C1'))).toBe('true')
      // Строки группы не запрашивались: ветка свёрнута.
      expect(calls.some(call => call.request.parentId === groupId('C1'))).toBe(
        false,
      )
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => changes.at(-1)).toEqual({})
      expect(checked(groupId('C1'))).toBe('false')
    } finally {
      await screen.unmount()
    }
  })

  test('GX2: флажок группы в трёх состояниях: выбрано; частично — при исключениях, отдельно выбранных строках или выбранных подгруппах внутри; не выбрано', async () => {
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city', 'kind']}
        plugins={[rowSelection()]}
      />,
    )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      expect(checked(groupId('C1'))).toBe('false')
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')

      // Снятая подгруппа — частично; выбранная снова — выбрано.
      await expandRow(groupId('C1'))
      await expect.poll(() => checkbox(groupId('C1', 'B'))).not.toBeNull()
      expect(checked(groupId('C1', 'B'))).toBe('true')
      await humanClick(checkbox(groupId('C1', 'B'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('mixed')
      await humanClick(checkbox(groupId('C1', 'B'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')

      // Исключение строки — частично и у подгруппы, и у группы.
      await expandRow(groupId('C1', 'B'))
      await expect.poll(() => checkbox('r1')).not.toBeNull()
      await humanClick(checkbox('r1')!)
      await expect.poll(() => checked(groupId('C1', 'B'))).toBe('mixed')
      expect(checked(groupId('C1'))).toBe('mixed')

      // Отдельно выбранная строка невыбранной группы и выбранная подгруппа — частично.
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('false')
      await humanClick(checkbox('r1')!)
      await expect.poll(() => checked(groupId('C1'))).toBe('mixed')
      await humanClick(checkbox('r1')!)
      await expect.poll(() => checked(groupId('C1'))).toBe('false')
      await humanClick(checkbox(groupId('C1', 'A'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('mixed')
      expect(checked(groupId('C1', 'A'))).toBe('true')
    } finally {
      await screen.unmount()
    }
  })

  test('GX3: строки и подгруппы выбранной группы выглядят выбранными, в том числе пришедшие позже; снятый флажок строки — исключение в узле группы', async () => {
    const changes: unknown[] = []
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        plugins={[
          rowSelection({ onRowSelectionChange: next => changes.push(next) }),
        ]}
      />,
    )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      // Строки ветки приходят после выбора группы.
      await expandRow(groupId('C1'))
      await expect.poll(() => rowOf('r1')).not.toBeNull()
      expect(rowOf('r1')!.getAttribute('data-selected')).toBe('true')
      expect(checked('r1')).toBe('true')
      expect(rowOf(groupId('C1'))!.getAttribute('data-selected')).toBe('true')
      await humanClick(checkbox('r1')!)
      await expect
        .poll(() => changes.at(-1))
        .toEqual({
          all: false,
          except: [],
          groups: [{ keys: ['C1'], all: true, except: ['r1'] }],
        })
      expect(rowOf('r1')!.getAttribute('data-selected')).toBe('false')
      expect(rowOf('r8')!.getAttribute('data-selected')).toBe('true')
      // Строка соседней группы не выбрана.
      await expandRow(groupId('C0'))
      await expect.poll(() => rowOf('r0')).not.toBeNull()
      expect(rowOf('r0')!.getAttribute('data-selected')).toBe('false')
    } finally {
      await screen.unmount()
    }
  })

  test('GX5: «Выбрать всё» в шапке ставит all: true и сбрасывает узлы групп; снятие — пустой выбор', async () => {
    const changes: unknown[] = []
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        plugins={[
          rowSelection({ onRowSelectionChange: next => changes.push(next) }),
        ]}
      />,
    )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      await expect
        .poll(() => headCheckbox().getAttribute('aria-checked'))
        .toBe('mixed')
      await humanClick(headCheckbox())
      await expect.poll(() => changes.at(-1)).toEqual({ all: true, except: [] })
      expect(checked(groupId('C0'))).toBe('true')
      await humanClick(headCheckbox())
      await expect.poll(() => changes.at(-1)).toEqual({})
      expect(checked(groupId('C1'))).toBe('false')
    } finally {
      await screen.unmount()
    }
  })

  test('GX6: счётчик — при известном числе строк всех выбранных групп сумма минус исключения; без него — «N строк и k групп»', async () => {
    for (const groupCounts of [true, false]) {
      const { getRows } = server(request => answerOf(request))
      const screen = await render(
        <Grid
          getRows={getRows}
          grouping={['city']}
          groupCounts={groupCounts}
          plugins={[rowSelection({ selectedCount: true })]}
        />,
      )
      try {
        await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
        await humanClick(checkbox(groupId('C1'))!)
        await expandRow(groupId('C1'))
        await expect.poll(() => rowOf('r1')).not.toBeNull()
        await humanClick(checkbox('r1')!)
        await expandRow(groupId('C0'))
        await expect.poll(() => rowOf('r0')).not.toBeNull()
        await humanClick(checkbox('r0')!)
        await expect
          .poll(count)
          .toBe(
            groupCounts
              ? tableLabels.selectedRows(cityCount('C1') - 1 + 1)
              : tableLabels.selectedRowsAndGroups(
                  1,
                  tableLabels.selectedGroupsCount(1),
                ),
          )
      } finally {
        await screen.unmount()
      }
    }
  })

  test('GX7: смена группировки сбрасывает выбор; отказ серверного действия смены группировки возвращает прежний выбор', async () => {
    let refuse = false
    const changes: unknown[] = []
    const { getRows } = server(request =>
      refuse && request.grouping.length === 0
        ? new Error('Grouping change refused')
        : answerOf(request),
    )
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        plugins={[
          rowSelection({ onRowSelectionChange: next => changes.push(next) }),
        ]}
      />,
    )
    const selected = {
      all: false,
      except: [],
      groups: [{ keys: ['C1'], all: true, except: [] }],
    }
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => changes.at(-1)).toEqual(selected)

      // Отказ: группировка и выбор — прежние.
      refuse = true
      const before = changes.length
      await clickGroup()
      await expect.poll(banner).not.toBeNull()
      // Сброс, затем откат.
      expect(changes.slice(before, before + 1)).toEqual([{}])
      await expect.poll(() => changes.at(-1)).toEqual(selected)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')

      // Успех: выбор сброшен.
      refuse = false
      await clickGroup()
      await expect.poll(() => groupRows().length).toBe(0)
      expect(changes.at(-1)).toEqual({})
    } finally {
      await screen.unmount()
    }
  })

  test('GX8: сортировка, фильтр и поиск выбор групп не сбрасывают', async () => {
    const changes: unknown[] = []
    const { calls, getRows } = server(request => answerOf(request))
    let table: GridTable | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        onTable={t => (table = t)}
        plugins={[
          columnSorting(),
          quickSearchModel(),
          rowSelection({ onRowSelectionChange: next => changes.push(next) }),
        ]}
      />,
    )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')
      const after = changes.length

      let was = calls.length
      const sort = () =>
        q('.data-grid__head-cell[data-column-id="name"] .column-sort__button')
      await expect.poll(sort).not.toBeNull()
      await revealCellButtons(
        q('.data-grid__head-cell[data-column-id="name"]')!,
      )
      await humanClick(sort()!)
      await expect.poll(() => calls.length).toBeGreaterThan(was)
      await expect.poll(() => checked(groupId('C1'))).toBe('true')

      was = calls.length
      setSearchByUser(table as never, 'N1')
      await expect.poll(() => calls.length).toBeGreaterThan(was)
      expect(calls.at(-1)!.request.globalFilter).toBe('N1')
      await expect.poll(() => checked(groupId('C1'))).toBe('true')
      expect(changes).toHaveLength(after)
    } finally {
      await screen.unmount()
    }
  })

  test('GX10: с keyboardNavigation Space на строке-группе переключает её выбор; у строки-группы есть aria-selected', async () => {
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        keyboard
        plugins={[rowSelection()]}
      />,
    )
    try {
      await expect.poll(() => rowOf(groupId('C1'))).not.toBeNull()
      expect(rowOf(groupId('C1'))!.getAttribute('aria-selected')).toBe('false')
      await humanClick(cellOf(groupId('C1'), 'amount')!)
      await press(' ')
      await expect.poll(() => checked(groupId('C1'))).toBe('true')
      expect(rowOf(groupId('C1'))!.getAttribute('aria-selected')).toBe('true')
      await press(' ')
      await expect.poll(() => checked(groupId('C1'))).toBe('false')
      expect(rowOf(groupId('C1'))!.getAttribute('aria-selected')).toBe('false')
    } finally {
      await screen.unmount()
    }
  })

  test('GX11: axe с color-contrast для состояния «частично» в обеих темах; флажок группы в forced-colors', async () => {
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid getRows={getRows} grouping={['city']} plugins={[rowSelection()]} />,
    )
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      await expandRow(groupId('C1'))
      await expect.poll(() => rowOf('r1')).not.toBeNull()
      await humanClick(checkbox('r1')!)
      await expect.poll(() => checked(groupId('C1'))).toBe('mixed')
      await inBothThemes(async () => {
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
        ).toEqual([])
      })
      if (browser.browser !== 'webkit') {
        await fc.forcedColors(true)
        try {
          // Частичный флажок залит системным цветом выбора, как выбранный.
          const style = getComputedStyle(checkbox(groupId('C1'))!)
          expect(style.backgroundColor).toBe(systemColor('Highlight'))
          expect(
            (await axe.run(q('.data-grid-theme')!, options)).violations,
          ).toEqual([])
        } finally {
          await fc.forcedColors(false)
        }
      }
    } finally {
      await screen.unmount()
    }
  })

  test('GX13: канал действий сообщает выбор и снятие группы с путём её ключей', async () => {
    const actions: DebugAction[] = []
    const { getRows } = server(request => answerOf(request))
    const screen = await render(
      <Grid
        getRows={getRows}
        grouping={['city']}
        onDebugAction={action => actions.push(action)}
        plugins={[rowSelection()]}
      />,
    )
    const toggles = () =>
      actions.filter(
        action =>
          action.plugin === 'rowSelection' && action.action === 'toggleGroup',
      )
    try {
      await expect.poll(() => checkbox(groupId('C1'))).not.toBeNull()
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => toggles().length).toBe(1)
      expect(toggles()[0]).toMatchObject({
        source: 'pointer',
        detail: { keys: ['C1'], selected: true },
      })
      await humanClick(checkbox(groupId('C1'))!)
      await expect.poll(() => toggles().length).toBe(2)
      expect(toggles()[1]).toMatchObject({
        detail: { keys: ['C1'], selected: false },
      })
    } finally {
      await screen.unmount()
    }
  })
})
