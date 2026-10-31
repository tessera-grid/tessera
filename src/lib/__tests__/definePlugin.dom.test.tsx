// @vitest-environment happy-dom
/**
 * Каналы плагина в слот-компоненте (ADR 0028, DP9): `hooks` и — у слота с
 * `state: true` — пара локального `state` приходят пропсами, запись — сеттером из
 * пары; обёртка компонента стабильна между вызовами фабрики, слот не перемонтируется.
 * Внешнее локальное состояние (DP8, DP17, DP18): значение из опции плагина
 * переносится в срез по новой ссылке, изменения изнутри приходят в `onChange`, смена
 * значения не пересобирает настройку. Сервисная колонка (DP20): `hooks` в ячейку
 * подмешивает `definePlugin` по `id`.
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { definePlugin, type PluginCellProps } from '../core/definePlugin'
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

describe('каналы плагина в сервисной колонке', () => {
  it('DP20: ячейка сервисной колонки получает живые hooks плагина без указания scope; обёртка стабильна между вызовами фабрики', () => {
    const seen: string[] = []
    const Cell = (props: PluginCellProps<{ label: string }>) => {
      seen.push(props.hooks.label)
      return null
    }
    const probe = definePlugin<Opts>()({
      id: 'probe',
      hooks: o => ({ label: o.label ?? 'default' }),
      column: {
        id: 'probe-column',
        side: 'leading',
        order: 1,
        cell: Cell,
        make: ({ cell }) => ({ id: 'probe-column', cell }),
      },
    })
    const cellOf = (entry: ReturnType<typeof probe>) =>
      (entry.column!.make() as { cell: unknown }).cell
    expect(cellOf(probe({ label: 'a' }))).toBe(cellOf(probe({ label: 'b' })))

    const Host = () => {
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name' }],
        data: [{ id: '1', name: 'A' }],
        plugins: [probe({ label: 'live' })],
      } as never) as any
      const cell = table
        .getRow('1')
        .getAllCells()
        .find((c: any) => c.column.id === 'probe-column')
      return createElement(cell.column.columnDef.cell, cell.getContext())
    }
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Host />))
    expect(seen.at(-1)).toBe('live')
    act(() => root.unmount())
  })
})

interface CounterOpts {
  enabled?: boolean
  count?: number
  onCountChange?: (next: number) => void
  initialCount?: number
  label?: string
}

describe('внешнее локальное состояние', () => {
  const setup = vi.fn()
  let write: ((next: number) => void) | undefined
  const counter = definePlugin<CounterOpts>()({
    id: 'counter',
    state: () => 0,
    stateName: 'count',
    slots: o => [
      {
        id: `counter-${o.label ?? ''}`,
        slot: 'statusBarSlot',
        state: true,
        component: props => {
          write = props.state[1]
          return null
        },
      },
    ],
    setup: () => () => {
      setup()
    },
  })

  let table: any
  const Host = (props: CounterOpts) => {
    table = useCreateTable({
      columns: [{ id: 'name', accessorKey: 'name' }],
      data: [{ id: '1', name: 'A' }],
      plugins: [counter(props)],
    } as never)
    const slot = table.getRenderSlots().statusBarSlot[0]
    return createElement(slot.component, { table })
  }
  const value = () => table.atoms['plugin:counter'].get()
  const mount = () => {
    const root = createRoot(document.createElement('div'))
    return {
      render: (props: CounterOpts) =>
        act(() => root.render(<Host {...props} />)),
      unmount: () => act(() => root.unmount()),
    }
  }

  it('DP8: с аргументом <имя> локальным срезом владеет приложение: срез равен значению аргумента, изменение изнутри приходит колбэку и срез не меняет до нового значения; без аргумента — дефолт state или initial<Имя>, изменения изнутри пишутся в срез', () => {
    const own = mount()
    own.render({})
    expect(value()).toBe(0)
    act(() => write!(7))
    expect(value()).toBe(7)
    own.unmount()

    const initial = mount()
    initial.render({ initialCount: 3 })
    expect(value()).toBe(3)
    initial.unmount()

    const onCountChange = vi.fn()
    const app = mount()
    app.render({ count: 5, onCountChange })
    expect(value()).toBe(5)
    act(() => write!(7))
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(7)
    expect(value()).toBe(5)
    app.render({ count: 7, onCountChange })
    expect(value()).toBe(7)
    app.unmount()
  })

  it('DP17: изменение локального среза изнутри (сеттер пары state, setPluginState) приходит в on<Имя>Change с новым значением — с аргументом <имя> и без него; новое значение от приложения колбэк не зовёт', () => {
    const onCountChange = vi.fn()
    const host = mount()
    host.render({ count: 1, onCountChange })
    expect(onCountChange).not.toHaveBeenCalled()
    act(() => write!(2))
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(2)
    host.render({ count: 3, onCountChange })
    expect(onCountChange).toHaveBeenCalledTimes(1)
    host.unmount()

    const own = vi.fn()
    const local = mount()
    local.render({ onCountChange: own })
    act(() => write!(4))
    expect(own).toHaveBeenCalledExactlyOnceWith(4)
    expect(value()).toBe(4)
    local.unmount()
  })

  it('DP18: новое значение аргумента <имя> не пересобирает настройку плагина; смена обычной опции — пересобирает', () => {
    const host = mount()
    host.render({ count: 1, label: 'a' })
    const slots = table.getRenderSlots()
    setup.mockClear()
    host.render({ count: 2, label: 'a' })
    host.render({ count: 3, label: 'a' })
    expect(table.getRenderSlots()).toBe(slots)
    expect(setup).not.toHaveBeenCalled()
    host.render({ count: 3, label: 'b' })
    expect(table.getRenderSlots()).not.toBe(slots)
    expect(setup).toHaveBeenCalledTimes(1)
    host.unmount()
  })
})
