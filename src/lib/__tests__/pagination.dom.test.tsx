// @vitest-environment happy-dom
/**
 * Живой `rowCount` серверной пагинации через `useCreateTable` (ADR 0038, PG7):
 * новый ответ сервера меняет итог без пересоздания таблицы.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { pagination } from '../plugins/pagination'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const page = Array.from({ length: 25 }, (_, index) => ({
  id: String(index),
  name: `Name ${index}`,
}))

let captured: any

const Host = ({ rowCount }: { rowCount: number }) => {
  captured = useCreateTable({
    columns: columns as never,
    data: page,
    plugins: [pagination({ server: true, rowCount, initialPageSize: 25 })],
  })
  return null
}

describe('pagination — живые опции', () => {
  it('PG7: серверный режим — data не режется, число страниц из rowCount; новый rowCount обновляет счётчик без пересоздания таблицы', () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => root.render(<Host rowCount={1000} />))
    const table = captured
    expect(table.getRowModel().rows).toHaveLength(25)
    expect(table.getPageCount()).toBe(40)

    act(() => root.render(<Host rowCount={2000} />))
    // useTable отдаёт новую обёртку каждый рендер; экземпляр — тот же store.
    expect(captured.store).toBe(table.store)
    expect(captured.getRowCount()).toBe(2000)
    expect(captured.getPageCount()).toBe(80)

    act(() => root.unmount())
  })
})
