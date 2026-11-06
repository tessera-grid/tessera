import axe from 'axe-core'
import { useMemo } from 'react'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import type { ColumnOption, LoadOptions } from '../../../core/columnOptions'
import type { RowSource } from '../../../core/rowSource'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnFiltering,
  pagination,
  rowExpanding,
  serverRowModel,
  type CellEditCommit,
} from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { optionsLabels } from '../../../shared/options/labels'

// Редакторы вариантов (ADR 0175, ED8–ED10, ED16, ED23–ED26) настоящими событиями: поповер с полем
// поиска у `select` и `object`, справочник с ожиданием и отказом, список с флажками у
// `multiSelect`, 1000 вариантов, очистка значения и поиска, закрытие прокруткой.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

/** Системный цвет палитры, как его отдаёт браузер. */
const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/** Конец анимаций появления поповера. */
const settle = () =>
  Promise.all(document.getAnimations().map(animation => animation.finished))

const STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]
const TAGS = [
  { value: 'new', label: 'New' },
  { value: 'sale', label: 'Sale' },
  { value: 'eco', label: 'Eco' },
]
const MANY = Array.from({ length: 1000 }, (_, i) => ({
  value: `v${i}`,
  label: `Value ${String(i).padStart(4, '0')}`,
}))
const ANN = { id: 'm1', name: 'Ann' }
const BOB = { id: 'm2', name: 'Bob' }
const CY = { id: 'm3', name: 'Cy' }
/** Есть только в справочнике, не в данных. */
const DANA = { id: 'm4', name: 'Dana' }

const ROWS = [
  {
    id: 'r1',
    status: 'draft',
    manager: ANN,
    owner: ANN,
    tags: ['new'],
    code: 'v0',
    price: 12.5,
    released: '2024-03-01',
  },
  {
    id: 'r2',
    status: 'active',
    manager: BOB,
    owner: CY,
    tags: [],
    code: 'v1',
    price: 3,
    released: '2024-05-10',
  },
]

/** Справочник менеджеров: ответ и отказ — по команде теста. */
const directory = () => {
  const pending: {
    resolve: (options: ColumnOption[]) => void
    reject: (error: Error) => void
  }[] = []
  const load: LoadOptions = () =>
    new Promise((resolve, reject) => pending.push({ resolve, reject }))
  return {
    load,
    answer: () =>
      pending.splice(0).forEach(entry =>
        entry.resolve([
          { value: 'm1', label: 'Ann', record: ANN },
          { value: 'm2', label: 'Bob', record: BOB },
          { value: 'm4', label: 'Dana', record: DANA },
        ]),
      ),
    refuse: () =>
      pending.splice(0).forEach(entry => entry.reject(new Error('down'))),
  }
}

const Grid = ({
  onCellEdit,
  onEditCancel,
  load,
  localization,
  searchDebounceMs,
  filtering,
}: {
  onCellEdit: (commit: CellEditCommit) => void
  onEditCancel: (end: unknown) => void
  load: LoadOptions
  localization?: Record<string, string>
  searchDebounceMs?: number
  /** Панель фильтра вариантов у справочника — тот же вид загрузки (ED24). */
  filtering?: boolean
}) => {
  const columns = useMemo(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        dataType: 'select',
        options: STATUS,
      },
      {
        id: 'manager',
        accessorKey: 'manager',
        header: 'Manager',
        dataType: 'object',
        loadOptions: load,
      },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        dataType: 'object',
        // Варианты без записи: запись берётся из данных по ключу.
        options: [
          { value: 'm1', label: 'Ann' },
          { value: 'm3', label: 'Cy' },
        ],
      },
      {
        id: 'tags',
        accessorKey: 'tags',
        header: 'Tags',
        dataType: 'multiSelect',
        options: TAGS,
      },
      {
        id: 'price',
        accessorKey: 'price',
        header: 'Price',
        dataType: 'number',
      },
      {
        id: 'released',
        accessorKey: 'released',
        header: 'Released',
        dataType: 'date',
      },
      // Фильтр вариантов со справочником; кнопки шапки — в ряд, не в кебабе.
      ...(filtering
        ? [
            {
              id: 'lookup',
              accessorKey: 'status',
              header: 'Lookup',
              dataType: 'select',
              loadOptions: load,
              size: 220,
            },
          ]
        : []),
      // Запись без справочника: варианты — записи из строк.
      {
        id: 'boss',
        accessorKey: 'manager',
        header: 'Boss',
        dataType: 'object',
      },
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Code',
        dataType: 'select',
        options: MANY,
      },
    ],
    [load, filtering],
  )
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    defaultColumn: { size: 110 },
    enableKeyboardNavigation: true,
    plugins: [
      cellEditing({ onCellEdit, onEditCancel, searchDebounceMs }),
      ...(filtering ? [columnFiltering()] : []),
    ],
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} localization={localization} />
    </div>
  )
}

const cellOf = (column: string, row = 'r1') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const field = () =>
  document.querySelector<HTMLInputElement>('[data-testid="edit-select"]')
const popup = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-options"]')
/** Поле, которое видит пользователь: скрытое поле формы Combobox — не оно. */
const VISIBLE_INPUT = 'input:not([type="hidden"]):not([aria-hidden="true"])'
const clearValue = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-clear-value"]')
/** Строки-скелеты загрузки вариантов: подпись — у их группы. */
const loadingLabel = (root: ParentNode | null | undefined) =>
  root?.querySelector('[role="status"][aria-busy="true"]')?.textContent ?? null
const itemOf = (value: string) =>
  popup()?.querySelector<HTMLElement>(`[data-value="${value}"]`) ?? null

const openEdit = async (column: string, row = 'r1') => {
  await revealCellButtons(cellOf(column, row))
  await humanClick(
    cellOf(column, row).querySelector<HTMLElement>('.cell__button button')!,
  )
}

const renderGrid = async () => {
  const onCellEdit = vi.fn()
  const onEditCancel = vi.fn()
  const server = directory()
  await render(
    <Grid
      onCellEdit={onCellEdit}
      onEditCancel={onEditCancel}
      load={server.load}
    />,
  )
  await waitForGrid()
  return { onCellEdit, onEditCancel, server }
}

const BOSS_COLUMNS = [
  { id: 'boss', accessorKey: 'manager', header: 'Boss', dataType: 'object' },
]

interface BossRow {
  id: string
  manager: { id: string; name: string }
  subRows?: BossRow[]
}

const BOSS_ROWS: BossRow[] = [
  { id: 'r1', manager: ANN },
  { id: 'r2', manager: BOB },
  // Третья строка — на второй странице, её подстрока в свёрнутой ветке.
  { id: 'r3', manager: DANA, subRows: [{ id: 'r3.1', manager: CY }] },
]

/** Клиентская таблица, где часть записей колонки вне показанного списка. */
const PagedBossGrid = () => {
  const table = useCreateTable({
    columns: BOSS_COLUMNS as never,
    data: BOSS_ROWS,
    getSubRows: (row: BossRow) => row.subRows,
    plugins: [
      pagination({ initialPageSize: 2 }),
      rowExpanding(),
      cellEditing({ onCellEdit: () => {}, onEditCancel: () => {} }),
    ] as never,
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Строка блока: менеджер чередуется, чтобы записей было две. */
const bossAnswer = ({ start, end }: { start: number; end: number }) =>
  Promise.resolve({
    rows: Array.from({ length: end - start }, (_, i) => ({
      id: `r${start + i + 1}`,
      manager: (start + i) % 2 === 0 ? ANN : BOB,
    })),
  })

const NO_BOSS_ROWS: BossRow[] = []

const MillionBossGrid = ({
  onTable,
}: {
  onTable: (table: { getRowSource: () => RowSource }) => void
}) => {
  const table = useCreateTable({
    columns: BOSS_COLUMNS as never,
    data: NO_BOSS_ROWS,
    getRowId: (row: BossRow) => row.id,
    rowCount: 1_000_000,
    plugins: [
      serverRowModel({ getRows: bossAnswer as never, blockSize: 50 }),
      cellEditing({ onCellEdit: () => {}, onEditCancel: () => {} }),
    ] as never,
  })
  onTable(table as never)
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('редакторы вариантов (ADR 0175)', () => {
  test('ED8: select и object — поповер с полем поиска сужает варианты набором, выбор стрелками и Enter; варианты из options, справочник из loadOptions с ожиданием, отказом и повтором; object сохраняет запись варианта, без неё — запись с тем же ключом из данных; подпись по getLabel', async () => {
    const { onCellEdit, onEditCancel, server } = await renderGrid()

    // Набор сужает варианты, Enter выбирает подсвеченный.
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    await expect.poll(() => document.activeElement === field()).toBe(true)
    await expect.poll(() => itemOf('active')).not.toBeNull()
    await userEvent.type(field()!, 'arch')
    await expect.poll(() => itemOf('active')).toBeNull()
    expect(itemOf('archived')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'status', value: 'archived' }),
      { signal: expect.any(AbortSignal) },
    )

    // Стрелки ходят по вариантам, Enter выбирает.
    await openEdit('status', 'r2')
    await expect.poll(() => itemOf('draft')).not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() =>
        popup()
          ?.querySelector('[data-highlighted]')
          ?.getAttribute('data-value'),
      )
      .toBeTruthy()
    await userEvent.keyboard('{Enter}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0]).toMatchObject({
      columnId: 'status',
      rowId: 'r2',
    })

    // Escape — без сохранения.
    onCellEdit.mockClear()
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalled()

    // Справочник: ожидание, отказ с повтором, ответ; сохраняется запись варианта.
    await openEdit('manager')
    await expect
      .poll(() => loadingLabel(popup()))
      .toBe(cellEditingLabels(tableLabels).editLoadingOptions)
    server.refuse()
    await expect
      .poll(() => popup()?.querySelector('[role="alert"]')?.textContent)
      .toContain(cellEditingLabels(tableLabels).editOptionsError)
    await humanClick(
      popup()!.querySelector<HTMLElement>(
        '[data-testid="edit-options-retry"]',
      )!,
    )
    await expect.poll(() => (server.answer(), itemOf('m4'))).not.toBeNull()
    expect(itemOf('m1')!.textContent).toContain('Ann')
    await humanClick(itemOf('m4')!)
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0].value).toBe(DANA)

    // Вариант без записи — запись с тем же ключом из данных.
    await openEdit('owner')
    await expect.poll(() => itemOf('m3')).not.toBeNull()
    await humanClick(itemOf('m3')!)
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0].value).toBe(CY)
  })

  test('ED9: multiSelect — поповер со списком флажков и поиском; Enter сохраняет массив, Escape отменяет', async () => {
    const { onCellEdit, onEditCancel } = await renderGrid()
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    const box = (value: string) =>
      multi()?.querySelector<HTMLElement>(
        `[data-value="${value}"] [role="checkbox"]`,
      ) ?? null
    const search = () =>
      multi()!.querySelector<HTMLInputElement>(
        '[data-testid="edit-options-search"]',
      )!

    await openEdit('tags')
    await expect.poll(multi).not.toBeNull()
    await expect.poll(() => document.activeElement).toBe(search())
    expect(box('new')).toHaveAttribute('aria-checked', 'true')
    await humanClick(box('sale')!)
    await userEvent.type(search(), 'ec')
    await expect.poll(() => box('sale')).toBeNull()
    await humanClick(box('eco')!)
    await userEvent.keyboard('{Enter}')
    await expect.poll(multi).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        columnId: 'tags',
        value: ['new', 'sale', 'eco'],
      }),
      { signal: expect.any(AbortSignal) },
    )

    onCellEdit.mockClear()
    await openEdit('tags', 'r2')
    await expect.poll(multi).not.toBeNull()
    await humanClick(box('new')!)
    await userEvent.keyboard('{Escape}')
    await expect.poll(multi).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalled()
  })

  test('ED10: список из 1000 вариантов виртуализирован — в DOM только видимые пункты, клавиши проходят весь список', async () => {
    const { onCellEdit } = await renderGrid()
    await openEdit('code')
    await expect.poll(() => itemOf('v1')).not.toBeNull()
    expect(popup()!.querySelectorAll('[role="option"]').length).toBeLessThan(60)
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => itemOf('v999')).not.toBeNull()
    expect(itemOf('v999')).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Enter}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'code', value: 'v999' }),
      { signal: expect.any(AbortSignal) },
    )
  })

  test('ED11: подпись ошибки разбора числа — ключ словаря editInvalidNumber; подпись очистки — editClear', async () => {
    const number = 'Только число'
    const clear = 'Стереть'
    const words = {
      'cellEditing.editInvalidNumber': number,
      'cellEditing.editClear': clear,
    }
    const server = directory()
    await render(
      <Grid
        onCellEdit={() => {}}
        onEditCancel={() => {}}
        load={server.load}
        localization={words}
      />,
    )
    await waitForGrid()

    await openEdit('price')
    const price = () => cellOf('price').querySelector('input')
    await expect.poll(price).not.toBeNull()
    await userEvent.clear(price()!)
    await userEvent.type(price()!, 'abc{Enter}')
    await expect
      .poll(() => cellOf('price').querySelector('[role="alert"]')?.textContent)
      .toBe(number)
    await userEvent.keyboard('{Escape}')

    await openEdit('status')
    await expect.poll(() => clearValue()?.textContent).toBe(clear)
  })

  test('ED19: подписи редакторов — свои ключи словаря edit*: поиск, «нет вариантов», загрузка, отказ загрузки, повтор, очистка; ключи фильтра вариантов редакторы не читают', async () => {
    const edit = {
      search: 'Найти',
      none: 'Пусто',
      loading: 'Ждём',
      error: 'Сбой',
      retry: 'Ещё раз',
      clear: 'Стереть',
    }
    const words = {
      'cellEditing.editSearchOptions': edit.search,
      'cellEditing.editNoOptions': edit.none,
      'cellEditing.editLoadingOptions': edit.loading,
      'cellEditing.editOptionsError': edit.error,
      'cellEditing.editRetry': edit.retry,
      'cellEditing.editClear': edit.clear,
      // Подписи фильтра — другие: редактор их не показывает.
      'columnFiltering.filterSearchOptions': 'ФИЛЬТР поиск',
      'columnFiltering.filterNoOptions': 'ФИЛЬТР пусто',
      'columnFiltering.filterLoadingOptions': 'ФИЛЬТР загрузка',
      'columnFiltering.filterOptionsError': 'ФИЛЬТР сбой',
      'columnFiltering.filterRetry': 'ФИЛЬТР повтор',
    }
    const server = directory()
    await render(
      <Grid
        onCellEdit={() => {}}
        onEditCancel={() => {}}
        load={server.load}
        localization={words}
      />,
    )
    await waitForGrid()

    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    expect(clearValue()!.textContent).toBe(edit.clear)
    await userEvent.type(field()!, 'zzz')
    await expect.poll(() => popup()?.textContent).toContain(edit.none)
    await userEvent.keyboard('{Escape}')

    await openEdit('manager')
    await expect.poll(() => loadingLabel(popup())).toBe(edit.loading)
    expect(field()!.placeholder).toBe(edit.search)
    server.refuse()
    await expect.poll(() => popup()?.textContent).toContain(edit.error)
    expect(
      popup()!.querySelector('[data-testid="edit-options-retry"]')!.textContent,
    ).toBe(edit.retry)
    expect(popup()!.textContent).not.toContain('ФИЛЬТР')
    await userEvent.keyboard('{Escape}')

    await openEdit('tags')
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    await expect.poll(multi).not.toBeNull()
    expect(multi()!.querySelector<HTMLInputElement>('input')!.placeholder).toBe(
      edit.search,
    )
  })

  test('ED12: редакторы проходят axe с color-contrast в обеих темах; роли combobox, listbox, dialog, aria-invalid у ошибки; вид в forced-colors', async () => {
    await renderGrid()
    const axeOn = async (root: Element) => {
      await inBothThemes(async () => {
        const { violations } = await axe.run(root, {
          rules: { region: { enabled: false } },
        })
        expect(violations.map(item => item.id)).toEqual([])
      })
    }

    await openEdit('status')
    await expect.poll(() => itemOf('active')).not.toBeNull()
    expect(field()).toHaveAttribute('role', 'combobox')
    expect(popup()!.querySelector('[role="listbox"]')).not.toBeNull()
    await settle()
    await axeOn(popup()!)
    await axeOn(cellOf('status'))

    // Высокая контрастность: подсвеченный вариант — системная пара Highlight.
    await fc.forcedColors(true)
    try {
      await userEvent.keyboard('{ArrowDown}')
      const highlighted = () =>
        popup()?.querySelector<HTMLElement>('[data-highlighted]') ?? null
      await expect.poll(highlighted).not.toBeNull()
      // Фон пункта меняется переходом — ждём его конца.
      await expect
        .poll(() => getComputedStyle(highlighted()!).backgroundColor)
        .toBe(sys('Highlight'))
      expect(getComputedStyle(highlighted()!).color).toBe(sys('HighlightText'))
    } finally {
      await fc.forcedColors(false)
    }
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()

    await openEdit('tags')
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    await expect.poll(multi).not.toBeNull()
    expect(multi()).toHaveAttribute('role', 'dialog')
    await settle()
    await axeOn(multi()!)
    await userEvent.keyboard('{Escape}')

    await openEdit('price')
    const price = () => cellOf('price').querySelector('input')
    await expect.poll(price).not.toBeNull()
    await userEvent.clear(price()!)
    await userEvent.type(price()!, 'abc{Enter}')
    await expect.poll(() => price()?.getAttribute('aria-invalid')).toBe('true')
    await axeOn(cellOf('price'))
  })

  test('ED17: object без options и loadOptions — варианты: уникальные записи колонки в загруженных строках по ключу, подпись по getLabel; выбор сохраняет эту запись', async () => {
    const { onCellEdit } = await renderGrid()
    await openEdit('boss')
    await expect.poll(() => itemOf('m2')).not.toBeNull()
    expect(itemOf('m1')!.textContent).toContain('Ann')
    expect(itemOf('m2')!.textContent).toContain('Bob')
    expect(popup()!.querySelectorAll('[data-value="m1"]').length).toBe(1)
    expect(itemOf('m1')).toHaveAttribute('data-selected')
    await humanClick(itemOf('m2')!)
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0].value).toBe(BOB)
  })

  test('ED18: необязательная задержка поиска справочника cellEditing({ searchDebounceMs }) — запрос loadOptions после паузы ввода; без аргумента — на каждый ввод', async () => {
    const searches = async (delay?: number) => {
      const asked: string[] = []
      const load: LoadOptions = search => {
        asked.push(search)
        return Promise.resolve([{ value: 'm1', label: 'Ann', record: ANN }])
      }
      const screen = await render(
        <Grid
          onCellEdit={() => {}}
          onEditCancel={() => {}}
          load={load}
          searchDebounceMs={delay}
        />,
      )
      await waitForGrid()
      await openEdit('manager')
      await expect.poll(field).not.toBeNull()
      await userEvent.type(field()!, 'bo')
      await new Promise(resolve => setTimeout(resolve, (delay ?? 0) + 200))
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
      // StrictMode повторяет эффект первого запроса — подряд одинаковые считаются за один.
      return asked.filter((search, index) => search !== asked[index - 1])
    }
    expect(await searches()).toEqual(['', 'b', 'bo'])
    expect(await searches(300)).toEqual(['', 'bo'])
  })

  test('ED16: внизу поповеров даты, варианта и нескольких вариантов — кнопка «Очистить значение»: сохраняет пустое значение', async () => {
    const { onCellEdit } = await renderGrid()
    const cases: [column: string, empty: unknown][] = [
      ['released', null],
      ['status', null],
      ['tags', []],
    ]
    for (const [column, empty] of cases) {
      await openEdit(column)
      await expect.poll(clearValue).not.toBeNull()
      // Кнопка — под чертой, отдельно от списка.
      expect(
        clearValue()!.closest('[role="listbox"], [role="group"]'),
      ).toBeNull()
      expect(clearValue()!.textContent).toBe(
        cellEditingLabels(tableLabels).editClear,
      )
      await humanClick(clearValue()!)
      await expect.poll(clearValue).toBeNull()
      expect(onCellEdit.mock.lastCall![0]).toMatchObject({ columnId: column })
      expect(onCellEdit.mock.lastCall![0].value).toEqual(empty)
    }
  })

  test('ED23: прокрутка таблицы закрывает поповер редактора даты и вариантов; правка отменяется, onEditCancel получает причину cancel', async () => {
    const { onCellEdit, onEditCancel } = await renderGrid()
    const scroller = () =>
      document.querySelector<HTMLElement>('.data-grid__container')!
    const opened = {
      released: () => document.querySelector('[data-testid="edit-date"]'),
      status: popup,
      tags: () => document.querySelector('[data-testid="edit-multiselect"]'),
    }
    for (const [column, open] of Object.entries(opened)) {
      onEditCancel.mockClear()
      await openEdit(column)
      await expect.poll(open).not.toBeNull()
      scroller().dispatchEvent(
        new WheelEvent('wheel', { deltaY: 40, bubbles: true }),
      )
      await expect.poll(open).toBeNull()
      expect(onEditCancel).toHaveBeenCalledWith(
        expect.objectContaining({ columnId: column, reason: 'cancel' }),
      )
    }
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  test('ED24: загрузка вариантов — строки-скелеты кита, отказ — блок ошибки кита с причиной и повтором, пустой список — заглушка Stub; так же в панели фильтра вариантов', async () => {
    const server = directory()
    await render(
      <Grid
        onCellEdit={() => {}}
        onEditCancel={() => {}}
        load={server.load}
        filtering
      />,
    )
    await waitForGrid()
    const skeletons = (root: ParentNode | null | undefined) =>
      root?.querySelectorAll('[aria-busy="true"] [data-tsr-skeleton-wave]')
        .length ?? 0
    const errorBlock = (root: ParentNode | null | undefined, retry: string) =>
      root?.querySelector<HTMLElement>(
        `[role="alert"]:has([data-testid="${retry}"])`,
      ) ?? null

    // Редактор: скелеты, блок ошибки с повтором, заглушка пустого ответа.
    await openEdit('manager')
    await expect.poll(() => skeletons(popup())).toBeGreaterThan(0)
    server.refuse()
    await expect
      .poll(() => errorBlock(popup(), 'edit-options-retry'))
      .not.toBeNull()
    expect(errorBlock(popup(), 'edit-options-retry')!.textContent).toContain(
      cellEditingLabels(tableLabels).editOptionsError,
    )
    expect(errorBlock(popup(), 'edit-options-retry')!.textContent).toContain(
      'down',
    )
    await humanClick(
      popup()!.querySelector<HTMLElement>(
        '[data-testid="edit-options-retry"]',
      )!,
    )
    await expect.poll(() => skeletons(popup())).toBeGreaterThan(0)
    server.answer()
    await expect.poll(() => itemOf('m4')).not.toBeNull()
    await userEvent.keyboard('{Escape}')

    // Пустой ответ поиска — заглушка кита.
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    await userEvent.type(field()!, 'zzz')
    await expect
      .poll(
        () =>
          popup()?.querySelector('[data-testid="options-empty"]')?.textContent,
      )
      .toContain(cellEditingLabels(tableLabels).editNoOptions)
    expect(skeletons(popup())).toBe(0)
    await userEvent.keyboard('{Escape}')

    // Панель фильтра вариантов — тот же вид.
    const lookupHead = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="lookup"]',
    )!
    await userEvent.hover(lookupHead)
    await humanClick(
      lookupHead.querySelector<HTMLElement>('.column-filter__button')!,
    )
    const panel = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
    await expect.poll(() => skeletons(panel())).toBeGreaterThan(0)
    server.refuse()
    await expect
      .poll(() => errorBlock(panel(), 'filter-options-retry'))
      .not.toBeNull()
  })

  test('ED25: поиск у редакторов вариантов — в поповере; в ячейке на время правки — текст значения', async () => {
    await renderGrid()
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    expect(popup()!.contains(field())).toBe(true)
    expect(cellOf('status').querySelector(VISIBLE_INPUT)).toBeNull()
    expect(cellOf('status').textContent).toContain('Draft')
    await userEvent.keyboard('{Escape}')

    await openEdit('tags')
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    await expect.poll(multi).not.toBeNull()
    expect(
      multi()!.querySelector('[data-testid="edit-options-search"]'),
    ).not.toBeNull()
    expect(cellOf('tags').querySelector(VISIBLE_INPUT)).toBeNull()
    expect(cellOf('tags').textContent).toContain('New')
  })

  test('ED27: записи object без справочника — из всех загруженных строк, и с другой страницы, и из свёрнутой ветки; в серверной модели открытие редактора не обходит итог строк', async () => {
    const paged = await render(<PagedBossGrid />)
    await waitForGrid()
    await openEdit('boss')
    await expect.poll(() => itemOf('m2')).not.toBeNull()
    expect(itemOf('m4')?.textContent).toContain('Dana')
    expect(itemOf('m3')?.textContent).toContain('Cy')
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()
    await paged.unmount()

    let table!: { getRowSource: () => RowSource }
    const server = await render(
      <MillionBossGrid onTable={next => (table = next)} />,
    )
    await waitForGrid()
    const read = vi.spyOn(table.getRowSource(), 'at')
    await openEdit('boss')
    await expect.poll(() => itemOf('m2')).not.toBeNull()
    expect(read.mock.calls.length).toBeLessThan(1000)
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()
    await server.unmount()
  })

  test('ED26: у поля поиска вариантов — кнопка очистки: стирает строку и возвращает весь список', async () => {
    await renderGrid()
    const clearSearch = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="edit-options-clear-search"]',
      )
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    expect(clearSearch()).toBeNull()
    await userEvent.type(field()!, 'arch')
    await expect.poll(() => itemOf('active')).toBeNull()
    expect(clearSearch()).toHaveAttribute(
      'aria-label',
      optionsLabels(tableLabels).clearSearch,
    )
    await humanClick(clearSearch()!)
    await expect.poll(() => itemOf('active')).not.toBeNull()
    expect(field()!.value).toBe('')
    expect(document.activeElement).toBe(field())
    await userEvent.keyboard('{Escape}')

    await openEdit('tags')
    const search = () =>
      document.querySelector<HTMLInputElement>(
        '[data-testid="edit-options-search"]',
      )
    await expect.poll(search).not.toBeNull()
    await userEvent.type(search()!, 'ec')
    await expect.poll(() => clearSearch()).not.toBeNull()
    await humanClick(clearSearch()!)
    expect(search()!.value).toBe('')
    await expect
      .poll(
        () =>
          document.querySelectorAll(
            '[data-testid="edit-multiselect"] [role="checkbox"]',
          ).length,
      )
      .toBe(3)
  })
})
