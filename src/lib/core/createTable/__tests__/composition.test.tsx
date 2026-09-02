import type { AccessorKeyColumnDef } from '@tanstack/react-table'
import { renderHook } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { RegistryEntry, ServiceColumn, TablePlugin } from '../../pluginContract'
import { useCreateTable } from '../useCreateTable'

// Приёмочные тесты инверсии (docs/decisions/0010-invert-core-plugins-registry.md):
// R2 (добавление плагина = одна запись, ноль правок ядра), R4 (пользовательский
// плагин приносит feature/column/options наравне со встроенными), R5 (common
// всегда включён). Плагины здесь определены ЦЕЛИКОМ в тесте — сам факт, что это
// работает без правок ядра, и есть доказательство R2.

const columns = [
  { id: 'a', accessorKey: 'a' },
  { id: 'b', accessorKey: 'b' },
] as unknown as AccessorKeyColumnDef<any>[]

const data = [
  { id: '1', a: 'x', b: 'y' },
  { id: '2', a: 'z', b: 'w' },
]

const leafIds = (table: any): string[] =>
  table.getAllLeafColumns().map((c: { id: string }) => c.id)

describe('Композиция плагинов — common всегда включён (R5)', () => {
  test('с пустым списком плагинов common всё равно вклеен ядром', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({ columns, data, plugins: [] }),
    )

    // getIsActionsColumn ставит именно commonPlugin.createColumn — если common
    // не вклеен, метода не будет.
    const column = result.current.getAllLeafColumns()[0]
    expect(typeof column.getIsActionsColumn).toBe('function')
    expect(column.getIsActionsColumn()).toBe(false)
  })
})

describe('Композиция плагинов — паритет пользовательского плагина (R2/R4)', () => {
  // Пользовательский плагин, определённый целиком здесь: приносит feature
  // (метод на колонке), сервисную колонку и опции — тем же способом, что встроенный.
  const customFeature: TablePlugin = {
    createColumn: column => {
      // @ts-expect-error — кастомный метод, augmentation в тесте не нужен
      column.getCustomFlag = () => true
    },
  }
  const customColumn: ServiceColumn = {
    id: 'customCol',
    make: () => ({ id: 'customCol', accessorKey: 'customCol' }) as any,
    side: 'trailing',
    order: 5,
  }
  const customPlugin = (): RegistryEntry => ({
    id: 'custom',
    feature: customFeature,
    column: customColumn,
    options: { debugTable: false } as RegistryEntry['options'],
  })

  test('пользовательский плагин приносит свою сервисную колонку (R4 column)', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({ columns, data, plugins: [customPlugin()] }),
    )
    expect(leafIds(result.current)).toContain('customCol')
  })

  test('пользовательский плагин приносит свою feature-логику (R4 feature)', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({ columns, data, plugins: [customPlugin()] }),
    )
    const dataColumn = result.current.getColumn('a')
    // @ts-expect-error — кастомный метод от плагина
    expect(dataColumn?.getCustomFlag()).toBe(true)
  })
})

describe('Композиция плагинов — управление списком (R2)', () => {
  const markerPlugin = (enabled?: boolean): RegistryEntry => ({
    id: 'marker',
    enabled,
    feature: {},
    column: {
      id: 'markerCol',
      make: () => ({ id: 'markerCol', accessorKey: 'markerCol' }) as any,
      side: 'trailing',
      order: 9,
    },
  })

  test('enabled: false отключает плагин (запись отсеивается)', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({ columns, data, plugins: [markerPlugin(false)] }),
    )
    expect(leafIds(result.current)).not.toContain('markerCol')
  })

  test('enabled по умолчанию (undefined) — плагин включён', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({ columns, data, plugins: [markerPlugin()] }),
    )
    expect(leafIds(result.current)).toContain('markerCol')
  })

  test('falsy-записи в списке игнорируются', async () => {
    const { result } = await renderHook(() =>
      useCreateTable({
        columns,
        data,
        plugins: [false, null, markerPlugin(), undefined],
      }),
    )
    expect(leafIds(result.current)).toContain('markerCol')
  })
})
