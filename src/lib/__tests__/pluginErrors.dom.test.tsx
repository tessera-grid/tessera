// @vitest-environment happy-dom
/**
 * Падение `setup` и `reconcile` плагина изолировано (ADR 0037, PE3, PE6).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../core/logger'
import { useCreateTable } from '../core/useCreateTable'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const DATA = [{ id: '1', name: 'A' }]

describe('изоляция setup и reconcile плагинов', () => {
  it('PE3: исключение в setup не роняет таблицу и не мешает setup остальных плагинов', () => {
    __resetLogger()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const goodSetup = vi.fn()
    const plugins = [
      {
        id: 'bad',
        setup: () => {
          throw new Error('setup failed')
        },
      },
      { id: 'good', setup: goodSetup },
    ] as const
    let table: any

    const Grid = () => {
      table = useCreateTable({
        columns: COLUMNS,
        data: DATA,
        plugins,
      } as never)
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    expect(() => act(() => root.render(<Grid />))).not.toThrow()

    expect(goodSetup).toHaveBeenCalledTimes(1)
    expect(
      table.getPluginDiagnostics().find((d: { id: string }) => d.id === 'bad'),
    ).toEqual({ id: 'bad', status: 'error', error: 'setup failed' })

    act(() => root.unmount())
    errorSpy.mockRestore()
    __resetLogger()
  })

  it('PE6: исключение в reconcile не роняет таблицу и не мешает reconcile остальных плагинов', () => {
    __resetLogger()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const goodReconcile = vi.fn()
    const plugins = [
      {
        id: 'bad',
        reconcile: () => {
          throw new Error('reconcile failed')
        },
      },
      { id: 'good', reconcile: goodReconcile },
    ] as const
    let table: any

    const Grid = () => {
      table = useCreateTable({
        columns: COLUMNS,
        data: DATA,
        plugins,
      } as never)
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    expect(() => act(() => root.render(<Grid />))).not.toThrow()

    expect(goodReconcile).toHaveBeenCalled()
    expect(
      table.getPluginDiagnostics().find((d: { id: string }) => d.id === 'bad'),
    ).toEqual({ id: 'bad', status: 'error', error: 'reconcile failed' })

    act(() => root.unmount())
    errorSpy.mockRestore()
    __resetLogger()
  })
})
