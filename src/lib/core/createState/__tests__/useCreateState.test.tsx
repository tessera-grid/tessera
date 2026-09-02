import type { AccessorKeyColumnDef } from '@tanstack/react-table'
import { renderHook } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding'
import { COLUMN_SELECTION_ID } from '../../../plugins/rowSelection'
import { CreateStateParams } from '../types'
import { useCreateState } from '../useCreateState'

// Сеть безопасности под инверсию ядра (docs/decisions/0010-invert-core-plugins-registry.md,
// R10). После инверсии useCreateState обобщён: видимость сервисных колонок сеется
// из serviceColumns (наличие), а пиннинг считается генерик-функцией
// mergeServiceColumnPinning (её оракул — columnPinningState.test.ts). Здесь —
// сев видимости, переопределение порядка (R7) и приоритет external-vs-core.
// Ассерты — прежний оракул паритета; поменялась сборка входа.

const columns = [
  { id: 'a', accessorKey: 'a' },
  { id: 'b', accessorKey: 'b' },
] as unknown as AccessorKeyColumnDef<any>[]

const params = (over: Partial<CreateStateParams> = {}): CreateStateParams => ({
  columns,
  state: {} as CreateStateParams['state'],
  handlers: {} as CreateStateParams['handlers'],
  serviceColumns: [],
  ...over,
})

const renderState = (over: Partial<CreateStateParams> = {}) =>
  renderHook(() => useCreateState(params(over)))

describe('useCreateState — сев видимости сервисных колонок (R8/R10)', () => {
  test('видимость сервисной колонки посеяна по её наличию в наборе', async () => {
    const { result } = await renderState({
      serviceColumns: [{ id: COLUMN_SELECTION_ID }],
    })

    // Присутствующая сервисная колонка видима…
    await expect
      .poll(
        () => result.current.coreState.columnVisibility?.[COLUMN_SELECTION_ID],
      )
      .toBe(true)
    // …а отсутствующая не сеется вовсе (нет колонки — нет записи видимости).
    expect(
      result.current.coreState.columnVisibility?.[COLUMN_EXPANDING_ID],
    ).toBeUndefined()
  })
})

describe('useCreateState — переопределение порядка колонок (R7)', () => {
  test('внешний columnOrder перекрывает выведенный из колонок порядок', async () => {
    const externalOrder = ['b', 'a']
    const { result } = await renderState({
      state: { columnOrder: externalOrder } as CreateStateParams['state'],
    })

    await expect
      .poll(() => result.current.coreState.columnOrder)
      .toEqual(externalOrder)
  })

  test('внешний columnOrder может ставить сервисную колонку в произвольную позицию', async () => {
    const externalOrder = ['a', COLUMN_SELECTION_ID, 'b']
    const { result } = await renderState({
      serviceColumns: [{ id: COLUMN_SELECTION_ID }],
      state: { columnOrder: externalOrder } as CreateStateParams['state'],
    })

    await expect
      .poll(() => result.current.coreState.columnOrder)
      .toEqual(externalOrder)
  })
})

describe('useCreateState — приоритет external-vs-core (R10)', () => {
  test('внешний слайс sorting выигрывает у ядрового дефолта', async () => {
    const externalSorting = [{ id: 'a', desc: true }]
    const { result } = await renderState({
      state: { sorting: externalSorting } as CreateStateParams['state'],
    })

    await expect
      .poll(() => result.current.coreState.sorting)
      .toEqual(externalSorting)
  })

  test('внешний слайс rowSelection выигрывает у ядрового дефолта', async () => {
    const externalRowSelection = { a: true }
    const { result } = await renderState({
      state: {
        rowSelection: externalRowSelection,
      } as CreateStateParams['state'],
    })

    await expect
      .poll(() => result.current.coreState.rowSelection)
      .toEqual(externalRowSelection)
  })

  test('внешний слайс expanded выигрывает у ядрового дефолта', async () => {
    const externalExpanded = { a: true }
    const { result } = await renderState({
      state: { expanded: externalExpanded } as CreateStateParams['state'],
    })

    await expect
      .poll(() => result.current.coreState.expanded)
      .toEqual(externalExpanded)
  })
})
