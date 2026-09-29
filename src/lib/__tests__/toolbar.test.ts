/**
 * Headless-проверки слота тулбара (ADR 0035, TB8–TB9): свёртка `toolbarSlot` из
 * активных записей и раскладка кнопок по подгруппам.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import type { PluginSlot } from '../core/createSlots'
import { foldEntries } from '../core/features'
import { resolveToolbarGroups } from '../core/toolbar'

type ToolbarPluginSlot = Extract<PluginSlot, { slot: 'toolbarSlot' }>

const button = (
  id: string,
  extra: Partial<ToolbarPluginSlot> = {},
): ToolbarPluginSlot => ({
  id,
  slot: 'toolbarSlot',
  component: () => null,
  ...extra,
})

describe('toolbarSlot — кнопки тулбара', () => {
  it('TB8: плагин добавляет кнопку слотом toolbarSlot; дубль id обновляет запись; у enabled:false кнопки нет', () => {
    const folded = foldEntries([
      { id: 'a', slots: [button('columns')] },
      { id: 'b', slots: [button('export'), button('columns', { group: 'x' })] },
      { id: 'c', enabled: false, slots: [button('density')] },
    ])
    expect(folded.slots.toolbarSlot.map(entry => entry.id)).toEqual([
      'columns',
      'export',
    ])
    expect(folded.slots.toolbarSlot[0].group).toBe('x')
  })

  it('TB9: группы идут по наименьшему order своих кнопок, кнопки внутри — по order; без order — в конец', () => {
    const { slots } = foldEntries([
      {
        id: 'p',
        slots: [
          button('export', { group: 'data', order: 20 }),
          button('settings', { group: 'view', order: 5 }),
          button('noOrder', { group: 'view' }),
          button('density', { group: 'view', order: 1 }),
          button('import', { group: 'data', order: 10 }),
        ],
      },
    ])
    expect(
      resolveToolbarGroups(slots.toolbarSlot).map(group => [
        group.id,
        group.items.map(item => item.id),
      ]),
    ).toEqual([
      ['view', ['density', 'settings', 'noOrder']],
      ['data', ['import', 'export']],
    ])
  })
})
