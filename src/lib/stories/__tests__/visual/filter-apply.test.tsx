import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import type { ColumnOption } from '../../../core/columnOptions'
import { bodyRows, humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Кнопка «Применить» и черновик серверного фильтра (ADR 0154; FD1–FD5, FD7–FD10) —
// настоящими событиями браузера. FD6 — модульный (`src/lib/__tests__/filterDraft.dom.test.tsx`).

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
  filters: { id: string; value: unknown }[]
  signal: AbortSignal
  answer: Deferred
}

let calls: Call[] = []
const onFilterChange = (
  filters: Call['filters'],
  { signal }: { signal: AbortSignal },
) => {
  const call = { filters, signal, answer: deferred() }
  calls.push(call)
  return call.answer.promise
}
const lastCall = () => calls.at(-1)!
const valueOf = (call: Call, id: string) =>
  call.filters.find(filter => filter.id === id)?.value

const STATUS: ColumnOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
]
const MANAGERS: ColumnOption[] = [
  { value: 'm1', label: 'Alice Moss' },
  { value: 'm2', label: 'Bob Reed' },
]

const DATA = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
  vip: i % 2 === 0,
  created: `2026-03-${String(i + 1).padStart(2, '0')}`,
  status: i % 2 ? 'paused' : 'active',
  manager: i % 2 ? 'm2' : 'm1',
}))

/** Колонки-заполнители: имя уходит из окна горизонтальной прокрутки. */
const FILLERS = Array.from({ length: 30 }, (_, i) => ({
  id: `f${i}`,
  accessorKey: 'age',
  header: `F${i}`,
  size: 160,
}))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'age', accessorKey: 'age', header: 'Age', filter: 'number' },
  {
    id: 'vip',
    accessorKey: 'vip',
    header: 'VIP',
    filter: { type: 'boolean' },
  },
  { id: 'created', accessorKey: 'created', header: 'Created', filter: 'date' },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    options: STATUS,
    filter: 'select',
  },
  {
    id: 'manager',
    accessorKey: 'manager',
    header: 'Manager',
    getOptionLabel: (id: string) =>
      MANAGERS.find(manager => manager.value === id)?.label,
    filter: {
      type: 'lookup',
      loadOptions: async (search: string) =>
        MANAGERS.filter(manager =>
          manager.label.toLowerCase().includes(search.toLowerCase()),
        ),
    },
  },
]

interface GridProps {
  server?: boolean
  wide?: boolean
  localization?: Record<string, unknown>
}

const Grid = ({ server = true, wide = false, localization }: GridProps) => {
  const table = useCreateTable({
    columns: (wide ? [...COLUMNS, ...FILLERS] : COLUMNS) as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      columnFiltering({
        server,
        timeZone: 'UTC',
        debounceMs: 0,
        onFilterChange,
      }),
    ] as never,
  })
  return (
    <div style={{ width: 900, height: 520 }}>
      <DataGrid table={table as never} localization={localization as never} />
    </div>
  )
}

const mount = async (props: GridProps = {}) => {
  calls = []
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const rowIds = () => bodyRows().map(row => row.dataset.rowId!)
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"][aria-colindex]`,
  )
const filterButton = (id = 'name') =>
  headCell(id)!.querySelector<HTMLElement>('.column-filter__button')!
const panel = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
const byTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
  panel()?.querySelector<T>(`[data-testid="${id}"]`) ?? null
const field = () => byTestId<HTMLInputElement>('filter-value')
const apply = () => byTestId<HTMLButtonElement>('filter-apply')
const reset = () => byTestId<HTMLButtonElement>('filter-reset')
const applyEnabled = () => !!apply() && !apply()!.disabled
const option = (value: string) =>
  panel()?.querySelector<HTMLElement>(
    `[data-option-index][data-value="${value}"] [role="checkbox"]`,
  ) ?? null
const firstDay = () =>
  panel()?.querySelector<HTMLButtonElement>(
    '[data-testid="filter-calendar"] [data-day] button',
  ) ?? null
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

const openPanel = async (id = 'name') => {
  await userEvent.hover(headCell(id)!)
  await humanClick(filterButton(id))
  await expect.poll(panel).not.toBeNull()
}
const closePanel = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(panel).toBeNull()
}
const typeName = async (text: string) => {
  await userEvent.click(field()!)
  await userEvent.keyboard(text)
  await expect.poll(() => field()!.value).toBe(text)
}
const chooseOperator = async (operator: string) => {
  const item = () =>
    document.querySelector<HTMLElement>(`[data-operator="${operator}"]`)
  await humanClick(byTestId('filter-operator')!)
  await expect.poll(item).not.toBeNull()
  await humanClick(item()!)
  await expect.poll(() => item()?.closest('[data-open]') ?? null).toBeNull()
}
/** Отпустить ответ «сервера» и дождаться конца ожидания. */
const answer = async (call = lastCall()) => {
  call.answer.resolve()
  await expect
    .poll(() => filterButton().getAttribute('aria-busy'))
    .not.toBe('true')
}
const busy = (id = 'name') =>
  filterButton(id).getAttribute('aria-busy') === 'true'
const active = (id = 'name') => filterButton(id).hasAttribute('data-active')

describe('Применение серверного фильтра (ADR 0154)', () => {
  test('FD1: в серверном режиме в нижней строке панели справа — «Применить», слева от неё «Сбросить»; ввод, выбор условия, дата и отметка варианта запрос не шлют', async () => {
    await mount()
    await openPanel()
    const applyBox = apply()!.getBoundingClientRect()
    const resetBox = reset()!.getBoundingClientRect()
    const panelBox = panel()!.getBoundingClientRect()
    expect(apply()!.textContent).toBe(tableLabels.filterApply)
    expect(applyBox.left).toBeGreaterThanOrEqual(resetBox.right)
    expect(Math.abs(applyBox.top - resetBox.top)).toBeLessThanOrEqual(1)
    expect(applyBox.bottom).toBeGreaterThan(panelBox.top + panelBox.height / 2)
    expect(panelBox.right - applyBox.right).toBeLessThan(applyBox.width)

    await typeName('Name 1')
    await chooseOperator('equals')
    await closePanel()
    await openPanel('created')
    await humanClick(firstDay()!)
    await closePanel()
    await openPanel('status')
    await humanClick(option('paused')!)
    await sleep(200)
    expect(calls).toHaveLength(0)
    expect(rowIds()).toHaveLength(12)
  })

  test('FD2: «Применить» и Enter в поле значения отправляют условие; кнопка недоступна, пока условие совпадает с действующим или число введено с ошибкой', async () => {
    await mount()
    await openPanel()
    expect(applyEnabled()).toBe(false)
    await typeName('Name')
    expect(applyEnabled()).toBe(true)
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(1)
    expect(valueOf(lastCall(), 'name')).toEqual({
      operator: 'contains',
      value: 'Name',
    })
    await answer()
    expect(applyEnabled()).toBe(false)

    await userEvent.click(field()!)
    await userEvent.keyboard(' 1{Enter}')
    await expect.poll(() => calls.length).toBe(2)
    expect(valueOf(lastCall(), 'name')).toEqual({
      operator: 'contains',
      value: 'Name 1',
    })
    await answer()
    await closePanel()

    await openPanel('age')
    await userEvent.click(field()!)
    await userEvent.keyboard('abc')
    await expect.poll(() => field()!.getAttribute('aria-invalid')).toBe('true')
    expect(applyEnabled()).toBe(false)
  })

  test('FD3: после «Применить» панель остаётся открытой, кнопка фильтра колонки показывает ожидание', async () => {
    await mount()
    await openPanel()
    await typeName('Name 1')
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(1)
    await expect.poll(() => busy()).toBe(true)
    await sleep(300)
    expect(panel()).not.toBeNull()
    expect(field()!.value).toBe('Name 1')
    await answer()
    expect(panel()).not.toBeNull()
  })

  test('FD4: отмена «стопом» снимает фильтр, условие остаётся в панели; «Применить» отправляет его снова', async () => {
    await mount()
    await openPanel()
    await typeName('Name 1')
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(1)
    const first = lastCall()
    await closePanel()
    await expect
      .poll(() => filterButton().hasAttribute('data-cancel-armed'))
      .toBe(true)
    await humanClick(filterButton())
    await expect.poll(() => first.signal.aborted).toBe(true)
    await expect.poll(() => busy()).toBe(false)
    expect(active()).toBe(false)

    await openPanel()
    expect(field()!.value).toBe('Name 1')
    expect(applyEnabled()).toBe(true)
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(2)
    expect(valueOf(lastCall(), 'name')).toEqual({
      operator: 'contains',
      value: 'Name 1',
    })
  })

  test('FD5: условие переживает закрытие и открытие панели, отказ сервера, уход колонки из окна прокрутки', async () => {
    await mount({ wide: true })

    // Закрытие и открытие.
    await openPanel()
    await typeName('Name 1')
    await closePanel()
    await openPanel()
    expect(field()!.value).toBe('Name 1')

    // Отказ сервера.
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(1)
    lastCall().answer.reject(new Error('Server error'))
    await expect.poll(() => busy()).toBe(false)
    await closePanel()
    await openPanel()
    expect(field()!.value).toBe('Name 1')
    await closePanel()

    // Колонка ушла из окна прокрутки и вернулась.
    scroller().scrollLeft = scroller().scrollWidth
    await expect.poll(() => headCell('name')).toBeNull()
    scroller().scrollLeft = 0
    await expect.poll(() => headCell('name')).not.toBeNull()
    await openPanel()
    expect(field()!.value).toBe('Name 1')
  })

  test('FD7: пока условие не применено, кнопка фильтра колонки выглядит выключенной', async () => {
    await mount()
    await openPanel()
    await typeName('Name 1')
    expect(active()).toBe(false)
    expect(filterButton().getAttribute('aria-label')).toBe(tableLabels.filter)
    await closePanel()
    expect(active()).toBe(false)

    await openPanel()
    await humanClick(apply()!)
    await expect.poll(() => calls.length).toBe(1)
    await answer()
    await expect.poll(() => active()).toBe(true)
  })

  test('FD8: так во всех панелях — текст, число, да/нет, дата, варианты, справочник', async () => {
    await mount()
    const panels: [string, () => Promise<void>][] = [
      ['name', () => typeName('Name 1')],
      [
        'age',
        async () => {
          await userEvent.click(field()!)
          await userEvent.keyboard('25')
        },
      ],
      [
        'vip',
        () =>
          humanClick(
            panel()!.querySelector<HTMLElement>('[data-value="yes"]')!,
          ),
      ],
      ['created', () => humanClick(firstDay()!)],
      ['status', () => humanClick(option('paused')!)],
      [
        'manager',
        async () => {
          await expect.poll(() => option('m2')).not.toBeNull()
          await humanClick(option('m2')!)
        },
      ],
    ]
    for (const [id, edit] of panels) {
      await openPanel(id)
      expect(apply(), id).not.toBeNull()
      expect(applyEnabled(), id).toBe(false)
      const count = calls.length
      await edit()
      await expect.poll(applyEnabled, { message: id }).toBe(true)
      await sleep(100)
      expect(calls.length, id).toBe(count)
      await humanClick(apply()!)
      await expect.poll(() => calls.length, { message: id }).toBe(count + 1)
      expect(valueOf(lastCall(), id), id).toBeDefined()
      await answer()
      await closePanel()
    }
  })

  test('FD9: в клиентском режиме кнопки нет, условие применяется само', async () => {
    await mount({ server: false })
    await openPanel()
    expect(apply()).toBeNull()
    await typeName('Name 1')
    await expect.poll(rowIds).toEqual(['1', '10', '11'])
  })

  test('FD10: подпись «Применить» — ключ словаря; axe и контраст кнопки в обеих темах', async () => {
    const screen = await mount({ localization: { filterApply: 'Send' } })
    await openPanel()
    expect(apply()!.textContent).toBe('Send')
    await closePanel()
    await screen.unmount()

    await mount()
    await openPanel()
    await inBothThemes(async () => {
      for (const enabled of [false, true]) {
        if (enabled) {
          await typeName('Name 1')
          // Цвет кнопки переходит к доступному — замер по конечному.
          document.getAnimations().forEach(animation => animation.finish())
        }
        const { violations } = await axe.run(panel()!, {
          rules: { 'color-contrast': { enabled: true } },
        })
        expect(
          violations.flatMap(v =>
            v.nodes.map(node => `${v.id}: ${node.target.join(' ')}`),
          ),
          enabled ? 'enabled' : 'disabled',
        ).toEqual([])
      }
      await userEvent.clear(field()!)
    })
  })
})
