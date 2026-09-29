// @vitest-environment happy-dom
/**
 * Падение `setup` плагина изолировано (ADR 0037, PE3).
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

describe('изоляция setup плагинов', () => {
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
})
