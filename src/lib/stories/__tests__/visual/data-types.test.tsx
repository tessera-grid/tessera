import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { CheckMark } from '../../../../ui'
import { useCreateTable } from '../../../core/useCreateTable'
import type { DataTypeRegistry } from '../../../core/dataTypes'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, columnSorting, rowGrouping } from '../../../plugins'
import { UiCanvas } from '../../__mocks__/UiCanvas'
import { RU_LABELS } from '../../__mocks__/localization.ru'
import { storyLabels } from '../../__mocks__/storyLabels'
import { humanClick, revealCellButtons } from '../helpers'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'

// Тип данных колонки (ADR 0172): вид по типу, значок булева, текст по типу в группе,
// агрегате, тултипе и сводке фильтров, выравнивание, примитив `CheckMark`; вид фильтра,
// сортировка и фильтр настоящими событиями, язык на лету. DT1–DT3, DT7, DT10, DT13–DT14,
// DT17 — модульные, DT20 — перф в `scroll`, DT11 — в `interaction`. Запись `object` (ADR 0174):
// подпись в ячейке, группе и тултипе, фильтр по ключу настоящими событиями; numberString —
// показ строкой и по формату без потери знаков, выравнивание.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(() => document.documentElement.classList.remove('dark'))

type Row = Record<string, unknown> & { id: string }

interface GridProps {
  columns: Record<string, unknown>[]
  data: Row[]
  plugins?: unknown[]
  dataTypes?: DataTypeRegistry
  localization?: Record<string, string>
  width?: number
}

const Grid = ({
  columns,
  data,
  plugins = [],
  dataTypes,
  localization,
  width = 960,
}: GridProps) => {
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
    dataTypes,
    timeZone: 'UTC',
  })
  return (
    <div style={{ width, height: 420 }}>
      <DataGrid table={table as never} localization={localization as never} />
    </div>
  )
}

const cellOf = (rowId: string, columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )!
const textOf = (rowId: string, columnId: string) =>
  cellOf(rowId, columnId).textContent ?? ''
const headOf = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!
const titleOf = (element: HTMLElement) =>
  element.querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
const rowIds = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ]
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
    .map(row => row.dataset.rowId)

const MOMENT = new Date('2026-10-31T14:05:00Z')

describe('Тип данных колонки (ADR 0172)', () => {
  test('DT4: колонка без dataType выглядит и сортируется как сейчас; объект Date без типа показывается как dateTime', async () => {
    const columns = [
      { id: 'num', accessorKey: 'num', header: 'Num' },
      { id: 'when', accessorKey: 'when', header: 'When' },
    ]
    const data = [
      { id: 'a', num: 10, when: MOMENT },
      { id: 'b', num: 9, when: MOMENT },
      { id: 'c', num: 100, when: MOMENT },
    ]
    await render(
      <Grid columns={columns} data={data} plugins={[columnSorting()]} />,
    )
    await waitForGrid()
    expect(textOf('a', 'num')).toBe('10')
    expect(cellOf('a', 'num').dataset.align).toBeUndefined()
    expect(textOf('a', 'when')).toBe('2026-10-31 14:05')

    // Сортировка числа без типа — по значению, как у TanStack: первым щелчком по убыванию
    // (строками порядок был бы b, c, a).
    await userEvent.hover(headOf('num'))
    await humanClick(headOf('num').querySelector('.column-sort__button')!)
    await expect.poll(rowIds).toEqual(['c', 'a', 'b'])
  })

  test('DT5: вид по умолчанию — text и number как есть, date и dateString — YYYY-MM-DD, dateTime и dateTimeString — YYYY-MM-DD HH:mm в поясе таблицы, варианты — подписи через «, », пусто — пустая ячейка', async () => {
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]
    const types = [
      'text',
      'number',
      'date',
      'dateString',
      'dateTime',
      'dateTimeString',
      'select',
      'multiSelect',
    ]
    const columns = types.map(type => ({
      id: type,
      accessorKey: type,
      header: type,
      dataType: type,
      size: 110,
      ...(type.endsWith('elect') && { options }),
    }))
    const full = {
      id: 'full',
      text: 'Desk',
      number: 1234.5,
      date: MOMENT,
      dateString: '2026-10-31',
      dateTime: MOMENT,
      dateTimeString: '2026-10-31T14:05:00Z',
      select: 'b',
      multiSelect: ['a', 'b'],
    }
    const empty = {
      id: 'empty',
      ...Object.fromEntries(types.map(t => [t, null])),
    }
    await render(<Grid columns={columns} data={[full, empty]} width={1000} />)
    await waitForGrid()
    expect(types.map(type => textOf('full', type))).toEqual([
      'Desk',
      '1234.5',
      '2026-10-31',
      '2026-10-31',
      '2026-10-31 14:05',
      '2026-10-31 14:05',
      'Beta',
      'Alpha, Beta',
    ])
    expect(types.map(type => textOf('empty', type))).toEqual(
      types.map(() => ''),
    )
  })

  test('DT6: boolean — неинтерактивный значок флажка, отмеченный или нет; скринридеру — «Да» или «Нет» из словаря', async () => {
    const columns = [
      { id: 'flag', accessorKey: 'flag', header: 'Flag', dataType: 'boolean' },
    ]
    const data = [
      { id: 'yes', flag: true },
      { id: 'no', flag: false },
    ]
    const markOf = (rowId: string) =>
      cellOf(rowId, 'flag').querySelector<HTMLElement>('.check-mark')!
    const screen = await render(<Grid columns={columns} data={data} />)
    await waitForGrid()
    for (const [rowId, checked, label] of [
      ['yes', true, 'Yes'],
      ['no', false, 'No'],
    ] as const) {
      const mark = markOf(rowId)
      expect(mark.getAttribute('role')).toBe('img')
      expect(mark.getAttribute('aria-label')).toBe(label)
      expect(mark.hasAttribute('data-checked')).toBe(checked)
      expect(mark.tabIndex).toBe(-1)
      expect(mark.closest('button, input, [role="checkbox"]')).toBeNull()
    }
    await screen.rerender(
      <Grid
        columns={columns}
        data={data}
        localization={{ booleanTrue: 'Да', booleanFalse: 'Нет' }}
      />,
    )
    await expect.poll(() => markOf('yes').getAttribute('aria-label')).toBe('Да')
    expect(markOf('no').getAttribute('aria-label')).toBe('Нет')
  })

  test('DT8: текст по типу показан в ячейке тела, строке группы, агрегате группы и тултипе обрезанного текста; в сводке фильтров — числа по типу колонки', async () => {
    const dataTypes: DataTypeRegistry = {
      money: {
        extends: 'number',
        format: { style: 'currency', currency: 'USD' },
      },
      dateString: { format: { dateStyle: 'medium' } },
    }
    const usd = (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value)
    const day = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date('2026-10-31T00:00:00Z'))
    const columns = [
      {
        id: 'released',
        accessorKey: 'released',
        header: 'Released',
        dataType: 'dateString',
        size: 160,
      },
      {
        id: 'price',
        accessorKey: 'price',
        header: 'Price',
        dataType: 'money',
        size: 160,
      },
      {
        id: 'narrow',
        accessorKey: 'narrow',
        header: 'Narrow',
        dataType: 'money',
        size: 60,
      },
    ]
    const data = [
      { id: 'a', released: '2026-10-31', price: 1200, narrow: 123456.78 },
      { id: 'b', released: '2026-10-31', price: 34.5, narrow: 1 },
    ]
    const first = await render(
      <Grid
        columns={columns}
        data={data}
        dataTypes={dataTypes}
        plugins={[
          rowGrouping({ initialGrouping: [] }),
          columnFiltering({
            initialColumnFilters: [
              { id: 'price', value: { operator: 'greaterThan', value: 1000 } },
            ],
          }),
        ]}
      />,
    )
    await waitForGrid()
    // Ячейка тела.
    expect(textOf('a', 'price')).toBe(usd(1200))
    expect(textOf('a', 'released')).toBe(day)

    // Тултип обрезанного текста — тот же текст по типу.
    const narrow = titleOf(cellOf('a', 'narrow'))
    expect(narrow.scrollWidth).toBeGreaterThan(narrow.clientWidth)
    await userEvent.hover(narrow)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="presentation"][data-open]')].map(
          tip => tip.textContent,
        ),
      )
      .toContain(usd(123456.78))

    // Сводка фильтров: число условия — по типу колонки.
    await humanClick(
      document.querySelector('[data-testid="filter-summary-button"]')!,
    )
    await expect
      .poll(
        () =>
          document.querySelector('[data-testid="filter-summary"]')?.textContent,
      )
      .toContain(usd(1000))
    await first.unmount()

    // Строка группы и агрегат группы.
    const groupColumns = [
      {
        id: 'released',
        accessorKey: 'released',
        header: 'Released',
        dataType: 'dateString',
        size: 200,
      },
      {
        id: 'price',
        accessorKey: 'price',
        header: 'Price',
        dataType: 'money',
        size: 160,
      },
    ]
    await render(
      <Grid
        columns={groupColumns}
        data={data}
        dataTypes={dataTypes}
        plugins={[rowGrouping({ initialGrouping: ['released'] })]}
      />,
    )
    await waitForGrid()
    const group = document.querySelector<HTMLElement>(
      '[data-group-row="true"]',
    )!
    const cell = (columnId: string) =>
      group.querySelector<HTMLElement>(
        `.data-grid__body-cell[data-column-id="${columnId}"]`,
      )!
    expect(cell('released').textContent).toContain(
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date('2026-10-31T00:00:00Z')),
    )
    expect(cell('price').textContent).toBe(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(1234.5),
    )
  })

  test('DT9: числа — цифры одной ширины; выравнивание по умолчанию — к началу, как у текста; align (start, center, end) у колонки или типа задаёт своё', async () => {
    const columns = [
      {
        id: 'num',
        accessorKey: 'num',
        header: 'Num',
        dataType: 'number',
        size: 160,
      },
      {
        id: 'mid',
        accessorKey: 'mid',
        header: 'Mid',
        dataType: 'number',
        align: 'center',
        size: 160,
      },
      {
        id: 'own',
        accessorKey: 'own',
        header: 'Own',
        dataType: 'qty',
        size: 160,
      },
    ]
    await render(
      <Grid
        columns={columns}
        data={[{ id: 'a', num: 7, mid: 7, own: 7 }]}
        dataTypes={{ qty: { extends: 'number', align: 'end' } }}
      />,
    )
    await waitForGrid()
    const style = (element: HTMLElement) => getComputedStyle(titleOf(element))
    for (const element of [cellOf('a', 'num'), headOf('num')]) {
      expect(style(element).textAlign).toBe('start')
      expect(style(element).fontVariantNumeric).toBe('tabular-nums')
      // Текст прижат к левому краю, как текст.
      const title = titleOf(element)
      const range = document.createRange()
      range.selectNodeContents(title)
      expect(
        range.getBoundingClientRect().left - title.getBoundingClientRect().left,
      ).toBeLessThan(2)
    }
    expect(style(cellOf('a', 'mid')).textAlign).toBe('center')
    expect(style(headOf('mid')).textAlign).toBe('center')
    expect(style(cellOf('a', 'own')).textAlign).toBe('end')
    expect(style(headOf('own')).textAlign).toBe('end')
  })

  test('DT18: примитив кита CheckMark — неинтерактивный значок флажка на токенах флажка выбора, галочка — иконка checkboxChecked из icons; публичный в /ui и в каталоге UI.CheckMark; axe и контраст в обеих темах и в forced-colors', async () => {
    // Публичный экспорт `/ui` рисует то же, что ячейка булева.
    const kit = await render(
      <UiCanvas>
        <CheckMark checked label="Yes" />
      </UiCanvas>,
    )
    expect(document.querySelector('.check-mark svg')).not.toBeNull()
    await kit.unmount()

    // Контраст — на фоне ячейки таблицы, где значок живёт.
    await render(
      <Grid
        columns={[
          {
            id: 'flag',
            accessorKey: 'flag',
            header: 'Flag',
            dataType: 'boolean',
          },
        ]}
        data={[
          { id: 'yes', flag: true },
          { id: 'no', flag: false },
        ]}
      />,
    )
    await waitForGrid()
    const marks = ['yes', 'no'].map(id =>
      cellOf(id, 'flag').querySelector<HTMLElement>('.check-mark')!,
    )
    expect(marks[0]!.querySelector('svg')).not.toBeNull()
    expect(marks[1]!.querySelector('svg')).toBeNull()
    const canvas = document.querySelector<HTMLElement>('.data-grid-theme')!
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async (mode: string) => {
      if (mode !== 'forced-colors') {
        // Рамка пустого значка — не ниже 3:1 к фону (WCAG 1.4.11).
        const surface = effectiveBg(marks[1]!.parentElement!)
        expect(
          contrast(toRgba(getComputedStyle(marks[1]!).borderTopColor), surface),
          mode,
        ).toBeGreaterThanOrEqual(3)
        expect(
          contrast(
            toRgba(getComputedStyle(marks[0]!).backgroundColor),
            surface,
          ),
          mode,
        ).toBeGreaterThanOrEqual(3)
      }
      expect((await axe.run(canvas, options)).violations, mode).toEqual([])
    }
    await inBothThemes(() =>
      check(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ),
    )
    if (server.browser !== 'webkit') {
      await fc.forcedColors(true)
      try {
        await check('forced-colors')
      } finally {
        await fc.forcedColors(false)
      }
    }
  })

  test('DT12: поля колонки filter нет — при подключённом фильтре он есть у каждой колонки с данными, вид — от базового типа (текст и без типа — текстовый, дата, дата со временем, да, нет или пусто, выбор одного, список с флажками); enableColumnFilter: false выключает фильтр колонки', async () => {
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]
    const kinds: [Record<string, unknown>, string][] = [
      [{ id: 'plain' }, 'text'],
      [{ id: 'text', dataType: 'text' }, 'text'],
      [{ id: 'num', dataType: 'number' }, 'number'],
      [{ id: 'flag', dataType: 'boolean' }, 'boolean'],
      [{ id: 'day', dataType: 'date' }, 'date'],
      [{ id: 'dayText', dataType: 'dateString' }, 'date'],
      [{ id: 'at', dataType: 'dateTime' }, 'datetime'],
      [{ id: 'atText', dataType: 'dateTimeString' }, 'datetime'],
      [{ id: 'pick', dataType: 'select', options }, 'select'],
      [{ id: 'picks', dataType: 'multiSelect', options }, 'multiselect'],
    ]
    const columns = [
      ...kinds.map(([column]) => ({
        accessorKey: column.id,
        header: column.id,
        size: 110,
        ...column,
      })),
      {
        id: 'off',
        accessorKey: 'text',
        header: 'off',
        dataType: 'text',
        enableColumnFilter: false,
        size: 110,
      },
      { id: 'shown', header: 'shown', cell: () => '—', size: 110 },
    ]
    const data = [
      {
        id: 'r1',
        plain: 'x',
        text: 'y',
        num: 1,
        flag: true,
        day: new Date('2026-10-31T00:00:00Z'),
        dayText: '2026-10-31',
        at: MOMENT,
        atText: '2026-10-31T14:05:00Z',
        pick: 'a',
        picks: ['a', 'b'],
      },
    ]
    await render(
      <Grid
        columns={columns}
        data={data}
        plugins={[columnFiltering()]}
        width={1500}
      />,
    )
    await waitForGrid()

    const button = (columnId: string) =>
      headOf(columnId).querySelector<HTMLElement>('.column-filter__button')
    const panel = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
    // Вид панели: у календаря и списка вариантов — data-filter-type, у булева — радиогруппа,
    // у числа — поле с десятичной клавиатурой, у текста — простое поле.
    const panelKind = () => {
      const open = panel()
      if (!open) return null
      if (open.dataset.filterType) return open.dataset.filterType
      if (open.querySelector('[data-testid="filter-boolean"]')) return 'boolean'
      const field = open.querySelector('[data-testid="filter-value"]')
      if (!field) return null
      return field.getAttribute('inputmode') === 'decimal' ? 'number' : 'text'
    }

    for (const [{ id }, kind] of kinds) {
      const columnId = id as string
      await revealCellButtons(headOf(columnId))
      expect(button(columnId), columnId).not.toBeNull()
      await humanClick(button(columnId)!)
      await expect.poll(panelKind, { message: columnId }).toBe(kind)
      await userEvent.keyboard('{Escape}')
      await expect.poll(panel).toBeNull()
    }
    expect(button('off')).toBeNull()
    expect(button('shown')).toBeNull()
  })

  test('DT21: настоящими событиями — нажатие на заголовки колонок текста, чисел и дат-строк и фильтр даты-строки дают порядок и отбор по DT10 и DT13', async () => {
    const columns = [
      { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
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
        dataType: 'dateString',
      },
    ]
    // Текстом порядок был бы другим: «Lamp 2» выше «Lamp 10», «9.5» выше «1000».
    const data = [
      { id: 'a', name: 'Lamp 10', price: 120, released: '2026-03-14' },
      { id: 'b', name: 'chair 2', price: 9.5, released: '2025-11-02' },
      { id: 'c', name: null, price: 1000, released: null },
      { id: 'd', name: 'Lamp 2', price: null, released: '2026-07-01' },
      { id: 'e', name: 'lamp 1', price: 15, released: '2026-03-02' },
    ]
    await render(
      <Grid
        columns={columns}
        data={data}
        plugins={[columnSorting(), columnFiltering()]}
      />,
    )
    await waitForGrid()
    const sortBy = async (columnId: string) => {
      await revealCellButtons(headOf(columnId))
      await humanClick(headOf(columnId).querySelector('.column-sort__button')!)
    }

    // Первый щелчок — по убыванию, второй — по возрастанию; пустые — в конце при обоих.
    await sortBy('name')
    await expect.poll(rowIds).toEqual(['a', 'd', 'e', 'b', 'c'])
    await sortBy('name')
    await expect.poll(rowIds).toEqual(['b', 'e', 'd', 'a', 'c'])
    await sortBy('price')
    await expect.poll(rowIds).toEqual(['c', 'a', 'e', 'b', 'd'])
    await sortBy('released')
    await expect.poll(rowIds).toEqual(['d', 'a', 'e', 'b', 'c'])

    // Фильтр даты-строки: день в календаре, затем условие «после».
    await revealCellButtons(headOf('released'))
    await humanClick(
      headOf('released').querySelector('.column-filter__button')!,
    )
    const calendar = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-calendar"]')
    await expect.poll(() => calendar()?.querySelector('select')).toBeTruthy()
    const [month, year] = calendar()!.querySelectorAll('select')
    await userEvent.selectOptions(year!, '2026')
    await userEvent.selectOptions(month!, '2')
    const day = () =>
      document.querySelector<HTMLElement>('[data-day="2026-03-14"] button')
    await expect.poll(day).toBeTruthy()
    await humanClick(day()!)
    await expect.poll(rowIds).toEqual(['a'])

    const after = () =>
      document.querySelector<HTMLElement>('[data-operator="after"]')
    await humanClick(document.querySelector('[data-testid="filter-operator"]')!)
    await expect.poll(after).toBeTruthy()
    await humanClick(after()!)
    await expect.poll(rowIds).toEqual(['d'])
  })

  test('DT19: смена locale на лету меняет текст ячеек, порядок сортировки и подписи без пересоздания таблицы', async () => {
    const columns = [
      { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
      { id: 'price', accessorKey: 'price', header: 'Price', dataType: 'money' },
    ]
    const data = [
      { id: 'a', name: 'Lamp', price: 1234.5 },
      { id: 'b', name: 'Кружка', price: 18.9 },
      { id: 'c', name: 'Apple', price: 2499 },
      { id: 'd', name: 'Лампа', price: 1150.75 },
    ]
    const money: DataTypeRegistry = {
      money: {
        extends: 'number',
        format: { style: 'currency', currency: 'USD' },
      },
    }
    const stores = new Set<unknown>()
    const LocaleGrid = ({ locale }: { locale: string }) => {
      const table = useCreateTable({
        columns: columns as never,
        data,
        getRowId: (row: Row) => row.id,
        plugins: [columnSorting()] as never,
        dataTypes: money,
        locale,
        timeZone: 'UTC',
      })
      stores.add((table as unknown as { store: unknown }).store)
      return (
        <div style={{ width: 960, height: 420 }}>
          <DataGrid
            table={table as never}
            localization={(locale === 'ru-RU' ? RU_LABELS : undefined) as never}
          />
        </div>
      )
    }
    const desc = (locale: string) =>
      [...data]
        .sort((x, y) => new Intl.Collator(locale).compare(y.name, x.name))
        .map(row => row.id)
    const price = (locale: string) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
      }).format(1234.5)
    const sortButton = () =>
      headOf('name').querySelector<HTMLElement>('.column-sort__button')!

    const screen = await render(<LocaleGrid locale="en-US" />)
    await waitForGrid()
    const opened = stores.size
    expect(textOf('a', 'price')).toBe(price('en-US'))
    await userEvent.hover(headOf('name'))
    await humanClick(sortButton())
    await expect.poll(rowIds).toEqual(desc('en-US'))
    expect(sortButton().getAttribute('aria-label')).toBe(
      columnSortingLabels(storyLabels('en')).sortAscending,
    )
    const row = cellOf('a', 'name').closest('.data-grid__body-row')!

    await screen.rerender(<LocaleGrid locale="ru-RU" />)
    await expect.poll(() => textOf('a', 'price')).toBe(price('ru-RU'))
    await expect.poll(rowIds).toEqual(desc('ru-RU'))
    expect(desc('ru-RU')).not.toEqual(desc('en-US'))
    expect(headOf('name').getAttribute('aria-sort')).toBe('descending')
    expect(sortButton().getAttribute('aria-label')).toBe(
      columnSortingLabels(storyLabels('ru')).sortAscending,
    )
    // Тот же экземпляр таблицы и та же строка в DOM — без пересоздания.
    expect(stores.size).toBe(opened)
    expect(row.isConnected).toBe(true)
  })

  test('TY2: ячейка, строка группы и тултип обрезанного текста показывают подпись записи', async () => {
    const NAME = 'Annabelle Longname-Smith'
    const columns = [
      {
        id: 'm',
        accessorKey: 'm',
        header: 'Manager',
        dataType: 'object',
        size: 260,
      },
      {
        id: 'narrow',
        accessorKey: 'm',
        header: 'Narrow',
        dataType: 'object',
        size: 60,
      },
    ]
    // Тот же менеджер разными объектами и второй менеджер.
    const data = [
      { id: 'a', m: { id: 1, name: NAME } },
      { id: 'b', m: { id: 1, name: NAME } },
      { id: 'c', m: { id: 2, name: 'Bob' } },
    ]
    const first = await render(<Grid columns={columns} data={data} />)
    await waitForGrid()
    expect(textOf('a', 'm')).toBe(NAME)
    expect(textOf('c', 'm')).toBe('Bob')

    const narrow = titleOf(cellOf('a', 'narrow'))
    expect(narrow.scrollWidth).toBeGreaterThan(narrow.clientWidth)
    await userEvent.hover(narrow)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="presentation"][data-open]')].map(
          tip => tip.textContent,
        ),
      )
      .toContain(NAME)
    await first.unmount()

    await render(
      <Grid
        columns={columns.slice(0, 1)}
        data={data}
        plugins={[rowGrouping({ initialGrouping: ['m'] })]}
      />,
    )
    await waitForGrid()
    const groups = [
      ...document.querySelectorAll<HTMLElement>('[data-group-row="true"]'),
    ]
    expect(groups).toHaveLength(2)
    expect(
      groups[0]!.querySelector('.data-grid__body-cell[data-column-id="m"]')!
        .textContent,
    ).toContain(NAME)
  })

  test('TY5: настоящими событиями: отметка подписи в панели фильтра записи отбирает строки с этим ключом, в том числе разные объекты с одним ключом', async () => {
    const columns = [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      { id: 'm', accessorKey: 'm', header: 'Manager', dataType: 'object' },
    ]
    const data = [
      { id: 'a', name: 'Lamp', m: { id: 1, name: 'Ann' } },
      { id: 'b', name: 'Mug', m: { id: 1, name: 'Ann' } },
      { id: 'c', name: 'Desk', m: { id: 2, name: 'Bob' } },
    ]
    await render(
      <Grid columns={columns} data={data} plugins={[columnFiltering()]} />,
    )
    await waitForGrid()
    await revealCellButtons(headOf('m'))
    await humanClick(headOf('m').querySelector('.column-filter__button')!)
    const option = (key: string) =>
      document.querySelector<HTMLElement>(
        `[data-testid="filter-panel"] [data-option-index][data-value="${key}"]`,
      )
    await expect.poll(() => option('1')?.textContent ?? '').toContain('Ann')
    expect(option('1')!.textContent).toContain('2')
    await humanClick(option('1')!.querySelector('[role="checkbox"]')!)
    await expect.poll(rowIds).toEqual(['a', 'b'])
  })

  test('TY9: встроенный тип numberString: значение — десятичная строка без экспоненты; показ — как есть или Intl.NumberFormat по format строкой, без потери знаков; выравнивание к началу, как у чисел', async () => {
    const LONG = '12345678901234567.89'
    const columns = [
      {
        id: 'raw',
        accessorKey: 'raw',
        header: 'Raw',
        dataType: 'numberString',
        size: 240,
      },
      {
        id: 'fmt',
        accessorKey: 'raw',
        header: 'Formatted',
        dataType: 'amount',
        size: 260,
      },
    ]
    const data = [
      { id: 'a', raw: LONG },
      { id: 'b', raw: '-0.50' },
    ]
    await render(
      <Grid
        columns={columns}
        data={data}
        dataTypes={{
          amount: {
            extends: 'numberString',
            format: { minimumFractionDigits: 2 },
          },
        }}
      />,
    )
    await waitForGrid()
    // Как есть — строка данных; с форматом — все знаки, а не float (…568.00).
    expect(textOf('a', 'raw')).toBe(LONG)
    expect(textOf('b', 'raw')).toBe('-0.50')
    expect(textOf('a', 'fmt')).toBe('12,345,678,901,234,567.89')
    expect(textOf('b', 'fmt')).toBe('-0.50')

    const style = (element: HTMLElement) => getComputedStyle(titleOf(element))
    for (const element of [cellOf('a', 'raw'), headOf('raw')]) {
      expect(style(element).textAlign).toBe('start')
      expect(style(element).fontVariantNumeric).toBe('tabular-nums')
    }
  })
})
