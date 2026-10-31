/**
 * Статус `error` в снимке плагинов и лог пойманных ошибок (ADR 0037, PE4–PE5);
 * стабильная обёртка шаблонов сервисной колонки (PE8).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { __resetLogger, __setLoggerProduction } from '../util/logger'
import { withPluginBoundary } from '../core/pluginBoundary'
import { rowSelection } from '../plugins/rowSelection'

const build = (plugins: any[]) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: [{ id: '1', name: 'X' }],
    columns: [{ id: 'name', accessorKey: 'name' }],
    getRowId: (row: any) => row.id,
    ...folded.options,
    pluginDiagnostics: folded.pluginDiagnostics,
  } as never) as any
}

const statusOf = (table: any, id: string) =>
  table.getPluginDiagnostics().find((d: { id: string }) => d.id === id)

describe('ошибки плагинов в снимке', () => {
  let errorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    __resetLogger()
    __setLoggerProduction(false)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    __setLoggerProduction(undefined)
    __resetLogger()
  })

  it("PE4: исключение в diagnose не выходит из getPluginDiagnostics — плагин получает status 'error'", () => {
    const table = build([
      {
        id: 'broken',
        diagnose: () => {
          throw new Error('diagnose failed')
        },
      },
      rowSelection(),
    ])

    expect(() => table.getPluginDiagnostics()).not.toThrow()
    expect(statusOf(table, 'broken')).toEqual({
      id: 'broken',
      status: 'error',
      error: 'diagnose failed',
    })
    expect(statusOf(table, 'rowSelection')).toEqual({
      id: 'rowSelection',
      status: 'active',
    })
  })

  it("PE5: пойманная ошибка пишется logError один раз на плагин; status 'error' важнее inert", () => {
    const table = build([{ id: 'menu', diagnose: () => 'noActions' }])
    expect(statusOf(table, 'menu').status).toBe('inert')

    table.reportPluginError('menu', new Error('first'))
    table.reportPluginError('menu', new Error('second'))

    expect(statusOf(table, 'menu')).toEqual({
      id: 'menu',
      status: 'error',
      error: 'first',
    })
    const messages = errorSpy.mock.calls.map(call => String(call[0]))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('menu')
    expect(messages[0]).toContain('first')
  })
})

describe('граница сервисной колонки', () => {
  it('PE8: withPluginBoundary для того же шаблона cell и header и того же id плагина отдаёт ту же обёртку, для другого id — другую', () => {
    const cell = () => null
    const header = () => null
    const first = withPluginBoundary({ id: 'mark', cell, header }, 'marks')
    const again = withPluginBoundary({ id: 'mark', cell, header }, 'marks')
    const other = withPluginBoundary({ id: 'mark', cell, header }, 'others')

    expect(first.cell).not.toBe(cell)
    expect(again.cell).toBe(first.cell)
    expect(again.header).toBe(first.header)
    expect(other.cell).not.toBe(first.cell)
    expect(other.header).not.toBe(first.header)
  })
})
