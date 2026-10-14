import { ru } from '@daypicker/react/locale/ru'
import axe from 'axe-core'

import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, keyboardNavigation } from '../../../plugins'
import { AXE_OPTIONS } from './a11y-helpers'
import { bodyRows, humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'

// Фильтр дат (ADR 0047): панель с календарём, время у datetime, клавиатура, тема,
// локализация, сводка, axe, серверный режим. Условия по значениям, пресеты и пояс
// (DF2–DF8) — модульные тесты `src/lib/__tests__/filteringDates.test.ts`; ленивый
// модуль (DF14) — `date-filter-chunk.test.tsx`.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

const DATA = [
  {
    id: '0',
    name: 'Alice',
    birth: '1990-03-14',
    created: '2026-03-15T00:30:00Z',
    note: 'a',
  },
  {
    id: '1',
    name: 'Bob',
    birth: '1990-03-15',
    created: '2026-03-15T09:30:00Z',
    note: 'b',
  },
  {
    id: '2',
    name: 'Carol',
    birth: '1990-03-16',
    created: '2026-03-15T14:30:00Z',
    note: 'c',
  },
  {
    id: '3',
    name: 'Dave',
    birth: '1991-07-01',
    created: '2026-03-15T22:30:00Z',
    note: 'd',
  },
  {
    id: '4',
    name: 'Erin',
    birth: null,
    created: '2026-03-16T08:00:00Z',
    note: 'e',
  },
  {
    id: '5',
    name: 'Frank',
    birth: '1985-12-31',
    created: '2026-03-01T12:00:00Z',
    note: 'f',
  },
]
const ALL = DATA.map(row => row.id)

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'birth', accessorKey: 'birth', header: 'Birth', filter: 'date' },
  {
    id: 'created',
    accessorKey: 'created',
    header: 'Created',
    filter: 'datetime',
  },
  {
    id: 'closed',
    accessorFn: (row: { birth: string | null }) =>
      row.birth?.split('-').reverse().join('.'),
    header: 'Closed',
    filter: {
      type: 'date',
      parse: (value: unknown) =>
        typeof value === 'string' ? value.split('.').reverse().join('-') : null,
    },
  },
  { id: 'note', accessorKey: 'note', header: 'Note' },
]

interface GridProps {
  plugins?: readonly unknown[]
  localization?: Record<string, unknown>
  icons?: Record<string, unknown>
  colorMode?: 'light' | 'dark'
  enableKeyboardNavigation?: boolean
  onTable?: (table: any) => void
}

const Grid = ({
  plugins = [columnFiltering({ timeZone: 'UTC', debounceMs: 0 })],
  localization,
  icons,
  colorMode,
  enableKeyboardNavigation,
  onTable,
}: GridProps) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableToolbar: true,
    plugins: [
      ...plugins,
      ...(enableKeyboardNavigation ? [keyboardNavigation()] : []),
    ] as never,
  })
  onTable?.(table)
  return (
    <div style={{ height: 600 }}>
      <DataGrid
        table={table as never}
        localization={localization as never}
        icons={icons as never}
        colorMode={colorMode}
      />
    </div>
  )
}

const rowIds = () => bodyRows().map(row => row.dataset.rowId!)
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const filterButton = (id: string) =>
  headCell(id).querySelector<HTMLButtonElement>('.column-filter__button')
const panel = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
const calendar = () =>
  panel()?.querySelector<HTMLElement>('[data-testid="filter-calendar"]') ?? null
const day = (iso: string) =>
  calendar()!.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)!
const dayCell = (iso: string) =>
  calendar()!.querySelector<HTMLElement>(`[data-day="${iso}"]`)!
const byTestId = (id: string) =>
  panel()?.querySelector<HTMLInputElement>(`[data-testid="${id}"]`) ?? null
const summary = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-summary"]')
const summaryButton = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-testid="filter-summary-button"]',
  )!

const openFilter = async (columnId: string) => {
  await userEvent.hover(headCell(columnId))
  await humanClick(filterButton(columnId)!)
  await expect.poll(calendar).not.toBeNull()
}

const chooseOperator = async (operator: string) => {
  const item = () =>
    document.querySelector<HTMLElement>(`[data-operator="${operator}"]`)
  await humanClick(panel()!.querySelector('[data-testid="filter-operator"]')!)
  await expect.poll(item).not.toBeNull()
  await humanClick(item()!)
  await expect.poll(() => item()?.closest('[data-open]') ?? null).toBeNull()
}

const closePanel = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(panel).toBeNull()
}

const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

/** Значение токена темы в свойстве `prop` на корне грида. */
const resolve = (token: string, prop: string) => {
  const probe = document.createElement('div')
  probe.style.setProperty(prop, `var(${token})`)
  calendar()!.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop).trim()
  probe.remove()
  return value
}

// «Сегодня» — 15 марта 2026: календарь открывается на месяце с данными.
const NOW = new Date(Date.UTC(2026, 2, 15, 12))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(async () => {
  vi.useRealTimers()
  await reducedMotion(false)
})

describe('Фильтр дат — панель', () => {
  test('DF1: date и datetime (строкой и объектом с parse) дают колонке кнопку фильтра; колонка без filter в фильтре дат не участвует', async () => {
    await render(<Grid />)
    await waitForGrid()
    for (const id of ['birth', 'created', 'closed']) {
      expect(filterButton(id), id).not.toBeNull()
    }
    expect(filterButton('note')).toBeNull()

    await openFilter('birth')
    expect(panel()!.dataset.filterType).toBe('date')
    await closePanel()
    await openFilter('created')
    expect(panel()!.dataset.filterType).toBe('datetime')
    await closePanel()

    // Объект с parse: «15.03.1990» разбирается в день.
    await openFilter('closed')
    await humanClick(day('2026-03-15'))
    await expect.poll(rowIds).toEqual([])
    await userEvent.selectOptions(
      calendar()!.querySelectorAll('select')[1],
      '1990',
    )
    await humanClick(day('1990-03-15'))
    await expect.poll(rowIds).toEqual(['1'])
  })

  test('DF9: поповер даты — условие, пресеты, календарь (диапазон у «между»), выпадающие месяц и год, «Сбросить»; выбор дня, диапазона и пресета применяется сразу', async () => {
    // Задержка ввода большая: выбор в календаре от неё не зависит.
    await render(
      <Grid
        plugins={[columnFiltering({ timeZone: 'UTC', debounceMs: 5000 })]}
      />,
    )
    await waitForGrid()
    await openFilter('created')
    const selects = calendar()!.querySelectorAll('select')
    expect(selects).toHaveLength(2)
    expect(selects[0].value).toBe('2')
    expect(selects[1].value).toBe('2026')

    await humanClick(day('2026-03-15'))
    await expect.poll(rowIds).toEqual(['0', '1', '2', '3'])
    expect(dayCell('2026-03-15').getAttribute('aria-selected')).toBe('true')

    await chooseOperator('between')
    // День переносится в диапазон; второй щелчок продлевает его.
    await humanClick(day('2026-03-16'))
    await expect.poll(rowIds).toEqual(['0', '1', '2', '3', '4'])
    expect(dayCell('2026-03-15').getAttribute('aria-selected')).toBe('true')
    expect(dayCell('2026-03-16').getAttribute('aria-selected')).toBe('true')

    // Месяц и год — выпадающими списками.
    await userEvent.selectOptions(selects[0], '1')
    await expect
      .poll(() => calendar()!.querySelector('[data-day="2026-02-01"]'))
      .not.toBeNull()

    await chooseOperator('preset')
    expect(calendar()).toBeNull()
    const preset = (value: string) =>
      panel()!.querySelector<HTMLElement>(`[data-value="${value}"]`)!
    await humanClick(preset('yesterday'))
    await expect.poll(rowIds).toEqual([])
    await humanClick(preset('today'))
    await expect.poll(rowIds).toEqual(['0', '1', '2', '3'])
    await humanClick(preset('thisMonth'))
    await expect.poll(rowIds).toEqual(ALL)

    await chooseOperator('on')
    await humanClick(day('2026-03-01'))
    await expect.poll(rowIds).toEqual(['5'])
    await humanClick(byTestId('filter-reset')!)
    await expect.poll(rowIds).toEqual(ALL)
    expect(dayCell('2026-03-01').getAttribute('aria-selected')).not.toBe('true')
  })

  test('DF10: у datetime для «до», «после», «между» есть поле времени, ввод применяется через debounceMs; у «в день» и пресетов поля нет', async () => {
    await render(
      <Grid
        plugins={[columnFiltering({ timeZone: 'UTC', debounceMs: 300 })]}
      />,
    )
    await waitForGrid()
    await openFilter('created')
    expect(byTestId('filter-time')).toBeNull()

    await chooseOperator('before')
    await humanClick(day('2026-03-15'))
    await expect.poll(rowIds).toEqual(['5'])
    await userEvent.fill(byTestId('filter-time')!, '10:00')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(rowIds()).toEqual(['5'])
    await expect.poll(rowIds).toEqual(['0', '1', '5'])

    await chooseOperator('between')
    expect(byTestId('filter-time')).toBeNull()
    expect(byTestId('filter-time-from')).not.toBeNull()
    expect(byTestId('filter-time-to')).not.toBeNull()

    await chooseOperator('preset')
    expect(byTestId('filter-time-from')).toBeNull()
    await closePanel()

    // У date поля времени нет.
    await openFilter('birth')
    await chooseOperator('before')
    expect(byTestId('filter-time')).toBeNull()
  })

  test.each([false, true])(
    'DF11: клавиатура — стрелки по дням, PageUp/PageDown по месяцам, выбор Enter; Escape закрывает и возвращает фокус на кнопку (enableKeyboardNavigation: %s)',
    async enableKeyboardNavigation => {
      let table: any
      await render(
        <Grid
          enableKeyboardNavigation={enableKeyboardNavigation}
          onTable={t => (table = t)}
        />,
      )
      await waitForGrid()
      await openFilter('created')
      const focusedDay = () =>
        (document.activeElement?.closest('[data-day]') as HTMLElement | null)
          ?.dataset.day
      await expect.poll(focusedDay).toBe('2026-03-15')
      await userEvent.keyboard('{ArrowRight}')
      expect(focusedDay()).toBe('2026-03-16')
      await userEvent.keyboard('{ArrowDown}')
      expect(focusedDay()).toBe('2026-03-23')
      await userEvent.keyboard('{PageUp}')
      expect(focusedDay()).toBe('2026-02-23')
      await userEvent.keyboard('{PageDown}')
      await userEvent.keyboard('{ArrowLeft}{ArrowUp}')
      expect(focusedDay()).toBe('2026-03-15')
      await userEvent.keyboard('{Enter}')
      await expect.poll(rowIds).toEqual(['0', '1', '2', '3'])
      expect(table.atoms.columnFilters.get()).toEqual([
        { id: 'created', value: { operator: 'on', value: '2026-03-15' } },
      ])

      await closePanel()
      await expect
        .poll(() => document.activeElement)
        .toBe(filterButton('created'))
    },
  )
})

describe('Фильтр дат — вид', () => {
  test.each(['light', 'dark'] as const)(
    'DF12: календарь в теме (%s) — сегодня, выбран, диапазон, фокус — из токенов --tsr-comp-*; стили @daypicker/react не подключены',
    async colorMode => {
      await render(<Grid colorMode={colorMode} />)
      await waitForGrid()
      await openFilter('created')
      await chooseOperator('between')
      await humanClick(day('2026-03-10'))
      await humanClick(day('2026-03-12'))
      await expect
        .poll(() => dayCell('2026-03-11').getAttribute('aria-selected'))
        .toBe('true')
      // Переход фона заканчивается — сравниваем установившиеся цвета.
      const settled = async (el: Element, prop: string, token: string) =>
        expect
          .poll(() => read(el, prop))
          .toBe(resolve(token, prop === 'color' ? 'color' : prop))

      for (const iso of ['2026-03-10', '2026-03-12']) {
        await settled(
          day(iso),
          'background-color',
          '--tsr-comp-calendar-day-selected-bg',
        )
        await settled(day(iso), 'color', '--tsr-comp-calendar-day-selected-fg')
      }
      await settled(
        dayCell('2026-03-11'),
        'background-color',
        '--tsr-comp-calendar-range-bg',
      )
      expect(read(day('2026-03-11'), 'background-color')).toBe(
        'rgba(0, 0, 0, 0)',
      )
      expect(read(day('2026-03-15'), 'font-weight')).toBe('700')

      day('2026-03-20').focus()
      await userEvent.keyboard('{ArrowRight}')
      const focused = document.activeElement!
      expect(read(focused, 'box-shadow')).toContain(
        resolve('--tsr-comp-focus-ring', 'color'),
      )

      const daypickerRules = [...document.styleSheets].some(sheet => {
        try {
          return [...sheet.cssRules].some(rule =>
            rule.cssText.includes('.rdp-'),
          )
        } catch {
          return false
        }
      })
      expect(daypickerRules).toBe(false)
    },
  )

  test('DF13: анимации календаря — через токены движения; при prefers-reduced-motion их нет', async () => {
    await render(<Grid />)
    await waitForGrid()
    await openFilter('created')
    const button = day('2026-03-10')
    const nav = calendar()!.querySelector<HTMLElement>(
      'button[aria-label="Previous month"]',
    )!
    const duration = resolve(
      '--tsr-comp-motion-duration',
      'transition-duration',
    )
    const easing = resolve(
      '--tsr-comp-motion-easing',
      'transition-timing-function',
    )
    const parts = (el: Element, prop: string) =>
      read(el, prop)
        .split(/,(?![^(]*\))/)
        .map(part => part.trim())
    for (const el of [button, nav]) {
      for (const part of parts(el, 'transition-duration')) {
        expect(part).toBe(duration)
      }
      for (const part of parts(el, 'transition-timing-function')) {
        expect(part).toBe(easing)
      }
    }
    await reducedMotion(true)
    for (const el of [button, nav]) {
      for (const part of read(el, 'transition-duration').split(',')) {
        expect(part.trim()).toBe('0s')
      }
    }
  })

  test('DF15: подписи условий, пресетов и поля времени — из localization; месяцы, дни и первый день недели — из dateLocale, по умолчанию en-US; стрелки — из icons', async () => {
    const weekdays = () =>
      [...calendar()!.querySelectorAll('thead th')].map(th =>
        th.textContent!.trim(),
      )
    const english = await render(<Grid />)
    await waitForGrid()
    await openFilter('created')
    expect(weekdays()[0]).toBe('Su')
    expect(
      calendar()!.querySelectorAll('select')[0].selectedOptions[0].textContent,
    ).toBe('March')
    await english.unmount()

    const Prev = () => <svg data-testid="custom-prev" />
    const Next = () => <svg data-testid="custom-next" />
    await render(
      <Grid
        plugins={[
          columnFiltering({ timeZone: 'UTC', debounceMs: 0, dateLocale: ru }),
        ]}
        localization={{
          filterOn: 'В день',
          filterBefore: 'До',
          filterPreset: 'Период',
          filterPresetToday: 'Сегодня',
          filterTime: 'Время',
          previousMonth: 'Предыдущий месяц',
          nextMonth: 'Следующий месяц',
        }}
        icons={{ previousMonth: Prev, nextMonth: Next }}
      />,
    )
    await waitForGrid()
    await openFilter('created')
    expect(weekdays()[0]).toBe('пн')
    expect(
      calendar()!.querySelectorAll('select')[0].selectedOptions[0].textContent,
    ).toMatch(/^март/)
    const operator = panel()!.querySelector('[data-testid="filter-operator"]')!
    expect(operator.textContent).toContain('В день')
    const prev = calendar()!.querySelector('[aria-label="Предыдущий месяц"]')!
    expect(prev.querySelector('[data-testid="custom-prev"]')).not.toBeNull()
    expect(
      calendar()!
        .querySelector('[aria-label="Следующий месяц"]')!
        .querySelector('[data-testid="custom-next"]'),
    ).not.toBeNull()

    await chooseOperator('before')
    expect(operator.textContent).toContain('До')
    expect(byTestId('filter-time')!.getAttribute('aria-label')).toBe('Время')
    await chooseOperator('preset')
    expect(operator.textContent).toContain('Период')
    expect(panel()!.textContent).toContain('Сегодня')
  })

  test('DF16: сводка «Фильтры» показывает дату через Intl.DateTimeFormat (локаль dateLocale, пояс timeZone), пресет — подписью', async () => {
    const item = (columnId: string) =>
      summary()!.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)!
        .textContent
    // Тулбар — ленивый модуль (PB6): кнопка сводки появляется после загрузки.
    const openSummary = async () => {
      await expect.poll(summaryButton).not.toBeNull()
      await humanClick(summaryButton())
      await expect.poll(summary).not.toBeNull()
    }

    let table: any
    const english = await render(<Grid onTable={t => (table = t)} />)
    await waitForGrid()
    table.setColumnFilters([
      { id: 'birth', value: { operator: 'on', value: '1990-03-15' } },
      {
        id: 'created',
        value: {
          operator: 'between',
          value: ['2026-03-15T09:30', null],
        },
      },
      { id: 'closed', value: { operator: 'preset', value: 'today' } },
    ])
    await openSummary()
    expect(item('birth')).toContain('On Mar 15, 1990')
    expect(item('created')).toContain('Between Mar 15, 2026, 9:30 AM – …')
    expect(item('closed')).toContain('Today')
    await english.unmount()

    await render(
      <Grid
        plugins={[
          columnFiltering({
            timeZone: 'Asia/Tokyo',
            debounceMs: 0,
            dateLocale: ru,
          }),
        ]}
        onTable={t => (table = t)}
      />,
    )
    await waitForGrid()
    table.setColumnFilters([
      { id: 'birth', value: { operator: 'on', value: '1990-03-15' } },
    ])
    await openSummary()
    // Стенная дата фильтра выводится как есть, без сдвига в пояс.
    expect(item('birth')).toContain('15 мар. 1990 г.')
  })

  test.each(['light', 'dark'] as const)(
    'DF17: поповер даты и календарь проходят axe с color-contrast (%s); зона нажатия дней и кнопок не меньше 24×24',
    async colorMode => {
      await render(<Grid colorMode={colorMode} />)
      await waitForGrid()
      const axeOf = async (root: Element) =>
        (
          await axe.run(root, {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          })
        ).violations
      const dialog = () => panel()!.closest('[role="dialog"]')!

      await openFilter('created')
      await chooseOperator('between')
      await humanClick(day('2026-03-10'))
      await humanClick(day('2026-03-12'))
      await expect
        .poll(() => dayCell('2026-03-11').getAttribute('aria-selected'))
        .toBe('true')
      // Переходы фона закончились — axe меряет установившиеся цвета.
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(await axeOf(dialog())).toEqual([])
      const buttons = calendar()!.querySelectorAll<HTMLElement>('button')
      expect(buttons.length).toBeGreaterThan(28)
      for (const el of buttons) {
        expect(
          Math.min(el.offsetWidth, el.offsetHeight),
          el.outerHTML.slice(0, 120),
        ).toBeGreaterThanOrEqual(24)
      }

      await chooseOperator('preset')
      await humanClick(
        panel()!.querySelector<HTMLElement>('[data-value="today"]')!,
      )
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(await axeOf(dialog())).toEqual([])
    },
  )
})

describe('Фильтр дат — сервер', () => {
  test('DF19: server — грид не фильтрует даты; onFilterChange получает ISO-строки и пресеты как есть, после действия пользователя', async () => {
    const onFilterChange = vi.fn()
    let table: any
    await render(
      <Grid
        plugins={[
          columnFiltering({
            server: true,
            timeZone: 'UTC',
            debounceMs: 0,
            onFilterChange,
          }),
        ]}
        onTable={t => (table = t)}
      />,
    )
    await waitForGrid()
    await openFilter('created')
    await humanClick(day('2026-03-15'))
    await expect.poll(() => onFilterChange.mock.calls.length).toBe(1)
    expect(onFilterChange).toHaveBeenLastCalledWith(
      [{ id: 'created', value: { operator: 'on', value: '2026-03-15' } }],
      { signal: expect.any(AbortSignal) },
    )
    expect(rowIds()).toEqual(ALL)

    await chooseOperator('preset')
    await humanClick(
      panel()!.querySelector<HTMLElement>('[data-value="last7Days"]')!,
    )
    await expect
      .poll(() => onFilterChange.mock.lastCall?.[0])
      .toEqual([
        { id: 'created', value: { operator: 'preset', value: 'last7Days' } },
      ])
    expect(JSON.stringify(onFilterChange.mock.calls)).not.toMatch(/Z"/)
    expect(rowIds()).toEqual(ALL)

    const calls = onFilterChange.mock.calls.length
    table.setColumnFilters([])
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(onFilterChange).toHaveBeenCalledTimes(calls)
  })
})
