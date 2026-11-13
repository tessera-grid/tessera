import { useMemo, useState } from 'react'
import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  columnPinning,
  columnSorting,
  rowSelection,
  serverRowModel,
  valueChangeFlash,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { OWN_WRITE_GRACE } from '../../../shared/ownWrites'
import { startEditSession } from '../../../plugins/cellEditing/session'
import { describeWork, measureWork, renders } from '../work.helpers'
import { BodyCell } from '../../../grid/BodyCell'
import { BodyRow } from '../../../grid/BodyRow'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  resolveColor,
  toRgba,
} from './a11y-helpers'

// Вспышка при смене значения извне (ADR 0221; VC1–VC5, VC7–VC11, VC13–VC17): настоящий
// грид, данные приложения и серверная модель. Модульные VC6, VC12 — в `valueChangeFlash`,
// перф VC18 — в `performance/interaction`, VC19 — в `performance/scroll`.

declare module 'vitest/browser' {
  interface BrowserCommands {
    reducedMotion: (reduce: boolean) => Promise<void>
    forcedColors: (active: boolean) => Promise<void>
  }
}

interface Quote {
  id: string
  name: string
  price: number
  amount: string
  at: Date
  note: string
}

const quote = (i: number): Quote => ({
  id: `r${i}`,
  name: `N${i}`,
  price: 100 + i,
  amount: `${i}.50`,
  at: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
  note: `x${i}`,
})

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 120 },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    dataType: 'number',
    changeFlash: 'direction',
    size: 110,
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'numberString',
    changeFlash: 'direction',
    size: 110,
  },
  {
    id: 'at',
    accessorKey: 'at',
    header: 'At',
    dataType: 'date',
    changeFlash: 'direction',
    size: 130,
  },
  {
    id: 'note',
    accessorKey: 'note',
    header: 'Note',
    changeFlash: false,
    size: 110,
  },
]

interface Api {
  applyRowTransaction: (transaction: object) => unknown
  writeCells: (changes: object[]) => unknown
  highlight: (target: object, options?: { tone?: string }) => unknown
  setCellSelection: (ranges: object[]) => void
  setRowData: (id: string, updater: (row: Quote) => Quote) => void
  refreshRows: (options?: { purge?: boolean }) => void
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  getRowSource: () => { byId: (id: string) => unknown }
}

let table: Api
let setRows: (update: (rows: Quote[]) => Quote[]) => void
let setLocale: (locale: string) => void

interface GridProps {
  count?: number
  plugins?: readonly TesseraFeatureEntry[]
  flash?: boolean
  columns?: unknown[]
  pinned?: boolean
  onCellEdit?: (commit: {
    rowId: string
    columnId: string
    value: unknown
  }) => unknown
  onCommitEdits?: (batch: {
    cells: { rowId: string; columnId: string; value: unknown }[]
  }) => unknown
}

const Grid = ({
  count = 300,
  plugins = [],
  flash = true,
  columns = COLUMNS,
  pinned = false,
}: GridProps) => {
  const initial = useMemo(
    () => Array.from({ length: count }, (_, i) => quote(i)),
    [count],
  )
  const [rows, set] = useState(initial)
  const [locale, changeLocale] = useState('en-US')
  setRows = set
  setLocale = changeLocale
  table = useCreateTable({
    columns: columns as never,
    data: rows,
    locale,
    getRowId: (row: Quote) => row.id,
    onDataChange: (next: Quote[]) => set(next),
    state: {
      ...(pinned && { columnPinning: { start: ['name'], end: [] } }),
    },
    plugins: [...(flash ? [valueChangeFlash()] : []), ...plugins] as never,
  }) as unknown as Api
  return (
    <div style={{ width: 640, height: 360, background: 'var(--card)' }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  return screen
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellEl = (rowId: string, columnId: string) =>
  rowEl(rowId)?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) ??
  null
const flashOf = (rowId: string, columnId: string) =>
  cellEl(rowId, columnId)?.getAttribute('data-flash') ?? null
const arrowOf = (rowId: string, columnId: string) =>
  cellEl(rowId, columnId)?.querySelector<HTMLElement>(
    '[data-flash-direction]',
  ) ?? null
const allFlashed = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-cell[data-flash]',
    ),
  ]
    .map(
      cell =>
        `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${cell.dataset.columnId}`,
    )
    .sort()

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** Рендер, эффекты и запись вспышек коммита улеглись. */
const settle = async () => {
  await frame()
  await frame()
  await frame()
}
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

/** Сменить поля строк новым `data` — как сокет. */
const update = (patch: Record<string, Partial<Quote>>) =>
  setRows(rows =>
    rows.map(row => (patch[row.id] ? { ...row, ...patch[row.id] } : row)),
  )

const styles: HTMLStyleElement[] = []
const tokens = (css: string) => {
  const style = document.createElement('style')
  style.textContent = `.data-grid-theme { ${css} }`
  document.head.append(style)
  styles.push(style)
}
/** Вспышка держится весь тест. */
const holdLong = () => tokens('--tsr-comp-flash-duration: 60s;')

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1000, 800))
afterAll(() => page.viewport(viewport.width, viewport.height))
afterEach(async () => {
  styles.splice(0).forEach(style => style.remove())
  document.documentElement.classList.remove('dark')
  await commands.reducedMotion(false)
  await commands.forcedColors(false)
})

describe('Вспышка при смене значения: источники', () => {
  test('VC1: без плагина и с enabled: false смена значения не вспыхивает; с плагином — вспыхивает', async () => {
    holdLong()
    for (const plugins of [
      { flash: false },
      { flash: false, plugins: [valueChangeFlash({ enabled: false })] },
    ]) {
      const screen = await mount(plugins)
      update({ r1: { name: 'changed' } })
      await settle()
      expect(cellEl('r1', 'name')!.textContent).toContain('changed')
      expect(allFlashed()).toEqual([])
      await screen.unmount()
    }
    const screen = await mount()
    update({ r1: { name: 'changed' } })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')
    await screen.unmount()
  })

  test('VC2: новый data ссылкой и applyRowTransaction вспыхивают изменённую ячейку; соседние с прежним значением и другие строки — нет', async () => {
    holdLong()
    const screen = await mount()
    update({ r1: { name: 'socket' } })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')
    await settle()
    expect(allFlashed()).toEqual(['r1:name'])

    table.applyRowTransaction({ update: [{ ...quote(2), name: 'pushed' }] })
    await expect.poll(() => flashOf('r2', 'name')).toBe('changed')
    await settle()
    expect(allFlashed()).toEqual(['r1:name', 'r2:name'])
    await screen.unmount()
  })

  test('VC4: правка ячейки, пакет onCommitEdits и эхо с другим значением не вспыхивают; поздняя смена извне — вспыхивает', async () => {
    holdLong()
    let commits = 0
    const screen = await render(
      <EditingGrid
        onCellEdit={({ rowId, columnId, value }) => {
          // Сервер нормализует значение: эхо отличается от набранного.
          update({ [rowId]: { [columnId]: `${String(value).toUpperCase()}!` } })
        }}
        onCommitEdits={({ cells }) => {
          commits++
          return Promise.resolve().then(() => {
            for (const cell of cells) {
              update({
                [cell.rowId]: { [cell.columnId]: `${String(cell.value)}*` },
              })
            }
          })
        }}
      />,
    )
    await expect.poll(() => cellEl('r1', 'name')).not.toBeNull()
    startEditSession(table, table.getRowSource().byId('r1') as never, {
      id: 'name',
    })
    await expect.poll(() => document.activeElement?.tagName).toBe('INPUT')
    const input = document.activeElement as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'mine{Enter}')
    await expect
      .poll(() => cellEl('r1', 'name')!.textContent)
      .toContain('MINE!')
    await settle()
    expect(flashOf('r1', 'name')).not.toBe('changed')

    table.writeCells([{ rowId: 'r2', columnId: 'name', value: 'pasted' }])
    await expect
      .poll(() => cellEl('r2', 'name')!.textContent)
      .toContain('pasted*')
    await settle()
    expect(commits).toBe(1)
    expect(flashOf('r2', 'name')).not.toBe('changed')

    // Отметка живёт после ответа ограниченное время: позже смена извне — вспыхивает.
    await sleep(OWN_WRITE_GRACE + 100)
    update({ r1: { name: 'colleague' } })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')
    await screen.unmount()
  })

  test('VC5: первая отрисовка, въезд в окно, сортировка без смены значения, смена языка и новая строка — без вспышки смены', async () => {
    holdLong()
    const screen = await mount({ plugins: [columnSorting()] })
    await settle()
    expect(allFlashed()).toEqual([])
    // Въезд в окно.
    scroller().scrollTop = 4000
    await expect
      .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
        timeout: 3000,
      })
      .toBe(false)
    await settle()
    expect(allFlashed()).toEqual([])
    scroller().scrollTop = 0
    await expect.poll(() => rowEl('r0')).not.toBeNull()
    // Сортировка по убыванию цены: строки переставлены, значения те же.
    table.setSorting([{ id: 'price', desc: true }])
    await settle()
    expect(allFlashed()).toEqual([])
    setLocale('de-DE')
    await settle()
    expect(allFlashed()).toEqual([])
    // Новая строка — вспышка прихода строки, ячейки смены нет.
    table.applyRowTransaction({ add: [{ ...quote(999) }], index: 0 })
    await expect.poll(() => rowEl('r999')).not.toBeNull()
    await settle()
    expect(allFlashed()).toEqual([])
    await screen.unmount()
  })
})

/** Грид с правкой: «эхо» правки возвращается новым `data`. */
const EditingGrid = (props: GridProps) => (
  <Grid
    count={20}
    plugins={[
      cellEditing({
        onCellEdit: props.onCellEdit as never,
        onCommitEdits: props.onCommitEdits as never,
      }),
    ]}
  />
)

describe('Вспышка при смене значения: серверная модель', () => {
  let items: Quote[] = []
  const getRows = ({ start, end }: ServerRowsRequest) =>
    Promise.resolve<ServerRowsResponse<Quote>>({
      rows: items.slice(start, end),
      rowCount: items.length,
    })
  const ServerGrid = () => {
    table = useCreateTable({
      rowCount: items.length,
      columns: COLUMNS as never,
      data: [] as Quote[],
      getRowId: (row: Quote) => row.id,
      plugins: [
        serverRowModel({ getRows, blockSize: 100 }),
        valueChangeFlash(),
      ] as never,
    }) as unknown as Api
    return (
      <div style={{ width: 640, height: 360 }}>
        <DataGrid table={table as never} />
      </div>
    )
  }

  test('VC3: update транзакции, setRowData и refreshRows без purge со сменой значения вспыхивают ячейку', async () => {
    holdLong()
    items = Array.from({ length: 300 }, (_, i) => quote(i))
    const screen = await render(<ServerGrid />)
    await expect.poll(() => cellEl('r1', 'name')).not.toBeNull()

    items[1] = { ...items[1]!, name: 'pushed' }
    table.applyRowTransaction({ update: [items[1]] })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')

    table.setRowData('r2', row => ({ ...row, name: 'set' }))
    await expect.poll(() => flashOf('r2', 'name')).toBe('changed')

    items[3] = { ...items[3]!, name: 'refetched' }
    table.refreshRows({ purge: false })
    await expect.poll(() => flashOf('r3', 'name')).toBe('changed')
    await settle()
    expect(allFlashed()).toEqual(['r1:name', 'r2:name', 'r3:name'])
    await screen.unmount()
  })
})

describe('Вспышка при смене значения: колонки и направление', () => {
  test('VC7: changeFlash: false и служебные колонки не вспыхивают; direction — up и down у числа, десятичной строки и даты, пустое — changed; умолчание — columnDefault', async () => {
    holdLong()
    let screen = await mount({ plugins: [rowSelection()] })
    update({
      r1: { price: 500, amount: '0.10', at: new Date(Date.UTC(2027, 0, 1)) },
      r2: { price: 1, amount: '99.99', at: new Date(Date.UTC(2020, 0, 1)) },
      r3: { price: undefined as never, note: 'n' },
      r4: { name: 'text' },
    })
    await expect.poll(() => flashOf('r1', 'price')).toBe('up')
    expect(flashOf('r1', 'amount')).toBe('down')
    expect(flashOf('r1', 'at')).toBe('up')
    expect(flashOf('r2', 'price')).toBe('down')
    expect(flashOf('r2', 'amount')).toBe('up')
    expect(flashOf('r2', 'at')).toBe('down')
    expect(flashOf('r3', 'price')).toBe('changed')
    expect(flashOf('r3', 'note')).toBeNull()
    // Колонка без `direction` — нейтральный итог.
    expect(flashOf('r4', 'name')).toBe('changed')
    // Служебная колонка выбора строк не вспыхивает.
    const service = rowEl('r1')!.querySelectorAll('[data-flash]')
    expect(
      [...service].every(
        cell => cell.getAttribute('data-column-id') !== '__select',
      ),
    ).toBe(true)
    await screen.unmount()

    // Умолчание для колонок без своего поля — аргумент плагина; своё поле колонки главнее.
    screen = await mount({
      flash: false,
      plugins: [valueChangeFlash({ columnDefault: false })],
    })
    update({ r1: { name: 'off', price: 900 } })
    await expect.poll(() => flashOf('r1', 'price')).toBe('up')
    expect(flashOf('r1', 'name')).toBeNull()
    await screen.unmount()
  })

  test('VC8: up и down несут треугольник у начального края посередине высоты; содержимое не сдвигается; стрелка гаснет со вспышкой', async () => {
    const screen = await mount()
    const text = () =>
      cellEl('r1', 'price')!
        .querySelector<HTMLElement>(
          '.data-grid__cell-wrapper-title, [title], div div',
        )!
        .getBoundingClientRect()
    const before = text()
    update({ r1: { price: 999 } })
    await expect.poll(() => arrowOf('r1', 'price')).not.toBeNull()
    const arrow = arrowOf('r1', 'price')!
    expect(arrow.dataset.flashDirection).toBe('up')
    expect(arrow.getAttribute('aria-hidden')).toBe('true')
    const cell = cellEl('r1', 'price')!.getBoundingClientRect()
    const box = arrow.getBoundingClientRect()
    const padding = Number.parseFloat(
      getComputedStyle(cellEl('r1', 'price')!).getPropertyValue(
        '--tsr-comp-cell-content-padding-x',
      ),
    )
    expect(box.width).toBeGreaterThan(0)
    expect(box.left).toBeGreaterThanOrEqual(cell.left)
    expect(box.right).toBeLessThanOrEqual(cell.left + padding)
    expect(
      Math.abs(box.top + box.height / 2 - (cell.top + cell.height / 2)),
    ).toBeLessThan(1)
    expect(text()).toEqual(before)
    expect(getComputedStyle(arrow).backgroundColor).toBe(
      resolveColor(cellEl('r1', 'price')!, 'var(--tsr-comp-flash-up-color)'),
    )
    update({ r2: { price: 1 } })
    await expect
      .poll(() => arrowOf('r2', 'price')?.dataset.flashDirection)
      .toBe('down')
    // Угасание: стрелка уходит вместе с заливкой.
    await expect.poll(() => arrowOf('r1', 'price')?.dataset.out).toBe('true')
    await expect
      .poll(() => arrowOf('r1', 'price'), { timeout: 3000 })
      .toBeNull()
    expect(flashOf('r1', 'price')).toBeNull()
    await screen.unmount()
  })

  test('VC9: смена той же ячейки до конца вспышки перезапускает время; итог — по последней смене', async () => {
    tokens(
      '--tsr-comp-flash-duration: 400ms; --tsr-comp-flash-fade-duration: 100ms;',
    )
    const screen = await mount()
    update({ r1: { price: 999 } })
    await expect.poll(() => flashOf('r1', 'price')).toBe('up')
    await sleep(250)
    update({ r1: { price: 1 } })
    await expect.poll(() => flashOf('r1', 'price')).toBe('down')
    // Через 450 мс от первой смены — первая уже гасла бы, вторая держится.
    await sleep(250)
    expect(flashOf('r1', 'price')).toBe('down')
    expect(cellEl('r1', 'price')!.hasAttribute('data-flash-out')).toBe(false)
    await screen.unmount()
  })
})

describe('Вспышка при смене значения: окно и перестановки', () => {
  test('VC10: ячейка вне окна не вспыхивает и при прокрутке к ней; вспыхнувшая, ушедшая и вернувшаяся до истечения, — залита', async () => {
    holdLong()
    const screen = await mount()
    update({ r1: { name: 'lit' }, r250: { name: 'far' } })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')
    const toRow = async (id: string, top: number) => {
      scroller().scrollTop = top
      await expect.poll(() => rowEl(id), { timeout: 3000 }).not.toBeNull()
      await expect
        .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
          timeout: 3000,
        })
        .toBe(false)
      await settle()
    }
    const rowHeight = rowEl('r1')!.getBoundingClientRect().height
    await toRow('r250', 250 * rowHeight)
    expect(rowEl('r1')).toBeNull()
    expect(flashOf('r250', 'name')).toBeNull()
    await toRow('r1', 0)
    expect(flashOf('r1', 'name')).toBe('changed')
    await screen.unmount()
  })

  test('VC11: строка, переставленная сменой внутри окна при сортировке по изменённой колонке, вспыхивает на новом месте', async () => {
    holdLong()
    const screen = await mount({
      count: 6,
      plugins: [
        columnSorting({ initialSorting: [{ id: 'price', desc: true }] }),
      ],
    })
    const order = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].map(
        row => row.dataset.rowId,
      )
    await expect.poll(order).toEqual(['r5', 'r4', 'r3', 'r2', 'r1', 'r0'])
    update({ r0: { price: 1000 } })
    await expect.poll(() => order()[0]).toBe('r0')
    await expect.poll(() => flashOf('r0', 'price')).toBe('up')
    await screen.unmount()
  })
})

const OUTCOMES = ['changed', 'up', 'down'] as const

describe('Вспышка при смене значения: вид', () => {
  test('VC13: вспышка любого итога не смешивается с заливкой цели — подсветка строки, ячейки и колонки, тинт диапазона, выбранная и закреплённая строка; после угасания — прежний цвет', async () => {
    tokens(`
      --tsr-comp-flash-duration: 60s;
      --tsr-comp-flash-fade-duration: 1ms;
      --tsr-comp-highlight-fade-duration: 1ms;
      --tsr-comp-motion-duration: 1ms;
    `)
    const screen = await mount({
      pinned: true,
      plugins: [
        columnPinning(),
        rowSelection({ rowSelection: { r4: true } }),
        cellSelection(),
      ],
    })
    await inBothThemes(async () => {
      const fillOf = (cell: HTMLElement) => effectiveBg(cell).slice(0, 3)
      const toneOf = (cell: HTMLElement, outcome: string) =>
        toRgba(resolveColor(cell, `var(--tsr-comp-flash-${outcome}-bg)`)).slice(
          0,
          3,
        )
      const near = (a: number[], b: number[]) =>
        a.reduce((sum, value, i) => sum + Math.abs(value - b[i]!), 0) <= 6
      table.highlight({ row: 'r1' }, { tone: 'warning' })
      table.highlight({ cell: ['r2', 'price'] }, { tone: 'danger' })
      table.highlight({ column: 'amount' }, { tone: 'success' })
      table.setCellSelection([
        {
          anchorRowIndex: 3,
          focusRowIndex: 3,
          anchorColumnId: 'price',
          focusColumnId: 'amount',
        },
      ])
      await settle()
      const targets: [string, string][] = [
        ['r1', 'name'], // подсветка строки, закреплённая колонка
        ['r1', 'price'], // подсветка строки
        ['r2', 'price'], // подсветка ячейки
        ['r5', 'amount'], // подсветка колонки
        ['r3', 'price'], // тинт диапазона
        ['r4', 'price'], // выбранная строка
      ]
      for (const outcome of OUTCOMES) {
        const before = targets.map(([row, column]) =>
          fillOf(cellEl(row, column)!),
        )
        ;(
          table as unknown as {
            flashOutcome: (t: object[], o: string) => void
          }
        ).flashOutcome(
          targets.map(cell => ({ cell })),
          outcome,
        )
        await settle()
        for (const [row, column] of targets) {
          const cell = cellEl(row, column)!
          expect(
            near(fillOf(cell), toneOf(cell, outcome)),
            `${outcome} ${row}:${column}`,
          ).toBe(true)
        }
        // Угасание открывает прежнюю заливку.
        ;(table as unknown as { setFlashes: (v: object) => void }).setFlashes(
          {},
        )
        await settle()
        targets.forEach(([row, column], i) =>
          expect(
            near(fillOf(cellEl(row, column)!), before[i]!),
            `после ${outcome} ${row}:${column}`,
          ).toBe(true),
        )
      }
    })
    await screen.unmount()
  })

  test('VC14: текст на тонах changed, up, down — 4.5:1, стрелка — 3:1 в обеих темах; тоны отличимы между собой и от arrived; axe без нарушений', async () => {
    holdLong()
    const screen = await mount()
    await inBothThemes(async () => {
      const surface = cellEl('r1', 'name')!
      const hueOf = (outcome: string) => {
        const [r, g, b] = toRgba(
          resolveColor(surface, `var(--tsr-comp-flash-${outcome}-bg)`),
        ).map(v => v / 255)
        const max = Math.max(r!, g!, b!)
        const min = Math.min(r!, g!, b!)
        const d = max - min || 1
        const h =
          max === r
            ? ((g! - b!) / d) % 6
            : max === g
              ? (b! - r!) / d + 2
              : (r! - g!) / d + 4
        return (h * 60 + 360) % 360
      }
      const gap = (a: number, b: number) => {
        const d = Math.abs(a - b) % 360
        return d > 180 ? 360 - d : d
      }
      const hues = Object.fromEntries(
        [...OUTCOMES, 'arrived'].map(outcome => [outcome, hueOf(outcome)]),
      )
      expect(gap(hues.changed!, hues.arrived!)).toBeGreaterThan(30)
      expect(gap(hues.changed!, hues.up!)).toBeGreaterThan(30)
      expect(gap(hues.changed!, hues.down!)).toBeGreaterThan(30)
      expect(gap(hues.up!, hues.down!)).toBeGreaterThan(30)

      update({
        r1: { name: `t${Math.random()}`, price: 5000 },
        r2: { price: 0 },
      })
      await expect.poll(() => flashOf('r2', 'price')).toBe('down')
      for (const [row, column] of [
        ['r1', 'name'],
        ['r1', 'price'],
        ['r2', 'price'],
      ] as const) {
        const cell = cellEl(row, column)!
        const bg = effectiveBg(cell)
        const color = toRgba(
          getComputedStyle(cell.querySelector('*') ?? cell).color,
        )
        expect(contrast(color, bg), `${row}:${column}`).toBeGreaterThanOrEqual(
          4.5,
        )
        const arrow = arrowOf(row, column)
        if (arrow) {
          expect(
            contrast(toRgba(getComputedStyle(arrow).backgroundColor), bg),
            `стрелка ${row}:${column}`,
          ).toBeGreaterThanOrEqual(3)
        }
      }
      const { violations } = await axe.run(
        document.querySelector<HTMLElement>('[role="table"]')!,
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(violations.map(v => v.id)).toEqual([])
    })
    await screen.unmount()
  })

  test('VC15: forced-colors — changed, up и down не заливаются, стрелка CanvasText; уменьшенное движение — то же время без перехода', async () => {
    holdLong()
    await commands.forcedColors(true)
    let screen = await mount()
    const before = getComputedStyle(cellEl('r1', 'name')!).backgroundImage
    update({ r1: { name: 'forced', price: 999 } })
    await expect.poll(() => flashOf('r1', 'name')).toBe('changed')
    const plain = getComputedStyle(rowEl('r1')!).backgroundColor
    for (const column of ['name', 'price']) {
      expect(getComputedStyle(cellEl('r1', column)!).backgroundColor).toBe(
        getComputedStyle(cellEl('r2', column)!).backgroundColor,
      )
    }
    expect(plain).toBe(getComputedStyle(rowEl('r2')!).backgroundColor)
    expect(before).toBeDefined()
    expect(getComputedStyle(arrowOf('r1', 'price')!).backgroundColor).toBe(
      resolveColor(rowEl('r1')!, 'CanvasText'),
    )
    await screen.unmount()
    await commands.forcedColors(false)

    tokens(
      '--tsr-comp-flash-duration: 300ms; --tsr-comp-flash-fade-duration: 400ms;',
    )
    await commands.reducedMotion(true)
    screen = await mount()
    const started = performance.now()
    update({ r1: { price: 999 } })
    await expect.poll(() => flashOf('r1', 'price')).toBe('up')
    await expect
      .poll(() => cellEl('r1', 'price')!.hasAttribute('data-flash-out'))
      .toBe(true)
    expect(performance.now() - started).toBeGreaterThanOrEqual(280)
    const transitions = cellEl('r1', 'price')!
      .getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition)
    expect(transitions).toEqual([])
    await screen.unmount()
  })

  test('VC16: вспышка смены ничего не объявляет и не меняет aria-* ячейки', async () => {
    holdLong()
    const screen = await mount()
    const aria = (el: Element) =>
      [...el.attributes]
        .filter(attr => attr.name.startsWith('aria-') || attr.name === 'role')
        .map(attr => `${attr.name}=${attr.value}`)
        .sort()
    const regions = () =>
      [...document.querySelectorAll('[aria-live]')].map(el => el.textContent)
    const before = aria(cellEl('r1', 'price')!)
    const live = regions()
    update({ r1: { price: 999 } })
    await expect.poll(() => flashOf('r1', 'price')).toBe('up')
    await sleep(200)
    expect(aria(cellEl('r1', 'price')!)).toEqual(before)
    expect(regions()).toEqual(live)
    await screen.unmount()
  })

  test('VC17: смена значения одной ячейки с плагином перерисовывает не больше, чем без него, кроме ячейки вспышки; другие строки окна — нет', async () => {
    holdLong()
    const measure = async (flash: boolean) => {
      const screen = await mount({ flash })
      await settle()
      const grid = document.querySelector('.data-grid-theme')!
      const work = await measureWork(grid, async () => {
        update({ r1: { price: 999 } })
        await expect
          .poll(() => cellEl('r1', 'price')!.textContent)
          .toContain('999')
        if (flash) await expect.poll(() => flashOf('r1', 'price')).toBe('up')
      })
      await screen.unmount()
      return work
    }
    const base = await measure(false)
    const work = await measure(true)
    expect(renders(work, BodyRow), describeWork(work)).toBe(
      renders(base, BodyRow),
    )
    // Ячейки: те же, что без плагина, и одна — записью вспышки.
    expect(renders(work, BodyCell), describeWork(work)).toBeLessThanOrEqual(
      renders(base, BodyCell) + 1,
    )
  })
})
