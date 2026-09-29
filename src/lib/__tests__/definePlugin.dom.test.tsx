// @vitest-environment happy-dom
/**
 * Граница «мемо/живо» опций `definePlugin` (ADR 0028, DP14) и слоты как функция
 * аргументов фабрики (DP15).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { definePlugin } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name' }]
const data = [{ id: '1', name: 'A' }]

const probe = definePlugin<{ enabled?: boolean; value?: number }>()({
  id: 'probe',
  options: o => ({ probeFrozen: o.value }),
  liveOptions: o => ({ probeLive: o.value }),
})

let captured: any

const Host = ({ value }: { value: number }) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins: [probe({ value })],
  })
  return null
}

describe('definePlugin — опции и слоты', () => {
  it('DP14: liveOptions сворачиваются каждый рендер, options заморожены по сигнатуре набора', () => {
    const root = createRoot(document.createElement('div'))

    act(() => root.render(<Host value={1} />))
    expect(captured.options.probeFrozen).toBe(1)
    expect(captured.options.probeLive).toBe(1)

    act(() => root.render(<Host value={2} />))
    expect(captured.options.probeFrozen).toBe(1)
    expect(captured.options.probeLive).toBe(2)

    act(() => root.unmount())
  })

  it('DP15: slots-функция получает аргументы фабрики — набор слотов зависит от опций', () => {
    const counted = definePlugin<{ enabled?: boolean; badge?: boolean }>()({
      id: 'counted',
      slots: o =>
        o.badge
          ? [{ id: 'badge', slot: 'statusBarSlot', component: () => null }]
          : [],
    })
    expect(counted({ badge: true }).slots?.map(slot => slot.id)).toEqual([
      'badge',
    ])
    expect(counted().slots).toEqual([])
  })
})
