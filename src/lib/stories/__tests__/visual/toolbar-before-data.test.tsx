import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { useState } from 'react'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { SKELETON_WAVE_ANIMATION } from '../../../grid/useSkeletonWave'
import {
  columnFiltering,
  columnVisibility,
  dataExport,
  quickSearch,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'

// Тулбар до прихода данных (ADR 0122, TF1–TF6, TF8–TF11): доступны функции, чей результат —
// запрос или состояние; клиентский экспорт и, без колонок, «Колонки» и поле поиска —
// скелеты размером с контрол. TF7, TF12 — модульные в `export`.

const fx = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  await fx.reducedMotion(false)
  await fx.forcedColors(false)
})

interface Row {
  id: string
  name: string
  city: string
}

const ROWS: Row[] = [
  { id: '1', name: 'Alice', city: 'Rome' },
  { id: '2', name: 'Bob', city: 'Oslo' },
  { id: '3', name: 'Carol', city: 'Lima' },
]
const NO_ROWS: Row[] = []

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_COLUMNS: typeof COLUMNS = []
/** Колонки, по которым поиск не ищет: булевы. */
const NOT_SEARCHABLE = COLUMNS.map(column => ({
  ...column,
  dataType: 'boolean' as const,
}))

const NAME_FILTER = [
  { id: 'name', value: { operator: 'contains', value: 'ali' } },
]

interface HostProps {
  loading?: 'initial' | false
  columns?: unknown[]
  data?: Row[]
  server?: boolean
  exportServer?: boolean
  /** Выгрузка одной комбинацией: клик сразу выгружает, без панели. */
  singleExport?: boolean
  initialColumnFilters?: unknown[]
  onSearchChange?: (...args: unknown[]) => void
  onFilterChange?: (...args: unknown[]) => void
  onExport?: (...args: unknown[]) => void
  onExported?: (...args: unknown[]) => void
  colorMode?: 'light' | 'dark'
}

const Host = ({
  loading = 'initial',
  columns = COLUMNS,
  data = NO_ROWS,
  colorMode,
  ...options
}: HostProps) => {
  // Набор плагинов — договор на время жизни таблицы: стенд его не меняет.
  const [plugins] = useState(() => [
    quickSearch({
      onSearchChange: options.onSearchChange as never,
    }),
    columnFiltering({
      onFilterChange: options.onFilterChange as never,
      initialColumnFilters: options.initialColumnFilters as never,
    }),
    columnVisibility(),
    dataExport({
      onExport: options.onExport as never,
      onExported: options.onExported as never,
      ...(options.singleExport && {
        allow: { rows: ['all'], columns: ['visible'] },
      }),
    }),
  ])
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
    loading,
    dataMode: {
      filtering: options.server ? 'server' : 'client',
      search: options.server ? 'server' : 'client',
      export: options.exportServer ? 'server' : 'client',
    },
  })
  return (
    <div style={{ height: 400, display: 'flex', flexDirection: 'column' }}>
      <DataGrid table={table as never} height={360} colorMode={colorMode} />
    </div>
  )
}

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const toolbar = () => byTestId('data-grid-toolbar')!
const searchInput = () => byTestId('quick-search') as HTMLInputElement | null
const summaryButton = () => byTestId('filter-summary-button')
const exportButton = () => byTestId('export-button')
const columnsButton = () => byTestId('column-visibility-button')
/** Полоска скелета внутри обёртки контрола. */
const barOf = (id: string) =>
  byTestId(id)!.querySelector<HTMLElement>('[data-tsr-skeleton-wave]')!
const rowIds = () =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].map(
    row => row.dataset.rowId,
  )

const rect = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}
const near = (actual: number, expected: number, message?: string) =>
  expect(Math.abs(actual - expected), message).toBeLessThanOrEqual(0.5)
const expectSameBox = (
  actual: ReturnType<typeof rect>,
  expected: ReturnType<typeof rect>,
  message: string,
) => {
  near(actual.left, expected.left, `${message}: left`)
  near(actual.top, expected.top, `${message}: top`)
  near(actual.width, expected.width, `${message}: width`)
  near(actual.height, expected.height, `${message}: height`)
}
/** Значение токена темы в px — на корне грида. */
const tokenPx = (name: string) => {
  const probe = document.createElement('span')
  probe.style.width = `var(${name})`
  probe.style.position = 'absolute'
  toolbar().append(probe)
  const value = probe.getBoundingClientRect().width
  probe.remove()
  return value
}
/**
 * Скелет кнопки — квадрат иконки со скруглением скелета в центре места кнопки: фон кнопки
 * прозрачный, видна только иконка.
 */
const expectIconSkeleton = (id: string) => {
  const icon = tokenPx('--tsr-comp-button-icon-size')
  const button = tokenPx('--tsr-comp-toolbar-button-size')
  const bar = rect(barOf(id))
  const place = rect(byTestId(id)!)
  near(bar.width, icon, `${id}: ширина`)
  near(bar.height, icon, `${id}: высота`)
  expect(getComputedStyle(barOf(id)).borderTopLeftRadius, id).toBe(
    `${tokenPx('--tsr-comp-skeleton-radius')}px`,
  )
  near(place.width, button, `${id}: ширина места`)
  near(place.height, button, `${id}: высота места`)
  near(bar.left + bar.width / 2, place.left + place.width / 2, `${id}: по x`)
  near(bar.top + bar.height / 2, place.top + place.height / 2, `${id}: по y`)
}

/** Боксы контролов тулбара, кроме названного, — соседи не должны сдвигаться. */
const neighbours = (except: string) =>
  [
    ...toolbar().querySelectorAll<HTMLElement>(
      '[data-testid="quick-search"], [data-testid="quick-search-skeleton"], [data-testid="filter-summary-button"], [data-testid="column-visibility-button"], [data-testid="column-visibility-skeleton"], [data-testid="export-button"], [data-testid="export-skeleton"]',
    ),
  ]
    .filter(element => !element.dataset.testid!.startsWith(except))
    // Место контрола: скелет и кнопка одного контрола — одно место.
    .map(element => ({
      id: element.dataset.testid!.replace(/-(skeleton|button)$/, ''),
      ...rect(element),
    }))
const expectSameNeighbours = (
  before: ReturnType<typeof neighbours>,
  after: ReturnType<typeof neighbours>,
) => {
  expect(after.map(item => item.id)).toEqual(before.map(item => item.id))
  before.forEach((item, index) =>
    expectSameBox(after[index], item, String(item.id)),
  )
}

const waitToolbar = () =>
  expect.poll(() => byTestId('data-grid-toolbar')).not.toBeNull()

describe('Тулбар до прихода данных (ADR 0122)', () => {
  test('TF1: поиск во время первой загрузки доступен: клиентский запрос применяется к пришедшим строкам, серверный сразу вызывает onSearchChange', async () => {
    const client = await render(<Host />)
    await expect.poll(searchInput).not.toBeNull()
    expect(searchInput()!.getAttribute('aria-disabled')).not.toBe('true')
    await userEvent.type(searchInput()!, 'ali')
    await client.rerender(<Host loading={false} data={ROWS} />)
    await expect.poll(rowIds).toEqual(['1'])
    expect(searchInput()!.value).toBe('ali')
    await client.unmount()

    const onSearchChange = vi.fn()
    await render(<Host server onSearchChange={onSearchChange} />)
    await expect.poll(searchInput).not.toBeNull()
    await userEvent.type(searchInput()!, 'bo')
    await expect.poll(() => onSearchChange.mock.calls.at(-1)?.[0]).toBe('bo')
    // Данных всё ещё нет: колбэк ушёл до них.
    expect(byTestId('quick-search')).not.toBeNull()
    expect(rowIds()).toEqual([])
  })

  test('TF2: колонок ещё нет — на месте поля поиска скелет по токенам поля; колонки пришли — поле на том же месте, соседи не сдвигаются; после загрузки без колонок поиска поле выключено', async () => {
    const screen = await render(<Host columns={NO_COLUMNS} />)
    await expect.poll(() => byTestId('quick-search-skeleton')).not.toBeNull()
    expect(searchInput()).toBeNull()
    const bar = barOf('quick-search-skeleton')
    near(rect(bar).width, tokenPx('--tsr-comp-quick-search-width'), 'width')
    near(rect(bar).height, tokenPx('--tsr-comp-toolbar-button-size'), 'height')
    expect(getComputedStyle(bar).borderTopLeftRadius).toBe(
      `${tokenPx('--tsr-comp-control-radius')}px`,
    )
    const skeletonBox = rect(byTestId('quick-search-skeleton')!)
    const before = neighbours('quick-search')

    await screen.rerender(<Host columns={COLUMNS} />)
    await expect.poll(searchInput).not.toBeNull()
    expect(byTestId('quick-search-skeleton')).toBeNull()
    const field = searchInput()!.parentElement!
    expectSameBox(rect(field), skeletonBox, 'field')
    expectSameNeighbours(before, neighbours('quick-search'))
    await screen.unmount()

    await render(<Host loading={false} columns={NOT_SEARCHABLE} data={ROWS} />)
    await expect.poll(searchInput).not.toBeNull()
    expect(searchInput()!.getAttribute('aria-disabled')).toBe('true')
    expect(byTestId('quick-search-skeleton')).toBeNull()
  })

  test('TF3: «Колонки» при неизвестных колонках — скелет иконки в центре места кнопки тулбара; колонки известны — кнопка доступна, меню по описанию колонок', async () => {
    const screen = await render(<Host columns={NO_COLUMNS} />)
    await expect
      .poll(() => byTestId('column-visibility-skeleton'))
      .not.toBeNull()
    expect(columnsButton()).toBeNull()
    expectIconSkeleton('column-visibility-skeleton')
    const skeletonBox = rect(byTestId('column-visibility-skeleton')!)

    await screen.rerender(<Host columns={COLUMNS} />)
    await expect.poll(columnsButton).not.toBeNull()
    expect(byTestId('column-visibility-skeleton')).toBeNull()
    expectSameBox(rect(columnsButton()!), skeletonBox, 'button')
    await humanClick(columnsButton()!)
    await expect.poll(() => byTestId('column-visibility-menu')).not.toBeNull()
    const menu = byTestId('column-visibility-menu')!
    expect(menu.textContent).toContain('Name')
    expect(menu.textContent).toContain('City')
  })

  test('TF4: «Фильтры» во время первой загрузки — как после неё: с фильтрами кнопка доступна и снимает фильтр (клиент — для пришедших строк, сервер — колбэком); без фильтров или без колонок — выключена', async () => {
    const removeName = async () => {
      await expect.poll(summaryButton).not.toBeNull()
      expect(summaryButton()!.getAttribute('aria-disabled')).not.toBe('true')
      await humanClick(summaryButton()!)
      await expect.poll(() => byTestId('filter-summary')).not.toBeNull()
      await humanClick(byTestId('filter-summary-remove')!)
      await expect.poll(() => byTestId('filter-summary')).toBeNull()
    }

    const client = await render(<Host initialColumnFilters={NAME_FILTER} />)
    await removeName()
    await client.rerender(
      <Host initialColumnFilters={NAME_FILTER} loading={false} data={ROWS} />,
    )
    await expect.poll(rowIds).toEqual(['1', '2', '3'])
    await client.unmount()

    const onFilterChange = vi.fn()
    const onSearchChange = vi.fn()
    const server = await render(
      <Host
        server
        initialColumnFilters={NAME_FILTER}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
      />,
    )
    await removeName()
    await expect.poll(() => onFilterChange.mock.calls.length).toBe(1)
    await server.unmount()

    const empty = await render(<Host />)
    await expect.poll(summaryButton).not.toBeNull()
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
    await empty.unmount()

    await render(
      <Host columns={NO_COLUMNS} initialColumnFilters={NAME_FILTER} />,
    )
    await expect.poll(summaryButton).not.toBeNull()
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
  })

  test('TF5: клиентский «Экспорт» во время первой загрузки — скелет иконки в центре места кнопки тулбара; данные пришли — кнопка на том же месте, соседи не сдвигаются', async () => {
    const screen = await render(<Host />)
    await expect.poll(() => byTestId('export-skeleton')).not.toBeNull()
    expect(exportButton()).toBeNull()
    expectIconSkeleton('export-skeleton')
    const skeletonBox = rect(byTestId('export-skeleton')!)
    const before = neighbours('export')

    await screen.rerender(<Host loading={false} data={ROWS} />)
    await expect.poll(exportButton).not.toBeNull()
    expect(byTestId('export-skeleton')).toBeNull()
    expectSameBox(rect(exportButton()!), skeletonBox, 'button')
    expectSameNeighbours(before, neighbours('export'))
  })

  test('TF6: «Экспорт» с серверным вариантом доступен до данных: клик выгружает через onExport', async () => {
    const onExport = vi.fn()
    await render(<Host exportServer singleExport onExport={onExport} />)
    await expect.poll(exportButton).not.toBeNull()
    expect(byTestId('export-skeleton')).toBeNull()
    await humanClick(exportButton()!)
    await expect.poll(() => onExport.mock.calls.length).toBe(1)
    expect(onExport.mock.calls[0][0]).toMatchObject({
      settings: { rows: 'all', columns: 'visible' },
    })
  })

  test('TF8: скелеты тулбара — в общей волне рамки; при уменьшенном движении без волны, в forced-colors — GrayText', async () => {
    const sys = (name: string) => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = name
      document.body.append(probe)
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    }
    const ids = [
      'quick-search-skeleton',
      'column-visibility-skeleton',
      'export-skeleton',
    ]
    const waitBars = () =>
      expect.poll(() => byTestId('export-skeleton')).not.toBeNull()
    const lightShift = (bar: Element) =>
      new DOMMatrix(getComputedStyle(bar, '::after').transform).m41

    const shared = await render(<Host columns={NO_COLUMNS} />)
    await waitBars()
    const frame = document.querySelector<HTMLElement>('[data-skeleton-wave]')!
    const waveWidth = Number.parseFloat(
      getComputedStyle(frame).getPropertyValue(
        '--tsr-comp-skeleton-wave-width',
      ),
    )
    for (const id of ids) {
      const bar = barOf(id)
      expect(frame.contains(bar), id).toBe(true)
      // Блик — полоса общей волны рамки, а не своя волна полоски.
      near(
        Number.parseFloat(getComputedStyle(bar, '::after').width),
        waveWidth,
        id,
      )
      expect(
        document
          .getAnimations()
          .some(
            animation =>
              animation.id === SKELETON_WAVE_ANIMATION &&
              (animation.effect as KeyframeEffect).target === bar,
          ),
        id,
      ).toBe(true)
    }
    await shared.unmount()

    await fx.reducedMotion(true)
    const reduced = await render(<Host columns={NO_COLUMNS} />)
    await waitBars()
    for (const id of ids) {
      // Полоса целиком за левым краем скелета: света нет.
      expect(lightShift(barOf(id)), id).toBeLessThanOrEqual(-waveWidth / 2)
    }
    await reduced.unmount()
    await fx.reducedMotion(false)

    await fx.forcedColors(true)
    await render(<Host columns={NO_COLUMNS} />)
    await waitBars()
    for (const id of ids) {
      expect(getComputedStyle(barOf(id)).backgroundColor, id).toBe(
        sys('GrayText'),
      )
    }
  })

  test('TF9: скелеты тулбара не фокусируются и скрыты от скринридера, roving-фокус их пропускает; после загрузки контрол встаёт на своё место в порядке', async () => {
    /** Обход тулбара стрелкой вправо от поля поиска до возврата к нему. */
    const walk = async () => {
      searchInput()!.focus()
      const visited: Element[] = [document.activeElement!]
      for (let step = 0; step < 10; step++) {
        // eslint-disable-next-line no-await-in-loop
        await userEvent.keyboard('{ArrowRight}')
        if (document.activeElement === visited[0]) break
        visited.push(document.activeElement!)
      }
      return visited
    }
    const focusables = () =>
      [
        ...toolbar().querySelectorAll<HTMLElement>(
          'button, input:not([disabled])',
        ),
      ].filter(element => !element.closest('[aria-hidden="true"]'))

    const screen = await render(<Host />)
    await expect.poll(() => byTestId('export-skeleton')).not.toBeNull()
    await expect.poll(searchInput).not.toBeNull()
    const skeleton = byTestId('export-skeleton')!
    expect(skeleton.getAttribute('aria-hidden')).toBe('true')
    expect(skeleton.querySelectorAll('button, input, [tabindex]').length).toBe(
      0,
    )
    const before = await walk()
    expect(before.some(element => skeleton.contains(element))).toBe(false)
    expect(before).toEqual(focusables())
    // Место скелета среди контролов тулбара по DOM.
    const slotIndex = [
      ...toolbar().querySelectorAll<HTMLElement>(
        'button, input, [data-testid="export-skeleton"]',
      ),
    ].findIndex(element => element === skeleton)

    await screen.rerender(<Host loading={false} data={ROWS} />)
    await expect.poll(exportButton).not.toBeNull()
    const after = await walk()
    expect(after).toEqual(focusables())
    expect(after).toContain(exportButton())
    expect(
      [...toolbar().querySelectorAll<HTMLElement>('button, input')].indexOf(
        exportButton()!,
      ),
    ).toBe(slotIndex)
  })

  test('TF10: пустой результат после загрузки — обычная кнопка «Экспорт», выгрузка — файл с шапкой', async () => {
    const onExported = vi.fn()
    await render(
      <Host
        loading={false}
        data={NO_ROWS}
        singleExport
        onExported={onExported}
      />,
    )
    await expect.poll(exportButton).not.toBeNull()
    expect(byTestId('export-skeleton')).toBeNull()
    await humanClick(exportButton()!)
    await expect.poll(() => onExported.mock.calls.length).toBe(1)
    expect(onExported.mock.calls[0][0]).toMatchObject({ rowCount: 0 })
    expect(
      onExported.mock.calls[0][0].columns.map(
        (column: { id: string }) => column.id,
      ),
    ).toEqual(['name', 'city'])
  })

  test('TF11: axe с color-contrast во время первой загрузки со всеми четырьмя функциями тулбара в светлой и тёмной темах', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await render(
        <Host colorMode={colorMode} initialColumnFilters={NAME_FILTER} />,
      )
      // eslint-disable-next-line no-await-in-loop
      await waitToolbar()
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(() => byTestId('export-skeleton')).not.toBeNull()
      expect(searchInput(), colorMode).not.toBeNull()
      expect(summaryButton(), colorMode).not.toBeNull()
      expect(columnsButton(), colorMode).not.toBeNull()
      // eslint-disable-next-line no-await-in-loop
      const { violations } = await axe.run(toolbar(), {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(violations, colorMode).toEqual([])
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })
})
