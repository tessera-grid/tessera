// @vitest-environment happy-dom
/**
 * Черновик серверного фильтра колонки (ADR 0154; FD6): набранное условие забывается после
 * применения, «Сбросить», смены фильтра колонки снаружи и при новом открытии таблицы.
 * Запуск: npx vitest run --config vitest.node.config.ts filterDraft
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { columnFiltering } from '../plugins/columnFiltering'
import { useFilterDraft } from '../plugins/columnFiltering/filterDraft'
import type { ColumnFilterValue } from '../plugins/columnFilteringModel/types'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const data = [{ id: '1', name: 'Bob' }]

const draftOf = (current: ColumnFilterValue | undefined) =>
  current && 'value' in current ? String(current.value) : ''
const filterOf = (draft: string): ColumnFilterValue | undefined =>
  draft ? { operator: 'contains', value: draft } : undefined

let table: any
let panel: ReturnType<typeof useFilterDraft<string>> | undefined
let root: Root | undefined

/** Панель фильтра колонки: смонтирована — открыта. */
const Panel = () => {
  panel = useFilterDraft({
    table,
    columnId: 'name',
    current: table.getColumn('name').getFilterValue(),
    draftOf,
    filterOf,
  })
  return null
}

const Host = ({ open }: { open: boolean }) => {
  table = useCreateTable({
    columns: columns as never,
    data,
    dataMode: { filtering: 'server' },
    plugins: [columnFiltering({ onFilterChange: () => undefined })],
  })
  return open ? createElement(Panel) : null
}

const render = (open: boolean) =>
  act(() => root!.render(createElement(Host, { open })))
const mount = () => {
  act(() => root?.unmount())
  root = createRoot(document.createElement('div'))
  render(true)
}
const reopen = () => {
  render(false)
  panel = undefined
  render(true)
}
const type = (text: string) => act(() => panel!.setDraft(text))

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

describe('Черновик серверного фильтра (ADR 0154)', () => {
  it('FD6: условие забывается после применения, «Сбросить», смены фильтра колонки снаружи и при новом открытии таблицы', () => {
    mount()
    expect(panel!.server).toBe(true)

    // Без применения набранное переживает закрытие панели.
    type('Bo')
    reopen()
    expect(panel!.draft).toBe('Bo')

    // «Сбросить» без действующего фильтра: черновик забыт.
    act(() => panel!.forget())
    reopen()
    expect(panel!.draft).toBe('')

    // Применено: панель показывает действующее условие, черновика нет.
    type('Bob')
    act(() => panel!.commit())
    reopen()
    expect(panel!.draft).toBe('Bob')
    expect(panel!.dirty).toBe(false)

    // Фильтр колонки сменили снаружи: панель показывает его, а не черновик.
    type('Al')
    act(() =>
      table.getColumn('name').setFilterValue({
        operator: 'contains',
        value: 'Eve',
      }),
    )
    reopen()
    expect(panel!.draft).toBe('Eve')

    // Новая таблица: черновика прежней нет.
    type('Zed')
    reopen()
    expect(panel!.draft).toBe('Zed')
    mount()
    expect(panel!.draft).toBe('')
  })
})
