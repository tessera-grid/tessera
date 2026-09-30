/**
 * Слоты как функция аргументов фабрики `definePlugin` (ADR 0028, DP15).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { definePlugin } from '../core/definePlugin'

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
