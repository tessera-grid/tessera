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
import { humanClick } from '../helpers'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Тип данных колонки (ADR 0172, этап 1): вид по типу, значок булева, текст по типу в группе,
// агрегате, тултипе и сводке фильтров, выравнивание, примитив `CheckMark`.
// DT1–DT3, DT7 — модульный `dataTypes`, DT20 — перф в `scroll`.

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
        filter: 'number',
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

  test('DT9: number выровнен вправо в ячейке и заголовке, цифры одной ширины; align (start, center, end) у колонки или типа главнее', async () => {
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
        dataTypes={{ qty: { extends: 'number', align: 'start' } }}
      />,
    )
    await waitForGrid()
    const style = (element: HTMLElement) => getComputedStyle(titleOf(element))
    for (const element of [cellOf('a', 'num'), headOf('num')]) {
      expect(style(element).textAlign).toBe('end')
      expect(style(element).fontVariantNumeric).toBe('tabular-nums')
      // Текст прижат к правому краю: его правая граница — у края обёртки.
      const title = titleOf(element)
      const range = document.createRange()
      range.selectNodeContents(title)
      expect(
        title.getBoundingClientRect().right -
          range.getBoundingClientRect().right,
      ).toBeLessThan(2)
    }
    expect(style(cellOf('a', 'mid')).textAlign).toBe('center')
    expect(style(headOf('mid')).textAlign).toBe('center')
    expect(style(cellOf('a', 'own')).textAlign).toBe('start')
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
})
