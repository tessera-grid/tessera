// @vitest-environment happy-dom
/**
 * Итог пункта меню на цели (ADR 0152; TG1, TG8, TG12): поле `target` и цель по умолчанию,
 * цель «диапазон» в текущем порядке, диапазоны на индексах следуют за списком строк.
 * Запуск: npx vitest run --config vitest.node.config.ts menuTarget
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  actionTargets,
  defaultActionTarget,
  runMenuAction,
} from '../core/headerActions/actionStatus'
import { readActionStatus } from '../core/headerActions/actionStatusFeature'
import type { MenuAction } from '../core/headerActions/types'
import { readFlashes, rangeFlashAt } from '../core/flashes/flashFeature'
import { followIndexRanges } from '../core/highlights/followRanges'
import {
  type FlashTarget,
  type Highlights,
  readHighlights,
} from '../core/highlights/highlightFeature'
import {
  rangeHighlightKey,
  type RangeTarget,
} from '../core/highlights/targetRanges'
import type { RowListChange } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import type { RangeTarget as PublicRangeTarget } from '../../index'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const item = (id: string): Item => ({ id, a: id, b: id, c: id })
const ROWS = ['r1', 'r2', 'r3', 'r4'].map(item)
const columns = ['a', 'b', 'c'].map(id => ({
  id,
  accessorKey: id,
  size: 100,
}))

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
  vi.useRealTimers()
})

const Host = ({ data }: { data: Item[] }) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: [],
  } as never)
  return null
}

const mount = (data: Item[] = ROWS) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, { data })))
}

const action = (target?: MenuAction['target'], id = 'archive'): MenuAction => ({
  id,
  icon: () => null,
  label: () => 'Archive',
  onSelect: () => new Promise(() => {}),
  target,
})

/** Диапазон углами строк — `id` или индексами — и колонками (ADR 0180, §6). */
const range = (
  rows: readonly [string, string] | { indexes: readonly [number, number] },
  cols: readonly [string, string],
): RangeTarget => ({
  range: {
    ...('indexes' in rows
      ? { anchorRowIndex: rows.indexes[0], focusRowIndex: rows.indexes[1] }
      : { anchorRowId: rows[0], focusRowId: rows[1] }),
    anchorColumnId: cols[0],
    focusColumnId: cols[1],
  },
})

describe('Итог пункта меню на цели: поле target', () => {
  it('TG1: target(ctx, defaultTarget) — поле действия меню в публичных типах; его принимают кебабы, инлайн-кнопки и контекстное меню; у контекстного меню defaultTarget — цель по умолчанию, у остальных — undefined', () => {
    mount()
    const table = captured
    const row = { id: 'r2' }
    const column = { id: 'b' }
    const menuCtx = {
      table,
      row,
      column,
      selection: {
        count: 1,
        isSingle: true,
        isMultiple: false,
        isInSelection: true,
      },
    }
    const kebabCtx = { table, row, column }
    const headerCtx = { table, header: { column } }

    expect(defaultActionTarget(menuCtx)).toEqual({ cell: ['r2', 'b'] })
    expect(defaultActionTarget(kebabCtx)).toBeUndefined()
    expect(defaultActionTarget(headerCtx)).toBeUndefined()

    const seen: unknown[] = []
    const custom = action((ctx, fallback) => {
      seen.push(fallback)
      return { row: (ctx as { row: { id: string } }).row.id }
    })
    expect(actionTargets(custom, menuCtx)).toEqual([{ row: 'r2' }])
    expect(actionTargets(custom, kebabCtx)).toEqual([{ row: 'r2' }])
    expect(seen).toEqual([{ cell: ['r2', 'b'] }, undefined])
    expect(
      actionTargets(
        action(() => false),
        menuCtx,
      ),
    ).toEqual([])
    expect(actionTargets(action(), kebabCtx)).toEqual([])

    // Кебаб, инлайн-кнопка и контекстное меню идут через runMenuAction: цель — в ожидании.
    act(() => runMenuAction(custom, kebabCtx))
    act(() =>
      runMenuAction(action(undefined, 'delete'), menuCtx, undefined, {
        keepError: false,
      }),
    )
    const targets = Object.values(readActionStatus(table)).map(
      entry => entry.target,
    )
    expect(targets).toEqual([[{ row: 'r2' }], [{ cell: ['r2', 'b'] }]])

    const typed: PublicRangeTarget = range(['r1', 'r2'], ['a', 'b'])
    const field: MenuAction['target'] = () => typed as FlashTarget
    expect(field).toBeTypeOf('function')
  })
})

describe('Итог пункта меню на цели: диапазон', () => {
  it('TG8: цель range — ячейки между углами по текущему порядку строк и видимых колонок, одна запись при любом размере; после смены порядка — между теми же углами; угол, ушедший из данных, снимает запись', () => {
    vi.useFakeTimers()
    mount()
    const target = range(['r2', 'r3'], ['a', 'b'])
    act(() => captured.flashOutcome(target, 'reverted'))
    const flashes = readFlashes(captured)
    expect(Object.keys(flashes)).toEqual([rangeHighlightKey(target)])

    const inside = (rowId: string, columnId: string) =>
      rangeFlashAt(captured, readFlashes(captured), rowId, columnId) !==
      undefined
    expect([inside('r2', 'a'), inside('r3', 'b'), inside('r2', 'b')]).toEqual([
      true,
      true,
      true,
    ])
    expect([inside('r1', 'a'), inside('r4', 'a'), inside('r2', 'c')]).toEqual([
      false,
      false,
      false,
    ])

    // Новый порядок: r2 и r3 — по краям, между ними — r1 и r4.
    mount(['r2', 'r1', 'r4', 'r3'].map(item))
    expect([inside('r1', 'a'), inside('r4', 'b'), inside('r2', 'c')]).toEqual([
      true,
      true,
      false,
    ])

    act(() =>
      captured.highlight(range(['r1', 'r4'], ['a', 'c']), { tone: 'danger' }),
    )
    expect(Object.keys(readHighlights(captured))).toHaveLength(1)

    mount(['r1', 'r2', 'r4'].map(item))
    expect(readFlashes(captured)).toEqual({})
    expect(Object.keys(readHighlights(captured))).toHaveLength(1)
    mount(['r2', 'r4'].map(item))
    expect(readHighlights(captured)).toEqual({})
  })
})

/** Источник серверной модели: смены списка задаёт тест. */
const fakeServerTable = (highlights: Highlights) => {
  const listeners = new Set<() => void>()
  let state: Record<string, unknown> = { sorting: [] }
  let epoch = 0
  let version = 0
  const log: RowListChange[][] = []
  let slice = highlights
  let flashes = {}
  const table = {
    store: {
      get: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return { unsubscribe: () => listeners.delete(listener) }
      },
    },
    atoms: {
      highlights: { get: () => slice },
      flashes: { get: () => flashes },
    },
    setHighlights: (updater: (prev: Highlights) => Highlights) => {
      slice = updater(slice)
    },
    setFlashes: (updater: (prev: object) => object) => {
      flashes = updater(flashes)
    },
    getRowSource: () => ({
      keyByIndex: true,
      epoch: () => epoch,
      version: () => version,
      changesSince: (from: number) => log.slice(from),
      indexOf: () => -1,
    }),
  }
  const emit = () => listeners.forEach(listener => listener())
  return {
    table,
    slice: () => slice,
    change: (batch: RowListChange[]) => {
      log.push(batch)
      version++
      emit()
    },
    query: () => {
      state = { sorting: [{ id: 'a', desc: false }] }
      emit()
    },
    newEpoch: () => {
      epoch++
      emit()
    },
  }
}

describe('Итог пункта меню на цели: серверная модель', () => {
  it('TG12: в серверной модели диапазон — индексы: новая выборка снимает подсветку диапазона, раскрытие и приход строк выше сдвигают её, между углами — снимают', () => {
    const at = (from: number, to: number) =>
      range({ indexes: [from, to] }, ['a', 'b'])
    const state = { list: [{ id: 1, key: 'default', tone: 'danger' }] }
    const keyOf = (from: number, to: number) => rangeHighlightKey(at(from, to))

    const server = fakeServerTable({ [keyOf(10, 12)]: state })
    const stop = followIndexRanges(server.table)
    server.change([]) // первая раскладка
    server.change([{ at: 2, delta: 5 }])
    expect(Object.keys(server.slice())).toEqual([keyOf(15, 17)])
    server.change([{ at: 40, delta: 3 }])
    expect(Object.keys(server.slice())).toEqual([keyOf(15, 17)])
    server.change([{ at: 16, delta: 2 }])
    expect(server.slice()).toEqual({})
    stop()

    for (const reset of ['query', 'newEpoch'] as const) {
      const again = fakeServerTable({ [keyOf(3, 4)]: state })
      const done = followIndexRanges(again.table)
      again.change([])
      again[reset]()
      expect(again.slice()).toEqual({})
      done()
    }

    // Диапазон по id в серверной модели индексами не сдвигается.
    const byId = rangeHighlightKey(range(['x', 'y'], ['a', 'b']))
    const ids = fakeServerTable({ [byId]: state })
    const off = followIndexRanges(ids.table)
    ids.change([])
    ids.change([{ at: 0, delta: 4 }])
    expect(Object.keys(ids.slice())).toEqual([byId])
    off()
  })
})
