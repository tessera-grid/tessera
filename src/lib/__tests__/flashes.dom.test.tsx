// @vitest-environment happy-dom
/**
 * Вспышка итога на цели (ADR 0134; OF1–OF3, OF5, OF13): API на таблице, отдельность от
 * подсветки приложения, перезапуск и замена, время жизни, перерисовка только цели.
 * Без смонтированного грида время — запасное: 300 + 500 мс у любого итога.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement, Profiler, type ReactNode } from 'react'
import { allColumnsWindow } from './columnWindow'
import { createRoot, type Root } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { definePlugin } from '../core/definePlugin'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { readFlashes } from '../core/flashes/flashFeature'
import {
  cellHighlightKey,
  columnHighlightKey,
  type HighlightTarget,
  readHighlights,
  rowHighlightKey,
} from '../core/highlights/highlightFeature'
import { useCreateTable } from '../core/useCreateTable'
import { BodyCell } from '../grid/BodyCell'
import { BodyRow } from '../grid/BodyRow'
import { columnSizing } from '../plugins/columnSizing'
import type { FlashOutcome } from '../../index'
import { rowCellsOf } from '../grid/rowCells'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  a: string
  b: string
}

const ROWS: Item[] = [
  { id: 'r1', a: 'A1', b: 'B1' },
  { id: 'r2', a: 'A2', b: 'B2' },
]
const columns = [
  { id: 'a', accessorKey: 'a', size: 100, cell: (i: any) => i.getValue() },
  { id: 'b', accessorKey: 'b', size: 100, cell: (i: any) => i.getValue() },
]

type Api = {
  flashOutcome: (
    target: HighlightTarget | readonly HighlightTarget[],
    outcome: FlashOutcome,
  ) => void
  highlight: (target: HighlightTarget, options?: { tone?: string }) => unknown
}

let captured: any
let root: Root | undefined

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
  vi.useRealTimers()
})

const Host = ({
  data = ROWS,
  cols = columns,
  plugins = [],
}: {
  data?: Item[]
  cols?: typeof columns
  plugins?: unknown[]
}) => {
  captured = useCreateTable({
    columns: cols as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
  } as never)
  return null
}

const mount = (props: Parameters<typeof Host>[0] = {}) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, props)))
}

const api = () => captured as Api
const flash = (
  target: HighlightTarget | readonly HighlightTarget[],
  outcome: FlashOutcome,
) => act(() => api().flashOutcome(target, outcome))
const entry = (key: string) => readFlashes(captured)[key]
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('Вспышка итога: API', () => {
  it('OF1: table.flashOutcome — ядровая фича без плагинов; цель — строка, ячейка, колонка или массив; итоги arrived, accepted, reverted; из setup плагина; тип из корня пакета', () => {
    mount()
    flash({ row: 'r1' }, 'arrived')
    flash({ cell: ['r2', 'b'] }, 'accepted')
    flash({ column: 'a' }, 'reverted')
    expect(entry(rowHighlightKey('r1'))?.outcome).toBe('arrived')
    expect(entry(cellHighlightKey('r2', 'b'))?.outcome).toBe('accepted')
    expect(entry(columnHighlightKey('a'))?.outcome).toBe('reverted')

    flash([{ row: 'r2' }, { column: 'b' }], 'accepted')
    expect(entry(rowHighlightKey('r2'))?.outcome).toBe('accepted')
    expect(entry(columnHighlightKey('b'))?.outcome).toBe('accepted')

    // Неизвестный итог ничего не ставит.
    const before = readFlashes(captured)
    act(() => api().flashOutcome({ row: 'r1' }, 'saved' as FlashOutcome))
    expect(readFlashes(captured)).toBe(before)

    act(() => root!.unmount())
    root = undefined
    let fromSetup: Api | undefined
    const probe = definePlugin()({
      id: 'flashProbe',
      setup: () => table => {
        fromSetup = table as Api
      },
    })
    mount({ plugins: [probe()] })
    const outcome: FlashOutcome = 'reverted'
    act(() => fromSetup!.flashOutcome({ row: 'r1' }, outcome))
    expect(entry(rowHighlightKey('r1'))?.outcome).toBe('reverted')
  })

  it('OF2: вспышка не попадает в срез highlights; подсветка приложения той же цели после вспышки видна как прежде', () => {
    mount()
    act(() => {
      api().highlight({ row: 'r1' }, { tone: 'warning' })
    })
    const highlights = readHighlights(captured)
    flash({ row: 'r1' }, 'accepted')
    flash({ column: 'a' }, 'reverted')
    expect(readHighlights(captured)).toBe(highlights)
    expect(Object.keys(readHighlights(captured))).toEqual([
      rowHighlightKey('r1'),
    ])

    advance(5000)
    expect(readFlashes(captured)).toEqual({})
    expect(readHighlights(captured)).toBe(highlights)
    expect(
      readHighlights(captured)[rowHighlightKey('r1')]?.list.at(-1)?.tone,
    ).toBe('warning')
  })

  it('OF3: повторная вспышка той же цели перезапускает время; другой итог той же цели заменяет прежний', () => {
    mount()
    const key = rowHighlightKey('r1')
    flash({ row: 'r1' }, 'arrived')
    const first = entry(key)!
    advance(200)
    flash({ row: 'r1' }, 'arrived')
    expect(entry(key)!.id).not.toBe(first.id)
    // Без перезапуска удержание кончилось бы на 300 мс.
    advance(250)
    expect(entry(key)!.out).toBeUndefined()
    advance(100)
    expect(entry(key)!.out).toBe(true)

    // Угасающую вспышку новая возвращает к удержанию.
    flash({ row: 'r1' }, 'accepted')
    expect(entry(key)).toMatchObject({ outcome: 'accepted' })
    expect(entry(key)!.out).toBeUndefined()
    flash({ row: 'r1' }, 'reverted')
    expect(entry(key)!.outcome).toBe('reverted')
    expect(Object.keys(readFlashes(captured))).toEqual([key])
  })
})

describe('Вспышка итога: время жизни', () => {
  it('OF5: удержание и угасание снимают отметку; цели вне data и columns теряют её; один таймер на таблицу; срез не растёт', () => {
    mount()
    const idle = vi.getTimerCount()
    flash({ row: 'r1' }, 'arrived')
    advance(100)
    flash({ cell: ['r1', 'a'] }, 'accepted')
    advance(100)
    flash({ row: 'r2' }, 'reverted')
    expect(vi.getTimerCount() - idle).toBe(1)

    // arrived: удержание 300, угасание 500.
    advance(100)
    expect(entry(rowHighlightKey('r1'))!.out).toBe(true)
    expect(entry(cellHighlightKey('r1', 'a'))!.out).toBeUndefined()
    advance(500)
    expect(entry(rowHighlightKey('r1'))).toBeUndefined()
    expect(entry(cellHighlightKey('r1', 'a'))!.out).toBe(true)
    // reverted — то же время, что у остальных итогов.
    expect(entry(rowHighlightKey('r2'))!.out).toBe(true)
    expect(vi.getTimerCount() - idle).toBe(1)
    advance(200)
    expect(readFlashes(captured)).toEqual({})
    expect(vi.getTimerCount() - idle).toBe(0)

    flash([{ row: 'r2' }, { cell: ['r1', 'b'] }, { column: 'a' }], 'reverted')
    flash({ row: 'r1' }, 'accepted')
    mount({ data: [ROWS[0]!], cols: [columns[0]!] })
    expect(Object.keys(readFlashes(captured)).sort()).toEqual(
      [columnHighlightKey('a'), rowHighlightKey('r1')].sort(),
    )
    advance(5000)
    expect(readFlashes(captured)).toEqual({})
    expect(vi.getTimerCount() - idle).toBe(0)
  })
})

/* ------------------------------ OF13: перерисовки ------------------------------ */

const virtualRow = (index: number) =>
  ({
    index,
    start: index * 40,
    size: 40,
    end: index * 40 + 40,
    key: index,
    lane: 0,
  }) as any

const makeTable = () => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: ROWS,
    columns,
    getRowId: (row: Item) => row.id,
    ...folded.options,
  } as never) as any
}

describe('Вспышка итога: перерисовка только цели', () => {
  it('OF13: вспышка строки перерисовывает только её; ячейки — только эту ячейку; колонки — только её ячейки', () => {
    const table = makeTable()
    const renders: string[] = []
    const track = (id: string, node: ReactNode) =>
      createElement(
        Profiler,
        { id, onRender: (name: string) => renders.push(name), key: id },
        node,
      )
    const rows = table.getRowModel().rows
    const rowsRoot = createRoot(document.createElement('div'))
    const cellsRoot = createRoot(document.createElement('div'))
    act(() => {
      rowsRoot.render(
        rows.map((row: any, index: number) =>
          track(
            `row:${row.id}`,
            <BodyRow
              row={row}
              cells={rowCellsOf(row.table, row)}
              virtualRow={virtualRow(index)}
              virtualColumns={allColumnsWindow(table.getAllLeafColumns())}
              leafColumns={table.getAllLeafColumns()}
              ariaRowIndexBase={1}
            />,
          ),
        ),
      )
      cellsRoot.render(
        rows.flatMap((row: any, index: number) =>
          row
            .getVisibleCells()
            .map((cell: any) =>
              track(
                `cell:${row.id}:${cell.column.id}`,
                <BodyCell cell={cell} rowIndex={index} />,
              ),
            ),
        ),
      )
    })

    const after = (run: () => void) => {
      renders.length = 0
      act(run)
      return [...new Set(renders)].sort()
    }

    expect(after(() => table.flashOutcome({ row: 'r1' }, 'arrived'))).toEqual([
      'row:r1',
    ])
    expect(
      after(() => table.flashOutcome({ cell: ['r2', 'b'] }, 'accepted')),
    ).toEqual(['cell:r2:b', 'row:r2'])
    // Угасание — тоже только цели: строка r1 и ячейка r2:b, поставленные в один момент.
    expect(after(() => vi.advanceTimersByTime(300))).toEqual([
      'cell:r2:b',
      'row:r1',
      'row:r2',
    ])
    expect(
      after(() => table.flashOutcome({ column: 'a' }, 'reverted')),
    ).toEqual(['cell:r1:a', 'cell:r2:a', 'row:r1', 'row:r2'])

    act(() => {
      rowsRoot.unmount()
      cellsRoot.unmount()
    })
  })
})

describe('Вспышка итога: токены темы', () => {
  it('OF19: токены --tsr-comp-flash-* — в трёх уровнях темы; токенов --tsr-comp-row-arrival-*, --tsr-comp-cell-saved-* и --tsr-comp-highlight-arrival-bg в теме нет', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/lib/ui/theme/theme.css'),
      'utf8',
    )
    const declared = new Map(
      [...css.matchAll(/(--tsr-comp-flash-[a-z-]+)\s*:\s*([^;]+);/g)].map(
        match => [match[1]!, match[2]!],
      ),
    )
    // Итоги смены значения (ADR 0221) — свои токены рядом, их проверяет VC12.
    expect([...declared.keys()]).toEqual(
      expect.arrayContaining([
        '--tsr-comp-flash-accepted-bg',
        '--tsr-comp-flash-arrived-bg',
        '--tsr-comp-flash-duration',
        '--tsr-comp-flash-fade-duration',
        '--tsr-comp-flash-reverted-bg',
      ]),
    )
    // Компонентный уровень ссылается на системный и компонентный, не на опорный.
    const refs = [...declared.values()].flatMap(value =>
      [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(match => match[1]!),
    )
    expect(refs.length).toBeGreaterThan(0)
    expect(
      refs.filter(
        ref => !ref.startsWith('--tsr-sys-') && !ref.startsWith('--tsr-comp-'),
      ),
    ).toEqual([])
    expect(
      css.match(
        /--tsr-comp-(row-arrival-[a-z-]+|cell-saved-[a-z-]+|highlight-arrival-bg)/g,
      ),
    ).toBeNull()
  })
})
