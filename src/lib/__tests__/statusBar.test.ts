/**
 * Headless-проверка слота нижней панели (ADR 0038, SB5): свёртка `statusBarSlot`
 * из активных записей.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import type { PluginSlot } from '../core/createSlots'
import { foldEntries } from '../core/features'

type StatusBarPluginSlot = Extract<PluginSlot, { slot: 'statusBarSlot' }>

const item = (
  id: string,
  extra: Partial<StatusBarPluginSlot> = {},
): StatusBarPluginSlot => ({
  id,
  slot: 'statusBarSlot',
  component: () => null,
  ...extra,
})

describe('statusBarSlot — нижняя панель', () => {
  it('SB5: слот дедуплицируется по id — дубль обновляет запись; у enabled:false слота нет', () => {
    const folded = foldEntries([
      { id: 'a', slots: [item('pagination')] },
      {
        id: 'b',
        slots: [item('selected'), item('pagination', { align: 'end' })],
      },
      { id: 'c', enabled: false, slots: [item('status')] },
    ])
    expect(folded.slots.statusBarSlot.map(entry => entry.id)).toEqual([
      'pagination',
      'selected',
    ])
    expect(folded.slots.statusBarSlot[0].align).toBe('end')
  })
})
