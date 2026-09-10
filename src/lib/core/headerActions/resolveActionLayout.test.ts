import { describe, expect, test } from 'vitest'

import { resolveActionLayout } from './resolveActionLayout'
import { SlotAction, SlotMenuConfig } from './types'

// Модульные тесты чистого движка раскладки действий слота (ADR 0024, AM1–AM9).
// Белый ящик над `resolveActionLayout`: порог, all-or-nothing, счётчик опаковых,
// gating по `visible`, `collapsible`, порядок. Один тест = одно требование (AM<n>).

/** Минимальный дескриптор; `over` переопределяет нужные поля под конкретный кейс. */
const action = (id: string, over: Partial<SlotAction> = {}): SlotAction => ({
  id,
  slot: 'rightHeaderSlot',
  icon: () => null,
  label: () => id,
  onSelect: () => {},
  ...over,
})

const AUTO: SlotMenuConfig = { mode: 'auto', threshold: 3 }
const ALWAYS: SlotMenuConfig = { mode: 'always', threshold: 3 }
const ctx = {}

const ids = (list: SlotAction[]) => list.map(a => a.id)

describe('resolveActionLayout (ADR 0024)', () => {
  test('AM1: без конфига меню все применимые действия инлайн, схлопывания нет', () => {
    const actions = [action('a'), action('b'), action('c')]

    const layout = resolveActionLayout({
      actions,
      opaqueCount: 0,
      config: undefined,
      ctx,
    })

    expect(layout.collapsed).toBe(false)
    expect(ids(layout.inline)).toEqual(['a', 'b', 'c'])
    expect(layout.menu).toEqual([])
  })

  test('AM2: auto — применимых меньше порога → все инлайн', () => {
    const layout = resolveActionLayout({
      actions: [action('a'), action('b')],
      opaqueCount: 0,
      config: AUTO,
      ctx,
    })

    expect(layout.collapsed).toBe(false)
    expect(ids(layout.inline)).toEqual(['a', 'b'])
    expect(layout.menu).toEqual([])
  })

  test('AM3: auto — применимых не меньше порога → все схлопываемые в кебаб', () => {
    const layout = resolveActionLayout({
      actions: [action('a'), action('b'), action('c')],
      opaqueCount: 0,
      config: AUTO,
      ctx,
    })

    expect(layout.collapsed).toBe(true)
    expect(layout.inline).toEqual([])
    expect(ids(layout.menu)).toEqual(['a', 'b', 'c'])
  })

  test('AM4: опаковые добивают счётчик до порога, но сами в кебаб не уезжают', () => {
    const layout = resolveActionLayout({
      actions: [action('a')],
      opaqueCount: 2,
      config: AUTO,
      ctx,
    })

    // 1 применимый + 2 опаковых = 3 ≥ порог → схлопывание; в меню только дескриптор.
    expect(layout.collapsed).toBe(true)
    expect(ids(layout.menu)).toEqual(['a'])
    expect(layout.inline).toEqual([])
  })

  test('AM5: mode "always" схлопывает независимо от счётчика', () => {
    const layout = resolveActionLayout({
      actions: [action('a')],
      opaqueCount: 0,
      config: ALWAYS,
      ctx,
    })

    expect(layout.collapsed).toBe(true)
    expect(ids(layout.menu)).toEqual(['a'])
  })

  test('AM6: visible === false убирает действие целиком и из счётчика', () => {
    const layout = resolveActionLayout({
      actions: [
        action('a'),
        action('hidden', { visible: () => false }),
        action('b'),
      ],
      opaqueCount: 0,
      config: AUTO,
      ctx,
    })

    // Применимых 2 (< порог 3): не схлопнуто, скрытого нет нигде.
    expect(layout.collapsed).toBe(false)
    expect(ids(layout.inline)).toEqual(['a', 'b'])
    expect(ids(layout.menu)).not.toContain('hidden')
  })

  test('AM7: collapsible === false остаётся инлайн при схлопывании', () => {
    const layout = resolveActionLayout({
      actions: [
        action('pin'),
        action('sort'),
        action('drag', { collapsible: false }),
      ],
      opaqueCount: 0,
      config: AUTO,
      ctx,
    })

    expect(layout.collapsed).toBe(true)
    expect(ids(layout.menu)).toEqual(['pin', 'sort'])
    expect(ids(layout.inline)).toEqual(['drag'])
  })

  test('AM8: схлопывание с пустым меню невозможно (все инлайн-only)', () => {
    const layout = resolveActionLayout({
      actions: [
        action('a', { collapsible: false }),
        action('b', { collapsible: false }),
        action('c', { collapsible: false }),
      ],
      opaqueCount: 0,
      config: AUTO,
      ctx,
    })

    expect(layout.collapsed).toBe(false)
    expect(ids(layout.inline)).toEqual(['a', 'b', 'c'])
    expect(layout.menu).toEqual([])
  })

  test('AM9: единый порядок по order (число → индекс, last/undefined → в конец)', () => {
    const layout = resolveActionLayout({
      actions: [
        action('last', { order: 'last' }),
        action('two', { order: 2 }),
        action('zero', { order: 0 }),
        action('end'),
        action('one', { order: 1 }),
      ],
      opaqueCount: 0,
      config: undefined,
      ctx,
    })

    // Числовые по возрастанию, затем last/undefined (стабильно, в порядке подачи).
    expect(ids(layout.inline)).toEqual(['zero', 'one', 'two', 'last', 'end'])
  })
})
