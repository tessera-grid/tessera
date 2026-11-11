import { render } from 'vitest-browser-react'
import { useState, type ComponentProps } from 'react'
import type { RowSelectionValue } from '../../../core/rowSelectionAll'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { ActionsZone } from '../../../grid/headerActions/ActionsZone'
import { StatusBar } from '../../../grid/StatusBar/StatusBar'
import { Toolbar } from '../../../grid/Toolbar/Toolbar'
import {
  columnSorting,
  columnVisibility,
  quickSearch,
  rowSelection,
} from '../../../plugins'
import { ViewSettingsButton } from '../../../grid/ViewSettings/ViewSettingsButton'
import { SearchField } from '../../../plugins/quickSearch/SearchField'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'
import { makeColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { describeWork, measureWork, renders } from '../work.helpers'

// Перерисовка приложения не доходит до грида (ADR 0196; HR3–HR7): выбор у приложения виден в
// том же кадре, перерисовка приложения и клик выбора не будят тулбар, поиск, «Колонки», кнопки
// шапки, пропы и входы отрисовки доходят до грида.

const COLUMNS = makeColumns(5)
const ROWS = getData(40)
const ROW_5 = (ROWS[5] as { id: string }).id

type GridProps = Omit<ComponentProps<typeof DataGrid>, 'table'>

interface AppProps {
  controlled?: boolean
  grid?: GridProps
  data?: unknown[]
  columns?: unknown[]
  /** Выбор, который приложение кладёт в свой срез вместо пришедшего. */
  onSelection?: (next: RowSelectionValue) => RowSelectionValue
}

let rerenderApp = () => {}

const App = ({
  controlled = false,
  grid,
  data = ROWS,
  columns = COLUMNS,
  onSelection,
}: AppProps) => {
  const [selection, setSelection] = useState<RowSelectionValue>({})
  const [, setTick] = useState(0)
  rerenderApp = () => setTick(tick => tick + 1)
  const table = useCreateTable({
    columns: columns as never,
    data: data as never,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      rowSelection(
        controlled
          ? {
              selectedCount: true,
              rowSelection: selection,
              onRowSelectionChange: next => {
                setSelection(onSelection ? onSelection(next) : next)
              },
            }
          : { selectedCount: true },
      ),
      quickSearch(),
      columnVisibility(),
      columnSorting(),
    ],
  })
  return (
    <div style={{ width: 900, height: 520 }}>
      <DataGrid table={table as never} height={480} {...grid} />
    </div>
  )
}

const container = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const checkbox = (index: number) =>
  document.querySelectorAll<HTMLElement>(
    '.data-grid__body-row [role="checkbox"]',
  )[index]!
const SEARCH = '[data-testid="data-grid-toolbar"] input[type="search"]'
const mounted = async () => {
  await expect.poll(() => checkbox(2) ?? null).not.toBeNull()
  await expect.poll(() => document.querySelector(SEARCH)).not.toBeNull()
}

/** Тулбар, поле поиска, «Настройки вида» и зоны кнопок шапки. */
const PANEL = [Toolbar, SearchField, ViewSettingsButton, ActionsZone]

describe('Перерисовка приложения не доходит до грида (ADR 0196)', () => {
  test('HR3: выбор строки, который держит приложение, показан в гриде в том же кадре, что и перерисовка приложения', async () => {
    let seen: string | null = null
    const screen = await render(
      <App
        controlled
        onSelection={next => {
          // Строку 5 выбирает только приложение: её флажок — значение приложения, не таблицы.
          requestAnimationFrame(() => {
            seen = checkbox(5).getAttribute('aria-checked')
          })
          return { ...(next as object), [ROW_5]: true }
        }}
      />,
    )
    try {
      await mounted()
      await humanClick(checkbox(2))
      await expect.poll(() => seen).not.toBeNull()
      expect(seen).toBe('true')
    } finally {
      await screen.unmount()
    }
  })

  test('HR4: перерисовка приложения с теми же входами не перерисовывает DataGrid, тулбар, поле поиска, «Колонки», зоны кнопок шапки и нижнюю панель', async () => {
    const screen = await render(<App />)
    try {
      await mounted()
      const work = await measureWork(container(), () => {
        rerenderApp()
        rerenderApp()
      })
      expect(work.commits, describeWork(work)).toBeGreaterThan(0)
      expect(
        renders(work, DataGrid, ...PANEL, StatusBar),
        describeWork(work),
      ).toBe(0)
    } finally {
      await screen.unmount()
    }
  })

  for (const controlled of [false, true]) {
    test(`HR5: клик выбора строки (${controlled ? 'выбор у приложения' : 'выбор у таблицы'}) не перерисовывает тулбар, поле поиска, «Колонки» и зоны кнопок шапки; в нижней панели — только счётчик выбранных`, async () => {
      const screen = await render(<App controlled={controlled} />)
      try {
        await mounted()
        // Первый выбор показывает нижнюю панель со счётчиком — смена раскладки; мерим следующий.
        await humanClick(checkbox(1))
        await expect
          .poll(() => checkbox(1).getAttribute('aria-checked'))
          .toBe('true')
        const work = await measureWork(container(), () =>
          humanClick(checkbox(2)),
        )
        await expect
          .poll(() => checkbox(2).getAttribute('aria-checked'))
          .toBe('true')
        expect(
          renders(work, DataGrid, ...PANEL, StatusBar),
          describeWork(work),
        ).toBe(0)
        expect(
          document.querySelector('[data-testid="selected-rows-count"]')
            ?.textContent,
        ).toBe(rowSelectionLabels(tableLabels).selectedRows(2))
      } finally {
        await screen.unmount()
      }
    })
  }

  test('HR6: смена пропов height, localization, icons и colorMode у DataGrid перерисовывает грид с новым значением', async () => {
    const CustomSort = () => <svg data-testid="custom-sort" />
    const screen = await render(<App grid={{ height: 300 }} />)
    try {
      await mounted()
      const low = container().getBoundingClientRect().height

      await screen.rerender(<App grid={{ height: 420 }} />)
      await expect
        .poll(() => container().getBoundingClientRect().height)
        .toBe(low + 120)

      const grid: GridProps = { height: 420 }
      grid.localization = { 'quickSearch.search': 'Find rows' }
      await screen.rerender(<App grid={{ ...grid }} />)
      await expect
        .poll(() => document.querySelector(SEARCH)?.getAttribute('placeholder'))
        .toBe('Find rows')

      grid.icons = { sort: CustomSort }
      await screen.rerender(<App grid={{ ...grid }} />)
      await expect
        .poll(() => document.querySelector('[data-testid="custom-sort"]'))
        .not.toBeNull()

      grid.colorMode = 'light'
      await screen.rerender(<App grid={{ ...grid }} />)
      await expect
        .poll(() =>
          document
            .querySelector('[data-tsr-color-mode]')
            ?.getAttribute('data-tsr-color-mode'),
        )
        .toBe('light')
    } finally {
      await screen.unmount()
    }
  })

  test('HR7: новые data и columns от приложения доходят до грида в том же коммите', async () => {
    const screen = await render(<App />)
    try {
      await mounted()
      const renamed = ROWS.map((row, index) =>
        index === 0
          ? { ...(row as object), firstName: 'Renamed first row' }
          : row,
      )
      await screen.rerender(<App data={renamed} />)
      expect(container().textContent).toContain('Renamed first row')

      const headers = () =>
        container().querySelectorAll('[role="columnheader"]').length
      const before = headers()
      await screen.rerender(
        <App data={renamed} columns={COLUMNS.slice(0, 2)} />,
      )
      // Колонка флажков и две колонки данных.
      expect(headers()).toBe(3)
      expect(before).toBeGreaterThan(3)
    } finally {
      await screen.unmount()
    }
  })
})
