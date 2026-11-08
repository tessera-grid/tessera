// @vitest-environment happy-dom
/**
 * Колонки быстрого поиска (ADR 0053, QS3, QS6–QS7): живой набор в порядке отображения
 * и колонки для сервера.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setSearchByUser } from '../shared/filtering/filtering'
import { searchColumnIdsOf } from '../shared/filtering/searchColumns'
import type { DataMode } from '../core/dataMode'
import { useCreateTable } from '../core/useCreateTable'
import { quickSearch } from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'vip', accessorKey: 'vip', dataType: 'boolean' },
  { id: 'born', accessorKey: 'born', dataType: 'dateString' },
  { id: 'code', accessorKey: 'code', enableGlobalFilter: false },
  { id: 'visits', accessorKey: 'visits', header: 'Visits' },
]
const data = [
  {
    id: '1',
    name: 'Ann',
    city: 'Oslo',
    vip: true,
    born: '2000-01-01',
    code: 'x',
    visits: 3,
  },
]

const mount = (
  options: Parameters<typeof quickSearch>[0] = {},
  dataMode?: DataMode,
) => {
  const Host = () => {
    captured = useCreateTable({
      columns: columns as never,
      data,
      dataMode,
      plugins: [quickSearch(options)],
    })
    return null
  }
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(<Host />))
}

describe('колонки быстрого поиска', () => {
  it('QS3: набор живой — скрытие, enableGlobalFilter: false и булевы исключают колонку, колонки дат входят (ADR 0172); возврат возвращает; порядок — отображения', () => {
    mount()
    expect(searchColumnIdsOf(captured)).toEqual([
      'name',
      'city',
      'born',
      'visits',
    ])

    act(() => captured.getColumn('city').toggleVisibility(false))
    expect(searchColumnIdsOf(captured)).toEqual(['name', 'born', 'visits'])
    act(() => captured.getColumn('city').toggleVisibility(true))
    expect(searchColumnIdsOf(captured)).toEqual([
      'name',
      'city',
      'born',
      'visits',
    ])

    act(() => captured.getColumn('visits').pin('start'))
    expect(searchColumnIdsOf(captured)).toEqual([
      'visits',
      'name',
      'city',
      'born',
    ])
  })

  it('QS6: onSearchChange получает вторым аргументом { columnIds } — колонки поиска грида', () => {
    const onSearchChange = vi.fn()
    mount({ onSearchChange })
    act(() => setSearchByUser(captured, 'an'))
    expect(onSearchChange).toHaveBeenCalledWith(
      'an',
      { columnIds: ['name', 'city', 'born', 'visits'] },
      { signal: expect.any(AbortSignal) },
    )
  })

  it('QS7: в серверном режиме смена набора колонок при непустом поиске зовёт onSearchChange с прежней строкой и новыми columnIds; при пустом — нет', async () => {
    const onSearchChange = vi.fn()
    mount({ onSearchChange }, { search: 'server' })
    // Согласование плагинов — после записи, сменившей состояние (ADR 0196, §1).
    await act(async () => captured.getColumn('city').toggleVisibility(false))
    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => setSearchByUser(captured, 'an'))
    onSearchChange.mockClear()
    await act(async () => captured.getColumn('city').toggleVisibility(true))
    expect(onSearchChange).toHaveBeenCalledWith(
      'an',
      { columnIds: ['name', 'city', 'born', 'visits'] },
      { signal: expect.any(AbortSignal) },
    )
  })
})
