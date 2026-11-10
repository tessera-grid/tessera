import { render } from 'vitest-browser-react'
import { commands } from 'vitest/browser'
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { RowTransaction } from '../../../core/rowTransactions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { getScroller, renderGrid, settleRowMotion } from '../helpers'

// Полоса окна (ADR 0202): кадров с пустым местом у края нет ни при спокойной и быстрой
// прокрутке, ни при прыжке (WB3), ни после смены списка строк (WB5).

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}
beforeAll(() => motion.reducedMotion(true))
afterAll(() => motion.reducedMotion(false))

const nextFrame = () => new Promise(requestAnimationFrame)

/** Непокрытое строками место видимой части тела, px. */
const uncoveredY = () => {
  const scroller = getScroller()
  const box = scroller.getBoundingClientRect()
  const head = scroller.querySelector('.data-grid__head')
  const top = head ? head.getBoundingClientRect().bottom : box.top
  const bottom = box.top + scroller.clientHeight
  const rows = [
    ...scroller.querySelectorAll<HTMLElement>(
      '.data-grid__body > [data-index]',
    ),
  ]
    .map(row => row.getBoundingClientRect())
    .sort((a, b) => a.top - b.top)
  const atEnd =
    scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1
  let cursor = top
  let gap = 0
  for (const row of rows) {
    if (row.bottom <= cursor) continue
    if (row.top > cursor + 1) gap += Math.min(row.top, bottom) - cursor
    cursor = Math.max(cursor, row.bottom)
    if (cursor >= bottom) break
  }
  if (cursor < bottom - 1 && !atEnd) gap += bottom - cursor
  return Math.max(0, Math.round(gap))
}

/** Непокрытое ячейками место строк видимой части по ширине, px — худшая строка. */
const uncoveredX = () => {
  const scroller = getScroller()
  const box = scroller.getBoundingClientRect()
  const left = box.left
  const right = box.left + scroller.clientWidth
  const atEnd =
    scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1
  let worst = 0
  for (const row of scroller.querySelectorAll<HTMLElement>(
    '.data-grid__body > [data-index]',
  )) {
    const r = row.getBoundingClientRect()
    if (r.bottom < box.top || r.top > box.top + scroller.clientHeight) continue
    const cells = [
      ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
    ]
      .map(cell => cell.getBoundingClientRect())
      .sort((a, b) => a.left - b.left)
    let cursor = left
    let gap = 0
    for (const cell of cells) {
      if (cell.right <= cursor) continue
      if (cell.left > cursor + 1) gap += Math.min(cell.left, right) - cursor
      cursor = Math.max(cursor, cell.right)
      if (cursor >= right) break
    }
    if (cursor < right - 1 && !atEnd) gap += right - cursor
    worst = Math.max(worst, gap)
  }
  return Math.round(worst)
}

/** Прокрутка по кадрам с шагом `step`, px: худшее непокрытое место по обеим осям. */
const scrollBy = async (axis: 'y' | 'x', step: number, frames: number) => {
  const scroller = getScroller()
  let worst = 0
  for (let i = 0; i < frames; i++) {
    if (axis === 'y') scroller.scrollTop += step
    else scroller.scrollLeft += step
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
    worst = Math.max(worst, uncoveredY(), uncoveredX())
  }
  return worst
}

const mount = async () => {
  renderGrid({ columnCount: 100, dataCount: 1000 })
  await expect
    .poll(
      () => document.querySelectorAll('.data-grid__body > [data-index]').length,
    )
    .toBeGreaterThan(5)
  await nextFrame()
}

describe('Полоса окна (ADR 0202)', () => {
  test('WB3: полоса пополняется вне события прокрутки, пока видимое внутри отрисованного окна, и в событии — когда вышло; кадров с пустым местом у края нет при спокойной и быстрой прокрутке и при прыжке ползунком и scrollTop', async () => {
    await mount()
    const scroller = getScroller()
    // Спокойная прокрутка — ниже порога быстрой (ADR 0008).
    expect(await scrollBy('y', 8, 60)).toBe(0)
    expect(await scrollBy('x', 25, 60)).toBe(0)
    // Быстрая прокрутка — выше порога.
    expect(await scrollBy('y', 90, 30)).toBe(0)
    expect(await scrollBy('x', 200, 30)).toBe(0)
    // Прыжок: видимое далеко за полосой — окно в том же кадре.
    scroller.scrollTop = scroller.scrollHeight / 2
    await nextFrame()
    expect(uncoveredY()).toBe(0)
    expect(uncoveredX()).toBe(0)
    scroller.scrollLeft = scroller.scrollWidth / 3
    await nextFrame()
    expect(uncoveredY()).toBe(0)
    expect(uncoveredX()).toBe(0)
    // Назад — разворот полосы без пустых мест.
    expect(await scrollBy('y', -8, 40)).toBe(0)
    expect(await scrollBy('x', -25, 40)).toBe(0)
  })
})

interface Item {
  id: string
  name: string
}
const ROWS: Item[] = Array.from({ length: 1000 }, (_, k) => ({
  id: `r${k}`,
  name: `N${k}`,
}))
interface TransactionTable {
  applyRowTransaction: (transaction: RowTransaction<Item>) => unknown
}

const TransactionGrid = ({
  onTable,
}: {
  onTable: (table: TransactionTable) => void
}) => {
  const [data, setData] = useState(ROWS)
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data,
    onDataChange: setData,
  })
  onTable(table as unknown as TransactionTable)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Полоса окна после смены списка (ADR 0202)', () => {
  test('WB5: после смены списка строк — раскрытия и сворачивания ветки, клиентской транзакции — видимая часть без пустых мест в первом кадре после смены', async () => {
    renderGrid({
      dataCount: 300,
      dataNesting: 'nested',
      enableRowExpanding: true,
    })
    await expect
      .poll(() => document.querySelectorAll('.row-expand-button').length)
      .toBeGreaterThan(0)
    const scroller = getScroller()
    // Прокрутка вниз: полоса впереди, позади одна строка.
    await scrollBy('y', 8, 30)
    const toggle = () =>
      [...document.querySelectorAll<HTMLElement>('.row-expand-button')].find(
        button => {
          const box = button.getBoundingClientRect()
          const area = scroller.getBoundingClientRect()
          return box.top > area.top + 60 && box.bottom < area.bottom
        },
      )!
    toggle().click()
    await nextFrame()
    expect(uncoveredY()).toBe(0)
    await settleRowMotion()
    toggle().click()
    await nextFrame()
    expect(uncoveredY()).toBe(0)
    await settleRowMotion()

    let table!: TransactionTable
    const screen = await render(<TransactionGrid onTable={t => (table = t)} />)
    try {
      const grid = () =>
        document.querySelectorAll<HTMLElement>('.data-grid__container')[1]!
      await expect
        .poll(() => grid().querySelectorAll('[data-index]').length)
        .toBeGreaterThan(5)
      const rowHeight = Number.parseFloat(
        getComputedStyle(grid()).getPropertyValue('--tsr-comp-row-height'),
      )
      grid().scrollTop = 300 * rowHeight
      await nextFrame()
      await nextFrame()
      // Вставка выше экрана, удаление на экране, вставка на экране.
      // Транзакция дошла, когда приложение закоммитило новый data: число строк сменилось.
      const rowCount = () =>
        grid()
          .closest('[data-tsr-grid]')
          ?.querySelector('[aria-rowcount]')
          ?.getAttribute('aria-rowcount')
      const before = rowCount()
      table.applyRowTransaction({ add: [{ id: 'a', name: 'A' }], index: 10 })
      await expect.poll(rowCount).not.toBe(before)
      table.applyRowTransaction({ remove: ['r305', 'r306'] })
      // Следующая транзакция — после коммита этой: иначе она возьмёт прежний data.
      await expect
        .poll(() => grid().querySelector('[data-row-id="r305"]'))
        .toBeNull()
      table.applyRowTransaction({
        add: [
          { id: 'b', name: 'B' },
          { id: 'c', name: 'C' },
        ],
        index: 304,
      })
      // Смена списка — коммит нового data приложения.
      await expect
        .poll(() => grid().querySelector('[data-row-id="b"]'))
        .not.toBeNull()
      const box = grid().getBoundingClientRect()
      const rows = [...grid().querySelectorAll<HTMLElement>('[data-index]')]
        .map(row => row.getBoundingClientRect())
        .filter(r => r.bottom > box.top && r.top < box.bottom)
        .sort((a, b) => a.top - b.top)
      for (let k = 1; k < rows.length; k++) {
        expect(rows[k]!.top - rows[k - 1]!.bottom).toBeLessThanOrEqual(1)
      }
      expect(rows.at(-1)!.bottom).toBeGreaterThanOrEqual(
        box.top + grid().clientHeight - 1,
      )
      // На местах — новые строки, а не прежние.
      const shown = (id: string) => {
        const row = grid().querySelector(`[data-row-id="${id}"]`)
        if (!row) return false
        const r = row.getBoundingClientRect()
        return r.bottom > box.top && r.top < box.bottom
      }
      expect(shown('b') && shown('c')).toBe(true)
      expect(grid().querySelector('[data-row-id="r305"]')).toBeNull()

      // Список короче полосы: видимое кончается за 12 строк до конца, полоса заходит в
      // хвост, удалены последние 8 строк — видимое на месте.
      const count = grid().scrollHeight / rowHeight
      grid().scrollTop = (count - 12) * rowHeight - grid().clientHeight
      await nextFrame()
      await nextFrame()
      expect(grid().querySelector('[data-row-id="r995"]')).not.toBeNull()
      table.applyRowTransaction({
        remove: ROWS.slice(-8).map(row => row.id),
      })
      await expect
        .poll(() => grid().querySelector('[data-row-id="r995"]'))
        .toBeNull()
      const end = grid().getBoundingClientRect()
      const tail = [...grid().querySelectorAll<HTMLElement>('[data-index]')]
        .map(row => row.getBoundingClientRect())
        .filter(r => r.bottom > end.top && r.top < end.bottom)
        .sort((a, b) => a.top - b.top)
      expect(tail.length).toBeGreaterThanOrEqual(
        Math.floor(grid().clientHeight / rowHeight) - 1,
      )
      for (let k = 1; k < tail.length; k++) {
        expect(tail[k]!.top - tail[k - 1]!.bottom).toBeLessThanOrEqual(1)
      }
    } finally {
      await screen.unmount()
    }
  })
})

const WIDE_COLUMNS = Array.from({ length: 60 }, (_, k) => ({
  id: `c${k}`,
  header: `C${k}`,
  size: 120,
  accessorFn: (row: Item) => `${row.name}·${k}`,
}))

const WideTransactionGrid = ({
  onTable,
}: {
  onTable: (table: TransactionTable) => void
}) => {
  const [data, setData] = useState(ROWS)
  const table = useCreateTable({
    columns: WIDE_COLUMNS as never,
    data,
    onDataChange: setData,
  })
  onTable(table as unknown as TransactionTable)
  return (
    <div style={{ width: 800, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Покой и рост полосы (ADR 0202, §1а)', () => {
  test('WB12: в кадре смены списка строк окно строк и колонок — видимое и симметричный запас; затем полоса дорастает без прокрутки', async () => {
    let table!: TransactionTable
    const screen = await render(
      <WideTransactionGrid onTable={t => (table = t)} />,
    )
    try {
      const grid = () =>
        document.querySelector<HTMLElement>('.data-grid__container')!
      const size = () => {
        const rows = grid().querySelectorAll<HTMLElement>('[data-index]')
        return {
          rows: rows.length,
          cells: rows[0]!.querySelectorAll('.data-grid__body-cell').length,
        }
      }
      const rowCount = () =>
        grid()
          .closest('[data-tsr-grid]')
          ?.querySelector('[aria-rowcount]')
          ?.getAttribute('aria-rowcount')
      await expect.poll(() => size().rows).toBeGreaterThan(5)
      // Полоса после монтирования: рост в следующем кадре, затем окно стоит.
      let grown = size()
      await expect
        .poll(async () => {
          const before = grown
          await nextFrame()
          await nextFrame()
          grown = size()
          return grown.rows === before.rows && grown.cells === before.cells
        })
        .toBe(true)

      // Окно в кадре коммита смены списка — до кадра, в котором полоса дорастает.
      const before = rowCount()
      let atChange: { rows: number; cells: number } | undefined
      const observer = new MutationObserver(() => {
        if (atChange === undefined && rowCount() !== before) atChange = size()
      })
      observer.observe(grid().closest('[data-tsr-grid]')!, {
        attributes: true,
        subtree: true,
        attributeFilter: ['aria-rowcount'],
      })
      table.applyRowTransaction({ add: [{ id: 'a', name: 'A' }], index: 500 })
      await expect.poll(() => atChange).toBeDefined()
      observer.disconnect()
      expect(atChange!.rows).toBeLessThan(grown.rows)
      expect(atChange!.cells).toBeLessThan(grown.cells)
      // Без прокрутки полоса дорастает до прежней.
      await expect.poll(size).toEqual(grown)
      expect(grid().scrollTop).toBe(0)
      expect(grid().scrollLeft).toBe(0)
    } finally {
      await screen.unmount()
    }
  })
})
