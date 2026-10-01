/**
 * Авторская поверхность `definePlugin` (ADR 0028, DP1, DP3, DP6, DP7, DP10, DP12, DP15): запись
 * по форме идентична ручной, hook-слайс без undefined под ключом id, поле фич —
 * `features`, `TOptions` задаётся один раз, слоты как функция аргументов.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { TableFeature } from '../types'
import {
  definePlugin,
  type PluginCellProps,
  type PluginCellStateProps,
} from '../core/definePlugin'
import { buildTesseraFeatures, foldEntries } from '../core/features'

describe('definePlugin — слоты', () => {
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

describe('definePlugin — запись', () => {
  const probeFeature: TableFeature = {}
  const column = {
    id: 'probe-column',
    side: 'leading' as const,
    order: 1,
    make: () => ({ id: 'probe-column' }),
  }
  const slot = {
    id: 'probe-slot',
    slot: 'statusBarSlot' as const,
    component: () => null,
  }

  it('DP1: фабрика даёт запись, свёртка которой совпадает со свёрткой ручной; компонент слота обёрнут каналами плагина', () => {
    const onPing = () => {}
    const factory = definePlugin<{ enabled?: boolean; size?: number }>()({
      id: 'probe',
      features: { probeFeature },
      options: o => ({ probeSize: o.size ?? 1 }),
      hooks: () => ({ onPing }),
      column,
      slots: [slot],
    })
    const manual = {
      id: 'probe',
      features: { probeFeature },
      options: { probeSize: 3 },
      hooks: { probe: { onPing } },
      column,
      slots: [slot],
    }
    const defined = factory({ size: 3 })
    // Компонент слота definePlugin оборачивает каналами (DP9) — сверяем без него.
    const withoutComponents = (entry: { slots?: object[] }) => ({
      ...entry,
      slots: entry.slots?.map(
        ({ component: _component, ...rest }: any) => rest,
      ),
    })
    expect(withoutComponents(defined)).toMatchObject(withoutComponents(manual))
    expect(defined.slots?.[0].component).not.toBe(slot.component)

    const fold = (entry: object) => {
      const { options, slots, serviceColumns, hooks } = foldEntries([
        entry,
      ] as never) as unknown as Record<string, unknown>
      return { options, slots, serviceColumns, hooks }
    }
    expect(fold(withoutComponents(defined))).toEqual(
      fold(withoutComponents(manual)),
    )
  })

  it('DP3: hook-слайс лежит под id плагина, undefined-ключи отброшены', () => {
    const onPing = () => {}
    const entry = definePlugin<{
      enabled?: boolean
      onPing?: () => void
      onPong?: () => void
    }>()({
      id: 'probe',
      hooks: o => ({ onPing: o.onPing, onPong: o.onPong }),
    })({ onPing })
    expect(entry.hooks).toEqual({ probe: { onPing } })
    expect(Object.keys(entry.hooks?.probe ?? {})).toEqual(['onPing'])
  })

  it('DP10: фичи плагина — поле features; прежнее поле slot не читается', () => {
    const defined = definePlugin<{ enabled?: boolean }>()({
      id: 'probe',
      features: { probeFeature },
    })()
    expect(Object.keys(buildTesseraFeatures([defined]))).toContain(
      'probeFeature',
    )
    const legacy = { id: 'legacy', slot: { legacyFeature: probeFeature } }
    expect(Object.keys(buildTesseraFeatures([legacy as never]))).not.toContain(
      'legacyFeature',
    )
  })

  it('DP12: TOptions задаётся один раз — o в options и hooks выводится без аннотации', () => {
    interface Opts {
      enabled?: boolean
      size?: number
    }
    const factory = definePlugin<Opts>()({
      id: 'probe',
      options: o => {
        expectTypeOf(o).toEqualTypeOf<Opts>()
        return { probeSize: o.size }
      },
      hooks: o => {
        expectTypeOf(o).toEqualTypeOf<Opts>()
        return {}
      },
    })
    expectTypeOf(factory).parameter(0).toEqualTypeOf<Opts | undefined>()
    expect(factory({ size: 2 }).options).toEqual({ probeSize: 2 })
  })
})

describe('definePlugin — типы слот-компонентов', () => {
  interface Opts {
    enabled?: boolean
  }
  const Ping = (props: PluginCellProps<{ onPing: () => void }>) => {
    props.hooks.onPing()
    return null
  }
  const Counter = (
    props: PluginCellStateProps<Record<never, never>, number>,
  ) => (props.state[0] > 0 ? null : null)

  it('DP6: компонент, написанный в слоте, получает типы хуков и состояния из деклараций плагина', () => {
    const plugin = definePlugin<Opts>()({
      id: 'inferred',
      state: () => 0,
      hooks: () => ({ onPing: () => {} }),
      slots: [
        {
          id: 'slot',
          slot: 'rightCellSlot',
          state: true,
          component: props => {
            expectTypeOf(props.hooks).toEqualTypeOf<{ onPing: () => void }>()
            expectTypeOf(props.state).toEqualTypeOf<
              [number, (next: number) => void]
            >()
            return null
          },
        },
      ],
    })
    expect(plugin().slots).toHaveLength(1)
  })

  it('DP7: компонент слота, ждущий хуки или состояние не того типа, не компилируется', () => {
    const matching = definePlugin<Opts>()({
      id: 'matching',
      hooks: () => ({ onPing: () => {} }),
      slots: [{ id: 'slot', slot: 'rightCellSlot', component: Ping }],
    })
    const otherHooks = definePlugin<Opts>()({
      id: 'otherHooks',
      // @ts-expect-error — компонент ждёт onPing, плагин объявил onPong
      hooks: () => ({ onPong: () => {} }),
      slots: [{ id: 'slot', slot: 'rightCellSlot', component: Ping }],
    })
    // @ts-expect-error — у плагина нет хуков, компонент их ждёт
    const noHooks = definePlugin<Opts>()({
      id: 'noHooks',
      slots: [{ id: 'slot', slot: 'rightCellSlot', component: Ping }],
    })
    const noState = definePlugin<Opts>()({
      id: 'noState',
      // @ts-expect-error — у плагина нет состояния, компонент его ждёт
      slots: [{ id: 'slot', slot: 'rightCellSlot', component: Counter }],
    })
    const otherState = definePlugin<Opts>()({
      id: 'otherState',
      state: () => 'text',
      slots: [
        // @ts-expect-error — состояние плагина — строка, компонент ждёт число
        { id: 'slot', slot: 'rightCellSlot', state: true, component: Counter },
      ],
    })
    const stateNotRequested = definePlugin<Opts>()({
      id: 'stateNotRequested',
      state: () => 0,
      // @ts-expect-error — слот не объявил state: true, компонент ждёт состояние
      slots: [{ id: 'slot', slot: 'rightCellSlot', component: Counter }],
    })
    const wrongSlot = definePlugin<Opts>()({
      id: 'wrongSlot',
      hooks: () => ({ onPing: () => {} }),
      // @ts-expect-error — компонент ячейки в слоте заголовка
      slots: [{ id: 'slot', slot: 'leftHeaderSlot', component: Ping }],
    })
    expect(
      [
        matching,
        otherHooks,
        noHooks,
        noState,
        otherState,
        stateNotRequested,
        wrongSlot,
      ].every(factory => typeof factory === 'function'),
    ).toBe(true)
  })
})
