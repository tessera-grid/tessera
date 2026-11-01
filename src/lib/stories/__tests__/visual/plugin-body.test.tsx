/**
 * Канал вклада в тело для авторов плагинов (ADR 0173): тот же путь, что у встроенных
 * (BC2), клавиши (BC7) и события мыши (BC8) настоящими событиями, a11y историй (BC9).
 * BC1, BC3–BC5 — модульный `pluginBody.dom`, BC6 — перф в `scroll`.
 */
import axe from 'axe-core'
import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import type { PluginBodyEventTarget } from '../../../core/bodyContributions'
import { definePlugin } from '../../../core/definePlugin'
import { useCreateTable } from '../../../core/useCreateTable'
import { BodyCell } from '../../../grid/BodyCell'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellKey,
  changes,
  keyMarks,
  MARK_KEY,
} from '../../__mocks__/bodyPlugins'
import * as PluginApi from '../../DataGrid.PluginApi.stories'
import { composeStories } from '@storybook/react'
import { humanClick } from '../helpers'
import { describeWork, measureWork, renders } from '../work.helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

afterEach(() => document.documentElement.classList.remove('dark'))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i}`,
}))

let setChanged: (next: string[]) => void = () => {}

const Grid = ({
  plugins = [],
  navigation = false,
}: {
  plugins?: unknown[]
  navigation?: boolean
}) => {
  const [changed, set] = useState<string[]>([])
  setChanged = set
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    enableKeyboardNavigation: navigation,
    plugins: [changes({ changed }), ...plugins] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const cellOf = (rowId: string, columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )!

describe('Канал вклада в тело для авторов (ADR 0173)', () => {
  test('BC2: вклад автора идёт тем же путём, что встроенных: одна подписка на ячейку, перерисовываются только ячейки, чей выбор изменился, — по счётчикам работы; события — делегированием от корня', async () => {
    const seen: { target: PluginBodyEventTarget; currentTarget: unknown }[] = []
    const watcher = definePlugin<{ enabled?: boolean }>()({
      id: 'watcher',
      body: () => ({
        root: {
          events: {
            dblclick: (event, target) =>
              seen.push({ target, currentTarget: event.currentTarget }),
          },
        },
      }),
    })
    await render(<Grid plugins={[watcher()]} />)
    await waitForGrid()
    const grid = document.querySelector<HTMLElement>('.data-grid__container')!

    // Выбор изменился у одной ячейки — перерисована только она.
    const work = await measureWork(grid, () =>
      setChanged([cellKey('r2', 'city')]),
    )
    expect(renders(work, BodyCell), describeWork(work)).toBe(1)
    expect(cellOf('r2', 'city').hasAttribute('data-changes-cell')).toBe(true)

    // Вторая ячейка: прежняя отмечена и не перерисована.
    const next = await measureWork(grid, () =>
      setChanged([cellKey('r2', 'city'), cellKey('r5', 'name')]),
    )
    expect(renders(next, BodyCell), describeWork(next)).toBe(1)

    // Событие приходит через корень: обработчика у ячейки нет.
    await userEvent.dblClick(cellOf('r3', 'name'))
    await expect.poll(() => seen.length).toBe(1)
    expect(seen[0]!.target.cellElement).toBe(cellOf('r3', 'name'))
    expect(seen[0]!.target.row?.id).toBe('r3')
    expect(seen[0]!.currentTarget).not.toBe(cellOf('r3', 'name'))
    expect(seen[0]!.target.cell?.column.id).toBe('name')
  })

  test('BC7: настоящими нажатиями: onKey автора получает клавишу до хода активной ячейки, true — клавиша взята и ячейка не двигается; onActiveCellChange получает новую ячейку', async () => {
    const moves: { rowIndex: number; columnIndex: number }[] = []
    await render(
      <Grid
        navigation
        plugins={[keyMarks({ onActiveCell: next => moves.push(next) })]}
      />,
    )
    await waitForGrid()
    const active = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-cell[data-kn-active]',
      )
    await humanClick(cellOf('r1', 'name'))
    await expect.poll(() => active()).toBe(cellOf('r1', 'name'))

    // Клавиша плагина: взята, ячейка на месте и отмечена.
    await userEvent.keyboard(MARK_KEY)
    await expect
      .poll(() => cellOf('r1', 'name').hasAttribute('data-keymarks-cell'))
      .toBe(true)
    expect(active()).toBe(cellOf('r1', 'name'))

    // Стрелка плагину не нужна: ячейка уходит вниз, плагин узнаёт новую.
    moves.length = 0
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => active()).toBe(cellOf('r2', 'name'))
    expect(moves.at(-1)).toEqual({ rowIndex: 2, columnIndex: 0 })
    expect(cellOf('r2', 'name').hasAttribute('data-keymarks-cell')).toBe(false)
  })

  test('BC8: настоящей мышью: обработчик события автора над телом получает событие и ячейку под указателем', async () => {
    const seen: { type: string; row?: string; column?: string }[] = []
    const record = (event: MouseEvent, target: PluginBodyEventTarget) =>
      seen.push({
        type: event.type,
        row: target.row?.id,
        column: target.cell?.column.id,
      })
    const mouse = definePlugin<{ enabled?: boolean }>()({
      id: 'mouse',
      body: () => ({
        root: {
          events: { click: record, dblclick: record, contextmenu: record },
        },
      }),
    })
    await render(<Grid plugins={[mouse()]} />)
    await waitForGrid()
    await userEvent.dblClick(cellOf('r4', 'city'))
    await expect
      .poll(() => seen.filter(item => item.type === 'dblclick'))
      .toEqual([{ type: 'dblclick', row: 'r4', column: 'city' }])
    expect(seen.some(item => item.type === 'click' && item.row === 'r4')).toBe(
      true,
    )
    await userEvent.click(cellOf('r6', 'name'), { button: 'right' })
    await expect
      .poll(() => seen.filter(item => item.type === 'contextmenu'))
      .toEqual([{ type: 'contextmenu', row: 'r6', column: 'name' }])
  })

  test('BC9: истории сценариев проходят axe с color-contrast в обеих темах; атрибуты aria-* автора не меняют роли грида', async () => {
    const stories = composeStories(PluginApi)
    for (const Story of [
      stories.PluginApiBodyAttributes,
      stories.PluginApiBodyEvents,
      stories.PluginApiBodyKeys,
    ]) {
      const screen = await render(<Story />)
      await waitForGrid()
      await inBothThemes(async () => {
        const result = await axe.run(
          document.querySelector<HTMLElement>('.data-grid__container')!
            .parentElement!,
          AXE_OPTIONS,
        )
        expect(result.violations, Story.storyName).toEqual([])
      })
      await screen.unmount()
    }

    // Автор пишет aria-* в корень и ячейки — роли грида и таблицы прежние.
    const aria = definePlugin<{ enabled?: boolean }>()({
      id: 'aria',
      body: () => ({
        cell: {
          select: () => true,
          render: () => ({
            attrs: { 'aria-description': 'checked', role: 'presentation' },
          }),
        },
        root: {
          attrs: () => ({
            'aria-roledescription': 'sheet',
            'aria-rowcount': 1,
            role: 'presentation',
          }),
        },
      }),
    })
    await render(<Grid navigation plugins={[aria()]} />)
    await waitForGrid()
    const table = document.querySelector('[role="grid"]')!
    expect(table).not.toBeNull()
    expect(table.getAttribute('aria-roledescription')).toBe('sheet')
    expect(table.getAttribute('aria-rowcount')).not.toBe('1')
    expect(cellOf('r0', 'name').getAttribute('role')).toBe('gridcell')
    expect(cellOf('r0', 'name').getAttribute('aria-description')).toBe(
      'checked',
    )
  })
})
