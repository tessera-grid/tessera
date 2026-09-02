import { renderHook } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useColumnOrderState } from '../columnOrderState'
import { useColumnPinningState } from '../columnPinningState'
import { useColumnSizingState } from '../columnSizingState'
import { useColumnSortingState } from '../columnSortingState'
import { useColumnVisibilityState } from '../columnVisibilityState'
import { useRowExpandingState } from '../rowExpandingState'
import { useRowGroupingState } from '../rowGroupingState'
import { useRowSelectionState } from '../rowSelectionState'
import { stateUpdater } from '../stateUpdater'

// Сеть безопасности под инверсию ядра (docs/decisions/0010-invert-core-plugins-registry.md,
// R10 — «логика state сохранена»). Слайсы состояния — контролируемые обёртки над
// useState, которые сохранятся при инверсии (плагины сеют свой слайс сами через
// getInitialState). Тесты фиксируют их контракт: начальное значение, обновление
// через onChange и ре-синхронизацию при смене начального значения. Один инвариант
// — один тест.

// --- Однородные слайсы (useState(initial) + эффект setState(initial)) ----------

const uniformSlices = [
  {
    name: 'columnSizing',
    hook: useColumnSizingState,
    valueKey: 'columnSizing',
    changeKey: 'onColumnSizingChange',
    initial: { a: 100 },
    reseed: { b: 200 },
    next: { c: 50 },
  },
  {
    name: 'columnSorting',
    hook: useColumnSortingState,
    valueKey: 'columnSorting',
    changeKey: 'onColumnSortingChange',
    initial: [{ id: 'a', desc: true }],
    reseed: [{ id: 'b', desc: false }],
    next: [{ id: 'c', desc: true }],
  },
  {
    name: 'columnVisibility',
    hook: useColumnVisibilityState,
    valueKey: 'columnVisibility',
    changeKey: 'onColumnVisibilityChange',
    initial: { a: false },
    reseed: { b: false },
    next: { c: false },
  },
  {
    name: 'rowExpanding',
    hook: useRowExpandingState,
    valueKey: 'rowExpanded',
    changeKey: 'onRowExpandedChange',
    initial: { a: true },
    reseed: { b: true },
    next: { c: true },
  },
  {
    name: 'rowGrouping',
    hook: useRowGroupingState,
    valueKey: 'grouping',
    changeKey: 'onGroupingChange',
    initial: ['a'],
    reseed: ['b'],
    next: ['c'],
  },
  {
    name: 'rowSelection',
    hook: useRowSelectionState,
    valueKey: 'rowSelection',
    changeKey: 'onRowSelectionChange',
    initial: { a: true },
    reseed: { b: true },
    next: { c: true },
  },
] as const

describe.each(uniformSlices)(
  'state-слайс $name — контролируемая обёртка (R10)',
  ({ hook, valueKey, changeKey, initial, reseed, next }) => {
    test('возвращает переданное начальное значение', async () => {
      const { result } = await renderHook(() => hook(initial as any))
      expect((result.current as any)[valueKey]).toEqual(initial)
    })

    test('onChange обновляет значение', async () => {
      const { result } = await renderHook(() => hook())
      ;(result.current as any)[changeKey](next)
      await expect
        .poll(() => (result.current as any)[valueKey])
        .toEqual(next)
    })

    test('ре-синхронизируется при смене начального значения', async () => {
      const { result, rerender } = await renderHook(
        (props: any) => hook(props),
        { initialProps: initial as any },
      )
      expect((result.current as any)[valueKey]).toEqual(initial)

      rerender(reseed as any)
      await expect
        .poll(() => (result.current as any)[valueKey])
        .toEqual(reseed)
    })
  },
)

// --- columnOrder: ре-сев ГЕЙТИТСЯ изменением длины --------------------------------

describe('state-слайс columnOrder — ре-сев только при смене длины (R10)', () => {
  test('возвращает переданный начальный порядок и обновляется через onChange', async () => {
    const { result } = await renderHook(() => useColumnOrderState(['a', 'b']))
    expect(result.current.columnOrder).toEqual(['a', 'b'])

    result.current.onColumnOrderChange(['b', 'a'])
    await expect.poll(() => result.current.columnOrder).toEqual(['b', 'a'])
  })

  test('смена начального порядка ТОЙ ЖЕ длины не пере-сеивает состояние', async () => {
    const { result, rerender } = await renderHook(
      (props?: string[]) => useColumnOrderState(props),
      { initialProps: ['a', 'b'] },
    )
    expect(result.current.columnOrder).toEqual(['a', 'b'])

    // Новый начальный порядок той же длины (2) — состояние сохраняется как было.
    rerender(['c', 'd'])
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(result.current.columnOrder).toEqual(['a', 'b'])
  })

  test('смена длины начального порядка пере-сеивает состояние', async () => {
    const { result, rerender } = await renderHook(
      (props?: string[]) => useColumnOrderState(props),
      { initialProps: ['a', 'b'] },
    )

    // Длина изменилась (2 → 3) — состояние берёт новый порядок.
    rerender(['c', 'd', 'e'])
    await expect
      .poll(() => result.current.columnOrder)
      .toEqual(['c', 'd', 'e'])
  })
})

// --- columnPinning: обёртка сливает дефолт с начальным пиннингом ------------------

// Стабильные ссылки: колбэк renderHook выполняется на каждом рендере, а эффект
// слайса зависит от идентичности начального значения — инлайновый литерал плодил
// бы новую ссылку каждый раз и зациклил setState.
const INITIAL_PINNING = { left: ['a'], right: [] }
const NEXT_PINNING = { left: ['x'], right: ['y'] }

describe('state-слайс columnPinning — обёртка (R10)', () => {
  test('начальное значение слито с дефолтом (обе стороны присутствуют)', async () => {
    const { result } = await renderHook(() =>
      useColumnPinningState(INITIAL_PINNING),
    )
    expect(result.current.columnPinning).toEqual({ left: ['a'], right: [] })
  })

  test('onChange обновляет пиннинг', async () => {
    const { result } = await renderHook(() => useColumnPinningState())
    result.current.onColumnPinningChange(NEXT_PINNING)
    await expect
      .poll(() => result.current.columnPinning)
      .toEqual({ left: ['x'], right: ['y'] })
  })
})

// --- stateUpdater: мост к table.setState по одному ключу --------------------------

describe('stateUpdater — точечное обновление слайса через setState (R10)', () => {
  test('значение-updater кладётся в state по своему ключу поверх остального', () => {
    const setState = vi.fn()
    const update = stateUpdater<any>('sorting', { setState } as any)

    update([{ id: 'a', desc: true }] as any)

    // Вызывает instance.setState с функцией; применим её к прежнему состоянию.
    const reducer = setState.mock.calls[0][0]
    expect(reducer({ sorting: [], grouping: ['g'] })).toEqual({
      sorting: [{ id: 'a', desc: true }],
      grouping: ['g'],
    })
  })

  test('функция-updater получает прежнее значение своего ключа', () => {
    const setState = vi.fn()
    const update = stateUpdater<any>('sorting', { setState } as any)

    update(((old: any[]) => [...old, { id: 'b' }]) as any)

    const reducer = setState.mock.calls[0][0]
    expect(reducer({ sorting: [{ id: 'a' }] })).toEqual({
      sorting: [{ id: 'a' }, { id: 'b' }],
    })
  })
})
