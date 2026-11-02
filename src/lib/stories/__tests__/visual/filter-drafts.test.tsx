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
import { Bubble } from '../../../ui/Bubble'
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

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Неприменённое условие фильтра в заголовке (ADR 0178, §3–§4; DR6, DR7, DR9, DR10, DR12):
// кольцо на кнопке фильтра, место в ряду, сводка фильтров, кольцо кита, доступность. DR11 —
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
const ringed = (button: HTMLElement) =>
  bubbleOf(button).getAttribute('data-shown') === 'true' &&
  bubbleOf(button).getAttribute('data-fill') === 'outline'
const solid = (button: HTMLElement) =>
  bubbleOf(button).getAttribute('data-shown') === 'true' &&
  !bubbleOf(button).hasAttribute('data-fill')
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
  test('DR6: кнопка фильтра с черновиком видна без наведения, на ней полая точка; при действующем фильтре — сплошная; тултип и имя кнопки из словаря говорят, что условие не применено', async () => {
    const screen = await mount()
    try {
      // Без черновика и фильтра кнопка спрятана до наведения.
      expect(visible(filterButton('name'))).toBe(false)

      api.setDraft(draftOn('name'))
      await expect.poll(() => visible(filterButton('name'))).toBe(true)
      const name = filterButton('name')!
      expect(ringed(name)).toBe(true)
      expect(name.hasAttribute('data-active')).toBe(false)
      const draftName = tableLabels.actionDraft(tableLabels.filter)
      expect(name.getAttribute('aria-label')).toBe(draftName)
      await userEvent.hover(name)
      await expect.poll(() => tooltipShown(draftName)).toBe(true)
      await away()

      // Действует фильтр и есть иной черновик: сплошная точка, имя — про оба.
      api.setColumnFilters([{ id: 'city', value: BOB }])
      api.setDraft(draftOn('city', { operator: 'contains', value: 'Rome' }))
      await expect.poll(() => solid(filterButton('city')!)).toBe(true)
      expect(filterButton('city')!.getAttribute('aria-label')).toBe(
        tableLabels.actionActiveDraft(tableLabels.filterActive),
      )
      // Действует без черновика: прежняя точка и имя.
      api.setColumnFilters([
        { id: 'age', value: { operator: 'equals', value: 21 } },
      ])
      await expect.poll(() => solid(filterButton('age')!)).toBe(true)
      expect(filterButton('age')!.getAttribute('aria-label')).toBe(
        tableLabels.filterActive,
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
      expect(ringed(filterButton('name')!)).toBe(true)
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
      await expect.poll(() => ringed(filterButton('city')!)).toBe(true)
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

  test('DR12: axe с color-contrast у кнопок с полой точкой в обеих темах и в ролях table, grid, treegrid', async () => {
    for (const role of [undefined, 'grid'] as const) {
      const screen = await mount(role)
      try {
        api.setDraft(draftOn('name'))
        await expect.poll(() => ringed(filterButton('name')!)).toBe(true)
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

describe('Полая точка кита (ADR 0178, §4)', () => {
  const Kit = () => (
    <div className={DATA_GRID_THEME_CLASS} style={{ padding: 16 }}>
      <IconButton label="Draft" draft data-testid="draft">
        <span aria-hidden>F</span>
      </IconButton>
      <IconButton label="Both" draft active data-testid="both">
        <span aria-hidden>F</span>
      </IconButton>
      <Bubble size="dot" tone="active" fill="outline" data-testid="bubble" />
    </div>
  )
  const byId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  /** Цвет кольца — из тени-обводки. */
  const ringColor = (bubble: HTMLElement) => {
    const match = /rgba?\([^)]+\)/.exec(getComputedStyle(bubble).boxShadow)
    return match ? toRgba(match[0]) : undefined
  }

  test("DR10: Bubble — fill: 'solid' или 'outline'; IconButton — draft: кольцо, кнопка видна без наведения, значок как у невключённой, с active главнее сплошная точка; кольцо на токенах кита, не ниже 3:1 к фону кнопки в обеих темах, видно в forced-colors", async () => {
    const screen = await render(<Kit />)
    try {
      const bubble = byId('bubble')
      expect(getComputedStyle(bubble).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(ringColor(bubble)).toBeDefined()
      // Толщина кольца — токен кита.
      const probe = document.createElement('span')
      probe.style.width = 'var(--tsr-comp-indicator-outline-width)'
      probe.style.display = 'block'
      bubble.parentElement!.append(probe)
      const width = getComputedStyle(probe).width
      probe.remove()
      expect(getComputedStyle(bubble).boxShadow).toContain(`${width} inset`)

      const draft = byId('draft')
      expect(draft.hasAttribute('data-active')).toBe(false)
      expect(draft.getAttribute('data-draft')).toBe('true')
      expect(bubbleOf(draft).getAttribute('data-fill')).toBe('outline')
      expect(bubbleOf(draft).getAttribute('data-shown')).toBe('true')
      const both = byId('both')
      expect(both.hasAttribute('data-active')).toBe(true)
      expect(bubbleOf(both).hasAttribute('data-fill')).toBe(false)

      await inBothThemes(async () => {
        const ring = bubbleOf(draft)
        const ratio = contrast(ringColor(ring)!, effectiveBg(draft))
        expect(ratio).toBeGreaterThanOrEqual(3)
      })

      if (server.browser === 'webkit') return
      await commands.forcedColors(true)
      await expect
        .poll(() => getComputedStyle(bubbleOf(draft)).borderTopStyle)
        .toBe('solid')
      const ring = bubbleOf(draft)
      expect(parseFloat(getComputedStyle(ring).borderTopWidth)).toBeGreaterThan(
        0,
      )
      expect(toRgba(getComputedStyle(ring).borderTopColor)).not.toEqual(
        toRgba(getComputedStyle(document.body).backgroundColor),
      )
    } finally {
      await screen.unmount()
    }
  })
})
