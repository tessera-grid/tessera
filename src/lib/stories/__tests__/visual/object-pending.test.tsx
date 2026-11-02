import { commands, userEvent } from 'vitest/browser'
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { Failure } from '../../../core/failures/failuresFeature'
import type {
  ContextMenuAction,
  HeaderAction,
  RowAction,
} from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  columnDragging,
  columnFiltering,
  columnSorting,
  contextMenu,
  headerActionMenu,
  pagination,
  quickSearch,
  rowActionMenu,
  rowActions,
  rowDragging,
} from '../../../plugins'
import { PENDING_WAVE_ANIMATION } from '../../../grid/useSkeletonWave'
import { setColumnFilterByUser } from '../../../shared/filtering/filtering'
import { humanClick, pendingArcOf, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { toRgba } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    reducedMotion: (reduce: boolean) => Promise<void>
  }
}

// Ожидание и отказ на объекте действия (ADR 0177; OB1, OB3, OB5, OB6, OB13, OB16): у
// кнопок-источников нет дуги и отметки, занятый объект под волной, отказ строки и колонки —
// вспышкой, меню занятой и помеченной ячейки. OB2 — `object-process-failure`, OB4, OB11, OB14,
// OB15 — модульные (`failures.dom`, `serverActions.dom`), треугольник ячейки — `cell-issue`.

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

interface Call {
  kind: string
  signal?: AbortSignal
  answer: Deferred
}

let calls: Call[] = []

/** Колбэк, чей ответ держит тест. */
const held =
  (kind: string) =>
  (...args: unknown[]) => {
    const last = args.at(-1) as { signal?: AbortSignal } | undefined
    const call = { kind, signal: last?.signal, answer: deferred() }
    calls.push(call)
    return call.answer.promise
  }
const lastCall = (kind: string) =>
  calls.filter(call => call.kind === kind).at(-1)!

const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
const rowAction = (
  id: string,
  label: string,
  rest: Partial<RowAction> = {},
): RowAction => ({
  id,
  slot: 'actionRowSlot',
  icon: icon(label[0]!),
  label: () => label,
  onSelect: held(id),
  ...rest,
})
const headerAction = (
  id: string,
  label: string,
  rest: Partial<HeaderAction> = {},
): HeaderAction => ({
  id,
  slot: 'rightHeaderSlot',
  icon: icon(label[0]!),
  label: () => label,
  onSelect: held(id),
  ...rest,
})
const recalculate: ContextMenuAction = {
  id: 'recalculate',
  icon: icon('R'),
  label: () => 'Recalculate',
  onSelect: held('recalculate'),
}

const probe = definePlugin()({
  id: 'objectProbe',
  slotActions: [
    rowAction('archive', 'Archive', { order: 0 }),
    rowAction('remove', 'Remove', { order: 1, placement: 'menu' }),
    headerAction('freeze', 'Freeze', { order: 10 }),
    headerAction('audit', 'Audit', { order: 11, placement: 'menu' }),
  ],
  contextMenuActions: [recalculate],
})

interface Item {
  id: string
  name: string
  city: string
}

const DATA: Item[] = Array.from({ length: 25 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  city: `City ${index}`,
}))

const COLUMNS = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 280,
    enableDragging: true,
  },
  {
    id: 'city',
    accessorKey: 'city',
    header: 'City',
    size: 280,
    enableDragging: true,
  },
]

let captured: { getFailures: () => Failure[] } | undefined

/** Запрос данных — на «сервере»; переносы и правка — колбэки в руках теста. */
const Grid = ({ server = true }: { server?: boolean }) => {
  const [data, setData] = useState(DATA)
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    rowCount: server ? 1000 : undefined,
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    dataMode: server ? 'server' : 'client',
    plugins: [
      probe(),
      rowActions(),
      // Кнопки — в ряду, в кебабе — только пункты меню.
      rowActionMenu({ threshold: 10 }),
      headerActionMenu({ threshold: 10 }),
      contextMenu(),
      cellSelection(),
      cellEditing({
        canEditCell: () => true,
        onCellEdit: held('edit'),
      }),
      ...(server
        ? [
            columnSorting({ onToggleColumnSort: held('sort') }),
            columnFiltering({ onFilterChange: held('filter') }),
            quickSearch({ onSearchChange: held('search') }),
            pagination({ initialPageSize: 25, onPageChange: held('page') }),
          ]
        : [
            columnDragging({ onColumnDragEnd: held('columnMove') }),
            rowDragging({
              onRowDragEnd: held('rowMove'),
              onRowOrderChange: setData as never,
            }),
          ]),
    ] as never,
  })
  captured = table as never
  return (
    <div style={{ width: 760, height: 520 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (server = true) => {
  calls = []
  const screen = await render(<Grid server={server} />)
  await waitForGrid()
  return screen
}

afterEach(async () => {
  await commands.reducedMotion(false)
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (id: string, column = 'name') =>
  rowEl(id).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const headCell = (id = 'name') =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"][aria-colindex]`,
  )!
const sortButton = () =>
  headCell().querySelector<HTMLElement>('.column-sort__button')!
const filterButton = () =>
  headCell().querySelector<HTMLElement>('.column-filter__button')!
const searchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!
const nextPage = () =>
  document.querySelector<HTMLElement>('[data-page-action="next"]')!
const range = () =>
  document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    .textContent
const actionButton = (scope: HTMLElement, label: string) =>
  scope.querySelector<HTMLElement>(`button[aria-label$="${label}"]`)
const rowKebab = (id: string) =>
  rowEl(id).querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.rowMenu}"]`,
  )!
const headKebab = () =>
  headCell().querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.headerMenu}"]`,
  )!
const columnHandle = (id = 'name') =>
  headCell(id).querySelector<HTMLElement>('.drag__handler--column')!
const rowHandle = (id: string) =>
  rowEl(id).querySelector<HTMLElement>('.drag__handler--column')!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const itemByText = (text: string) =>
  items().find(el => el.textContent?.includes(text))
const columnOrder = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__head-cell[data-column-id][aria-colindex]',
    ),
  ]
    .filter(cell => COLUMNS.some(column => column.id === cell.dataset.columnId))
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map(cell => cell.dataset.columnId!)
const rowOrder = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ]
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .slice(0, 3)
    .map(row => row.dataset.rowId!)
const liveText = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
    .textContent ?? ''
const glowing = () => !!document.querySelector('[data-refreshing]')
const redLight = () =>
  document
    .querySelector('[class*="linear-progress"]')
    ?.getAttribute('data-error-flash')
const pendingBanner = () =>
  document.querySelector<HTMLElement>('.data-grid__pending-action')
const pendingCancel = () =>
  document.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')
const errorBanner = () =>
  document.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const shownAlerts = () =>
  [pendingBanner(), errorBanner()].filter(
    el => !!el && el.getBoundingClientRect().height > 0,
  ).length
const waved = (el: Element) => el.hasAttribute('data-pending-wave')
/** Неподвижная подложка ожидания: блика нет, подложка ячейки залита (ADR 0152, §3). */
const stillWaved = (el: Element) =>
  waved(el) && toRgba(getComputedStyle(el, '::after').backgroundColor)[3] > 0
const waves = () =>
  document
    .getAnimations()
    .filter(animation => animation.id === PENDING_WAVE_ANIMATION)
const editorOf = (cell: HTMLElement) => cell.querySelector('input')
/** Нажать кнопку правки ячейки. */
const pressEdit = async (cell: HTMLElement) => {
  await revealCellButtons(cell)
  await humanClick(
    cell.querySelector<HTMLElement>(
      `button[aria-label="${tableLabels.editCell}"]`,
    )!,
  )
}
const failures = () => captured!.getFailures()

/**
 * Кнопка-источник не показывает ни ожидания, ни отказа (ADR 0177, §2): ни дуги, ни
 * `aria-busy`, ни узла отметки, ни причины в описании.
 */
const plain = (el: HTMLElement, reason?: string) => {
  const described = (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
  return (
    !pendingArcOf(el) &&
    el.getAttribute('aria-busy') !== 'true' &&
    !el.hasAttribute('data-pending') &&
    !el.querySelector('[data-failure-indicator]') &&
    (!reason || !described.includes(reason))
  )
}

const REASON = 'Server said no'

interface Source {
  name: string
  server: boolean
  button: () => HTMLElement
  /** Запустить действие настоящим событием; кнопка, по которой нажали. */
  start: () => Promise<void>
  kind: string
  /** Новое состояние видно сразу; после отказа — прежнее или черновик поля. */
  shown?: () => boolean
  reverted?: () => boolean
}

const sources = (): Source[] => {
  let before: string[] = []
  return [
    {
      name: 'сортировка',
      server: true,
      button: sortButton,
      start: () => humanClick(sortButton()),
      kind: 'sort',
      shown: () => headCell().getAttribute('aria-sort') !== 'none',
      reverted: () => headCell().getAttribute('aria-sort') === 'none',
    },
    {
      name: 'фильтр',
      server: true,
      button: filterButton,
      start: async () => {
        setColumnFilterByUser(captured as never, 'name', {
          operator: 'contains',
          value: 'Row',
        })
      },
      kind: 'filter',
      shown: () => filterButton().hasAttribute('data-active'),
      // Условие — черновик поля: после отказа кнопка показывает его (ADR 0116, SA9).
      reverted: () => filterButton().hasAttribute('data-active'),
    },
    {
      name: 'пейджер',
      server: true,
      button: nextPage,
      start: () => humanClick(nextPage()),
      kind: 'page',
      shown: () => !!range()?.startsWith('26'),
      reverted: () => !!range()?.startsWith('1'),
    },
    {
      name: 'поиск',
      server: true,
      button: searchInput,
      start: async () => {
        await userEvent.click(searchInput())
        await userEvent.type(searchInput(), 'Row')
      },
      kind: 'search',
      shown: () => searchInput().value === 'Row',
      // Текст — черновик поля (ADR 0116, SA9).
      reverted: () => searchInput().value === 'Row',
    },
    {
      name: 'инлайн-кнопка строки',
      server: true,
      button: () => actionButton(rowEl('r1'), 'Archive')!,
      start: async () => {
        await revealCellButtons(rowEl('r1'))
        await humanClick(actionButton(rowEl('r1'), 'Archive')!)
      },
      kind: 'archive',
    },
    {
      name: 'кебаб строки',
      server: true,
      button: () => rowKebab('r1'),
      start: async () => {
        await revealCellButtons(rowEl('r1'))
        await humanClick(rowKebab('r1'))
        await expect.poll(() => itemByText('Remove')).toBeTruthy()
        await humanClick(itemByText('Remove')!)
      },
      kind: 'remove',
    },
    {
      name: 'инлайн-кнопка колонки',
      server: true,
      button: () => actionButton(headCell(), 'Freeze')!,
      start: async () => {
        await userEvent.hover(headCell())
        await expect.poll(() => actionButton(headCell(), 'Freeze')).toBeTruthy()
        await humanClick(actionButton(headCell(), 'Freeze')!)
      },
      kind: 'freeze',
    },
    {
      name: 'кебаб колонки',
      server: true,
      button: headKebab,
      start: async () => {
        await userEvent.hover(headCell())
        await humanClick(headKebab())
        await expect.poll(() => itemByText('Audit')).toBeTruthy()
        await humanClick(itemByText('Audit')!)
      },
      kind: 'audit',
    },
    {
      name: 'ручка колонки',
      server: false,
      button: () => columnHandle(),
      start: async () => {
        before = columnOrder()
        await userEvent.hover(headCell())
        await expect.poll(() => columnHandle()).toBeTruthy()
        columnHandle().focus()
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => itemByText(tableLabels.moveRight)).toBeTruthy()
        await humanClick(itemByText(tableLabels.moveRight)!)
      },
      kind: 'columnMove',
      shown: () => columnOrder()[0] !== before[0],
      reverted: () => columnOrder()[0] === before[0],
    },
    {
      name: 'ручка строки',
      server: false,
      button: () => rowHandle('r0'),
      start: async () => {
        before = rowOrder()
        rowHandle('r0').focus()
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => itemByText(tableLabels.moveDown)).toBeTruthy()
        await humanClick(itemByText(tableLabels.moveDown)!)
      },
      kind: 'rowMove',
      shown: () => rowOrder()[0] !== before[0],
      reverted: () => rowOrder()[0] === before[0],
    },
  ]
}

describe('Ожидание и отказ на объекте (ADR 0177)', () => {
  for (const source of sources()) {
    test(`OB1: кнопки-источники действий над данными таблицы — шапка, сортировка, фильтр, пейджер, поиск, ручки переноса, кебабы и инлайн-кнопки строки и колонки — не показывают дугу ожидания и отметку отказа; кнопка сразу показывает новое состояние и при отказе откатывается; условие фильтра и текст поиска остаются в поле черновиком (ADR 0116, SA9) (${source.name})`, async () => {
      const screen = await mount(source.server)
      try {
        await source.start()
        await expect
          .poll(() => calls.some(c => c.kind === source.kind))
          .toBe(true)
        if (source.shown) expect(source.shown()).toBe(true)
        // Дуга кнопки появилась бы через свою задержку — ждём дольше неё.
        await sleep(400)
        await userEvent.hover(source.button())
        expect(plain(source.button())).toBe(true)

        lastCall(source.kind).answer.reject(new Error(REASON))
        if (source.reverted) await expect.poll(source.reverted).toBe(true)
        await sleep(300)
        // Отказ дошёл до таблицы: черновик поля всё ещё на месте.
        if (source.reverted) expect(source.reverted()).toBe(true)
        expect(plain(source.button(), REASON)).toBe(true)
      } finally {
        await screen.unmount()
      }
    })
  }

  test('OB3: запрос данных: свечение под шапкой; дольше --tsr-comp-cancel-hint-delay — не красная полоса «… · Отменить», Escape отменяет; быстрый запрос полосы не показывает', async () => {
    const screen = await mount()
    try {
      // Быстрый запрос: свечение есть, полосы нет.
      await humanClick(sortButton())
      await expect.poll(glowing).toBe(true)
      await sleep(300)
      expect(shownAlerts()).toBe(0)
      lastCall('sort').answer.resolve()
      await expect.poll(glowing).toBe(false)
      await sleep(1200)
      expect(shownAlerts()).toBe(0)

      // Долгий: полоса со «Отменить», свет под шапкой не красный.
      await humanClick(sortButton())
      await expect.poll(glowing).toBe(true)
      await expect.poll(() => pendingCancel(), { timeout: 3000 }).not.toBeNull()
      await expect
        .poll(() => pendingBanner()!.getBoundingClientRect().height)
        .toBeGreaterThan(0)
      expect(pendingBanner()!.textContent).toContain(tableLabels.cancel)
      expect(redLight()).toBeFalsy()
      expect(shownAlerts()).toBe(1)

      // Escape в теле отменяет: сигнал прерван, свечение и полоса уходят.
      await humanClick(cellEl('r2', 'city'))
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => lastCall('sort').signal!.aborted).toBe(true)
      await expect.poll(glowing).toBe(false)
      await expect
        .poll(() => pendingBanner()?.getBoundingClientRect().height ?? 0)
        .toBe(0)
      expect(redLight()).toBeFalsy()
    } finally {
      await screen.unmount()
    }
  })

  test('OB5: волна или неподвижная подложка очерчивает ровно занятый объект; под ней работают чтение, выделение, копирование, навигация и меню, изменения объекта игнорируются; действие строки блокирует правку её ячеек, действие колонки — правку ячеек колонки', async () => {
    const screen = await mount()
    try {
      // Действие строки: волна — на всех ячейках строки и только на них.
      await revealCellButtons(rowEl('r1'))
      await humanClick(actionButton(rowEl('r1'), 'Archive')!)
      await expect.poll(() => waved(cellEl('r1', 'name'))).toBe(true)
      expect(waved(cellEl('r1', 'city'))).toBe(true)
      expect(waved(cellEl('r0', 'name'))).toBe(false)
      expect(waved(cellEl('r2', 'city'))).toBe(false)

      // Чтение, выделение, копирование, навигация и меню под волной работают.
      expect(cellEl('r1', 'name').textContent).toContain('Row 1')
      await humanClick(cellEl('r1', 'name'))
      await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
      await expect
        .poll(() => cellEl('r1', 'city').getAttribute('aria-selected'))
        .toBe('true')
      const copy = new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      cellEl('r1', 'name').dispatchEvent(copy)
      expect(copy.clipboardData!.getData('text/plain')).toBe('Row 1\tCity 1')
      await userEvent.keyboard('{ArrowDown}')
      await expect
        .poll(() => document.activeElement === cellEl('r2', 'name'))
        .toBe(true)
      await userEvent.keyboard('{ArrowUp}')
      await userEvent.click(cellEl('r1', 'name'), { button: 'right' })
      await expect.poll(() => itemByText('Recalculate')).toBeTruthy()
      await userEvent.keyboard('{Escape}')

      // Правка ячеек строки не открывается, вне строки — открывается.
      await pressEdit(cellEl('r1', 'name'))
      await sleep(150)
      expect(editorOf(cellEl('r1', 'name'))).toBeNull()
      await pressEdit(cellEl('r3', 'name'))
      await expect.poll(() => editorOf(cellEl('r3', 'name'))).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      lastCall('archive').answer.resolve()
      await expect.poll(() => waved(cellEl('r1', 'name'))).toBe(false)

      // Действие колонки: волна — на ячейках колонки, правка ячеек колонки не открывается.
      await userEvent.hover(headCell())
      await expect.poll(() => actionButton(headCell(), 'Freeze')).toBeTruthy()
      await humanClick(actionButton(headCell(), 'Freeze')!)
      await expect.poll(() => waved(cellEl('r4', 'name'))).toBe(true)
      expect(waved(cellEl('r4', 'city'))).toBe(false)
      await pressEdit(cellEl('r4', 'name'))
      await sleep(150)
      expect(editorOf(cellEl('r4', 'name'))).toBeNull()
      await pressEdit(cellEl('r4', 'city'))
      await expect.poll(() => editorOf(cellEl('r4', 'city'))).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      lastCall('freeze').answer.resolve()
      await expect.poll(() => waved(cellEl('r4', 'name'))).toBe(false)

      // При уменьшенном движении — неподвижная подложка на том же объекте.
      await commands.reducedMotion(true)
      await revealCellButtons(rowEl('r5'))
      await humanClick(actionButton(rowEl('r5'), 'Archive')!)
      await expect.poll(() => stillWaved(cellEl('r5', 'name'))).toBe(true)
      expect(stillWaved(cellEl('r5', 'city'))).toBe(true)
      expect(stillWaved(cellEl('r6', 'name'))).toBe(false)
      expect(waves()).toHaveLength(0)
      lastCall('archive').answer.resolve()
    } finally {
      await screen.unmount()
    }
  })

  test('OB6: попытка изменить занятый объект — вспышка reverted на нём и объявление «… ещё сохраняется»; запись в реестр не пишется', async () => {
    const screen = await mount()
    try {
      // Сохранение ячейки ждёт ответа: повторная правка не принимается.
      await pressEdit(cellEl('r1', 'name'))
      await expect.poll(() => editorOf(cellEl('r1', 'name'))).not.toBeNull()
      await userEvent.keyboard('{Control>}a{/Control}Saved{Enter}')
      await expect.poll(() => calls.some(c => c.kind === 'edit')).toBe(true)
      await pressEdit(cellEl('r1', 'name'))
      await expect
        .poll(() => cellEl('r1', 'name').getAttribute('data-flash'))
        .toBe('reverted')
      expect(editorOf(cellEl('r1', 'name'))).toBeNull()
      await expect
        .poll(liveText)
        .toContain(tableLabels.announceStillSaving('Name'))
      expect(failures()).toEqual([])
      lastCall('edit').answer.resolve()

      // Строка занята своим действием: правка её ячейки — так же.
      await revealCellButtons(rowEl('r2'))
      await humanClick(actionButton(rowEl('r2'), 'Archive')!)
      await expect.poll(() => waved(cellEl('r2', 'city'))).toBe(true)
      await pressEdit(cellEl('r2', 'city'))
      await expect
        .poll(() => cellEl('r2', 'city').getAttribute('data-flash'))
        .toBe('reverted')
      await expect
        .poll(liveText)
        .toContain(tableLabels.announceStillSaving('City'))
      expect(failures()).toEqual([])
      lastCall('archive').answer.resolve()
    } finally {
      await screen.unmount()
    }
  })

  test('OB13: отказ действия над строкой или колонкой — вспышка reverted и объявление, постоянной отметки нет, запись в реестр', async () => {
    const screen = await mount()
    try {
      await revealCellButtons(rowEl('r1'))
      await humanClick(actionButton(rowEl('r1'), 'Archive')!)
      await expect.poll(() => calls.some(c => c.kind === 'archive')).toBe(true)
      lastCall('archive').answer.reject(new Error(REASON))
      await expect
        .poll(() => rowEl('r1').getAttribute('data-flash'))
        .toBe('reverted')
      await expect
        .poll(liveText)
        .toContain(tableLabels.announceActionFailed('Archive', REASON))

      await userEvent.hover(headCell())
      await expect.poll(() => actionButton(headCell(), 'Freeze')).toBeTruthy()
      await humanClick(actionButton(headCell(), 'Freeze')!)
      lastCall('freeze').answer.reject(new Error(REASON))
      await expect
        .poll(() => headCell().getAttribute('data-column-flash'))
        .toBe('reverted')
      expect(cellEl('r3', 'name').getAttribute('data-column-flash')).toBe(
        'reverted',
      )
      await expect
        .poll(liveText)
        .toContain(tableLabels.announceActionFailed('Freeze', REASON))

      // Вспышка гаснет, постоянной отметки нет ни на объекте, ни на кнопках.
      await expect
        .poll(() => rowEl('r1').hasAttribute('data-flash'), { timeout: 4000 })
        .toBe(false)
      await expect
        .poll(() => headCell().hasAttribute('data-column-flash'), {
          timeout: 4000,
        })
        .toBe(false)
      expect(document.querySelector('[data-cell-issue]')).toBeNull()
      expect(rowEl('r1').hasAttribute('aria-invalid')).toBe(false)
      expect(
        plain(actionButton(rowEl('r1'), 'Archive') ?? rowKebab('r1')),
      ).toBe(true)
      expect(
        failures().map(({ label, target, reason }) => ({
          label,
          target,
          reason,
        })),
      ).toEqual([
        { label: 'Archive', target: { row: 'r1' }, reason: REASON },
        { label: 'Freeze', target: { column: 'name' }, reason: REASON },
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('OB16: контекстное меню и кебаб занятого объекта несут «Отменить сохранение» или «Отменить действие»; помеченной ячейки — «Повторить сохранение» и «Отбросить изменение»', async () => {
    const screen = await mount()
    const openContextMenu = async (cell: HTMLElement) => {
      await userEvent.click(cell, { button: 'right' })
      await expect.poll(() => items().length).toBeGreaterThan(0)
    }
    try {
      // Ждущее сохранение — «Отменить сохранение»; выбор прерывает его без отметки.
      await pressEdit(cellEl('r1', 'name'))
      await expect.poll(() => editorOf(cellEl('r1', 'name'))).not.toBeNull()
      await userEvent.keyboard('{Control>}a{/Control}Saved{Enter}')
      await expect.poll(() => calls.some(c => c.kind === 'edit')).toBe(true)
      await openContextMenu(cellEl('r1', 'name'))
      expect(itemByText(tableLabels.retrySave)).toBeUndefined()
      await humanClick(itemByText(tableLabels.cancelSave)!)
      await expect.poll(() => lastCall('edit').signal!.aborted).toBe(true)
      await expect
        .poll(() => cellEl('r1', 'name').getAttribute('aria-busy'))
        .not.toBe('true')
      expect(cellEl('r1', 'name').textContent).toContain('Row 1')
      expect(cellEl('r1', 'name').querySelector('[data-cell-issue]')).toBeNull()

      // Действие строки ждёт — «Отменить: ‹действие›» в контекстном меню ячеек строки; выбор
      // прерывает его.
      await revealCellButtons(rowEl('r2'))
      await humanClick(actionButton(rowEl('r2'), 'Archive')!)
      await openContextMenu(cellEl('r2', 'city'))
      const cancelArchive = tableLabels.cancelAction('Archive')
      await humanClick(itemByText(cancelArchive)!)
      await expect.poll(() => lastCall('archive').signal?.aborted).toBe(true)
      await expect.poll(() => waved(cellEl('r2', 'city'))).toBe(false)

      // Пункт кебаба ждёт — тот же кебаб несёт «Отменить: ‹пункт›».
      await revealCellButtons(rowEl('r4'))
      await humanClick(rowKebab('r4'))
      await expect.poll(() => itemByText('Remove')).toBeTruthy()
      await humanClick(itemByText('Remove')!)
      await expect.poll(() => waved(cellEl('r4', 'city'))).toBe(true)
      await revealCellButtons(rowEl('r4'))
      await humanClick(rowKebab('r4'))
      const cancelRemove = tableLabels.cancelAction('Remove')
      await expect.poll(() => itemByText(cancelRemove)).toBeTruthy()
      await humanClick(itemByText(cancelRemove)!)
      await expect.poll(() => lastCall('remove').signal?.aborted).toBe(true)
      await expect.poll(() => waved(cellEl('r4', 'city'))).toBe(false)

      // Отклонённое сохранение — «Повторить сохранение» и «Отбросить изменение».
      await pressEdit(cellEl('r3', 'name'))
      await expect.poll(() => editorOf(cellEl('r3', 'name'))).not.toBeNull()
      await userEvent.keyboard('{Control>}a{/Control}Draft{Enter}')
      lastCall('edit').answer.reject(new Error(REASON))
      await expect
        .poll(() => cellEl('r3', 'name').querySelector('[data-cell-issue]'))
        .not.toBeNull()
      await openContextMenu(cellEl('r3', 'name'))
      expect(itemByText(tableLabels.cancelSave)).toBeUndefined()
      expect(itemByText(tableLabels.failureDiscard)).toBeTruthy()
      const edits = calls.filter(c => c.kind === 'edit').length
      await humanClick(itemByText(tableLabels.retrySave)!)
      await expect
        .poll(() => calls.filter(c => c.kind === 'edit').length)
        .toBe(edits + 1)
      lastCall('edit').answer.reject(new Error(REASON))
      await expect
        .poll(() => cellEl('r3', 'name').querySelector('[data-cell-issue]'))
        .not.toBeNull()
      await openContextMenu(cellEl('r3', 'name'))
      await humanClick(itemByText(tableLabels.failureDiscard)!)
      await expect
        .poll(() => cellEl('r3', 'name').querySelector('[data-cell-issue]'))
        .toBeNull()
      expect(failures()).toEqual([])
    } finally {
      await screen.unmount()
    }
  })
})
