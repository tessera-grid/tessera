/**
 * Фаза E — headless-проверка плагина columnSorting на v9-ядре.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting, sortHeaderAction } from '../plugins/columnSorting'

interface Person {
  id: string
  name: string
}

const labels = {
  sortAscending: 'По возрастанию',
  sortDescending: 'По убыванию',
  clearSort: 'Сбросить',
  sortPriority: (p: number, t: number) => `приоритет ${p} из ${t}`,
} as never

const makeTable = (onToggleColumnSort = vi.fn()) => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSorting(),
  ]

  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [
      { id: '1', name: 'Борис' },
      { id: '2', name: 'Анна' },
    ] as Person[],
    columns: [{ id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' }],
    getRowId: (row: Person) => row.id,
    hooks: { columnSorting: { onToggleColumnSort } },
    slots: folded.slots,
    slotActions: folded.slotActions,
    actionMenu: folded.actionMenu,
    ...folded.options,
  } as never) as any

  return { table, folded, onToggleColumnSort }
}

const headerCtx = (table: any) => table.getHeaderGroups()[0].headers[0].getContext()

describe('Фаза E — columnSorting на v9', () => {
  it('foldEntries даёт опции сортировки', () => {
    const { folded } = makeTable()
    expect(folded.options).toMatchObject({
      enableSorting: true,
      enableSortingRemoval: true,
      manualSorting: false,
      enableMultiSort: true,
    })
  })

  it('дескриптор зарегистрирован в rightHeaderSlot', () => {
    const { folded } = makeTable()
    expect(folded.slotActions.rightHeaderSlot.map(a => a.id)).toContain('columnSorting')
    // и виден таблице через commonFeature API
    const { table } = makeTable()
    expect(table.getSlotActions().rightHeaderSlot).toHaveLength(1)
  })

  it('поведение: sortedRowModel переупорядочивает строки', () => {
    const { table } = makeTable()
    table.setSorting([{ id: 'name', desc: false }])
    expect(table.getRowModel().rows.map((r: any) => r.original.name)).toEqual([
      'Анна',
      'Борис',
    ])
  })

  it('дескриптор: visible/active + onSelect сортирует и зовёт хук', () => {
    const { table, onToggleColumnSort } = makeTable()
    
    const ctx = headerCtx(table)

    expect(sortHeaderAction.visible!(ctx)).toBe(true)
    expect(sortHeaderAction.active!(ctx)).toBe(false)

    // Реальный клик всегда передаёт событие (v9 isMultiSortEvent читает shiftKey).
    sortHeaderAction.onSelect(ctx, { shiftKey: false } as never)

    expect(table.atoms.sorting.get()).toHaveLength(1)
    expect(onToggleColumnSort).toHaveBeenCalledWith('name', expect.anything())
    expect(sortHeaderAction.active!(headerCtx(table))).toBe(true)
  })

  it('дескриптор: menuItems разворачивается в asc/desc/сброс', () => {
    const { table } = makeTable()
    
    const items = sortHeaderAction.menuItems!(headerCtx(table), labels)
    expect(items.map((i: any) => i.id)).toEqual(['asc', 'desc', 'clear'])
  })
})
