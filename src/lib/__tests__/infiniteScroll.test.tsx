// @vitest-environment happy-dom
/**
 * Лента (ADR 0081; IS5, IS6, IS8): загрузчик — одна загрузка за раз, цепочка, пауза
 * после пустого ответа, синхронный `onLoadMore`; живые аргументы без пересоздания
 * таблицы; инертность рядом с пагинацией и предупреждения о клиентской обработке.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnFiltering,
  columnSorting,
  infiniteScroll,
  pagination,
  quickSearch,
  rowGrouping,
} from '../plugins'
import {
  type EdgeGeometry,
  InfiniteLoader,
  type LoaderInput,
} from '../plugins/infiniteScroll/loader'
import { IDLE } from '../plugins/infiniteScroll/model'
import type { InfiniteScrollState } from '../plugins/infiniteScroll/types'
import { captureInertWarnings } from './inertWarnings'
import { __resetLogger } from '../util/logger'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** Загрузчик с подменённой геометрией и кадрами под управлением теста. */
const harness = (overrides: Partial<LoaderInput> = {}) => {
  const geometry: EdgeGeometry = {
    distance: 0,
    rowHeight: 50,
    viewportHeight: 400,
    scrollTop: 1000,
  }
  const frames: (() => void)[] = []
  const states: InfiniteScrollState[] = []
  const calls: { loaded: number; resolve: () => void; reject: () => void }[] =
    []
  const loader = new InfiniteLoader(
    () => geometry,
    run => frames.push(run),
  )
  let input: LoaderInput = {
    table: { store: {}, options: {} },
    hooks: {
      onLoadMore: ({ loaded }) =>
        new Promise<void>((resolve, reject) =>
          calls.push({ loaded, resolve, reject: () => reject(new Error('x')) }),
        ),
    },
    hasMore: true,
    loaded: 30,
    inert: false,
    sentinel: null,
    setValue: next => states.push(next),
    ...overrides,
  }
  loader.update(input)
  return {
    loader,
    geometry,
    calls,
    states,
    runFrames: () => frames.splice(0).forEach(run => run()),
    /** Новая `data` отрисована: строк стало `loaded`. */
    rendered: (loaded: number) => {
      input = { ...input, loaded }
      loader.update(input)
    },
  }
}

describe('Лента: загрузчик', () => {
  it('IS5: цепочка — пока блок в пути, повторные проверки (протяжка ползунка) вызовов не дают; после ответа край снова просит следующий', async () => {
    let h = harness()
    h.loader.check()
    h.loader.check()
    h.geometry.scrollTop = 4000
    h.loader.check()
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.loaded).toBe(30)
    expect(h.states.at(-1)).toEqual({ status: 'pending', tailRows: 8 })

    // Короткий блок: край всё ещё у окна — следующий вызов, последовательно.
    h.calls[0]!.resolve()
    await tick()
    h.rendered(35)
    expect(h.states.at(-1)).toEqual(IDLE)
    h.loader.check()
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1]!.loaded).toBe(35)

    // Ответ без новых строк цепочку не продолжает до следующей прокрутки

    h = harness()
    h.loader.check()
    h.calls[0]!.resolve()
    await tick()
    // Новой data нет и через кадры.
    h.runFrames()
    expect(h.states.at(-1)).toEqual(IDLE)
    h.loader.check()
    h.loader.check()
    expect(h.calls).toHaveLength(1)
    h.geometry.scrollTop += 10
    h.loader.check()
    expect(h.calls).toHaveLength(2)

    // Синхронный onLoadMore — так же: одна загрузка, ответ по приходу строк, без пауз на пустом

    let count = 0
    h = harness({
      hooks: {
        onLoadMore: () => {
          count++
        },
      },
    })
    h.loader.check()
    h.loader.check()
    expect(count).toBe(1)
    await tick()
    h.rendered(80)
    expect(h.states.at(-1)).toEqual(IDLE)
    h.loader.check()
    expect(count).toBe(2)
    await tick()
    h.runFrames()
    h.loader.check()
    expect(count).toBe(2)

    // Устаревший ответ после отмены не меняет состояние

    h = harness()
    h.loader.check()
    h.loader.cancel({ abort: true })
    const settled = h.states.length
    h.calls[0]!.reject()
    await tick()
    h.runFrames()
    expect(h.states).toHaveLength(settled)
    expect(h.states.at(-1)).toEqual(IDLE)
  })
})

let root: Root | undefined
let captured: any

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
})

const Host = ({ plugins }: { plugins: unknown[] }) => {
  captured = useCreateTable({
    columns: [{ id: 'a', accessorKey: 'a' }] as never,
    data: [{ id: 'r1', a: 'A' }],
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
  } as never)
  return null
}

const mount = (plugins: unknown[]) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, { plugins })))
  return captured
}

describe('Лента: аргументы и совместимость', () => {
  it('IS6: hasMore: false — ни вызовов, ни хвоста', () => {
    const h = harness({ hasMore: false })
    h.loader.check()
    expect(h.calls).toHaveLength(0)
    expect(h.states).toHaveLength(0)

    // Смена hasMore и rowCount на лету — без пересоздания таблицы

    const first = mount([infiniteScroll({ hasMore: true, rowCount: 100 })])
    expect(first.options.infiniteScrollHasMore).toBe(true)
    expect(first.options.getTotalRowCount(first)).toBe(100)
    const store = first.store
    const second = mount([infiniteScroll({ hasMore: false, rowCount: 120 })])
    // Адаптер отдаёт новую обёртку на рендер; таблица та же — тот же store.
    expect(second.store).toBe(store)
    expect(second.options.infiniteScrollHasMore).toBe(false)
    expect(second.options.getTotalRowCount(second)).toBe(120)
    mount([infiniteScroll({ hasMore: true })])
    expect(captured.options.getTotalRowCount(captured)).toBe(-1)
  })

  describe('предупреждения', () => {
    const warnings = captureInertWarnings()
    let before = 0
    /** Новая таблица и чистый dedup логгера: предупреждения части — только её. */
    const fresh = () => {
      act(() => root?.unmount())
      root = undefined
      __resetLogger()
      before = warnings().length
    }

    it('IS8: с пагинацией лента инертна — причина pagination и dev-warn', () => {
      let table = mount([pagination(), infiniteScroll({ hasMore: true })])
      const diagnostic = table
        .getPluginDiagnostics()
        .find((d: { id: string }) => d.id === 'infiniteScroll')
      expect(diagnostic).toEqual({
        id: 'infiniteScroll',
        status: 'inert',
        reason: 'pagination',
      })
      expect(table.options.getTotalRowCount(table)).toBeUndefined()
      expect(warnings().some(w => w.includes('infiniteScroll'))).toBe(true)

      // Клиентские сортировка, фильтр, поиск и группировка — dev-warn, плагин работает
      fresh()

      table = mount([
        columnSorting(),
        columnFiltering(),
        quickSearch(),
        rowGrouping(),
        infiniteScroll({ hasMore: true }),
      ])
      const text = warnings().join('\n')
      for (const feature of ['sorting', 'filtering', 'search', 'grouping']) {
        expect(text).toContain(`client-side ${feature}`)
      }
      expect(
        table
          .getPluginDiagnostics()
          .find((d: { id: string }) => d.id === 'infiniteScroll').status,
      ).toBe('active')

      // Серверные сортировка, фильтр и поиск — без предупреждений
      fresh()

      mount([
        columnSorting({ server: true }),
        columnFiltering({ server: true }),
        quickSearch({ server: true }),
        infiniteScroll({ hasMore: true }),
      ])
      expect(
        warnings()
          .slice(before)
          .filter(w => w.includes('client-side')),
      ).toEqual([])
    })
  })
})
