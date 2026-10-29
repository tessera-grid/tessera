// @vitest-environment happy-dom
/**
 * Ленивые дети строк (ADR 0054; RE19, RE21–RE22, RE26–RE29, RE34–RE36): ответ
 * `loadChildren` по строке, его согласование с данными и методы таблицы. Отметки
 * прихода (ADR 0056; RE43–RE44, RE51). Склейка ответов (ADR 0066; RE65, RE67–RE72).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import type { TesseraFeatureEntry } from '../core/features'
import { ENGLISH_LABELS } from '../core/localization'
import { readPluginHooks } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import { rowExpanding, rowGrouping } from '../plugins'
import { readLoadedChildren } from '../plugins/rowExpanding/lazyChildrenFeature'
import { readFlashes } from '../core/flashes/flashFeature'
import { targetIdsOf } from '../core/highlights/highlightFeature'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
import type { RowExpandingHooks } from '../plugins/rowExpanding'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  kids?: number
  subRows?: Node[]
}

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const node = (id: string, kids = 0): Node => ({ id, name: id, kids })
const ROWS: Node[] = [
  node('a', 2),
  node('b'),
  { id: 't', name: 't', subRows: [node('t1')] },
]

const hasChildren = (row: { original: Node }) => (row.original.kids ?? 0) > 0

let captured: any

/** Вспышки `arrived` строк по id строки. */
const arrivals = () =>
  Object.fromEntries(
    Object.entries(readFlashes(captured))
      .filter(([, entry]) => entry.outcome === 'arrived')
      .map(([key, entry]) => [targetIdsOf(key).rowIds[0], entry]),
  )
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

interface HostProps {
  plugins: TesseraFeatureEntry[]
  data?: Node[]
}

const Host = ({ plugins, data = ROWS }: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins,
  })
  return null
}

const render = (props: HostProps) => {
  if (!root) {
    root = createRoot(document.createElement('div'))
  }
  act(() => root!.render(createElement(Host, props)))
}

const coreRow = (id: string) => captured.getCoreRowModel().rowsById[id]
const childIds = (id: string) =>
  (coreRow(id)?.subRows ?? []).map((row: { id: string }) => row.id)
const toggle = (id: string) =>
  act(() =>
    toggleRowExpanded(
      coreRow(id),
      readPluginHooks<Partial<RowExpandingHooks>>(captured, 'rowExpanding'),
    ),
  )
// Кадр, до которого копятся ответы, и задача применения сразу после него (ADR 0066).
const FRAME = 20
const flush = () =>
  act(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() =>
          setTimeout(() => setTimeout(resolve, 0), 0),
        ),
      ),
  )

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Ленивые дети строк (ADR 0054)', () => {
  it('RE19: синхронный массив из loadChildren показывается сразу, без ожидания', () => {
    const loadChildren = vi.fn(() => [node('a1')])
    render({ plugins: [rowExpanding({ hasChildren, loadChildren })] })
    toggle('a')
    expect(loadChildren).toHaveBeenCalledTimes(1)
    expect(coreRow('a').getIsExpandPending()).toBe(false)
    expect(coreRow('a').getIsExpanded()).toBe(true)
    expect(childIds('a')).toEqual(['a1'])
  })

  it('RE21: новый ответ повторного раскрытия заменяет сохранённых детей', async () => {
    const second = deferred<Node[]>()
    const loadChildren = vi
      .fn()
      .mockReturnValueOnce([node('a1')])
      .mockReturnValueOnce(second.promise)
    render({ plugins: [rowExpanding({ hasChildren, loadChildren })] })
    toggle('a')
    toggle('a')
    toggle('a')
    expect(coreRow('a').getIsExpandPending()).toBe(true)
    expect(childIds('a')).toEqual(['a1'])
    second.resolve([node('a2'), node('a3')])
    await flush()
    expect(childIds('a')).toEqual(['a2', 'a3'])
  })

  it('RE22: onExpandRow уведомляется и при loadChildren; его промис ожидание не ведёт', async () => {
    const onExpandRow = vi.fn(() => new Promise<void>(() => {}))
    const loadChildren = vi.fn(() => Promise.resolve([node('a1')]))
    render({
      plugins: [rowExpanding({ hasChildren, loadChildren, onExpandRow })],
    })
    toggle('a')
    expect(onExpandRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
      true,
    )
    await flush()
    expect(coreRow('a').getIsExpandPending()).toBe(false)
    expect(childIds('a')).toEqual(['a1'])
  })

  it('RE26: поздний ответ прежней попытки игнорируется', async () => {
    const first = deferred<Node[]>()
    const second = deferred<Node[]>()
    const loadChildren = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const plugins = [rowExpanding({ hasChildren, loadChildren })]
    render({ plugins })
    toggle('a')
    // Данные обновились без строки, затем строка вернулась и её раскрыли снова.
    render({ plugins, data: ROWS.slice(1) })
    render({ plugins, data: [...ROWS] })
    expect(coreRow('a').getIsExpandPending()).toBe(false)
    toggle('a')
    first.resolve([node('late')])
    await flush()
    expect(childIds('a')).toEqual([])
    expect(coreRow('a').getIsExpandPending()).toBe(true)
    second.resolve([node('a1')])
    await flush()
    expect(childIds('a')).toEqual(['a1'])
  })

  it('RE27: строка ушла из data — ответ удалён; смена data с той же строкой ответ сохраняет', () => {
    const loadChildren = () => [node('a1')]
    const plugins = [rowExpanding({ hasChildren, loadChildren })]
    render({ plugins })
    toggle('a')
    render({ plugins, data: [...ROWS] })
    expect(Object.keys(readLoadedChildren(captured))).toEqual(['a'])
    expect(childIds('a')).toEqual(['a1'])
    render({ plugins, data: ROWS.slice(1) })
    expect(readLoadedChildren(captured)).toEqual({})
  })

  it('RE28: строка с subRows в данных loadChildren не вызывает', () => {
    const loadChildren = vi.fn(() => [node('x')])
    render({
      plugins: [
        rowExpanding({ hasChildren: () => true, loadChildren, maxDepth: 2 }),
      ],
    })
    toggle('t')
    expect(loadChildren).not.toHaveBeenCalled()
    expect(childIds('t')).toEqual(['t1'])
  })

  it('RE29: hasChildren подчиняется maxDepth; при активной группировке не вызывается', () => {
    const spy = vi.fn(hasChildren)
    const loadChildren = () => [node('a1', 5)]
    render({
      plugins: [rowExpanding({ hasChildren: spy, loadChildren, maxDepth: 1 })],
    })
    toggle('a')
    expect(coreRow('a1').getCanExpand()).toBe(false)
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
    act(() => root!.unmount())
    root = undefined

    const grouped = vi.fn(hasChildren)
    render({
      plugins: [
        rowGrouping({ grouping: ['name'] }),
        rowExpanding({ hasChildren: grouped, loadChildren }),
      ],
    })
    captured
      .getRowModel()
      .flatRows.forEach((row: { getCanExpand: () => boolean }) =>
        row.getCanExpand(),
      )
    expect(grouped).not.toHaveBeenCalled()
  })

  it('RE34: expanded: true не зовёт loadChildren; строка с ответом раскрыта, без ответа — свёрнута; срез не меняется', () => {
    const loadChildren = vi.fn(() => [node('a1')])
    const onExpandedChange = vi.fn()
    const plugins = [rowExpanding({ hasChildren, loadChildren })]
    const allExpanded = [
      rowExpanding({
        hasChildren,
        loadChildren,
        expanded: true,
        onExpandedChange,
      }),
    ]
    render({ plugins: allExpanded })
    expect(loadChildren).not.toHaveBeenCalled()
    expect(coreRow('a').getIsExpanded()).toBe(false)
    expect(coreRow('t').getIsExpanded()).toBe(true)
    act(() => root!.unmount())
    root = undefined

    render({ plugins })
    toggle('a')
    toggle('a')
    render({ plugins: allExpanded })
    expect(coreRow('a').getIsExpanded()).toBe(true)
    expect(childIds('a')).toEqual(['a1'])
    expect(loadChildren).toHaveBeenCalledTimes(1)
    expect(onExpandedChange).not.toHaveBeenCalled()
  })

  it('RE35: setLoadedChildren заменяет ответ раскрытой и свёрнутой строки; для строки без ответа — ничего', () => {
    const plugins = [
      rowExpanding({ hasChildren, loadChildren: () => [node('a1')] }),
    ]
    render({ plugins: [...plugins] })
    toggle('a')
    act(() => captured.setLoadedChildren('a', [node('a8')]))
    expect(childIds('a')).toEqual(['a8'])
    toggle('a')
    act(() =>
      captured.setLoadedChildren('a', (prev: Node[]) => [...prev, node('a9')]),
    )
    expect(coreRow('a').getIsExpanded()).toBe(false)
    expect(childIds('a')).toEqual(['a8', 'a9'])
    act(() => captured.setLoadedChildren('b', [node('b1')]))
    expect('b' in readLoadedChildren(captured)).toBe(false)
  })

  it('RE36: resetLoadedChildren(rowId) удаляет ответ строки и сворачивает её; без аргумента — все ответы', () => {
    const lazy = [node('a', 1), node('c', 1)]
    const loadChildren = (row: { id: string }) => [node(`${row.id}1`)]
    const plugins = [rowExpanding({ hasChildren, loadChildren })]
    render({ plugins, data: lazy })
    toggle('a')
    toggle('c')
    act(() => captured.resetLoadedChildren('a'))
    expect(Object.keys(readLoadedChildren(captured))).toEqual(['c'])
    expect(coreRow('a').getIsExpanded()).toBe(false)
    expect(childIds('a')).toEqual([])
    act(() => captured.resetLoadedChildren())
    expect(readLoadedChildren(captured)).toEqual({})
    expect(coreRow('c').getIsExpanded()).toBe(false)
  })

  it('RE43: синхронный массив из loadChildren и setLoadedChildren вспышки прихода не дают', async () => {
    const plugins = [
      rowExpanding({ hasChildren, loadChildren: () => [node('a1')] }),
    ]
    render({ plugins })
    toggle('a')
    expect(childIds('a')).toEqual(['a1'])
    act(() => captured.setLoadedChildren('a', [node('a1'), node('a2')]))
    expect(childIds('a')).toEqual(['a1', 'a2'])
    await flush()
    expect(readFlashes(captured)).toEqual({})
  })

  it('RE44: вспышку arrived получают только id, которых не было в прошлом ответе; тот же набор — без новых вспышек', async () => {
    const loadChildren = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve([node('a1')]))
      .mockReturnValueOnce(Promise.resolve([node('a1'), node('a2')]))
      .mockReturnValueOnce(Promise.resolve([node('a1'), node('a2')]))
    render({ plugins: [rowExpanding({ hasChildren, loadChildren })] })
    toggle('a')
    await flush()
    const first = arrivals()
    expect(Object.keys(first)).toEqual(['a1'])
    toggle('a')
    toggle('a')
    await flush()
    const second = arrivals()
    expect(Object.keys(second)).toEqual(['a1', 'a2'])
    expect(second.a1, 'a1 не вспыхнула заново').toBe(first.a1)
    toggle('a')
    toggle('a')
    await flush()
    expect(arrivals(), 'тот же набор').toEqual(second)
  })

  it('RE51: вспышки прихода снимаются по истечении времени и у строк, ушедших из data', async () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    try {
      const lazy = [node('a', 1), node('c', 1)]
      const loadChildren = (row: { id: string }) =>
        Promise.resolve([node(`${row.id}1`)])
      const plugins = [rowExpanding({ hasChildren, loadChildren })]
      render({ plugins, data: lazy })
      toggle('a')
      await act(() => vi.advanceTimersByTimeAsync(FRAME))
      now.mockReturnValue(200)
      toggle('c')
      await act(() => vi.advanceTimersByTimeAsync(FRAME))
      expect(Object.keys(arrivals())).toEqual(['a1', 'c1'])

      // Удержание и угасание a1 вышли (300 + 500 мс по умолчанию), c1 ещё гаснет.
      now.mockReturnValue(300)
      await act(() => vi.advanceTimersByTimeAsync(300))
      now.mockReturnValue(800)
      await act(() => vi.advanceTimersByTimeAsync(500))
      expect(Object.keys(arrivals())).toEqual(['c1'])

      // c ушла из данных — её ответ и вспышка ребёнка удалены.
      render({ plugins, data: [lazy[0]!] })
      expect(arrivals()).toEqual({})
    } finally {
      now.mockRestore()
      vi.useRealTimers()
    }
  })
})

describe('Склейка ответов loadChildren (ADR 0066)', () => {
  const LAZY = [node('a', 1), node('c', 1), node('d', 1)]
  type Answer = Node[] | Promise<Node[]>

  /** Грид с тремя ленивыми строками; ответ строки задаёт `answers[rowId]`. */
  const renderBatch = (answers: Record<string, () => Answer>) => {
    const plugins = [
      rowExpanding({
        hasChildren,
        loadChildren: (row: { id: string }) => answers[row.id]!(),
      }),
    ]
    render({ plugins, data: LAZY })
    return plugins
  }
  const tick = (ms = 1) => act(() => vi.advanceTimersByTimeAsync(ms))
  const listen = () => {
    const say = vi.fn()
    registerAnnouncer(captured, { say, labels: ENGLISH_LABELS })
    return say
  }
  const countWrites = (key: 'loadedChildren' | 'rowExpandPending') => {
    const writes = { count: 0 }
    captured.atoms[key].subscribe(() => writes.count++)
    return writes
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('RE65: ответы нескольких строк, пришедшие отдельными задачами до кадра, применяются одной записью loadedChildren и одной rowExpandPending', async () => {
    const answers = {
      a: deferred<Node[]>(),
      c: deferred<Node[]>(),
      d: deferred<Node[]>(),
    }
    renderBatch({
      a: () => answers.a.promise,
      c: () => answers.c.promise,
      d: () => answers.d.promise,
    })
    toggle('a')
    toggle('c')
    toggle('d')
    const loaded = countWrites('loadedChildren')
    const pending = countWrites('rowExpandPending')
    answers.a.resolve([node('a1')])
    await tick()
    answers.c.resolve([node('c1')])
    await tick()
    answers.d.resolve([node('d1')])
    await tick()
    expect(loaded.count).toBe(0)
    await tick(FRAME)
    expect(loaded.count).toBe(1)
    expect(pending.count).toBe(1)
    expect([childIds('a'), childIds('c'), childIds('d')]).toEqual([
      ['a1'],
      ['c1'],
      ['d1'],
    ])
    expect(coreRow('d').getIsExpandPending()).toBe(false)
  })

  it('RE67: синхронный ответ применяется в том же клике, пока в очереди ждёт ответ другой строки', async () => {
    renderBatch({
      a: () => Promise.resolve([node('a1')]),
      c: () => [node('c1')],
    })
    toggle('a')
    await tick()
    toggle('c')
    expect(childIds('c')).toEqual(['c1'])
    expect(childIds('a')).toEqual([])
    expect(coreRow('a').getIsExpandPending()).toBe(true)
  })

  it('RE68: отказ применяется сразу — сворачивание, вспышка, объявление, — пока в очереди ждёт ответ другой строки', async () => {
    renderBatch({
      a: () => Promise.resolve([node('a1')]),
      c: () => Promise.reject(new Error('down')),
    })
    const say = listen()
    toggle('a')
    toggle('c')
    await tick()
    expect(coreRow('a').getIsExpandPending()).toBe(true)
    expect(coreRow('c').getIsExpanded()).toBe(false)
    expect(Object.keys(captured.atoms.rowExpandFailed.get())).toEqual(['c'])
    expect(say).toHaveBeenCalledWith(
      ENGLISH_LABELS.announceExpandFailed('down'),
    )
  })

  it('RE69: на пачку — одно объявление с суммой детей строк пачки', async () => {
    renderBatch({
      a: () => Promise.resolve([node('a1'), node('a2')]),
      c: () => Promise.resolve([node('c1'), node('c2'), node('c3')]),
    })
    const say = listen()
    toggle('a')
    await tick()
    toggle('c')
    await tick()
    await tick(FRAME)
    expect(say.mock.calls).toEqual([[ENGLISH_LABELS.announceChildrenLoaded(5)]])
  })

  it('RE70: ответ строки, ушедшей из data до кадра, не применяется, даже если строка вернулась', async () => {
    const load = vi
      .fn<() => Answer>()
      .mockReturnValueOnce(Promise.resolve([node('a1')]))
      .mockReturnValueOnce(new Promise(() => {}))
    const plugins = renderBatch({ a: load })
    toggle('a')
    await tick()
    // Строка ушла и вернулась, её раскрыли снова — ждёт новая попытка.
    render({ plugins, data: LAZY.slice(1) })
    render({ plugins, data: [...LAZY] })
    toggle('a')
    await tick(FRAME)
    expect(readLoadedChildren(captured)).toEqual({})
    expect(coreRow('a').getIsExpandPending()).toBe(true)
  })

  it('RE71: setLoadedChildren после прихода ответа и до кадра не затирается этим ответом; ожидание снимается', async () => {
    const refresh = deferred<Node[]>()
    const load = vi
      .fn<() => Answer>()
      .mockReturnValueOnce([node('a1')])
      .mockReturnValueOnce(refresh.promise)
    renderBatch({ a: load })
    toggle('a')
    toggle('a')
    toggle('a')
    refresh.resolve([node('a2')])
    await tick()
    act(() => captured.setLoadedChildren('a', [node('a9')]))
    await tick(FRAME)
    expect(childIds('a')).toEqual(['a9'])
    expect(coreRow('a').getIsExpandPending()).toBe(false)
  })

  it('RE72: без кадра (вкладка скрыта) пачка применяется таймером не позже 100 мс', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    renderBatch({ a: () => Promise.resolve([node('a1')]) })
    toggle('a')
    // Ответ пришёл, кадра нет: пачка ждёт таймера и применяется к 100 мс.
    await tick()
    expect(childIds('a')).toEqual([])
    await tick(100)
    expect(childIds('a')).toEqual(['a1'])
  })
})
