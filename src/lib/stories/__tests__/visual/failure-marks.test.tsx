import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnDragging,
  columnSorting,
  keyboardNavigation,
  pagination,
  rowDragging,
  rowExpanding,
} from '../../../plugins'
import { failureShownOn, humanClick } from '../helpers'
import { tableLabels } from '../labels'

// Отметка отказа у встроенных носителей (ADR 0127 этап 2, ADR 0136): IR13 — снятие
// повтором и успехом, IR19 — отметка с причиной у тоггла, ручек и кнопок пагинации,
// IR20 — отметка переживает виртуализацию, сортировку и смену страницы. Инлайн-действие,
// сортировка и выгрузка — MI19, SA12 и XL7.

interface Item {
  id: string
  a: string
  b: string
  c: string
  subRows?: Item[]
}

const item = (i: number, subRows?: Item[]): Item => ({
  id: `r${i}`,
  a: `A${String(i).padStart(3, '0')}`,
  b: `B${i}`,
  c: `C${i}`,
  ...(subRows ? { subRows } : {}),
})

const COLUMNS = [
  {
    id: 'a',
    accessorKey: 'a',
    header: 'A',
    size: 140,
    enableDragging: true,
  },
  {
    id: 'b',
    accessorKey: 'b',
    header: 'B',
    size: 140,
    enableDragging: true,
  },
  {
    id: 'c',
    accessorKey: 'c',
    header: 'C',
    size: 140,
    enableDragging: true,
  },
]

interface Deferred {
  resolve: () => void
  reject: (reason: unknown) => void
}

/** «Сервер» теста: каждое действие ждёт, пока тест не ответит. */
const createServer = () => {
  const calls: Deferred[] = []
  const answer = () =>
    new Promise<void>((resolve, reject) => calls.push({ resolve, reject }))
  return { calls, answer }
}

interface GridProps {
  server: ReturnType<typeof createServer>
  count?: number
  serverPages?: boolean
  pageSize?: number
  /** Клавиатурная навигация держит строку активной ячейки в окне (KN9). */
  keyboard?: boolean
}

const Grid = ({
  server,
  count = 30,
  serverPages,
  pageSize,
  keyboard = true,
}: GridProps) => {
  const [data, setData] = useState(() =>
    Array.from({ length: count }, (_, i) =>
      i === 0 ? item(0, [item(100), item(101)]) : item(i),
    ),
  )
  const table = useCreateTable({
    rowCount: serverPages ? 1000 : undefined,
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    dataMode: { pagination: serverPages ? 'server' : 'client' },
    plugins: [
      ...(keyboard ? [keyboardNavigation()] : []),
      columnSorting(),
      rowExpanding({
        onExpandRow: (_row: unknown, expanding: boolean) =>
          expanding ? server.answer() : undefined,
      }),
      rowDragging({
        onRowDragEnd: () => server.answer(),
        onRowOrderChange: updater =>
          setData(prev => (updater as (rows: Item[]) => Item[])(prev)),
      }),
      columnDragging({ onColumnDragEnd: () => server.answer() }),
      ...(pageSize
        ? [
            pagination({
              initialPageSize: pageSize,
              onPageChange: serverPages ? () => server.answer() : undefined,
            }),
          ]
        : []),
    ] as never,
  })
  return (
    <div style={{ height: 420, width: 700 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const headEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const toggleOf = (id: string) =>
  rowEl(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const rowHandleOf = (id: string) =>
  rowEl(id)?.querySelector<HTMLElement>('.drag__handler--column') ?? null
const columnHandleOf = (id: string) =>
  headEl(id).querySelector<HTMLElement>('.drag__handler--column')!
const pageButton = (action: string) =>
  document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

const waitRows = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)

/** Ответить отказом на последнее действие. */
const refuse = async (
  server: ReturnType<typeof createServer>,
  reason: string,
) => {
  await expect.poll(() => server.calls.length).toBeGreaterThan(0)
  server.calls.splice(0).forEach(call => call.reject(new Error(reason)))
}

/** Переставить строку вниз с клавиатуры. */
const moveRowDown = async (id: string) => {
  await userEvent.click(
    rowEl(id)!.querySelector<HTMLElement>('[data-column-id="b"]')!,
  )
  await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
}

describe('Отметка отказа у носителей', () => {
  test('IR19: отметка отказа у каждого встроенного носителя — тоггл раскрытия, ручки переноса строки и колонки, кнопки страниц и выбор размера страницы; текст — «Не удалось: <причина>. Нажмите, чтобы повторить» из localization, причина по MI15', async () => {
    const server = createServer()
    const screen = await render(
      <Grid server={server} serverPages pageSize={10} />,
    )
    await waitRows()
    const expectMark = async (button: () => Element | null, reason: string) => {
      await expect.poll(() => failureShownOn(button())).toBe(true)
      expect(button()).toHaveAccessibleDescription(
        tableLabels.actionFailedRetry(reason),
      )
    }
    /** Причина видна и глазами: подсказкой при наведении (IR10). */
    const tooltipText = () =>
      [...document.querySelectorAll('[data-side]')]
        .map(el => el.textContent?.trim())
        .find(Boolean)
    const expectReasonOnHover = async (button: Element, reason: string) => {
      await userEvent.hover(button)
      await expect
        .poll(tooltipText, { timeout: 2000 })
        .toBe(tableLabels.actionFailedRetry(reason))
      await userEvent.unhover(button)
    }

    await humanClick(toggleOf('r0')!)
    await refuse(server, 'No access')
    await expectMark(() => toggleOf('r0'), 'No access')

    await moveRowDown('r2')
    await refuse(server, 'Row is locked')
    await expectMark(() => rowHandleOf('r2'), 'Row is locked')
    await expectReasonOnHover(rowHandleOf('r2')!, 'Row is locked')

    headEl('b').focus()
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
    await refuse(server, 'Column is fixed')
    await expectMark(() => columnHandleOf('b'), 'Column is fixed')
    await expectReasonOnHover(columnHandleOf('b')!, 'Column is fixed')

    await humanClick(pageButton('next'))
    await refuse(server, 'Offline')
    await expectMark(() => pageButton('next'), 'Offline')

    const sizeTrigger = () =>
      document.querySelector<HTMLElement>('[data-testid="page-size-select"]')
    await humanClick(sizeTrigger()!)
    const option = () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        node => node.textContent?.trim() === '25',
      )
    await expect.poll(option).toBeTruthy()
    await humanClick(option()!)
    await refuse(server, 'Too many rows')
    await expectMark(sizeTrigger, 'Too many rows')
    await screen.unmount()
  })

  test('IR13: отметку снимают повтор и успех того же действия; наведение не снимает', async () => {
    const server = createServer()
    const screen = await render(<Grid server={server} />)
    await waitRows()
    await humanClick(toggleOf('r0')!)
    await refuse(server, 'No access')
    await expect.poll(() => failureShownOn(toggleOf('r0'))).toBe(true)

    // Наведение показывает причину, но отметку не снимает.
    await userEvent.hover(toggleOf('r0')!)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(failureShownOn(toggleOf('r0'))).toBe(true)

    // Повтор снимает отметку сразу, успех её не возвращает.
    await humanClick(toggleOf('r0')!)
    await expect
      .poll(() => toggleOf('r0')!.querySelector('[data-failure-indicator]'))
      .toBeNull()
    await expect.poll(() => server.calls.length).toBe(1)
    server.calls.splice(0).forEach(call => call.resolve())
    await expect.poll(() => rowEl('r100')).not.toBeNull()
    expect(toggleOf('r0')!.querySelector('[data-failure-indicator]')).toBeNull()
    await screen.unmount()
  })

  test('IR20: отметка отказа переживает уход строки из окна виртуализации и возврат, сортировку и смену страницы', async () => {
    const server = createServer()
    let screen = await render(
      <Grid server={server} count={300} keyboard={false} />,
    )
    await waitRows()
    const marked = () => failureShownOn(toggleOf('r0'))
    await humanClick(toggleOf('r0')!)
    await refuse(server, 'No access')
    await expect.poll(marked).toBe(true)

    // Окно виртуализации: строка уходит и возвращается.
    scroller().scrollTop = scroller().scrollHeight
    await expect.poll(() => rowEl('r0')).toBeNull()
    scroller().scrollTop = 0
    await expect.poll(marked).toBe(true)

    // Сортировка: модель строк пересобрана, отметка у той же строки.
    await humanClick(
      headEl('a').querySelector<HTMLElement>('.column-sort__button')!,
    )
    await expect
      .poll(() => headEl('a').getAttribute('aria-sort'))
      .not.toBe('none')
    // По убыванию строка уехала в конец — прокручиваем к ней.
    if (headEl('a').getAttribute('aria-sort') === 'descending') {
      scroller().scrollTop = scroller().scrollHeight
    }
    await expect.poll(marked).toBe(true)
    await screen.unmount()

    // Страница: уйти со страницы строки и вернуться.
    screen = await render(
      <Grid server={server} count={40} pageSize={10} keyboard={false} />,
    )
    await waitRows()
    await humanClick(toggleOf('r0')!)
    await refuse(server, 'No access')
    await expect.poll(marked).toBe(true)
    await humanClick(pageButton('next'))
    await expect.poll(() => rowEl('r0')).toBeNull()
    await humanClick(pageButton('previous'))
    await expect.poll(marked).toBe(true)
    await screen.unmount()
  })
})
