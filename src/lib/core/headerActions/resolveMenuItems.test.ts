import { describe, expect, test, vi } from 'vitest'

import { TableLabels } from '../localization'
import { resolveMenuItems } from './resolveMenuItems'
import { HeaderMenuItem, SlotAction } from './types'

// Модульные тесты чистого разрешения пунктов подгруппы меню (ADR 0024, AM20–AM21).
// Белый ящик над `resolveMenuItems`: разворот `menuItems` (напр. сортировка
// asc/desc/сброс, пин слева/справа) vs одиночная строка из полей дескриптора с
// дефолтами. Один тест = одно требование (AM<n>).

const labels = {} as TableLabels
const ctx = { marker: 'ctx' }

/** Минимальный дескриптор; `over` переопределяет нужные поля под кейс. */
const action = (over: Partial<SlotAction> = {}): SlotAction => ({
  id: 'act',
  slot: 'rightHeaderSlot',
  icon: () => 'icon',
  label: () => 'label',
  onSelect: () => {},
  ...over,
})

describe('resolveMenuItems (ADR 0024)', () => {
  test('AM20: при заданном menuItems возвращает его результат, делегируя ctx/labels', () => {
    const items: HeaderMenuItem[] = [
      { id: 'left', label: 'Pin left', onSelect: () => {} },
      { id: 'right', label: 'Pin right', onSelect: () => {} },
    ]
    const menuItems = vi.fn(() => items)

    const result = resolveMenuItems(action({ menuItems }), ctx, labels)

    // Разворот отдан дескриптору целиком (сортировка / пин слева-справа).
    expect(result).toBe(items)
    expect(menuItems).toHaveBeenCalledWith(ctx, labels)
  })

  test('AM21: без menuItems строит одну строку из полей дескриптора с дефолтами', () => {
    const onSelect = vi.fn()

    const result = resolveMenuItems(
      // disabled/active не заданы → дефолт false; onSelect строки оборачивает
      // action.onSelect(ctx).
      action({ id: 'pin', label: () => 'Pin', icon: () => 'pinIcon', onSelect }),
      ctx,
      labels,
    )

    expect(result).toHaveLength(1)
    const [item] = result
    expect(item.id).toBe('pin')
    expect(item.label).toBe('Pin')
    expect(item.icon).toBe('pinIcon')
    expect(item.disabled).toBe(false)
    expect(item.active).toBe(false)

    item.onSelect()
    expect(onSelect).toHaveBeenCalledWith(ctx)

    // Заданные disabled/active пробрасываются как есть.
    const [flagged] = resolveMenuItems(
      action({ disabled: () => true, active: () => true }),
      ctx,
      labels,
    )
    expect(flagged.disabled).toBe(true)
    expect(flagged.active).toBe(true)
  })
})
