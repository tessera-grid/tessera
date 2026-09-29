/**
 * Юнит-покрытие слот-машинерии (чистые функции).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { createEmptyRenderSlots, registerSlotInto } from '../core/createSlots'
import {
  createEmptySlotActions,
  registerSlotActionInto,
  resolveActionLayout,
  resolveMenuItems,
} from '../core/headerActions'
import type { SlotAction } from '../core/headerActions'

const action = (
  over: Partial<SlotAction> & Pick<SlotAction, 'id'>,
): SlotAction => ({
  slot: 'rightHeaderSlot',
  icon: () => null,
  label: () => over.id,
  onSelect: () => {},
  ...over,
})

describe('createSlots: registerSlotInto', () => {
  it('пустой набор содержит все семь слотов', () => {
    expect(Object.keys(createEmptyRenderSlots()).sort()).toEqual(
      [
        'actionRowSlot',
        'cellSlot',
        'leftCellSlot',
        'leftHeaderSlot',
        'rightCellSlot',
        'rightHeaderSlot',
        'toolbarSlot',
      ].sort(),
    )
  })

  it('дедуплицирует по id в пределах слота (обновление на месте)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, {
      id: 'a',
      slot: 'rightHeaderSlot',
      component: () => null,
    })
    registerSlotInto(slots, {
      id: 'a',
      slot: 'rightHeaderSlot',
      visible: false,
    })
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

  // cellSlot — владелец контента ячейки, владение эксклюзивно. Дев-варн ядра
  // (useCreateTable) сигналит по числу владельцев ПОСЛЕ дедупа по id: разные id —
  // конфликт (вкладываются), одинаковый id — схлопнут (не конфликт).
  it('cellSlot: разные id владельцев сосуществуют (сигнал конфликта для дев-варна)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'a', slot: 'cellSlot' })
    registerSlotInto(slots, { id: 'b', slot: 'cellSlot' })
    expect(slots.cellSlot.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('cellSlot: одинаковый id владельца дедуплицируется (не конфликт)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'x', slot: 'cellSlot' })
    registerSlotInto(slots, { id: 'x', slot: 'cellSlot' })
    expect(slots.cellSlot).toHaveLength(1)
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
    expect(
      actions.rightHeaderSlot.find(a => a.id === 'a')?.disabled?.({}),
    ).toBe(true)
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
      actions: [
        action({ id: 'a' }),
        action({ id: 'grip', collapsible: false }),
      ],
      opaqueCount: 0,
      config: { mode: 'always', threshold: 0 },
      ctx: {},
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.inline.map(a => a.id)).toEqual(['grip'])
    expect(layout.menu.map(a => a.id)).toEqual(['a'])
  })

  it("AM22: placement:'menu' не рисуется инлайн; кебаб показан и сам считается в пороге одной кнопкой", () => {
    const hide = action({ id: 'hide', placement: 'menu' })
    // pin + кебаб = 2 < 3: pin остаётся кнопкой, кебаб — ради menu-действия.
    const below = resolveActionLayout({
      actions: [action({ id: 'pin' }), hide],
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(below.collapsed).toBe(true)
    expect(below.inline.map(a => a.id)).toEqual(['pin'])
    expect(below.menu.map(a => a.id)).toEqual(['hide'])

    // pin + sort + кебаб = 3: порог достигнут — всё в кебабе, по order.
    const above = resolveActionLayout({
      actions: [
        action({ id: 'pin', order: 0 }),
        action({ id: 'sort', order: 1 }),
        action({ ...hide, order: 2 }),
      ],
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(above.inline).toEqual([])
    expect(above.menu.map(a => a.id)).toEqual(['pin', 'sort', 'hide'])
  })

  it("AM23: без плагина-меню действие placement:'menu' не показывается нигде", () => {
    const layout = resolveActionLayout({
      actions: [
        action({ id: 'pin' }),
        action({ id: 'hide', placement: 'menu' }),
      ],
      opaqueCount: 0,
      config: undefined,
      ctx: {},
    })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['pin'])
    expect(layout.menu).toEqual([])
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
    const items = resolveMenuItems(
      action({ id: 'a', active: () => true }),
      {},
      {} as never,
    )
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
