/**
 * Число включённых действий для знака на кебабе (ADR 0062, AI9).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { countActiveActions, type MenuAction } from '../core/headerActions'

const action = (
  id: string,
  extra: Partial<MenuAction<{ on: string[] }>> = {},
): MenuAction<{ on: string[] }> => ({
  id,
  icon: () => null,
  label: () => id,
  onSelect: () => {},
  ...extra,
})

describe('countActiveActions', () => {
  it('AI9: считает действия с active(ctx) === true, не считает скрытые visible(ctx) === false и действия без active', () => {
    const ctx = { on: ['sort', 'pin', 'hidden'] }
    const isOn = (id: string) => (c: { on: string[] }) => c.on.includes(id)
    const actions = [
      action('sort', { active: isOn('sort') }),
      action('pin', { active: isOn('pin'), visible: () => true }),
      action('filter', { active: isOn('filter') }),
      action('hidden', { active: isOn('hidden'), visible: () => false }),
      action('plain'),
    ]

    expect(countActiveActions(actions, ctx)).toBe(2)
    expect(countActiveActions(actions, { on: [] })).toBe(0)
    expect(countActiveActions([], ctx)).toBe(0)
  })
})
