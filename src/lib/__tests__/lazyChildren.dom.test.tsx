// @vitest-environment happy-dom
/**
 * Ленивые дети строк (ADR 0054; RE19, RE21–RE22, RE26–RE29, RE34–RE36): ответ
 * `loadChildren` по строке, его согласование с данными и методы таблицы. Отметки
 * прихода (ADR 0056; RE43–RE44, RE51).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import { readPluginHooks } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import { rowExpanding, rowGrouping } from '../plugins'
import {
  readLoadedChildren,
  readRowArrivals,
} from '../plugins/rowExpanding/lazyChildrenFeature'
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
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

interface HostProps {
  plugins: TesseraFeatureEntry[]
  data?: Node[]
  state?: Record<string, unknown>
  handlers?: Record<string, unknown>
}

const Host = ({ plugins, data = ROWS, state, handlers }: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins,
    state: state as never,
    handlers,
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
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

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
        rowGrouping(),
        rowExpanding({ hasChildren: grouped, loadChildren }),
      ],
      state: { grouping: ['name'] },
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
    render({
      plugins,
      state: { expanded: true },
      handlers: { onExpandedChange },
    })
    expect(loadChildren).not.toHaveBeenCalled()
    expect(coreRow('a').getIsExpanded()).toBe(false)
    expect(coreRow('t').getIsExpanded()).toBe(true)
    act(() => root!.unmount())
    root = undefined

    render({ plugins })
    toggle('a')
    toggle('a')
    render({
      plugins,
      state: { expanded: true },
      handlers: { onExpandedChange },
    })
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

  it('RE43: синхронный массив из loadChildren и setLoadedChildren отметок прихода не дают', async () => {
    const plugins = [
      rowExpanding({ hasChildren, loadChildren: () => [node('a1')] }),
    ]
    render({ plugins })
    toggle('a')
    expect(childIds('a')).toEqual(['a1'])
    act(() => captured.setLoadedChildren('a', [node('a1'), node('a2')]))
    expect(childIds('a')).toEqual(['a1', 'a2'])
    await flush()
    expect(readRowArrivals(captured)).toEqual({})
  })

  it('RE44: отметку получают только id, которых не было в прошлом ответе; тот же набор — без новых отметок', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(100)
    const loadChildren = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve([node('a1')]))
      .mockReturnValueOnce(Promise.resolve([node('a1'), node('a2')]))
      .mockReturnValueOnce(Promise.resolve([node('a1'), node('a2')]))
    render({ plugins: [rowExpanding({ hasChildren, loadChildren })] })
    toggle('a')
    await flush()
    expect(readRowArrivals(captured)).toEqual({ a1: 100 })
    toggle('a')
    now.mockReturnValue(200)
    toggle('a')
    await flush()
    expect(readRowArrivals(captured)).toEqual({ a1: 100, a2: 200 })
    toggle('a')
    now.mockReturnValue(300)
    toggle('a')
    await flush()
    expect(readRowArrivals(captured)).toEqual({ a1: 100, a2: 200 })
    now.mockRestore()
  })

  it('RE51: отметки снимаются по истечении времени и у строк, ушедших из data', async () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    try {
      const lazy = [node('a', 1), node('c', 1)]
      const loadChildren = (row: { id: string }) =>
        Promise.resolve([node(`${row.id}1`)])
      const plugins = [rowExpanding({ hasChildren, loadChildren })]
      render({ plugins, data: lazy })
      toggle('a')
      await act(() => vi.advanceTimersByTimeAsync(0))
      now.mockReturnValue(200)
      toggle('c')
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(readRowArrivals(captured)).toEqual({ a1: 0, c1: 200 })

      // Время a1 вышло (300 мс по умолчанию), c1 — ещё нет.
      now.mockReturnValue(300)
      await act(() => vi.advanceTimersByTimeAsync(300))
      expect(readRowArrivals(captured)).toEqual({ c1: 200 })

      // c ушла из данных — её ответ и отметка ребёнка удалены.
      render({ plugins, data: [lazy[0]!] })
      expect(readRowArrivals(captured)).toEqual({})
    } finally {
      now.mockRestore()
      vi.useRealTimers()
    }
  })
})
