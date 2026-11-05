import axe from 'axe-core'
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { server as browser, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { DebugAction } from '../../../core/debugActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  rowDragging,
  type RowDragEnd,
  rowExpanding,
  rowGrouping,
} from '../../../plugins'
import { humanClick, settleRowMotion } from '../helpers'
import { tableLabels } from '../labels'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'
import { AXE_OPTIONS } from './a11y-helpers'
import {
  container,
  depthOf,
  dragOver,
  HANDLE,
  nextFrame,
  pointer,
  release,
  rowById,
  settleSlotAfter,
  sleep,
} from './row-drop-helpers'

// Перенос между клиентскими группами (ADR 0186): GM2, GM4–GM9. GM1, GM3 — модульный
// clientGroupMove.dom, GM10 — перф в interaction.

interface Item {
  id: string
  country: string
  name: string
}

const ITEMS: Item[] = [
  { id: 'a', country: 'US', name: 'Alice' },
  { id: 'b', country: 'US', name: 'Bob' },
  { id: 'c', country: 'DE', name: 'Carl' },
  { id: 'd', country: 'DE', name: 'Dora' },
]
const COLUMNS = [
  { id: 'country', accessorKey: 'country', header: 'Country' },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]
const US = 'country:US'
const DE = 'country:DE'

const Grid = ({
  onRowDragEnd,
  expanded = true,
  colorMode,
  onDebugAction,
}: {
  onRowDragEnd: (
    end: RowDragEnd,
    write: (change: (rows: Item[]) => Item[]) => void,
  ) => void | PromiseLike<unknown>
  expanded?: boolean
  colorMode?: 'light' | 'dark'
  onDebugAction?: (action: DebugAction) => void
}) => {
  const [data, setData] = useState(ITEMS)
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    onDebugAction: onDebugAction as never,
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: [
      rowExpanding({ initialExpanded: expanded ? true : {} }),
      rowGrouping({ initialGrouping: ['country'] }),
      rowDragging({
        onRowDragEnd: (end: RowDragEnd) => onRowDragEnd(end, setData),
      }),
    ] as never,
  })
  return (
    <div style={{ width: 720, height: 460 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

const moved = (country: string, id: string) => (rows: Item[]) =>
  rows.map(row => (row.id === id ? { ...row, country } : row))
const flashOf = (id: string) => rowById(id)?.getAttribute('data-flash')
const invalid = () => container().hasAttribute('data-row-drop-invalid')
const handleOf = (id: string) => rowById(id)!.querySelector<HTMLElement>(HANDLE)
const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const menuItem = (id: string) =>
  document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
const openMenu = async (id: string) => {
  await userEvent.hover(rowById(id)!)
  await humanClick(handleOf(id)!)
  await expect.poll(() => menuItem('moveToGroup')).not.toBeNull()
}

describe('перенос между клиентскими группами (ADR 0186)', () => {
  test('GM2: бросок в другую группу того же уровня: onRowDragEnd получает родителей, место и значения групп; у строк-групп ручки нет', async () => {
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid
        onRowDragEnd={(end, write) => {
          ends.push(end)
          write(moved('DE', end.rowId))
        }}
      />,
    )
    await expect.poll(() => rowById('a')).not.toBeNull()
    await userEvent.hover(rowById(DE)!)
    await nextFrame()
    expect(rowById(DE)!.querySelector(HANDLE)).toBeNull()

    const { at } = await dragOver('a', DE, 1)
    await settleSlotAfter(DE, at)
    await release()
    expect(ends.at(-1)).toEqual(
      expect.objectContaining({
        rowId: 'a',
        parentId: DE,
        previousParentId: US,
        index: 0,
        groupValues: { country: 'DE' },
        previousGroupValues: { country: 'US' },
      }),
    )
    await expect.poll(() => depthOf(rowById('a')!)).toBe(1)
    await screen.unmount()
  })

  test('GM4: отказ — строка едет обратно, вспышка danger, объявление', async () => {
    const answer = deferred()
    const screen = await render(<Grid onRowDragEnd={() => answer.promise} />)
    await expect.poll(() => rowById('a')).not.toBeNull()
    const { at } = await dragOver('a', DE, 1)
    await settleSlotAfter(DE, at)
    await release()
    const order = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].sort(
        (x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top,
      )
    // Ждёт в новой группе.
    await expect
      .poll(() => order().findIndex(row => row.dataset.rowId === 'a'))
      .toBeGreaterThan(order().findIndex(row => row.dataset.rowId === DE))
    // Ячейка колонки группировки показывает новую группу и возвращается вместе со строкой.
    const country = () =>
      rowById('a')!.querySelector('[data-column-id="country"]')!.textContent
    await expect.poll(country).toContain('DE')
    answer.reject(new Error('Refused'))
    await expect.poll(() => flashOf('a')).toBe('reverted')
    await settleRowMotion()
    await expect.poll(country).toContain('US')
    expect(order().findIndex(row => row.dataset.rowId === 'a')).toBeLessThan(
      order().findIndex(row => row.dataset.rowId === DE),
    )
    await expect
      .poll(
        () =>
          document.querySelector('[role="status"][aria-live]')?.textContent ??
          '',
      )
      .toContain('Refused')
    await screen.unmount()
  })

  test('GM5: место внутри своей группы недопустимо, облако в тоне ошибки, бросок отменяется', async () => {
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid onRowDragEnd={end => void ends.push(end)} />,
    )
    await expect.poll(() => rowById('a')).not.toBeNull()
    await dragOver('a', 'b', 1)
    await expect.poll(invalid).toBe(true)
    await pointer.realMouseUp()
    await settleRowMotion()
    expect(ends).toEqual([])
    await screen.unmount()
  })

  test('GM6: свёрнутая группа раскрывается паузой, бросок в неё доступен', async () => {
    const ends: RowDragEnd[] = []
    const Hold = () => (
      <Grid
        expanded={false}
        onRowDragEnd={(end, write) => {
          ends.push(end)
          write(moved('DE', end.rowId))
        }}
      />
    )
    const screen = await render(<Hold />)
    await expect.poll(() => rowById(US)).not.toBeNull()
    rowById(US)!.querySelector<HTMLElement>('.row-expand-button')!.click()
    await expect.poll(() => rowById('a')).not.toBeNull()
    await settleRowMotion()
    expect(rowById('c')).toBeNull()

    const { at } = await dragOver('a', DE, 1)
    const under = await settleSlotAfter(DE, at)
    await sleep(900)
    await expect.poll(() => rowById('c')).not.toBeNull()
    await settleSlotAfter(DE, under)
    await release()
    expect(ends.at(-1)).toMatchObject({ rowId: 'a', parentId: DE })
    await screen.unmount()
  })

  test('GM7: меню ручки — раздел со списком групп того же уровня, перенос выбором пункта мышью и клавиатурой; «вверх» и «вниз» нет', async () => {
    const ends: RowDragEnd[] = []
    const screen = await render(
      <Grid
        onRowDragEnd={(end, write) => {
          ends.push(end)
          write(moved(String(end.groupValues!.country), end.rowId))
        }}
      />,
    )
    await expect.poll(() => rowById('a')).not.toBeNull()

    await openMenu('a')
    expect(menuItem('moveUp')).toBeNull()
    expect(menuItem('moveDown')).toBeNull()
    expect(menuItem('moveToGroup')!.textContent).toContain(
      rowDraggingLabels(tableLabels).moveToGroup,
    )
    await humanClick(menuItem('moveToGroup')!)
    await expect.poll(() => menuItem(DE)).not.toBeNull()
    expect(menuItem(US)).toBeNull()
    await humanClick(menuItem(DE)!)
    await expect.poll(() => ends.length).toBe(1)
    expect(ends[0]).toMatchObject({ rowId: 'a', parentId: DE })

    // Клавиатура: стрелка входит в раздел и выходит из него, Enter выбирает.
    await openMenu('b')
    await expect.poll(() => menuItem('moveToGroup')).not.toBeNull()
    menuItem('moveToGroup')!.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => menuItem(DE)).not.toBeNull()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(() => menuItem('moveToGroup')).not.toBeNull()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => document.activeElement === menuItem(DE)).toBe(true)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => ends.length).toBe(2)
    expect(ends[1]).toMatchObject({ rowId: 'b', parentId: DE })
    await screen.unmount()
  })

  test('GM8: канал действий — бросок и итог промиса', async () => {
    const actions: DebugAction[] = []
    const answer = deferred()
    const screen = await render(
      <Grid
        onDebugAction={action => actions.push(action)}
        onRowDragEnd={() => answer.promise}
      />,
    )
    await expect.poll(() => rowById('a')).not.toBeNull()
    const { at } = await dragOver('a', DE, 1)
    await settleSlotAfter(DE, at)
    await release()
    expect(actions).toContainEqual(
      expect.objectContaining({
        plugin: 'rowDragging',
        action: 'drop',
        detail: { rowId: 'a', parentId: DE },
        source: 'pointer',
      }),
    )
    answer.reject(new Error('Refused'))
    await expect
      .poll(() =>
        actions.some(
          action =>
            action.action.startsWith('commitMove') && action.source === 'auto',
        ),
      )
      .toBe(true)
    await screen.unmount()
  })

  test('GM9: axe с color-contrast в обеих темах и forced-colors при ожидании на ручке и в разделе меню', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const answer = deferred()
    for (const colorMode of ['light', 'dark'] as const) {
      const screen = await render(
        <Grid colorMode={colorMode} onRowDragEnd={() => answer.promise} />,
      )
      await expect.poll(() => rowById('a')).not.toBeNull()
      await openMenu('a')
      await humanClick(menuItem('moveToGroup')!)
      await expect.poll(() => menuItem(DE)).not.toBeNull()
      expect(
        (await axe.run(document.querySelector('[role="menu"]')!, options))
          .violations,
      ).toEqual([])
      await humanClick(menuItem(DE)!)
      await settleRowMotion()
      expect(
        (await axe.run(document.querySelector('.data-grid-theme')!, options))
          .violations,
      ).toEqual([])
      if (colorMode === 'light' && browser.browser !== 'webkit') {
        await pointer.forcedColors(true)
        try {
          expect(
            (
              await axe.run(
                document.querySelector('.data-grid-theme')!,
                options,
              )
            ).violations,
          ).toEqual([])
        } finally {
          await pointer.forcedColors(false)
        }
      }
      await screen.unmount()
    }
  })
})
