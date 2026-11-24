import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'

// Первый рендер и смена всего окна по кускам (ADR 0203): рамка, затем грид; строки окна —
// порциями (WS1); прыжок — видимые сразу (WS2).

interface Item {
  id: string
  [key: string]: string
}
const COLUMNS = Array.from({ length: 60 }, (_, c) => ({
  id: `c${c}`,
  accessorKey: `c${c}`,
  header: `C${c}`,
  size: 100,
}))
const ROWS: Item[] = Array.from({ length: 1000 }, (_, k) => {
  const row: Item = { id: `r${k}` }
  for (let c = 0; c < COLUMNS.length; c++) row[`c${c}`] = `${k}:${c}`
  return row
})

const Grid = ({
  role,
  incremental,
}: {
  role?: 'table' | 'grid'
  incremental?: boolean
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    enableKeyboardNavigation: role === 'grid',
    enableIncrementalRender: incremental,
  })
  return (
    <div style={{ width: 800, height: 500 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

let root: Root | undefined
let host: HTMLElement | undefined
afterEach(() => {
  flushSync(() => root?.unmount())
  host?.remove()
  root = undefined
})
const mount = (role?: 'table' | 'grid', incremental?: boolean) => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  flushSync(() => root!.render(<Grid role={role} incremental={incremental} />))
}

const nextFrame = () => new Promise(requestAnimationFrame)
const scroller = () => host!.querySelector<HTMLElement>('.data-grid__container')
const indexes = () =>
  [...host!.querySelectorAll<HTMLElement>('.data-grid__body-row')].map(row =>
    Number(row.dataset.index),
  )
/** Номера строк по кадрам до конца порций и десяти кадров без роста запаса. */
const framesUntilSettled = async () => {
  const frames: number[][] = []
  const pending = () => host!.querySelector('[data-portions-pending]')
  let stable = 0
  for (let i = 0; i < 300 && stable < 10; i++) {
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
    const now = indexes()
    stable =
      now.length > 0 && !pending() && now.length === frames.at(-1)?.length
        ? stable + 1
        : 0
    frames.push(now)
  }
  expect(stable).toBe(10)
  return frames
}
const visibleIndexes = () => {
  const area = scroller()!.getBoundingClientRect()
  const head = scroller()!.querySelector('.data-grid__head')
  const top = head ? head.getBoundingClientRect().bottom : area.top
  return [...host!.querySelectorAll<HTMLElement>('.data-grid__body-row')]
    .filter(row => {
      const r = row.getBoundingClientRect()
      return r.bottom > top + 1 && r.top < area.bottom - 1
    })
    .map(row => Number(row.dataset.index))
    .sort((a, b) => a - b)
}

describe('Первый рендер и смена всего окна (ADR 0203)', () => {
  test('WS1: монтирование на клиенте — первый кадр пустая рамка размера грида, затем грид; строки окна — порциями: первая — видимые сверху вниз, остальные — в следующих кадрах', async () => {
    mount()
    const frame = host!.querySelector<HTMLElement>('[data-tsr-grid]')!
    expect(frame).not.toBeNull()
    expect(scroller()).toBeNull()
    expect(frame.getBoundingClientRect().height).toBe(500)
    const frames = (await framesUntilSettled()).filter(f => f.length > 0)
    const first = frames[0]!
    const last = frames.at(-1)!
    expect(first.length).toBeLessThan(last.length)
    // Первая порция — от верха видимой части подряд.
    expect([...first].sort((a, b) => a - b)).toEqual(first.map((_, k) => k))
    // В конце нарезки видимая часть — целиком.
    const visible = visibleIndexes()
    expect(visible.length).toBeGreaterThan(5)
    expect(visible.every(index => last.includes(index))).toBe(true)
  })

  test('WS2: прыжок за полосу — видимые строки в кадре прыжка, запас окна порциями; строка активной ячейки — в первой порции', async () => {
    mount('grid')
    await framesUntilSettled()
    const grid = scroller()!
    const rowHeight = host!
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    grid.scrollTop = 500 * rowHeight
    await nextFrame()
    // Кадр прыжка: видимая часть уже из строк нового места.
    const visible = visibleIndexes()
    expect(visible.length).toBeGreaterThan(5)
    expect(visible[0]).toBeGreaterThanOrEqual(498)
    for (let k = 1; k < visible.length; k++) {
      expect(visible[k]).toBe(visible[k - 1]! + 1)
    }
    const area = grid.getBoundingClientRect()
    const lowest = Math.max(
      ...[...host!.querySelectorAll('.data-grid__body-row')].map(
        row => row.getBoundingClientRect().bottom,
      ),
    )
    expect(lowest).toBeGreaterThanOrEqual(area.bottom - 1)
    const settled = await framesUntilSettled()
    expect(settled.at(-1)!.length).toBeGreaterThan(visible.length)

    // Активная ячейка далеко: её строка — в первой порции прыжка обратно.
    const cell = host!.querySelector<HTMLElement>(
      `.data-grid__body-row[data-index="${visible[2]}"] .data-grid__body-cell`,
    )!
    cell.focus()
    cell.click()
    await framesUntilSettled()
    grid.scrollTop = 100 * rowHeight
    await nextFrame()
    expect(indexes()).toContain(visible[2])
  })

  test('WS9: опция ядра enableIncrementalRender по умолчанию включена; выключенная — монтирование и прыжок одним проходом: без рамки, переходов и порций', async () => {
    // По умолчанию — рамка первого рендера.
    mount()
    expect(host!.querySelector('[data-tsr-grid-pending]')).not.toBeNull()
    await framesUntilSettled()
    flushSync(() => root?.unmount())
    host?.remove()

    // Выключено: грид в том же коммите, окно — сразу целиком, порций нет.
    mount(undefined, false)
    expect(host!.querySelector('[data-tsr-grid-pending]')).toBeNull()
    expect(scroller()).not.toBeNull()
    let pending = false
    const frames: number[][] = []
    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
      pending ||= !!host!.querySelector('[data-portions-pending]')
      frames.push(indexes())
    }
    const drawn = frames.filter(f => f.length > 0)
    expect(pending).toBe(false)
    expect(drawn[0]!.length).toBe(drawn.at(-1)!.length)
    const rowHeight = host!
      .querySelector('.data-grid__body-row')!
      .getBoundingClientRect().height
    scroller()!.scrollTop = 500 * rowHeight
    await nextFrame()
    expect(host!.querySelector('[data-portions-pending]')).toBeNull()
  })
})
const ScrollOnMount = ({
  onResult,
  grid = true,
}: {
  onResult: (shown: Promise<boolean>) => void
  grid?: boolean
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
  })
  // Один вызов, как в эффекте монтирования: таблица — новая копия на каждую смену состояния.
  const called = useRef(false)
  useEffect(() => {
    if (called.current) return
    called.current = true
    onResult(
      (
        table as unknown as {
          scrollToRow: (id: string) => Promise<boolean>
        }
      ).scrollToRow('r500'),
    )
  }, [table, onResult])
  return (
    <div style={{ width: 800, height: 500 }}>
      {grid && <DataGrid table={table as never} />}
    </div>
  )
}

describe('Готовность грида после монтирования (ADR 0203, §6)', () => {
  test('WS10: scrollToRow из эффекта монтирования приложения ждёт грида за рамкой первого рендера и прокручивает к строке; без грида — false сразу', async () => {
    let shown: Promise<boolean> | undefined
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    flushSync(() =>
      root!.render(<ScrollOnMount onResult={result => (shown ??= result)} />),
    )
    // Эффект приложения прошёл, пока на месте грида — рамка.
    expect(shown).toBeDefined()
    expect(host.querySelector('[data-tsr-grid-pending]')).not.toBeNull()
    expect(await shown).toBe(true)
    await expect
      .poll(() => host!.querySelector('[data-row-id="r500"]'))
      .not.toBeNull()
    flushSync(() => root?.unmount())

    let alone: Promise<boolean> | undefined
    root = createRoot(host)
    flushSync(() =>
      root!.render(
        <ScrollOnMount grid={false} onResult={result => (alone ??= result)} />,
      ),
    )
    expect(await alone).toBe(false)
  })

  test('WS11: пока грид за рамкой первого рендера, корень несёт data-tsr-grid-pending, пока режет окно — тело несёт data-portions-pending; после отрисовки — ни того, ни другого', async () => {
    mount()
    expect(host!.querySelector('[data-tsr-grid-pending]')).not.toBeNull()
    let sawPortions = false
    for (let i = 0; i < 300; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
      sawPortions ||= !!host!.querySelector('[data-portions-pending]')
      if (
        sawPortions &&
        !host!.querySelector('[data-portions-pending], [data-tsr-grid-pending]')
      )
        break
    }
    expect(sawPortions).toBe(true)
    expect(host!.querySelector('[data-tsr-grid-pending]')).toBeNull()
    expect(host!.querySelector('[data-portions-pending]')).toBeNull()
    expect(scroller()).not.toBeNull()
  })
})
