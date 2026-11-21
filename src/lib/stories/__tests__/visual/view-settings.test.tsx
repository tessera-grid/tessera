import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { ViewSettingsButton } from '../../../grid/ViewSettings/ViewSettingsButton'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  quickSearch,
  rowGrouping,
  rowSelection,
} from '../../../plugins'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import { tableLabels } from '../labels'
import { measureWork, renders, describeWork } from '../work.helpers'
import {
  closeSettings,
  openSettings,
  openSettingsSection,
  viewSettingsButton,
  viewSettingsLevel,
  viewSettingsPopover,
  viewSettingsRow,
} from '../viewSettings'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// «Настройки вида» (ADR 0215): кнопка, первый уровень, короткие значения, простой раздел, раздел со
// своей панелью, фокус, подписки, доступность и сдвиг уровней. VW1, VW8–VW10, VW14–VW15 —
// модульные, VW13 — перф в `interaction`, VW17 — `view-settings-panel`.

/** axe с проверкой контраста: в общих опциях она выключена. */
const AXE_CONTRAST = {
  ...AXE_OPTIONS,
  rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
  age: 20 + i,
}))

type Api = {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  setColumnVisibility: (value: Record<string, boolean>) => void
  setGrouping: (value: string[]) => void
  setGlobalFilter: (value: string) => void
  getRow: (id: string) => { toggleSelected: (value: boolean) => void }
  getState: () => Record<string, unknown>
  atoms: Record<string, { get: () => unknown }>
}

let api: Api

const ownSection = definePlugin<{ enabled?: boolean }>()({
  id: 'ownSection',
  diagnose: () => undefined,
  viewSettingsSections: [
    {
      id: 'own',
      plugin: 'ownSection',
      icon: 'filterActive',
      slices: [],
      label: () => 'Own section',
      active: () => true,
      value: () => 'own value',
      levels: () => [
        {
          id: 'one',
          label: 'One',
          removeLabel: 'Remove one',
          remove: () => {},
        },
      ],
    },
  ],
})

const plugins = () => [
  columnFiltering(),
  columnSorting(),
  rowGrouping(),
  columnVisibility(),
  quickSearch({ toolbar: false }),
  rowSelection(),
  ownSection(),
]

const Grid = ({
  icons,
  onDebugAction,
}: {
  icons?: Record<string, unknown>
  onDebugAction?: (action: unknown) => void
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: plugins() as never,
    onDebugAction,
  } as never)
  api = table as unknown as Api
  return (
    <div style={{ width: 800, height: 420 }}>
      <DataGrid table={table as never} icons={icons as never} />
    </div>
  )
}

const mount = async (props: Parameters<typeof Grid>[0] = {}) => {
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  await expect.poll(() => viewSettingsButton(document)).not.toBeNull()
  return screen
}

const button = () => viewSettingsButton(document)!
const nameOf = (element: HTMLElement) =>
  element.getAttribute('aria-label') ?? element.textContent ?? ''
const bubbleCount = () =>
  button()
    .querySelector<HTMLElement>('[data-active-indicator]')
    ?.getAttribute('data-count') ?? null
const rowIds = () =>
  [
    ...viewSettingsLevel()!.querySelectorAll<HTMLElement>(
      '[data-view-settings-section]',
    ),
  ].map(row => row.dataset.viewSettingsSection)
const valueOf = (id: string) =>
  viewSettingsRow(id)!
    .querySelector('[data-popup-nav-value]')
    ?.textContent?.trim()
const descriptionOf = (id: string) =>
  document.getElementById(
    viewSettingsRow(id)!.getAttribute('aria-describedby')!,
  )!.textContent
const levels = () => [
  ...viewSettingsLevel()!.querySelectorAll<HTMLElement>(
    '[data-view-settings-level]',
  ),
]
const removeOf = (level: HTMLElement) =>
  level.querySelector<HTMLElement>('[data-view-settings-remove]')!
const resetButton = () =>
  document.querySelector<HTMLElement>('[data-testid="view-settings-reset"]')
const back = () =>
  viewSettingsLevel()!.querySelector<HTMLElement>('[data-popup-level-back]')!
const sortingLabels = columnSortingLabels(tableLabels)
const visibilityLabels = columnVisibilityLabels(tableLabels)

afterEach(async () => {
  await closeSettings()
  vi.restoreAllMocks()
})

describe('«Настройки вида» (ADR 0215)', () => {
  test('VW2: бабл кнопки — число активных разделов; подпись и доступное имя — с ним; значок — icons.viewSettings', async () => {
    const Icon = () => <svg data-testid="own-view-settings-icon" />
    await mount({ icons: { viewSettings: Icon } })
    // Раздел автора активен всегда — один.
    await expect.poll(bubbleCount).toBe('1')
    expect(nameOf(button())).toContain(tableLabels.viewSettingsActive(1))
    expect(
      button().querySelector('[data-testid="own-view-settings-icon"]'),
    ).not.toBeNull()

    api.setSorting([{ id: 'name', desc: false }])
    api.setColumnVisibility({ age: false })
    await expect.poll(bubbleCount).toBe('3')
    expect(nameOf(button())).toContain(tableLabels.viewSettingsActive(3))
  })

  test('VW3: первый уровень — строка на видимый раздел по рангам, раздел автора после встроенных; значок, имя, короткое значение, шеврон у открываемого; неактивный простой раздел приглушён и не открывается; общего сброса нет', async () => {
    await mount()
    api.setSorting([{ id: 'name', desc: false }])
    await openSettings()
    // Поиск неактивен — его строки нет.
    expect(rowIds()).toEqual([
      'filter',
      'sorting',
      'grouping',
      'columns',
      'own',
      'shortcuts',
    ])
    for (const id of rowIds()) {
      const row = viewSettingsRow(id!)!
      expect(row.querySelector('svg'), `${id}: значок`).not.toBeNull()
      expect(valueOf(id!), `${id}: значение`).toBeTruthy()
    }
    const chevron = (id: string) =>
      !!viewSettingsRow(id)!.querySelector('[data-popup-item-mark="submenu"]')
    // Сортировка активна, «Колонки» — своя панель: открываются. Фильтр и группировка — нет.
    expect(chevron('sorting')).toBe(true)
    expect(chevron('columns')).toBe(true)
    expect(chevron('shortcuts')).toBe(true)
    expect(chevron('filter')).toBe(false)
    expect(viewSettingsRow('filter')!.getAttribute('aria-disabled')).toBe(
      'true',
    )
    await userEvent.click(viewSettingsRow('filter')!, { force: true })
    expect(viewSettingsRow('filter')).not.toBeNull()
    expect(resetButton()).toBeNull()
  })

  test('VW4: короткие значения — счётчик включённого и черновиков, «hidden» у колонок, «active» у поиска; полное доступное имя строки', async () => {
    await mount()
    api.setSorting([
      { id: 'name', desc: false },
      { id: 'age', desc: true },
    ])
    api.setColumnVisibility({ city: false })
    api.setGlobalFilter('Name 1')
    api.setColumnFilters([
      { id: 'name', value: { operator: 'contains', value: 'Name' } },
    ])
    await openSettings()
    expect(valueOf('sorting')).toBe(tableLabels.viewSettingsActiveCount(2))
    expect(valueOf('filter')).toBe(tableLabels.viewSettingsActiveCount(1))
    expect(valueOf('grouping')).toBe(tableLabels.viewSettingsNone)
    expect(valueOf('columns')).toBe(visibilityLabels.columnsHiddenShort(1))
    expect(valueOf('search')).toBe(tableLabels.viewSettingsOn)
    // Полное имя строки — с уровнями раздела, а не только счётчиком.
    const full = descriptionOf('sorting')!
    expect(full).toContain(sortingLabels.sorting)
    expect(full).toContain('Name')
    expect(full).toContain('Age')
  })

  test('VW5: простой раздел — «назад», уровни с описанием и значком скрытой колонки, снятие уровня и «Сбросить» справа без тона danger путями плагина с каналом действий', async () => {
    const onDebugAction = vi.fn()
    await mount({ onDebugAction })
    api.setSorting([
      { id: 'name', desc: false },
      { id: 'city', desc: true },
    ])
    api.setColumnVisibility({ city: false })
    await openSettingsSection('sorting')
    expect(back().textContent).toContain(sortingLabels.sorting)
    expect(levels().map(level => level.dataset.viewSettingsLevel)).toEqual([
      'name',
      'city',
    ])
    for (const level of levels())
      expect(
        level.querySelector('[data-view-settings-description]')?.textContent,
      ).toBeTruthy()
    // Значок скрытой колонки — только у её уровня.
    const hidden = (level: HTMLElement) =>
      !!level.querySelector('[data-testid="view-settings-hidden"]')
    expect(levels().map(hidden)).toEqual([false, true])

    const reset = resetButton()!
    expect(reset.getAttribute('data-tone')).not.toBe('danger')
    const panel = reset.closest<HTMLElement>('[data-popup-level]')!
    expect(
      panel.getBoundingClientRect().right - reset.getBoundingClientRect().right,
    ).toBeLessThan(24)

    onDebugAction.mockClear()
    await userEvent.click(removeOf(levels()[0]!))
    await expect
      .poll(() => (api.atoms.sorting!.get() as { id: string }[]).map(s => s.id))
      .toEqual(['city'])
    expect(
      onDebugAction.mock.calls.some(
        ([action]) => (action as { plugin: string }).plugin === 'columnSorting',
      ),
    ).toBe(true)

    await userEvent.click(resetButton()!)
    await expect.poll(() => api.atoms.sorting!.get()).toEqual([])
  })

  test('VW6: раздел со своей панелью — рамка с «назад» и ленивый компонент; «Колонки» — меню колонок, открывается, даже когда ничего не скрыто', async () => {
    await mount()
    await openSettings()
    // Ничего не скрыто: раздел всё равно открывается.
    expect(valueOf('columns')).toBe(visibilityLabels.columnsAllVisible)
    await openSettingsSection('columns')
    expect(back().textContent).toContain(visibilityLabels.columns)
    await expect
      .poll(() =>
        viewSettingsLevel()!.querySelector(
          '[data-testid="column-visibility-menu"]',
        ),
      )
      .not.toBeNull()
  })

  test('VW7: фокус — вход в раздел на первый элемент, «назад» — на строку раздела, снятие уровня — на соседний уровень, затем на сброс; Escape закрывает', async () => {
    await mount()
    api.setSorting([
      { id: 'name', desc: false },
      { id: 'age', desc: true },
    ])
    await openSettings()
    viewSettingsRow('sorting')!.focus()
    await userEvent.keyboard('{Enter}')
    // Первый элемент простого раздела — снятие первого уровня.
    await expect.poll(() => levels().length).toBe(2)
    const focused = (element: () => HTMLElement | null) =>
      expect.poll(() => document.activeElement === element()).toBe(true)
    await focused(() => removeOf(levels()[0]!))

    back().focus()
    await userEvent.keyboard('{Enter}')
    await focused(() => viewSettingsRow('sorting'))

    // «Колонки»: фокус — на поле поиска меню.
    viewSettingsRow('columns')!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => document.activeElement?.tagName).toBe('INPUT')
    back().click()
    await focused(() => viewSettingsRow('columns'))

    // Снятие уровня: фокус на соседний уровень, последнего — на «Сбросить».
    viewSettingsRow('sorting')!.click()
    await expect.poll(() => levels().length).toBe(2)
    removeOf(levels()[0]!).focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => levels().length).toBe(1)
    await focused(() => removeOf(levels()[0]!))

    // Первый Escape гасит подсказку точки, второй закрывает поповер (ADR 0232, KX9).
    await expect
      .poll(() => document.querySelector('[data-tooltip-popup]')?.textContent)
      .toBe(tableLabels.viewSettingsLevelHint)
    await userEvent.keyboard('{Escape}')
    await expect.poll(viewSettingsPopover).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(viewSettingsPopover).toBeNull()
  })

  test('VW11: кнопка «Настроек вида» подписана только на срезы своих разделов — выбор строки и прокрутка её не перерисовывают', async () => {
    await mount()
    const grid = document.querySelector('.data-grid__container')!
    const work = await measureWork(grid, async () => {
      api.getRow('3').toggleSelected(true)
      grid.scrollTop = 400
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    expect(renders(work, ViewSettingsButton), describeWork(work)).toBe(0)
    // Смена среза раздела — перерисовка.
    const sorted = await measureWork(grid, () =>
      api.setSorting([{ id: 'name', desc: false }]),
    )
    expect(renders(sorted, ViewSettingsButton)).toBeGreaterThan(0)
  })

  test('VW12: кнопка, первый уровень, простой раздел и раздел со своей панелью — axe с color-contrast в обеих темах и в forced-colors', async () => {
    await mount()
    api.setSorting([{ id: 'name', desc: false }])
    api.setColumnVisibility({ age: false })
    // Контраст в forced-colors меряет матрица контраста по пикселям (ADR 0089, CX9–CX11): axe
    // читает вычисленные цвета, а их режим подменяет при отрисовке.
    let options: axe.RunOptions = AXE_CONTRAST
    const audit = async (target: Element) => {
      await inBothThemes(async () => {
        const result = await axe.run(target, options)
        expect(
          result.violations.map(
            v =>
              `${v.id}: ${v.nodes.map(n => n.html.slice(0, 160)).join(' | ')}`,
          ),
        ).toEqual([])
      })
    }
    const all = async () => {
      // Подпись и бабл — одного счёта: проверка не застаёт кнопку посреди перерисовки.
      await expect.poll(bubbleCount).toBe('3')
      await audit(button())
      await openSettings()
      await audit(viewSettingsLevel()!)
      await openSettingsSection('sorting')
      await audit(viewSettingsLevel()!)
      back().click()
      await openSettingsSection('columns')
      await expect
        .poll(() =>
          viewSettingsLevel()!.querySelector(
            '[data-testid="column-visibility-menu"]',
          ),
        )
        .not.toBeNull()
      await audit(viewSettingsLevel()!)
      await closeSettings()
    }
    await all()
    await commands.forcedColors(true)
    options = AXE_OPTIONS
    try {
      await all()
    } finally {
      await commands.forcedColors(false)
    }
  })

  test('VW16: переход в раздел и назад — сдвигом, окно подстраивает размер; у первого уровня заголовок, у раздела — строка «назад» одним видом, без разделителя', async () => {
    await mount()
    api.setSorting([{ id: 'name', desc: false }])
    await openSettings()
    const wrap = () =>
      viewSettingsLevel()!.closest<HTMLElement>('[data-popup-levels]')!
    const title = viewSettingsLevel()!.querySelector<HTMLElement>(
      '[data-popup-level-title]',
    )!
    expect(title.textContent).toContain(tableLabels.viewSettings)
    const { fontSize, fontWeight } = getComputedStyle(title)
    const before = wrap().getBoundingClientRect()

    const motion = (element: Element) =>
      element
        .getAnimations()
        .map(animation => (animation as CSSAnimation).animationName ?? '')
        .join(' ')
    viewSettingsRow('sorting')!.click()
    await expect.poll(() => motion(viewSettingsLevel()!)).toMatch(/InFromEnd/)
    const leaving = wrap().querySelector('[data-popup-level-ghost], [class]')
    expect(leaving).not.toBeNull()
    expect([...wrap().querySelectorAll('*')].map(motion).join(' ')).toMatch(
      /OutToStart/,
    )
    await expect
      .poll(() => wrap().getBoundingClientRect().height)
      .not.toBe(before.height)

    const backFont = getComputedStyle(back())
    expect(backFont.fontSize).toBe(fontSize)
    expect(backFont.fontWeight).toBe(fontWeight)
    expect(Number(backFont.fontWeight)).toBeGreaterThanOrEqual(600)
    expect(backFont.borderBottomWidth).toBe('0px')
    expect(viewSettingsLevel()!.querySelector('[role="separator"], hr')).toBe(
      null,
    )

    back().click()
    await expect.poll(() => motion(viewSettingsLevel()!)).toMatch(/InFromStart/)
  })
})

// Тысяча уровней сортировки (ADR 0215, VW18): список уровней виртуализирован.
const WIDE_COLUMNS = Array.from({ length: 1000 }, (_, i) => ({
  id: `col_${i}`,
  accessorKey: `col_${i}`,
  header: `Column ${i}`,
}))
const WIDE_DATA = Array.from({ length: 5 }, (_, row) => ({
  id: String(row),
  ...Object.fromEntries(WIDE_COLUMNS.map(column => [column.id, row])),
}))
const WideGrid = () => {
  const table = useCreateTable({
    columns: WIDE_COLUMNS as never,
    data: WIDE_DATA,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      columnSorting({
        initialSorting: WIDE_COLUMNS.map(column => ({
          id: column.id,
          desc: false,
        })),
      }),
    ] as never,
  } as never)
  return (
    <div style={{ width: 800, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('«Настройки вида» — тысяча уровней (ADR 0215)', () => {
  test('VW18: уровни раздела виртуализированы — при 1000 уровнях в DOM не больше 30; прокрутка до конца показывает последний; снятие уровня в конце списка переводит фокус на соседний уровень', async () => {
    const screen = await render(<WideGrid />)
    try {
      await waitForGrid()
      await openSettingsSection('sorting')
      await expect.poll(() => levels().length).toBeGreaterThan(0)
      expect(levels().length).toBeLessThanOrEqual(30)
      // Фокус входа — на снятие первого уровня: уровни есть с первого кадра.
      await expect
        .poll(() => document.activeElement === removeOf(levels()[0]!))
        .toBe(true)

      const scroller = viewSettingsLevel()!.querySelector<HTMLElement>(
        '[data-popup-scroller]',
      )!
      for (let i = 0; i < 5; i++) {
        scroller.scrollTop = scroller.scrollHeight
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      const last = () =>
        levels().find(level => level.dataset.viewSettingsLevel === 'col_999')
      await expect.poll(last).toBeTruthy()
      expect(levels().length).toBeLessThanOrEqual(30)

      // Снятие последнего уровня — фокус на новый последний, 999-й по месту.
      removeOf(last()!).focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(last).toBeUndefined()
      await expect
        .poll(
          () =>
            document.activeElement?.closest<HTMLElement>(
              '[data-view-settings-level]',
            )?.dataset.viewSettingsLevel,
        )
        .toBe('col_998')
      await userEvent.keyboard('{Escape}')
    } finally {
      await screen.unmount()
    }
  })
})
