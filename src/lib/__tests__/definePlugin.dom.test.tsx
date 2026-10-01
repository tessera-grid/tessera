// @vitest-environment happy-dom
/**
 * Каналы плагина в слот-компоненте (ADR 0028, DP9): `hooks` и — у слота с
 * `state: true` — пара локального `state` приходят пропсами, запись — сеттером из
 * пары; обёртка компонента стабильна между вызовами фабрики, слот не перемонтируется.
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { definePlugin } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Opts {
  enabled?: boolean
  label?: string
}

describe('каналы плагина в слоте', () => {
  it('DP9: hooks и пара state приходят пропсами, сеттер пишет срез; обёртка стабильна между вызовами фабрики', () => {
    const seen: { label: string; count: number }[] = []
    let increment: (() => void) | undefined
    const Probe = (props: {
      hooks: { label: string }
      state: [number, (next: number) => void]
    }) => {
      seen.push({ label: props.hooks.label, count: props.state[0] })
      increment = () => props.state[1](props.state[0] + 1)
      return null
    }
    const probe = definePlugin<Opts>()({
      id: 'probe',
      state: () => 0,
      hooks: o => ({ label: o.label ?? 'default' }),
      slots: [
        { id: 'probe', slot: 'rightCellSlot', state: true, component: Probe },
      ],
    })
    expect(probe({ label: 'a' }).slots?.[0].component).toBe(
      probe({ label: 'b' }).slots?.[0].component,
    )

    let table: any
    const Host = () => {
      table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name' }],
        data: [{ id: '1', name: 'A' }],
        plugins: [probe({ label: 'live' })],
      } as never)
      const slot = table.getRenderSlots().rightCellSlot[0]
      return createElement(
        slot.component,
        table.getRow('1').getAllCells()[0].getContext(),
      )
    }
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Host />))
    expect(seen.at(-1)).toEqual({ label: 'live', count: 0 })

    act(() => increment!())
    expect(seen.at(-1)).toEqual({ label: 'live', count: 1 })
    expect(table.atoms['plugin:probe'].get()).toBe(1)
    act(() => root.unmount())
  })
})
