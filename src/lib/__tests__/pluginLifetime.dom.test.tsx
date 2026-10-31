// @vitest-environment happy-dom
/**
 * Договоры на время жизни таблицы и начальные значения (ADR 0039, RX4–RX7): аргументы-
 * договоры и состав набора плагинов после монтирования не меняются, а предупреждают;
 * `initialPageSize` — семя состояния.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import { __resetLogger, __setLoggerProduction } from '../util/logger'
import { useCreateTable } from '../core/useCreateTable'
import { definePlugin } from '../core/definePlugin'
import { neverInert } from '../core/pluginDiagnostics'
import { pagination, rowSelection } from '../plugins'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const data = Array.from({ length: 60 }, (_, index) => ({
  id: String(index),
  name: `Name ${index}`,
}))

let captured: any
let root: Root | undefined
let warnSpy: MockInstance<typeof console.warn>

const Host = ({ plugins }: { plugins: TesseraFeatureEntry[] }) => {
  captured = useCreateTable({ columns: columns as never, data, plugins })
  return null
}

const render = (plugins: TesseraFeatureEntry[]) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(<Host plugins={plugins} />))
}

const warnings = () => warnSpy.mock.calls.map(call => String(call[0]))
const diagnosticOf = (id: string) =>
  captured
    .getPluginDiagnostics()
    .find((diagnostic: { id: string }) => diagnostic.id === id)

beforeEach(() => {
  __resetLogger()
  __setLoggerProduction(false)
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  warnSpy.mockRestore()
  __setLoggerProduction(undefined)
  __resetLogger()
})

describe('договоры на время жизни таблицы', () => {
  it('RX4: смена аргумента-договора (lifetime записи definePlugin) после монтирования не применяется и сопровождается dev-warn', () => {
    const contract = definePlugin<{ enabled?: boolean; mode?: string }>()({
      id: 'contract',
      lifetime: ['mode'],
      diagnose: neverInert,
      options: o => ({ contractMode: o.mode }),
    })
    render([contract({ mode: 'first' })])
    render([contract({ mode: 'second' })])

    expect(captured.options.contractMode).toBe('first')
    expect(warnings().some(text => text.includes('contract.mode'))).toBe(true)
  })

  it("RX5: плагин, добавленный после монтирования, инертен с причиной 'addedAfterMount' и сопровождается dev-warn с его id", () => {
    render([rowSelection()])
    render([rowSelection(), pagination()])

    expect(diagnosticOf('pagination')).toEqual({
      id: 'pagination',
      status: 'inert',
      reason: 'addedAfterMount',
    })
    expect(captured.getRenderSlots().statusBarSlot).toEqual([])
    expect(captured.getRowModel().rows).toHaveLength(60)
    expect(
      warnings().some(
        text => text.includes('pagination') && text.includes('добавлен'),
      ),
    ).toBe(true)
  })

  it('RX6: удаление плагина после монтирования выключает его как enabled: false и сопровождается dev-warn', () => {
    render([pagination()])
    expect(captured.getRowModel().rows).toHaveLength(25)

    render([])
    expect(captured.getRowModel().rows).toHaveLength(60)
    expect(captured.getRenderSlots().statusBarSlot).toEqual([])
    expect(diagnosticOf('pagination')).toEqual({
      id: 'pagination',
      status: 'inert',
      reason: 'removedAfterMount',
    })
    expect(
      warnings().some(
        text => text.includes('pagination') && text.includes('enabled: false'),
      ),
    ).toBe(true)
  })

  it('RX7: initialPageSize задаёт стартовый размер; его смена после монтирования текущий размер не меняет', () => {
    render([pagination({ initialPageSize: 10 })])
    expect(captured.atoms.pagination.get().pageSize).toBe(10)

    render([pagination({ initialPageSize: 50 })])
    expect(captured.atoms.pagination.get().pageSize).toBe(10)
    expect(captured.getRowModel().rows).toHaveLength(10)
  })
})
