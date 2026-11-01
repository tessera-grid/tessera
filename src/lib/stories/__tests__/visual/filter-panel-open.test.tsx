import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, headerActionMenu } from '../../../plugins'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Первое открытие фильтра колонки (ADR 0045, FL38–FL39): поповер появляется уже с
// панелью, без пустого кадра и заглушки загрузки. Отдельный файл: ленивые модули
// панели грузятся один раз на документ — FL38 первым открывает панель и календарь,
// FL39 первым открывает чек-лист вариантов.

const DATA = [
  { id: '1', name: 'Alice', created: '2026-03-15', status: 'lead' },
  { id: '2', name: 'Bob', created: '2026-04-01', status: 'won' },
]

const Grid = ({ withMenu }: { withMenu: boolean }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      {
        id: 'created',
        accessorKey: 'created',
        header: 'Created',
        dataType: 'dateString',
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        dataType: 'select',
      },
    ] as never,
    data: DATA,
    plugins: [
      columnFiltering(),
      ...(withMenu ? [headerActionMenu({ mode: 'always' })] : []),
    ],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const headCell = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!

/** Следит за поповерами фильтра: каждый, что появился в DOM, — уже с панелью. */
const watchFilterPopups = () => {
  const flat: string[] = []
  const check = () => {
    for (const popup of document.querySelectorAll<HTMLElement>(
      '[data-action-panel="columnFiltering"]',
    )) {
      if (
        !popup.querySelector('[data-testid="filter-panel"]') ||
        popup.querySelector('[aria-busy="true"]')
      ) {
        flat.push(popup.innerHTML)
      }
    }
  }
  const observer = new MutationObserver(check)
  observer.observe(document.body, { childList: true, subtree: true })
  return {
    flat,
    stop: () => observer.disconnect(),
  }
}

const panel = () =>
  document.querySelector(
    '[data-action-panel="columnFiltering"] [data-testid="filter-panel"]',
  )

let stopWatch: (() => void) | undefined
afterEach(() => stopWatch?.())

describe('Фильтр колонки — первое открытие', () => {
  test('FL38: первое открытие фильтра инлайн-кнопкой показывает поповер сразу с панелью: ни пустого поповера, ни заглушки загрузки', async () => {
    await render(<Grid withMenu={false} />)
    await waitForGrid()
    const watch = watchFilterPopups()
    stopWatch = watch.stop

    await userEvent.hover(headCell('created'))
    await humanClick(
      headCell('created').querySelector('.column-filter__button')!,
    )
    await expect.poll(panel).not.toBeNull()
    await expect
      .poll(() => document.querySelector('[data-testid="filter-calendar"]'))
      .not.toBeNull()

    expect(watch.flat).toEqual([])
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
  })

  test('FL39: первое открытие фильтра пунктом кебаба показывает поповер сразу с панелью: ни пустого поповера, ни заглушки загрузки', async () => {
    await render(<Grid withMenu />)
    await waitForGrid()
    const watch = watchFilterPopups()
    stopWatch = watch.stop

    await userEvent.hover(headCell('status'))
    await humanClick(
      headCell('status').querySelector(
        `[aria-label="${tableLabels.headerMenu}"]`,
      )!,
    )
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        el => el.textContent?.trim() === tableLabels.filter,
      )
    await expect.poll(item).toBeTruthy()
    await humanClick(item()!)
    await expect.poll(panel).not.toBeNull()
    await expect
      .poll(() => document.querySelector('[data-testid="filter-options"]'))
      .not.toBeNull()

    expect(watch.flat).toEqual([])
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
  })
})
