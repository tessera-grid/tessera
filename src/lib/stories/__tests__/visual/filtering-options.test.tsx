import axe from 'axe-core'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import type { ColumnOption } from '../../../core/columnOptions'
import type { DataMode } from '../../../core/dataMode'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import type { LoadOptions } from '../../../plugins/columnFilteringModel/types'
import { AXE_OPTIONS } from './a11y-helpers'
import { bodyRows, humanClick } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Фильтр вариантов (ADR 0048): чек-лист, поиск, счётчики, виртуализация, клавиатура,
// справочник с loadOptions, подписи в ячейке и сводке, сервер, локализация, axe.
// Условия, фасеты, подписи в поиске и экспорте (SF2–SF5, SF8, SF14, SF16–SF17) —
// модульные `src/lib/__tests__/filteringOptions.test.ts`; ленивый модуль (SF22) —
// `option-filter-chunk.test.tsx`.

const DATA = [
  {
    id: '1',
    name: 'Alice',
    status: 'lead',
    tags: ['vip', 'partner'],
    city: 'Rome',
    manager: 'm1',
    note: 'a',
  },
  {
    id: '2',
    name: 'Bob',
    status: 'won',
    tags: ['vip'],
    city: 'Paris',
    manager: 'm2',
    note: 'b',
  },
  {
    id: '3',
    name: 'Carol',
    status: 'lost',
    tags: [],
    city: 'Berlin',
    manager: 'm1',
    note: 'c',
  },
  {
    id: '4',
    name: 'Dave',
    status: null,
    tags: null,
    city: 'Paris',
    manager: 'm3',
    note: 'd',
  },
  {
    id: '5',
    name: 'Erin',
    status: 'won',
    tags: ['partner'],
    city: 'Oslo',
    manager: 'm2',
    note: 'e',
  },
  {
    id: '6',
    name: 'Frank',
    status: 'qualified',
    tags: ['vip', 'new'],
    city: 'Rome',
    manager: 'm1',
    note: 'f',
  },
]
const ALL = DATA.map(row => row.id)

const STATUS: ColumnOption[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]
const TAGS: ColumnOption[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Partner' },
  { value: 'new', label: 'New' },
]
const MANAGERS: ColumnOption[] = [
  { value: 'm1', label: 'Alice Moss' },
  { value: 'm2', label: 'Bob Reed' },
  { value: 'm3', label: 'Alan Hale' },
]
const managerName = (id: unknown) => MANAGERS.find(m => m.value === id)?.label

/** Справочник: поиск по имени; задержка по строке поиска — для гонок. */
const makeLoader = (delays: Record<string, number> = {}) => {
  const signals: { search: string; signal: AbortSignal }[] = []
  const load = vi.fn<LoadOptions>(
    (search, { signal }) =>
      new Promise((resolve, reject) => {
        signals.push({ search, signal })
        const timer = setTimeout(
          () =>
            resolve(
              MANAGERS.filter(m =>
                m.label.toLowerCase().includes(search.toLowerCase()),
              ),
            ),
          delays[search] ?? 50,
        )
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(signal.reason)
        })
      }),
  )
  return { load, signals }
}

const columnsWith = ({
  loadOptions = makeLoader().load,
  statusOptions = STATUS,
  extra = [],
}: {
  loadOptions?: LoadOptions
  statusOptions?: ColumnOption[]
  extra?: object[]
} = {}) => [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    options: statusOptions,
    dataType: 'select',
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    options: TAGS,
    dataType: 'multiSelect',
  },
  { id: 'city', accessorKey: 'city', header: 'City', dataType: 'select' },
  {
    id: 'manager',
    accessorKey: 'manager',
    header: 'Manager',
    getOptionLabel: managerName,
    dataType: 'select',
    loadOptions,
  },
  { id: 'note', accessorKey: 'note', header: 'Note' },
  ...extra,
]

interface GridProps {
  dataMode?: DataMode
  dataTypes?: Record<string, object>
  columns?: object[]
  data?: { id: string }[]
  plugins?: readonly unknown[]
  keyboard?: boolean
  localization?: Record<string, unknown>
  icons?: Record<string, unknown>
  colorMode?: 'light' | 'dark'
  onTable?: (table: any) => void
}

const Grid = ({
  columns = columnsWith(),
  dataMode,
  dataTypes,
  data = DATA,
  plugins = [columnFiltering({ debounceMs: 0 })],
  keyboard,
  localization,
  icons,
  colorMode,
  onTable,
}: GridProps) => {
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    enableToolbar: true,
    enableKeyboardNavigation: keyboard,
    dataMode,
    dataTypes: dataTypes as never,
    plugins: plugins as never,
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
const byTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
  panel()?.querySelector<T>(`[data-testid="${id}"]`) ?? null
const search = () => byTestId<HTMLInputElement>('filter-options-search')
const option = (value: string) =>
  panel()?.querySelector<HTMLElement>(
    `[data-option-index][data-value="${value}"]`,
  ) ?? null
const checkbox = (value: string) =>
  option(value)!.querySelector<HTMLElement>('[role="checkbox"]')!
const optionValues = () =>
  [
    ...panel()!.querySelectorAll<HTMLElement>(
      '[data-option-index][data-value]',
    ),
  ].map(li => li.dataset.value!)
const countOf = (value: string) =>
  option(value)?.querySelector('[data-testid="filter-option-count"]')
    ?.textContent ?? null
const cellText = (rowId: string, columnId: string) =>
  document
    .querySelector(
      `.data-grid__body-row[data-row-id="${rowId}"] [data-column-id="${columnId}"]`,
    )!
    .textContent!.trim()

const openFilter = async (columnId: string) => {
  await userEvent.hover(headCell(columnId))
  await humanClick(filterButton(columnId)!)
  await expect.poll(() => panel()?.dataset.filterType).toBeTruthy()
}

const closePanel = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(panel).toBeNull()
}

const chooseOperator = async (operator: string) => {
  const item = () =>
    document.querySelector<HTMLElement>(`[data-operator="${operator}"]`)
  await humanClick(byTestId('filter-operator')!)
  await expect.poll(item).not.toBeNull()
  await humanClick(item()!)
  await expect.poll(() => item()?.closest('[data-open]') ?? null).toBeNull()
}

describe('Фильтр вариантов — панель', () => {
  test('SF1: типы select и multiSelect и loadOptions колонки или типа дают колонке фильтр вариантов; панель — чек-лист', async () => {
    const first = await render(<Grid />)
    await waitForGrid()
    for (const id of ['status', 'tags', 'city', 'manager']) {
      expect(filterButton(id), id).not.toBeNull()
    }
    // Колонка без типа — текстовый фильтр, не чек-лист.
    await userEvent.hover(headCell('note'))
    await humanClick(filterButton('note')!)
    const textPanel = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
    await expect.poll(textPanel).not.toBeNull()
    expect(textPanel()!.dataset.filterType).toBeUndefined()
    expect(textPanel()!.querySelector('[role="group"]')).toBeNull()
    await closePanel()

    for (const [id, type] of [
      ['status', 'select'],
      ['tags', 'multiselect'],
      ['manager', 'lookup'],
    ]) {
      await openFilter(id)
      expect(panel()!.dataset.filterType).toBe(type)
      await expect.poll(() => optionValues().length).toBeGreaterThan(0)
      const group = panel()!.querySelector('[role="group"]')!
      expect(group.getAttribute('aria-label')).toBe(headCell(id).textContent)
      expect(group.querySelectorAll('[role="checkbox"]').length).toBe(
        optionValues().length,
      )
      await closePanel()
    }
    await first.unmount()

    // Справочник у своего типа: loadOptions — в реестре, колонка его только называет.
    const { load } = makeLoader()
    const typed = await render(
      <Grid
        columns={columnsWith().map(column =>
          (column as { id: string }).id === 'manager'
            ? { ...column, dataType: 'manager', loadOptions: undefined }
            : column,
        )}
        dataTypes={{ manager: { extends: 'select', loadOptions: load } }}
      />,
    )
    await openFilter('manager')
    expect(panel()!.dataset.filterType).toBe('lookup')
    await closePanel()
    await typed.unmount()
  })

  test('SF6: галочка, «Выбрать все», «Снять» и условие применяются сразу; «Выбрать все» и «Снять» действуют на варианты, видимые после поиска', async () => {
    const first = await render(
      <Grid plugins={[columnFiltering({ debounceMs: 5000 })]} />,
    )
    await waitForGrid()
    await openFilter('tags')
    await humanClick(checkbox('vip'))
    await expect.poll(rowIds).toEqual(['1', '2', '6'])
    expect(checkbox('vip').getAttribute('aria-checked')).toBe('true')
    await chooseOperator('noneOf')
    await expect.poll(rowIds).toEqual(['3', '4', '5'])
    await first.unmount()

    await render(<Grid />)
    await waitForGrid()
    await openFilter('status')
    await userEvent.fill(search()!, 'l')
    await expect.poll(optionValues).toEqual(['lead', 'qualified', 'lost'])
    await humanClick(byTestId('filter-select-all')!)
    await expect.poll(rowIds).toEqual(['1', '3', '6'])
    // Вне поиска «Won» не отмечен.
    await userEvent.fill(search()!, 'w')
    await expect.poll(optionValues).toEqual(['won'])
    expect(checkbox('won').getAttribute('aria-checked')).toBe('false')
    await humanClick(byTestId('filter-select-all')!)
    await expect.poll(rowIds).toEqual(['1', '2', '3', '5', '6'])
    // «Снять» снимает только видимые.
    await humanClick(byTestId('filter-clear-selection')!)
    await expect.poll(rowIds).toEqual(['1', '3', '6'])
  })

  test('SF7: поиск в панели — по подписям, «содержит» без учёта регистра, через debounceMs', async () => {
    await render(<Grid plugins={[columnFiltering({ debounceMs: 300 })]} />)
    await waitForGrid()
    await openFilter('tags')
    expect(optionValues()).toEqual(['vip', 'partner', 'new'])
    await userEvent.type(search()!, 'ARt')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(optionValues()).toEqual(['vip', 'partner', 'new'])
    // «ARt» есть в подписи «Partner», а не в значении: значение ищется по подписи.
    await expect.poll(optionValues).toEqual(['partner'])
    await userEvent.clear(search()!)
    await userEvent.type(search()!, 'ew')
    await expect.poll(optionValues).toEqual(['new'])
  })

  test('SF9: счётчики видны у вариантов; отмеченный вариант со счётчиком 0 остаётся в списке', async () => {
    await render(<Grid />)
    await waitForGrid()
    await openFilter('tags')
    expect([countOf('vip'), countOf('partner'), countOf('new')]).toEqual([
      '3',
      '2',
      '1',
    ])
    await humanClick(checkbox('new'))
    await expect.poll(rowIds).toEqual(['6'])
    await closePanel()

    // Чужой фильтр сужает счётчики: у «won» нет тега «new».
    await openFilter('status')
    await humanClick(checkbox('won'))
    await expect.poll(rowIds).toEqual([])
    await closePanel()

    await openFilter('tags')
    expect([countOf('vip'), countOf('partner'), countOf('new')]).toEqual([
      '1',
      '1',
      '0',
    ])
    expect(checkbox('new').getAttribute('aria-checked')).toBe('true')
  })

  test('SF10: список из сотен вариантов виртуализирован — в DOM видимые, прокрутка и клавиатура доходят до последнего', async () => {
    const MANY = Array.from({ length: 500 }, (_, i) => ({
      value: `v${i}`,
      label: `Value ${String(i).padStart(3, '0')}`,
    }))
    await render(
      <Grid
        columns={columnsWith({
          extra: [
            {
              id: 'big',
              accessorFn: (row: { id: string }) =>
                `v${(Number(row.id) - 1) * 99}`,
              header: 'Big',
              options: MANY,
              dataType: 'select',
            },
          ],
        })}
      />,
    )
    await waitForGrid()
    await openFilter('big')
    expect(optionValues().length).toBeGreaterThan(5)
    expect(optionValues().length).toBeLessThan(40)

    const scroller = byTestId('filter-options')!
    scroller.scrollTop = scroller.scrollHeight
    await expect.poll(() => option('v499')).not.toBeNull()

    scroller.scrollTop = 0
    await expect.poll(() => option('v0')).not.toBeNull()
    checkbox('v0').focus()
    await userEvent.keyboard('{End}')
    await expect
      .poll(
        () =>
          (
            document.activeElement?.closest(
              '[data-option-index]',
            ) as HTMLElement | null
          )?.dataset.value,
      )
      .toBe('v499')
    await userEvent.keyboard(' ')
    await expect.poll(rowIds).toEqual([])
    await userEvent.keyboard('{Home}')
    await expect
      .poll(
        () =>
          (
            document.activeElement?.closest(
              '[data-option-index]',
            ) as HTMLElement | null
          )?.dataset.value,
      )
      .toBe('v0')
    await userEvent.keyboard(' ')
    await expect.poll(rowIds).toEqual(['1'])
  })

  test.each([false, true])(
    'SF11: фокус в поиске при открытии; Tab в список, стрелки по вариантам, пробел — галочка; Escape закрывает и возвращает фокус (enableKeyboardNavigation: %s)',
    async withKeyboard => {
      await render(
        <Grid
          plugins={[columnFiltering({ debounceMs: 0 })]}
          keyboard={withKeyboard}
        />,
      )
      await waitForGrid()
      await openFilter('status')
      await expect.poll(() => document.activeElement).toBe(search())
      const focusedValue = () =>
        (
          document.activeElement?.closest(
            '[data-option-index]',
          ) as HTMLElement | null
        )?.dataset.value
      // Tab: «Выбрать все» → (недоступное «Снять» пропускается) → список.
      await userEvent.keyboard('{Tab}{Tab}')
      expect(focusedValue()).toBe('lead')
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      expect(focusedValue()).toBe('won')
      await userEvent.keyboard(' ')
      await expect.poll(rowIds).toEqual(['2', '5'])
      await userEvent.keyboard('{ArrowUp}')
      expect(focusedValue()).toBe('qualified')
      await closePanel()
      await expect
        .poll(() => document.activeElement)
        .toBe(filterButton('status'))
    },
  )
})

describe('Фильтр вариантов — справочник', () => {
  test('SF12: loadOptions зовётся при открытии и при поиске через debounceMs, прошлый вызов отменяется signal, устаревший ответ не показан; ожидание — индикатор и aria-busy', async () => {
    // «a» отвечает дольше «al»: ответ на «a» пришёл бы позже и затёр бы «al».
    const { load, signals } = makeLoader({ '': 150, a: 600, al: 50 })
    await render(
      <Grid
        columns={columnsWith({ loadOptions: load })}
        plugins={[columnFiltering({ debounceMs: 100 })]}
      />,
    )
    await waitForGrid()
    await openFilter('manager')
    await expect
      .poll(() => panel()!.querySelector('[aria-busy="true"]'))
      .not.toBeNull()
    expect(panel()!.textContent).toContain(tableLabels.filterLoadingOptions)
    await expect.poll(optionValues).toEqual(['m1', 'm2', 'm3'])
    // StrictMode (ADR 0091) запускает эффект дважды: первый вызов отменён сразу.
    const live = () => signals.filter(call => !call.signal.aborted)
    expect(live().map(call => call.search)).toEqual([''])
    expect(panel()!.querySelector('[aria-busy="true"]')).toBeNull()

    const opened = load.mock.calls.length
    await userEvent.type(search()!, 'a')
    await expect.poll(() => load.mock.calls.length).toBe(opened + 1)
    await userEvent.type(search()!, 'l')
    await expect.poll(() => load.mock.calls.length).toBe(opened + 2)
    expect(signals[opened]).toMatchObject({ search: 'a' })
    expect(signals[opened]!.signal.aborted).toBe(true)
    await expect.poll(optionValues).toEqual(['m1', 'm3'])
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(optionValues()).toEqual(['m1', 'm3'])
  })

  test('SF13: ошибка loadOptions — сообщение и «Повторить», повтор зовёт loadOptions снова; выбранный фильтр не снимается', async () => {
    let fail = true
    const load = vi.fn<LoadOptions>(async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
      if (fail) throw new Error('offline')
      return MANAGERS
    })
    let table: any
    await render(
      <Grid
        columns={columnsWith({ loadOptions: load })}
        onTable={t => (table = t)}
      />,
    )
    await waitForGrid()
    table.setColumnFilters([
      { id: 'manager', value: { operator: 'anyOf', value: ['m2'] } },
    ])
    await expect.poll(rowIds).toEqual(['2', '5'])

    await openFilter('manager')
    const alert = () => panel()!.querySelector('[role="alert"]')
    await expect.poll(alert).not.toBeNull()
    expect(alert()!.textContent).toContain(tableLabels.filterOptionsError)
    expect(rowIds()).toEqual(['2', '5'])
    // Отмеченное значение показано и без ответа справочника.
    fail = false
    const opened = load.mock.calls.length
    await humanClick(byTestId('filter-options-retry')!)
    expect(load).toHaveBeenCalledTimes(opened + 1)
    await expect.poll(optionValues).toEqual(['m1', 'm2', 'm3'])
    expect(checkbox('m2').getAttribute('aria-checked')).toBe('true')
    expect(rowIds()).toEqual(['2', '5'])
  })
})

describe('Фильтр вариантов — подписи и вид', () => {
  test('SF15: ячейка с options или getOptionLabel без своего cell показывает подпись, массив — через «, »; свой cell перекрывает; без плагина фильтрации тоже', async () => {
    const withFilter = await render(<Grid />)
    await waitForGrid()
    expect(cellText('1', 'status')).toBe('Lead')
    expect(cellText('1', 'tags')).toBe('VIP, Partner')
    expect(cellText('1', 'manager')).toBe('Alice Moss')
    expect(cellText('4', 'status')).toBe('')
    expect(cellText('4', 'manager')).toBe('Alan Hale')
    expect(cellText('1', 'city')).toBe('Rome')
    await withFilter.unmount()

    await render(
      <Grid
        plugins={[]}
        columns={[
          {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            options: STATUS,
          },
          {
            id: 'tags',
            accessorKey: 'tags',
            header: 'Tags',
            options: TAGS,
            cell: () => 'own',
          },
        ]}
      />,
    )
    await waitForGrid()
    expect(cellText('2', 'status')).toBe('Won')
    expect(cellText('2', 'tags')).toBe('own')
  })

  test('SF18: сводка «Фильтры» называет условие и подписи выбранных, лишние — «+N»', async () => {
    let table: any
    await render(<Grid onTable={t => (table = t)} />)
    await waitForGrid()
    table.setColumnFilters([
      {
        id: 'tags',
        value: { operator: 'anyOf', value: ['vip', 'partner', 'new'] },
      },
      { id: 'manager', value: { operator: 'noneOf', value: ['m1'] } },
      { id: 'status', value: { operator: 'empty' } },
    ])
    const summaryButton = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="filter-summary-button"]',
      )
    await expect.poll(summaryButton).not.toBeNull()
    await humanClick(summaryButton()!)
    const item = (id: string) =>
      document.querySelector(
        `[data-testid="filter-summary"] [data-column-id="${id}"]`,
      )?.textContent ?? null
    await expect.poll(() => item('tags')).toContain('Any of: VIP, Partner +1')
    expect(item('manager')).toContain('None of: Alice Moss')
    expect(item('status')).toContain(tableLabels.filterEmpty)
  })

  test('SF19: server — грид не фильтрует; onFilterChange получает значения как есть; счётчики — только из option.count', async () => {
    const onFilterChange = vi.fn()
    await render(
      <Grid
        columns={columnsWith({
          statusOptions: STATUS.map((option, i) => ({
            ...option,
            count: 10 * (i + 1),
          })),
        })}
        dataMode={{ filtering: 'server' }}
        plugins={[columnFiltering({ debounceMs: 0, onFilterChange })]}
      />,
    )
    await waitForGrid()
    await openFilter('status')
    expect(countOf('won')).toBe('30')
    await humanClick(checkbox('won'))
    // Отметка запрос не шлёт — его шлёт «Применить» (ADR 0154).
    expect(onFilterChange).not.toHaveBeenCalled()
    await humanClick(byTestId('filter-apply')!)
    await expect.poll(() => onFilterChange.mock.calls.length).toBe(1)
    expect(onFilterChange).toHaveBeenLastCalledWith(
      [{ id: 'status', value: { operator: 'anyOf', value: ['won'] } }],
      { signal: expect.any(AbortSignal) },
    )
    expect(rowIds()).toEqual(ALL)
    await closePanel()

    // Без count — без счётчиков; варианты из данных не собираются.
    await openFilter('tags')
    expect(countOf('vip')).toBeNull()
    await closePanel()
    await openFilter('city')
    expect(optionValues()).toEqual([])
    expect(panel()!.textContent).toContain(tableLabels.filterNoOptions)
  })

  test('SF20: подписи панели — из localization, иконки — из icons', async () => {
    const CustomClear = () => <svg data-testid="custom-clear" />
    await render(
      <Grid
        localization={{
          filterAnyOf: 'Любое из',
          filterSearchOptions: 'Найти значение',
          filterSelectAll: 'Выбрать все',
          filterClearSelection: 'Снять',
          filterNoOptions: 'Нет значений',
          clearSearch: 'Очистить',
        }}
        icons={{ clear: CustomClear }}
      />,
    )
    await waitForGrid()
    await openFilter('status')
    expect(byTestId('filter-operator')!.textContent).toContain('Любое из')
    expect(search()!.getAttribute('aria-label')).toBe('Найти значение')
    expect(byTestId('filter-select-all')!.textContent).toBe('Выбрать все')
    expect(byTestId('filter-clear-selection')!.textContent).toBe('Снять')
    await userEvent.fill(search()!, 'zzz')
    await expect.poll(() => panel()!.textContent).toContain('Нет значений')
    const clear = panel()!.querySelector('[aria-label="Очистить"]')!
    expect(clear.querySelector('[data-testid="custom-clear"]')).not.toBeNull()
  })

  test.each(['light', 'dark'] as const)(
    'SF21: панель проходит axe с color-contrast (%s), в том числе ожидание и ошибка; зона нажатия не меньше 24×24',
    async colorMode => {
      let fail = true
      const load = vi.fn<LoadOptions>(
        () =>
          new Promise((resolve, reject) =>
            setTimeout(
              () => (fail ? reject(new Error('offline')) : resolve(MANAGERS)),
              300,
            ),
          ),
      )
      await render(
        <Grid
          colorMode={colorMode}
          columns={columnsWith({ loadOptions: load })}
        />,
      )
      await waitForGrid()
      const axeOf = async () => {
        // Поповер проявляется переходом — axe проверяет конечный вид.
        document
          .getAnimations()
          .filter(a => a.effect?.getTiming().iterations !== Infinity)
          .forEach(a => a.finish())
        return (
          await axe.run(panel()!.closest('[role="dialog"]')!, {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          })
        ).violations
      }
      const settle = () => new Promise(resolve => setTimeout(resolve, 400))
      const buttonsAreLarge = () => {
        for (const el of panel()!.querySelectorAll<HTMLElement>('button')) {
          if (el.getAttribute('role') === 'checkbox') continue
          expect(
            Math.min(el.offsetWidth, el.offsetHeight),
            el.outerHTML.slice(0, 120),
          ).toBeGreaterThanOrEqual(24)
        }
      }

      await openFilter('tags')
      await humanClick(checkbox('vip'))
      await userEvent.fill(search()!, 'i')
      await settle()
      expect(await axeOf()).toEqual([])
      buttonsAreLarge()
      await closePanel()

      await openFilter('manager')
      await expect
        .poll(() => panel()!.querySelector('[aria-busy="true"]'))
        .not.toBeNull()
      expect(await axeOf()).toEqual([])
      await expect
        .poll(() => panel()!.querySelector('[role="alert"]'))
        .not.toBeNull()
      await settle()
      expect(await axeOf()).toEqual([])
      buttonsAreLarge()
      fail = false
      await humanClick(byTestId('filter-options-retry')!)
      await expect.poll(optionValues).toEqual(['m1', 'm2', 'm3'])
      await nextFrame()
      await settle()
      expect(await axeOf()).toEqual([])
    },
  )
})
