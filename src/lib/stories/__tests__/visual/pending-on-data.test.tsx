import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { ContextMenuAction, RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  contextMenu,
  dataExport,
  pagination,
  rowActionMenu,
  rowActions,
  rowExpanding,
  rowSelection,
} from '../../../plugins'
import { setObjectPending } from '../../../shared/objectPending'
import { humanClick, pendingArcOf } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'

// Ожидание на данных (ADR 0155; PW1–PW3): волна только у действия контекстного меню, цель
// «вся таблица» — свечение и плашка, скелет-строка ленивых детей в клиентской модели. PW4 —
// в `server-row-model`, PW5 — модульный (`src/lib/__tests__/pendingOnData.test.ts`).

interface Deferred<T = void> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const deferred = <T = void,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

interface Call {
  kind: string
  signal: AbortSignal
  answer: Deferred<any>
}

let calls: Call[] = []
const held =
  (kind: string) =>
  (...args: unknown[]) => {
    const { signal } = args.at(-1) as { signal: AbortSignal }
    const call = { kind, signal, answer: deferred<any>() }
    calls.push(call)
    return call.answer.promise
  }
const lastCall = (kind: string) =>
  calls.filter(call => call.kind === kind).at(-1)!

const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
const archive: RowAction = {
  id: 'archive',
  slot: 'actionRowSlot',
  icon: icon('A'),
  label: () => 'Archive',
  target: ctx => ({ row: (ctx as { row: { id: string } }).row.id }),
  onSelect: held('archive'),
}
const recalculate: ContextMenuAction = {
  id: 'recalculate',
  icon: icon('R'),
  label: () => 'Recalculate',
  onSelect: held('recalculate'),
}
const REFUSAL = 'The server is busy'
const recalculateTable: ContextMenuAction = {
  id: 'recalculateTable',
  icon: icon('T'),
  label: () => 'Recalculate table',
  target: () => 'table',
  onSelect: held('table'),
}

const probe = definePlugin()({
  id: 'pendingProbe',
  slotActions: [archive],
  contextMenuActions: [recalculate, recalculateTable],
})

interface Node {
  id: string
  name: string
  kids?: number
}

const DATA: Node[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  kids: i === 0 ? 2 : 0,
}))

interface GridProps {
  menu?: boolean
  onExported?: (request: { rowCount?: number }) => void
}

const Grid = ({ menu = false, onExported }: GridProps) => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    getRowId: (row: Node) => row.id,
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      probe(),
      rowActions(),
      ...(menu ? [rowActionMenu({ mode: 'always' })] : []),
      contextMenu(),
      rowSelection(),
      pagination({ initialPageSize: 50 }),
      rowExpanding({
        hasChildren: row => (row.original.kids ?? 0) > 0,
        loadChildren: held('children') as never,
      }),
      dataExport({
        allow: { rows: ['all'], columns: ['all'], formats: ['csv'] },
        onExported,
      }),
    ] as never,
  })
  captured = table
  return (
    <div style={{ width: 700, height: 520 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

let captured: any

const mount = async (props: GridProps = {}) => {
  calls = []
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellsOf = (id: string) => [
  ...rowEl(id).querySelectorAll<HTMLElement>('.data-grid__body-cell'),
]
const nameCell = (id: string) =>
  rowEl(id).querySelector<HTMLElement>('[data-column-id="name"]')!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const itemByText = (text: string) =>
  items().find(el => el.textContent?.includes(text))
const rowKebab = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
const archiveButton = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>('button[aria-label$="Archive"]')!
const waved = () => document.querySelectorAll('[data-pending-wave]').length
const flashedRow = (id: string) =>
  rowEl(id).getAttribute('data-flash') === 'reverted' ||
  cellsOf(id).some(cell => cell.getAttribute('data-flash') === 'reverted')
const rowBusy = (id: string) =>
  cellsOf(id)
    .filter(cell => cell.dataset.columnId === 'name')
    .every(cell => cell.getAttribute('aria-busy') === 'true')

const runFromContextMenu = async (cellId: string, label: string) => {
  await userEvent.click(nameCell(cellId), { button: 'right' })
  await expect.poll(() => itemByText(label)).toBeTruthy()
  await humanClick(itemByText(label)!)
  await expect.poll(() => items().length).toBe(0)
}

describe('Ожидание на данных (ADR 0155)', () => {
  test('PW1: волна на цели у любого инициатора — контекстного меню, инлайн-кнопки и кебаба; на инициаторе дуги нет; aria-busy у ячеек цели, вспышка отказа на цели', async () => {
    // Контекстное меню: инициатора не видно — волна на цели.
    let screen = await mount()
    await runFromContextMenu('r2', 'Recalculate')
    await expect
      .poll(() => nameCell('r2').hasAttribute('data-pending-wave'))
      .toBe(true)
    expect(nameCell('r2').getAttribute('aria-busy')).toBe('true')
    lastCall('recalculate').answer.reject(new Error(REFUSAL))
    await expect
      .poll(() => nameCell('r2').getAttribute('data-flash'))
      .toBe('reverted')

    // Инлайн-кнопка: волна на строке-цели, на кнопке дуги нет (ADR 0177, §1).
    await userEvent.hover(nameCell('r1'))
    await humanClick(archiveButton())
    await expect.poll(() => rowBusy('r1')).toBe(true)
    expect(pendingArcOf(archiveButton())).toBeNull()
    expect(nameCell('r1').hasAttribute('data-pending-wave')).toBe(true)
    lastCall('archive').answer.reject(new Error(REFUSAL))
    await expect.poll(() => flashedRow('r1')).toBe(true)
    await screen.unmount()

    // Кебаб: то же.
    screen = await mount({ menu: true })
    await userEvent.hover(nameCell('r3'))
    await expect.poll(() => rowKebab('r3')).not.toBeNull()
    await humanClick(rowKebab('r3')!)
    await expect.poll(() => itemByText('Archive')).toBeTruthy()
    await humanClick(itemByText('Archive')!)
    await expect.poll(() => rowBusy('r3')).toBe(true)
    expect(pendingArcOf(rowKebab('r3')!)).toBeNull()
    expect(nameCell('r3').hasAttribute('data-pending-wave')).toBe(true)
    lastCall('archive').answer.reject(new Error(REFUSAL))
    await expect.poll(() => flashedRow('r3')).toBe(true)
    await screen.unmount()
  })

  test("PW2: target, вернувший 'table': пока действие ждёт — свечение под шапкой и приглушение тела; отказ — плашка с причиной, закрытие снимает её", async () => {
    await mount()
    const body = () => document.querySelector<HTMLElement>('.data-grid__body')!
    const banner = () =>
      document.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
    const glowing = () => !!document.querySelector('[data-refreshing]')

    await runFromContextMenu('r2', 'Recalculate table')
    await expect.poll(glowing).toBe(true)
    await expect
      .poll(() => getComputedStyle(body()).opacity)
      .toBe(
        getComputedStyle(body())
          .getPropertyValue('--tsr-comp-loader-dim-opacity')
          .trim(),
      )
    expect(waved()).toBe(0)
    expect(banner()).toBeNull()

    lastCall('table').answer.reject(new Error(REFUSAL))
    await expect.poll(banner).not.toBeNull()
    await expect.poll(glowing).toBe(false)
    expect(banner()!.textContent).toContain(REFUSAL)
    expect(banner()!.textContent).toContain('Recalculate table')
    await humanClick(
      banner()!.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.loadErrorDismiss}"]`,
      )!,
    )
    await expect.poll(banner).toBeNull()
  })

  test('PW3: ленивые дети в клиентской модели — пока ждут, под строкой одна скелет-строка с отступом ребёнка; её нельзя выбрать, выгрузить и сосчитать; на кнопке раскрытия дуга и «стоп»', async () => {
    const exported: number[] = []
    await mount({
      onExported: request => exported.push(request.rowCount ?? -1),
    })
    const range = () =>
      document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
        .textContent
    const total = range()
    const toggle = () =>
      rowEl('r0').querySelector<HTMLElement>('.row-expand-button')!

    await humanClick(toggle())
    await expect.poll(() => calls.length).toBe(1)
    const pending = () => [
      ...document.querySelectorAll<HTMLElement>('[data-pending-row]'),
    ]
    await expect.poll(() => pending().length).toBe(1)
    const placeholder = pending()[0]!
    expect(Number(placeholder.dataset.index)).toBe(
      Number(rowEl('r0').dataset.index) + 1,
    )
    const indent = Number.parseFloat(
      getComputedStyle(placeholder).getPropertyValue(
        '--tsr-comp-row-nesting-indent',
      ),
    )
    const nested = [
      ...placeholder.querySelectorAll<HTMLElement>('[style*="padding-left"]'),
    ]
    expect(nested).toHaveLength(1)
    expect(Number.parseFloat(getComputedStyle(nested[0]!).paddingLeft)).toBe(
      indent,
    )

    // Дуга, затем «стоп».
    expect(toggle().getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(toggle())).not.toBeNull()
    await expect
      .poll(() => toggle().hasAttribute('data-cancel-armed'), { timeout: 2000 })
      .toBe(true)
    await userEvent.hover(toggle())
    const stop = toggle().querySelector<HTMLElement>('[data-cancel-icon]')!
    await expect.poll(() => getComputedStyle(stop).display).toBe('flex')

    // Не сосчитать, не выбрать, не выгрузить.
    expect(range()).toBe(total)
    expect(placeholder.querySelector('[role="checkbox"]')).toBeNull()
    captured.toggleAllRowsSelected(true)
    await expect
      .poll(() => Object.keys(captured.atoms.rowSelection.get()).length)
      .toBe(DATA.length)
    await captured.exportData()
    expect(exported).toEqual([DATA.length])
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
  })

  test('TG20: волна на цели-строке занимает всю ширину строки и при колонках уже таблицы, в том числе при виртуализации колонок; у цели-колонки свободное место справа без волны', async () => {
    let table: unknown
    const Narrow = ({
      columnVirtualization,
    }: {
      columnVirtualization: boolean
    }) => {
      table = useCreateTable({
        columns: [
          { id: 'id', accessorKey: 'id', header: 'Id', size: 120 },
          { id: 'name', accessorKey: 'name', header: 'Name', size: 120 },
        ] as never,
        data: [
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Bob' },
        ],
        getRowId: (row: { id: string }) => row.id,
        ...(columnVirtualization ? {} : { enableColumnVirtualization: false }),
      } as never)
      return (
        <div style={{ width: 720, height: 300 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const rowOf = (id: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${id}"]`,
      )!
    const waveRight = (id: string) =>
      Math.max(
        ...[...rowOf(id).querySelectorAll('[data-pending-wave]')].map(
          element => element.getBoundingClientRect().right,
        ),
      )
    for (const columnVirtualization of [true, false]) {
      const screen = await render(
        <Narrow columnVirtualization={columnVirtualization} />,
      )
      await expect.poll(() => rowOf('a')).not.toBeNull()
      setObjectPending(table, 'row', [{ row: 'a' }])
      await expect
        .poll(() => rowOf('a').querySelectorAll('[data-pending-wave]').length)
        .toBeGreaterThan(0)
      const row = rowOf('a').getBoundingClientRect()
      await expect.poll(() => waveRight('a')).toBeCloseTo(row.right, 0)
      // Блик идёт и по свободному месту: у него своя анимация.
      await expect
        .poll(
          () =>
            rowOf('a')
              .getAnimations({ subtree: true })
              .filter(animation => animation.id === 'tsr-pending-wave').length,
        )
        .toBeGreaterThan(
          rowOf('a').querySelectorAll(
            '.data-grid__body-cell[data-pending-wave]',
          ).length,
        )
      setObjectPending(table, 'row', undefined)

      setObjectPending(table, 'column', [{ column: 'name' }])
      await expect
        .poll(() => rowOf('b').querySelectorAll('[data-pending-wave]').length)
        .toBe(1)
      expect(waveRight('b')).toBeLessThan(row.right - 100)
      setObjectPending(table, 'column', undefined)
      await screen.unmount()
    }
  })
})
