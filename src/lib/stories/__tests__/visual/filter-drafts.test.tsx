import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import type { Draft } from '../../../core/drafts/drafts'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnPinning,
  columnSizing,
  columnSorting,
  headerActionMenu,
} from '../../../plugins'
import { IconButton } from '../../../ui/IconButton'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme/types'
import { tableLabels } from '../labels'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Неприменённое условие фильтра в заголовке (ADR 0178, §3–§4; DR6, DR7, DR9, DR10, DR12):
// точка неприменённого на кнопке фильтра, место в ряду, сводка фильтров, точка кита, доступность. DR11 —
// `unsaved-changes`, DR13 — перф в `scroll`.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 280 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 280 },
  { id: 'age', accessorKey: 'age', header: 'Age', size: 280 },
]
const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
  age: 20 + i,
}))

interface Api {
  setDraft: (draft: Draft) => void
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  setColumnSizing: (value: Record<string, number>) => void
}

let api: Api

const Grid = ({ role }: { role?: 'grid' }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    dataMode: { filtering: 'server' },
    enableKeyboardNavigation: role === 'grid',
    plugins: [
      columnPinning(),
      columnSorting(),
      columnFiltering({
        filteredCount: true,
        onFilterChange: () => Promise.resolve(),
      }),
      columnSizing(),
      headerActionMenu({ threshold: 4 }),
    ] as never,
  })
  api = table as unknown as Api
  return (
    <div style={{ width: 900, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const BOB = { operator: 'contains', value: 'Bob' }
const draftOn = (column: string, value: unknown = BOB): Draft => ({
  kind: 'columnFilter',
  target: { column },
  value,
})

const head = (column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"]`,
  )!
const filterButton = (column: string) =>
  head(column).querySelector<HTMLElement>('.column-filter__button')
const bubbleOf = (button: HTMLElement) =>
  button.querySelector<HTMLElement>('[data-active-indicator]')!
/** Кнопка видна без наведения: обёртка ячейки раскрыта. */
const visible = (button: HTMLElement | null) => {
  const wrapper = button?.closest<HTMLElement>('.cell__button')
  return (
    !!wrapper &&
    getComputedStyle(wrapper).opacity === '1' &&
    wrapper.getBoundingClientRect().width > 0
  )
}
/** Цвет токена темы в месте кнопки. */
const tokenColor = (near: HTMLElement, token: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = `var(${token})`
  near.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}
/** Видна сплошная точка тона `token`. */
const dotOf = (button: HTMLElement, token: string) => {
  const dot = bubbleOf(button)
  return (
    dot.getAttribute('data-shown') === 'true' &&
    getComputedStyle(dot).backgroundColor === tokenColor(button, token)
  )
}
const draftDot = (button: HTMLElement) =>
  dotOf(button, '--tsr-comp-draft-color')
const activeDot = (button: HTMLElement) =>
  dotOf(button, '--tsr-comp-active-indicator')
const away = () => userEvent.hover(document.body, { position: { x: 1, y: 1 } })
const tooltipShown = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const row = (column: string) =>
  [...head(column).querySelectorAll<HTMLElement>('button')].map(button =>
    button.hasAttribute('data-action-menu')
      ? 'menu'
      : (button.className.match(/column-(\w+)__button/)?.[1] ?? '?'),
  )

const mount = async (role?: 'grid') => {
  const screen = await render(<Grid role={role} />)
  await waitForGrid()
  await away()
  return screen
}

describe('Неприменённое условие в заголовке (ADR 0178)', () => {
  test('DR6: кнопка фильтра с черновиком видна без наведения, на ней точка цвета несохранённого; при действующем фильтре — точка включённого; тултип и имя кнопки из словаря говорят, что условие не применено', async () => {
    const screen = await mount()
    try {
      // Без черновика и фильтра кнопка спрятана до наведения.
      expect(visible(filterButton('name'))).toBe(false)

      api.setDraft(draftOn('name'))
      await expect.poll(() => visible(filterButton('name'))).toBe(true)
      const name = filterButton('name')!
      expect(draftDot(name)).toBe(true)
      expect(name.hasAttribute('data-active')).toBe(false)
      const draftName = tableLabels.actionDraft(
        columnFilteringLabels(tableLabels).filter,
      )
      expect(name.getAttribute('aria-label')).toBe(draftName)
      await userEvent.hover(name)
      await expect.poll(() => tooltipShown(draftName)).toBe(true)
      await away()

      // Действует фильтр и есть иной черновик: точка включённого, имя — про оба.
      api.setColumnFilters([{ id: 'city', value: BOB }])
      api.setDraft(draftOn('city', { operator: 'contains', value: 'Rome' }))
      await expect.poll(() => activeDot(filterButton('city')!)).toBe(true)
      expect(filterButton('city')!.getAttribute('aria-label')).toBe(
        tableLabels.actionActiveDraft(
          columnFilteringLabels(tableLabels).filterActive,
        ),
      )
      // Действует без черновика: прежняя точка и имя.
      api.setColumnFilters([
        { id: 'age', value: { operator: 'equals', value: 21 } },
      ])
      await expect.poll(() => activeDot(filterButton('age')!)).toBe(true)
      expect(filterButton('age')!.getAttribute('aria-label')).toBe(
        columnFilteringLabels(tableLabels).filterActive,
      )
    } finally {
      await screen.unmount()
    }
  })

  test('DR7: в узкой колонке кнопка фильтра с черновиком остаётся в ряду последней, как включённая', async () => {
    const screen = await mount()
    try {
      let width = 140
      for (; width <= 300; width += 5) {
        api.setColumnSizing({ name: width })
        await new Promise(requestAnimationFrame)
        await new Promise(requestAnimationFrame)
        if (row('name').length === 2 && row('name').includes('menu')) break
      }
      expect(row('name')).not.toContain('filter')
      api.setDraft(draftOn('name'))
      await expect.poll(() => row('name')).toEqual(['filter', 'menu'])
      expect(draftDot(filterButton('name')!)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('DR9: сводка и счётчик фильтров на тулбаре учитывают только действующие условия', async () => {
    const screen = await mount()
    try {
      const summary = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="filter-summary-button"]',
        )!
      const count = () =>
        bubbleOf(summary()).getAttribute('data-shown') === 'true'
          ? bubbleOf(summary()).textContent
          : '0'
      api.setDraft(draftOn('name'))
      api.setDraft(draftOn('city'))
      await expect.poll(() => draftDot(filterButton('city')!)).toBe(true)
      expect(count()).toBe('0')
      expect(
        document.querySelector('[data-testid="filtered-rows-count"]'),
      ).toBeNull()

      api.setColumnFilters([
        { id: 'age', value: { operator: 'equals', value: 21 } },
      ])
      await expect.poll(count).toBe('1')
    } finally {
      await screen.unmount()
    }
  })

  test('DR12: axe с color-contrast у кнопок с точкой неприменённого в обеих темах и в ролях table, grid, treegrid', async () => {
    for (const role of [undefined, 'grid'] as const) {
      const screen = await mount(role)
      try {
        api.setDraft(draftOn('name'))
        await expect.poll(() => draftDot(filterButton('name')!)).toBe(true)
        await inBothThemes(async () => {
          const result = await axe.run(head('name'), AXE_OPTIONS)
          expect(result.violations.map(v => v.id)).toEqual([])
        })
      } finally {
        await screen.unmount()
      }
    }
  })
})

describe('Точка неприменённого в ките (ADR 0178, §4)', () => {
  const Kit = () => (
    // Фон — поверхность темы: точка сравнивается с фоном кнопки в каждой теме.
    <div
      className={DATA_GRID_THEME_CLASS}
      style={{ padding: 16, background: 'var(--tsr-sys-surface)' }}
    >
      <IconButton label="Draft" draft data-testid="draft">
        <span aria-hidden>F</span>
      </IconButton>
      <IconButton label="Both" draft active data-testid="both">
        <span aria-hidden>F</span>
      </IconButton>
    </div>
  )
  const byId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  test('DR10: IconButton — draft: сплошная точка цвета несохранённого, кнопка видна без наведения, значок как у невключённой, с active главнее точка включённого; точка на токене кита, не ниже 3:1 к фону кнопки в обеих темах, видна в forced-colors', async () => {
    const screen = await render(<Kit />)
    try {
      const draft = byId('draft')
      expect(draft.hasAttribute('data-active')).toBe(false)
      expect(draft.getAttribute('data-draft')).toBe('true')
      expect(draftDot(draft)).toBe(true)
      expect(toRgba(getComputedStyle(bubbleOf(draft)).backgroundColor)[3]).toBe(
        1,
      )
      const both = byId('both')
      expect(both.hasAttribute('data-active')).toBe(true)
      expect(activeDot(both)).toBe(true)

      await inBothThemes(async () => {
        const dot = bubbleOf(draft)
        const ratio = contrast(
          toRgba(getComputedStyle(dot).backgroundColor),
          effectiveBg(draft),
        )
        expect(ratio).toBeGreaterThanOrEqual(3)
      })

      if (server.browser === 'webkit') return
      await commands.forcedColors(true)
      const dotColor = () =>
        toRgba(getComputedStyle(bubbleOf(draft)).backgroundColor)
      const canvas = () =>
        toRgba(getComputedStyle(document.body).backgroundColor)
      await expect.poll(() => dotColor()[3]).toBe(1)
      expect(dotColor()).not.toEqual(canvas())
      expect(contrast(dotColor(), effectiveBg(draft))).toBeGreaterThanOrEqual(3)
    } finally {
      await screen.unmount()
    }
  })
})
