/**
 * Авторская поверхность `definePlugin` (ADR 0028, DP1, DP3, DP10, DP12, DP15): запись
 * по форме идентична ручной, hook-слайс без undefined под ключом id, поле фич —
 * `features`, `TOptions` задаётся один раз, слоты как функция аргументов.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { TableFeature } from '../types'
import { definePlugin } from '../core/definePlugin'
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

  it('DP1: фабрика даёт запись, свёртка которой совпадает со свёрткой ручной', () => {
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
    expect(defined).toMatchObject(manual)

    const fold = (entry: object) => {
      const { options, slots, serviceColumns, hooks } = foldEntries([
        entry,
      ] as never) as unknown as Record<string, unknown>
      return { options, slots, serviceColumns, hooks }
    }
    expect(fold(defined)).toEqual(fold(manual))
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
