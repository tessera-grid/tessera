/**
 * Сводка колонки настоящим рендером (ADR 0230; SU5, SU7–SU9, SU11–SU12, SU15, SU18): пункт меню
 * колонки со вложенным списком, имя функции у итога, точка на кебабе, раздел «Настроек вида»,
 * серверная модель с откатом, без вспышки, доступность, целое число у счётных функций.
 */
import { useState } from 'react'
import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnAggregation,
  columnTotals,
  headerActionMenu,
  rowGroupingModel,
  serverRowModel,
  valueChangeFlash,
} from '../../../plugins'
import { humanClick } from '../helpers'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { openSettingsSection, viewSettingsLevel } from '../viewSettings'

interface Item {
  id: string
  city: string
  amount: number
}

const ROWS: Item[] = [
  { id: 'r1', city: 'Paris', amount: 1250.5 },
  { id: 'r2', city: 'Paris', amount: 3000 },
  { id: 'r3', city: 'Rome', amount: 500 },
]

const COLUMNS = [
  { id: 'city', accessorKey: 'city', header: 'City', dataType: 'text' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'money',
    aggregationFn: 'sum',
  },
]

// Деньги с копейками: количество в этой колонке не должно выглядеть суммой.
const DATA_TYPES = {
  money: {
    extends: 'number',
    format: { style: 'currency', currency: 'USD' },
  },
}

const Grid = ({
  plugins,
  width = 640,
  ...options
}: {
  plugins: unknown[]
  width?: number
} & Record<string, unknown>) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    dataTypes: DATA_TYPES,
    locale: 'en-US',
    plugins: plugins as never,
    ...options,
  } as never)
  return (
    <div style={{ width, height: 320 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const head = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const kebab = (id: string) =>
  head(id)?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null
const footer = (id = 'amount') =>
  document.querySelector<HTMLElement>(
    `.data-grid__footer-cell[data-column-id="${id}"]`,
  )
const footerText = (id = 'amount') => footer(id)?.textContent?.trim() ?? ''
const label = (id = 'amount') =>
  footer(id)?.querySelector<HTMLElement>('[data-total-label]') ?? null
const items = () => [
  ...document.querySelectorAll<HTMLElement>(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
  ),
]
const item = (text: string) =>
  items().find(
    el => el.querySelector('[data-popup-item-label]')?.textContent === text,
  )
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
/** Точка включённого действия на кебабе видна. */
const dotShown = (id: string) => {
  const dot = kebab(id)?.querySelector<HTMLElement>('[data-active-indicator]')
  if (!dot) return false
  settle()
  return getComputedStyle(dot).opacity === '1'
}
const groupCell = (city: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="city:${city}"] .data-grid__body-cell[data-column-id="amount"]`,
  )
const settle = () =>
  document
    .getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .forEach(a => a.finish())

/** Открыть раздел «Сводка» в кебабе колонки. */
const openSummary = async (id = 'amount') => {
  await userEvent.hover(head(id))
  await expect.poll(() => kebab(id)).not.toBeNull()
  await expect
    .poll(() => {
      settle()
      return getComputedStyle(kebab(id)!).opacity
    })
    .toBe('1')
  await humanClick(kebab(id)!)
  await expect.poll(() => item('Summary')).toBeTruthy()
  await humanClick(item('Summary')!)
  await expect.poll(() => item('Average')).toBeTruthy()
}

const PLUGINS = () => [columnTotals(), headerActionMenu(), columnAggregation()]

describe('сводка колонки (ADR 0230)', () => {
  test('SU5: пункт «Сводка» с текущей функцией подсказкой открывает список с отметкой текущей и «Без сводки» последним; выбор мышью и клавиатурой применяет функцию и закрывает меню', async () => {
    const screen = await render(<Grid plugins={PLUGINS()} />)
    await expect.poll(() => footerText()).toContain('$4,750.50')
    await userEvent.hover(head('amount'))
    await expect.poll(() => kebab('amount')).not.toBeNull()
    await expect
      .poll(() => {
        settle()
        return getComputedStyle(kebab('amount')!).opacity
      })
      .toBe('1')
    await humanClick(kebab('amount')!)
    await expect.poll(() => item('Summary')).toBeTruthy()
    expect(
      item('Summary')!.querySelector('[data-popup-item-hint]')?.textContent,
    ).toBe('Sum')
    await humanClick(item('Summary')!)
    await expect.poll(() => item('Average')).toBeTruthy()
    const labels = items()
      .map(el => el.querySelector('[data-popup-item-label]')?.textContent)
      .filter(text => text && text !== 'Summary')
    expect(labels).toEqual([
      'Sum',
      'Average',
      'Median',
      'Min',
      'Max',
      'Count',
      'No summary',
    ])
    expect(
      item('Sum')!.querySelector('[data-popup-item-mark="checked"]'),
    ).not.toBeNull()
    expect(
      item('Average')!.querySelector('[data-popup-item-mark="checked"]'),
    ).toBeNull()
    // Мышью.
    await humanClick(item('Average')!)
    await expect.poll(menu).toBeNull()
    await expect.poll(() => footerText()).toContain('$1,583.50')

    // Клавиатурой: Enter на пункте списка.
    await openSummary()
    item('Max')!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(menu).toBeNull()
    await expect.poll(() => footerText()).toContain('$3,000.00')
    await screen.unmount()
  })

  test('SU7: ячейка итога показывает имя функции перед числом; в узкой колонке «…» сокращает подпись, число видно целиком; в строках-группах подписи нет', async () => {
    let screen = await render(<Grid plugins={PLUGINS()} />)
    await expect.poll(() => label()?.textContent).toBe('Sum')
    const value = () => label()!.nextElementSibling as HTMLElement
    expect(value().textContent).toBe('$4,750.50')
    await screen.unmount()

    // Узкая колонка: подпись сокращается, число — нет.
    screen = await render(
      <Grid
        plugins={PLUGINS()}
        columns={[COLUMNS[0], { ...COLUMNS[1], size: 110, minSize: 48 }]}
      />,
    )
    await expect.poll(label).not.toBeNull()
    const box = label()!
    expect(box.scrollWidth).toBeGreaterThanOrEqual(box.clientWidth)
    expect(getComputedStyle(box).textOverflow).toBe('ellipsis')
    expect(value().scrollWidth).toBeLessThanOrEqual(value().clientWidth + 1)
    expect(getComputedStyle(value()).flexShrink).toBe('0')
    await screen.unmount()

    // Группы: значение без подписи.
    screen = await render(
      <Grid
        plugins={[
          columnTotals(),
          rowGroupingModel({ initialGrouping: ['city'] }),
          columnAggregation(),
        ]}
      />,
    )
    await expect.poll(() => groupCell('Paris')?.textContent).toBe('$4,250.50')
    expect(groupCell('Paris')!.querySelector('[data-total-label]')).toBeNull()
    await screen.unmount()
  })

  test('SU8: выбор не по умолчанию зажигает точку на кебабе колонки, выбор по умолчанию — нет', async () => {
    const screen = await render(<Grid plugins={PLUGINS()} />)
    await expect.poll(() => kebab('amount')).not.toBeNull()
    expect(dotShown('amount')).toBe(false)
    await openSummary()
    await humanClick(item('Average')!)
    await expect.poll(() => dotShown('amount')).toBe(true)
    await openSummary()
    await humanClick(item('Sum')!)
    await expect.poll(() => dotShown('amount')).toBe(false)
    await screen.unmount()
  })

  test('SU9: раздел «Сводка» в «Настройках вида» — уровни колонок с выбором, функция в описании, «N active»; снятие уровня и «Сбросить» возвращают функции по умолчанию', async () => {
    const columns = [
      ...COLUMNS,
      {
        id: 'visits',
        accessorKey: 'amount',
        header: 'Visits',
        dataType: 'number',
        aggregationFn: 'sum',
      },
    ]
    const Host = () => {
      const [plugins] = useState(() => [
        columnTotals(),
        headerActionMenu(),
        columnAggregation({
          initialColumnAggregations: { amount: 'mean', visits: 'max' },
        }),
      ])
      return <Grid plugins={plugins} columns={columns} />
    }
    const screen = await render(<Host />)
    const section = await openSettingsSection('summary')
    const levels = () => [
      ...viewSettingsLevel()!.querySelectorAll<HTMLElement>(
        '[data-view-settings-level]',
      ),
    ]
    await expect.poll(() => levels().length).toBe(2)
    expect(section.textContent).toContain('Amount')
    expect(section.textContent).toContain('Average')
    expect(section.textContent).toContain('Visits')
    expect(section.textContent).toContain('Max')
    // Снятие уровня — функция по умолчанию.
    await userEvent.click(
      levels()[0]!.querySelector<HTMLElement>(
        'button[aria-label^="Reset summary"]',
      )!,
    )
    await expect.poll(() => levels().length).toBe(1)
    await expect.poll(() => label()?.textContent).toBe('Sum')
    // «Сбросить» — все.
    const reset = [...document.querySelectorAll<HTMLElement>('button')].find(
      el => el.textContent === 'Reset summary',
    )!
    await userEvent.click(reset)
    await expect.poll(() => label('visits')?.textContent).toBe('Sum')
    await screen.unmount()
  })

  test('SU11: серверная модель — выбор уходит в aggregations запроса новой выборки; отказ откатывает выбор и показывает плашку; revertOnReject: false оставляет выбор', async () => {
    const requests: Record<string, string>[] = []
    let refuse = false
    const getRows = (request: { aggregations: Record<string, string> }) => {
      requests.push(request.aggregations)
      if (refuse) return Promise.reject(new Error('Summary is unavailable'))
      return Promise.resolve({
        rows: ROWS,
        rowCount: ROWS.length,
        totals: {
          amount: request.aggregations.amount === 'max' ? 3000 : 4750.5,
        },
      })
    }
    const banner = () =>
      document.querySelector('[data-testid="load-error-banner"]')
    const mount = (revertOnReject?: boolean) =>
      render(
        <Grid
          data={[]}
          plugins={[
            serverRowModel({ getRows } as never),
            columnTotals(),
            headerActionMenu(),
            columnAggregation({ revertOnReject }),
          ]}
        />,
      )
    let screen = await mount()
    await expect.poll(() => footerText()).toContain('$4,750.50')
    await openSummary()
    await humanClick(item('Max')!)
    await expect.poll(() => footerText()).toContain('$3,000.00')
    expect(requests.at(-1)).toEqual({ amount: 'max' })

    // Отказ: выбор откатился к «Максимум», плашка с причиной.
    refuse = true
    await openSummary()
    await humanClick(item('Average')!)
    await expect.poll(banner).not.toBeNull()
    expect(banner()!.textContent).toContain('Summary is unavailable')
    await expect.poll(() => label()?.textContent).toBe('Max')
    await screen.unmount()

    // Без отката выбор остаётся новым.
    refuse = false
    screen = await mount(false)
    await expect.poll(() => footerText()).toContain('$4,750.50')
    refuse = true
    await openSummary()
    await humanClick(item('Average')!)
    await expect.poll(banner).not.toBeNull()
    await expect.poll(() => label()?.textContent).toBe('Average')
    await screen.unmount()
  })

  test('SU12: смена функции не вспыхивает итогом', async () => {
    const screen = await render(
      <Grid
        plugins={[
          ...PLUGINS(),
          valueChangeFlash({ columnDefault: 'direction' }),
        ]}
      />,
    )
    await expect.poll(() => label()?.textContent).toBe('Sum')
    await openSummary()
    await humanClick(item('Max')!)
    await expect.poll(() => label()?.textContent).toBe('Max')
    const until = performance.now() + 400
    while (performance.now() < until) {
      expect(footer()!.getAttribute('data-flash')).toBeNull()
      // eslint-disable-next-line no-await-in-loop
      await new Promise(requestAnimationFrame)
    }
    await screen.unmount()
  })

  test('SU15: axe и контраст подписи итога, пункта и вложенного списка в обеих темах и в forced-colors', async () => {
    const screen = await render(<Grid plugins={PLUGINS()} />)
    await expect.poll(label).not.toBeNull()
    await inBothThemes(async () => {
      const grid = await axe.run(
        document.querySelector('.data-grid__container')!.closest('div')!,
        AXE_OPTIONS,
      )
      expect(grid.violations).toEqual([])
      // Приглушённая подпись — текст, не ниже 4.5:1 к фону строки итогов.
      const ratio = contrast(
        toRgba(getComputedStyle(label()!).color),
        backgroundOf(footer()!),
      )
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
    // Высокая контрастность: подпись — системный цвет текста.
    await commands.forcedColors(true)
    try {
      expect(toRgba(getComputedStyle(label()!).color)).toEqual(
        toRgba('CanvasText'),
      )
    } finally {
      await commands.forcedColors(false)
    }
    await openSummary()
    await inBothThemes(async () => {
      const list = await axe.run(menu()!, AXE_OPTIONS)
      expect(list.violations).toEqual([])
    })
    await userEvent.keyboard('{Escape}')
    await screen.unmount()
  })

  test('SU18: итог и значение строки-группы счётной функции — целое число по языку таблицы, а не по типу колонки; и без плагина', async () => {
    let screen = await render(
      <Grid
        plugins={[
          columnTotals(),
          rowGroupingModel({ initialGrouping: ['city'] }),
          columnAggregation({ initialColumnAggregations: { amount: 'count' } }),
        ]}
      />,
    )
    await expect.poll(() => groupCell('Paris')?.textContent).toBe('2')
    expect(label()!.nextElementSibling!.textContent).toBe('3')
    await screen.unmount()

    screen = await render(
      <Grid
        plugins={[columnTotals()]}
        columns={[COLUMNS[0], { ...COLUMNS[1], aggregationFn: 'count' }]}
        locale="ru-RU"
        data={Array.from({ length: 1200 }, (_, i) => ({
          id: `n${i}`,
          city: 'Paris',
          amount: i,
        }))}
      />,
    )
    // Группы разрядов — по языку таблицы, без валюты.
    await expect
      .poll(() => footerText())
      .toBe(new Intl.NumberFormat('ru-RU').format(1200))
    await screen.unmount()
  })
})
