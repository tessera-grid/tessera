import { render } from 'vitest-browser-react'
import { commands } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { startEditSession } from '../../../plugins/cellEditing/session'
import { humanClick, settleRowMotion } from '../helpers'

// Транзакции строк серверной модели на гриде (ADR 0157): что держится на месте при смене
// списка (RT8) и вид смены — движение, вспышка, двухфазный уход (RT9).

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const BLOCK = 100
const TOTAL = 1000

interface TransactionTable {
  applyRowTransaction: (transaction: object) => unknown
  setCellSelection: (ranges: object[]) => void
  store: { get: () => Record<string, unknown> }
  getRowSource: () => { byId: (id: string) => unknown }
}

/** Строки «сервера»: транзакция сперва меняет их, как настоящий сервер до push. */
let items: Item[] = []
const resetServer = () => {
  items = Array.from({ length: TOTAL }, (_, k) => ({
    id: `r${k}`,
    name: `N${k}`,
  }))
}

/** «Сервер» отвечает сразу строками своего набора. */
const getRows = ({ start, end }: ServerRowsRequest) =>
  Promise.resolve<ServerRowsResponse<Item>>({
    rows: items.slice(start, end),
    rowCount: items.length,
  })

/** Сервер применил изменение — приложение передаёт его таблице. */
const transact = (
  table: TransactionTable,
  { add, index, remove }: { add?: Item[]; index?: number; remove?: string[] },
) => {
  if (remove) items = items.filter(row => !remove.includes(row.id))
  if (add && index !== undefined) items.splice(index, 0, ...add)
  return table.applyRowTransaction({ add, index, remove })
}

const Grid = ({
  plugins = [],
  keyboard,
  onTable,
}: {
  plugins?: readonly TesseraFeatureEntry[]
  /** Клавиатурная навигация (ADR 0170, §1). */
  keyboard?: boolean
  onTable: (table: TransactionTable) => void
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    rowCount: TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK }),
      ...plugins,
    ] as never,
  })
  onTable(table as unknown as TransactionTable)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const body = () => q('.data-grid__body')!
const nextFrame = () => new Promise(requestAnimationFrame)
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
/** Строка, которую двигает движение строк: прямой потомок тела. */
const movingRow = (id: string) =>
  body().querySelector<HTMLElement>(`:scope > [data-row-id="${id}"]`)
/** Анимация сдвига строки движением строк. */
const slideOf = (id: string) =>
  movingRow(id)
    ?.getAnimations()
    .find(animation =>
      (animation.effect as KeyframeEffect)
        .getKeyframes()
        .some(frame => frame.translate !== undefined),
    )
const indexOf = (id: string) => Number(rowById(id)?.dataset.index ?? -1)
/** Строка, в которой фокус. */
const focusedRow = () =>
  (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
    '.data-grid__body-row',
  )
const pointer = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}
const item = (id: string): Item => ({ id, name: id })
const bodyAnimations = () =>
  body()
    .getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
const ghosts = () => document.querySelectorAll('[data-row-ghost]').length

/** Прокрутить тело к строке и дождаться, пока быстрая прокрутка уляжется. */
const scrollToIndex = async (index: number) => {
  scroller().scrollTop = index * rowHeight()
  await nextFrame()
  await expect
    .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
      timeout: 3000,
    })
    .toBe(false)
}

describe('Транзакции строк серверной модели (ADR 0157)', () => {
  test('RT8: позиция прокрутки и активная ячейка держат свою строку; активная ячейка удалённой строки — у соседней; диапазоны выделения следуют за списком; правка удалённой строки отменяется с причиной', async () => {
    resetServer()
    let table!: TransactionTable
    const onEditCancel = vi.fn()
    const screen = await render(
      <Grid
        keyboard
        plugins={[cellSelection(), cellEditing({ onEditCancel })]}
        onTable={t => (table = t)}
      />,
    )
    try {
      // Активная ячейка с фокусом на строке r5.
      await expect.poll(() => rowById('r5')).not.toBeNull()
      const cell = rowById('r5')!.querySelector<HTMLElement>('[data-kn-cell]')!
      await humanClick(cell)
      await expect.poll(() => focusedRow()?.dataset.rowId).toBe('r5')

      transact(table, { add: [item('n1')], index: 1 })
      await expect.poll(() => indexOf('r5')).toBe(6)
      await expect.poll(() => focusedRow()?.dataset.rowId).toBe('r5')

      // Строка активной ячейки удалена — ячейка у соседней, фокус с ней.
      transact(table, { remove: ['r5'] })
      await expect.poll(() => rowById('r5')).toBeNull()
      await expect.poll(() => focusedRow()?.dataset.rowId).toBe('r6')

      // Диапазон выделения на индексах сдвигается вместе со строками.
      table.setCellSelection([
        {
          anchorRowIndex: 10,
          focusRowIndex: 12,
          anchorColumnId: 'name',
          focusColumnId: 'name',
        },
      ])
      transact(table, { add: [item('n2')], index: 2 })
      await expect
        .poll(() => table.store.get().cellSelection)
        .toEqual([
          expect.objectContaining({ anchorRowIndex: 11, focusRowIndex: 13 }),
        ])

      // Правка удалённой строки отменяется с причиной.
      const edited = table.getRowSource().byId('r20')
      startEditSession(table, edited as never, { id: 'name' })
      transact(table, { remove: ['r20'] })
      await expect
        .poll(() => onEditCancel.mock.calls.at(-1)?.[0])
        .toMatchObject({ rowId: 'r20', reason: 'unavailable' })
      await settleRowMotion()
    } finally {
      await screen.unmount()
    }

    // Прокрутка держит первую строку экрана при смене выше неё.
    resetServer()
    const scrolled = await render(<Grid onTable={t => (table = t)} />)
    try {
      await expect.poll(() => rowById('r5')).not.toBeNull()
      await scrollToIndex(300)
      const top = scroller().scrollTop
      const first = Math.floor(top / rowHeight())
      await expect.poll(() => rowById(`r${first}`)).not.toBeNull()
      const anchored = `r${first}`
      transact(table, { add: [item('n3'), item('n4')], index: 10 })
      await expect
        .poll(() => Math.abs(scroller().scrollTop - (top + 2 * rowHeight())))
        .toBeLessThanOrEqual(1)
      expect(indexOf(anchored)).toBe(
        Math.round(scroller().scrollTop / rowHeight()),
      )
      transact(table, { remove: ['r50', 'r51', 'r52'] })
      await expect
        .poll(() => Math.abs(scroller().scrollTop - (top - rowHeight())))
        .toBeLessThanOrEqual(1)
      expect(indexOf(anchored)).toBe(
        Math.round(scroller().scrollTop / rowHeight()),
      )

      // У начала списка прокрутка не держит: новая строка сверху видна.
      await scrollToIndex(0)
      transact(table, { add: [item('n5')], index: 0 })
      await expect.poll(() => indexOf('n5')).toBe(0)
      expect(scroller().scrollTop).toBe(0)
    } finally {
      await scrolled.unmount()
    }
  })

  test('RT9: строки ниже места изменения едут, добавленная вспыхивает «пришла», удалённая гаснет на месте раньше, чем строки закрывают щель; вне окна — без движения; при уменьшенном движении — без анимации', async () => {
    resetServer()
    let table!: TransactionTable
    const screen = await render(<Grid onTable={t => (table = t)} />)
    try {
      await expect.poll(() => rowById('r5')).not.toBeNull()

      transact(table, { add: [item('n1')], index: 3 })
      await expect.poll(() => indexOf('n1')).toBe(3)
      expect(rowById('n1')!.getAttribute('data-flash')).toBe('arrived')
      expect(slideOf('r3')).toBeDefined()
      await settleRowMotion()

      // Удаление: сперва призрак гаснет, строки ниже ждут его конца.
      transact(table, { remove: ['r5'] })
      await expect.poll(ghosts).toBeGreaterThan(0)
      const move = slideOf('r6')
      const timing = move!.effect!.getTiming()
      expect(Number(timing.delay)).toBeGreaterThan(0)
      expect(timing.delay).toBe(timing.duration)
      await settleRowMotion()
      await expect.poll(ghosts).toBe(0)

      // Изменение вне окна — без движения.
      transact(table, { add: [item('far')], index: 600 })
      // Транзакция применяется задачей после кадра.
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextFrame()
      expect(bodyAnimations()).toHaveLength(0)

      // Уменьшенное движение — без анимации и призраков.
      await pointer.reducedMotion(true)
      try {
        transact(table, { add: [item('n2')], index: 1 })
        await expect.poll(() => indexOf('n2')).toBe(1)
        transact(table, { remove: ['r1'] })
        await expect.poll(() => rowById('r1')).toBeNull()
        expect(bodyAnimations()).toHaveLength(0)
        expect(ghosts()).toBe(0)
      } finally {
        await pointer.reducedMotion(false)
      }
    } finally {
      await screen.unmount()
    }
  })
})
