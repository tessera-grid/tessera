/**
 * Фаза C — юнит-покрытие портированной слот-машинерии (чистые функции).
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { describe, expect, it } from 'vitest'

import {
  createEmptyRenderSlots,
  registerSlotInto,
} from '../core/createSlots'
import {
  createEmptySlotActions,
  registerSlotActionInto,
  resolveActionLayout,
  resolveMenuItems,
} from '../core/headerActions'
import type { SlotAction } from '../core/headerActions'

const action = (over: Partial<SlotAction> & Pick<SlotAction, 'id'>): SlotAction => ({
  slot: 'rightHeaderSlot',
  icon: () => null,
  label: () => over.id,
  onSelect: () => {},
  ...over,
})

describe('createSlots: registerSlotInto', () => {
  it('пустой набор содержит все пять слотов', () => {
    expect(Object.keys(createEmptyRenderSlots()).sort()).toEqual(
      ['actionRowSlot', 'leftCellSlot', 'leftHeaderSlot', 'rightCellSlot', 'rightHeaderSlot'].sort(),
    )
  })

  it('дедуплицирует по id в пределах слота (обновление на месте)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'a', slot: 'rightHeaderSlot', component: () => null })
    registerSlotInto(slots, { id: 'a', slot: 'rightHeaderSlot', visible: false })
    expect(slots.rightHeaderSlot).toHaveLength(1)
    expect(slots.rightHeaderSlot[0].visible).toBe(false)
  })

  it('order числом вставляет по индексу, без order — в конец', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'a', slot: 'rightHeaderSlot' })
    registerSlotInto(slots, { id: 'b', slot: 'rightHeaderSlot' })
    registerSlotInto(slots, { id: 'c', slot: 'rightHeaderSlot', order: 0 })
    expect(slots.rightHeaderSlot.map(s => s.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('headerActions: registerSlotActionInto', () => {
  it('дедуп по id и вставка по order', () => {
    const actions = createEmptySlotActions()
    registerSlotActionInto(actions, action({ id: 'a' }))
    registerSlotActionInto(actions, action({ id: 'b' }))
    registerSlotActionInto(actions, action({ id: 'c', order: 0 }))
    registerSlotActionInto(actions, action({ id: 'a', disabled: () => true }))
    expect(actions.rightHeaderSlot.map(a => a.id)).toEqual(['c', 'a', 'b'])
    expect(actions.rightHeaderSlot.find(a => a.id === 'a')?.disabled?.({})).toBe(true)
  })
})

describe('headerActions: resolveActionLayout', () => {
  it('без конфига — все действия инлайн', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a' }), action({ id: 'b' })],
      opaqueCount: 0,
      config: undefined,
      ctx: {},
    })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['a', 'b'])
  })

  it('порог достигнут (с учётом opaqueCount) — схлопывание в кебаб', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a' }), action({ id: 'b' })],
      opaqueCount: 1,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.menu.map(a => a.id)).toEqual(['a', 'b'])
  })

  it('collapsible:false остаётся инлайн при схлопывании', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a' }), action({ id: 'grip', collapsible: false })],
      opaqueCount: 0,
      config: { mode: 'always', threshold: 0 },
      ctx: {},
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.inline.map(a => a.id)).toEqual(['grip'])
    expect(layout.menu.map(a => a.id)).toEqual(['a'])
  })

  it('visible:false исключает действие целиком', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a', visible: () => false }), action({ id: 'b' })],
      opaqueCount: 0,
      config: undefined,
      ctx: {},
    })
    expect(layout.inline.map(a => a.id)).toEqual(['b'])
  })
})

describe('headerActions: resolveMenuItems', () => {
  it('без menuItems — одна строка из полей дескриптора', () => {
    const items = resolveMenuItems(action({ id: 'a', active: () => true }), {}, {} as never)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'a', active: true })
  })

  it('с menuItems — разворот в несколько пунктов', () => {
    const items = resolveMenuItems(
      action({
        id: 'sort',
        menuItems: () => [
          { id: 'asc', label: 'ASC', onSelect: () => {} },
          { id: 'desc', label: 'DESC', onSelect: () => {} },
        ],
      }),
      {},
      {} as never,
    )
    expect(items.map(i => i.id)).toEqual(['asc', 'desc'])
  })
})
