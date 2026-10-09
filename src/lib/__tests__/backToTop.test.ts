/**
 * Кнопка «наверх» (ADR 0082): запись слота, которая не вызывает панель (BT3),
 * пересечение порога (BT12) и инертность без нижней панели (BT13).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import type { PluginSlot } from '../core/createSlots'
import { foldEntries } from '../core/features'
import { countPanelSlots, resolvePanelVisible } from '../core/panels'
import {
  backToTopInertReason,
  type ScrollArea,
  watchThreshold,
} from '../plugins/backToTop/model'

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

const fakeArea = (clientHeight: number) => {
  const listeners = new Set<() => void>()
  const area: ScrollArea & { scrollTo: (top: number) => void } = {
    scrollTop: 0,
    clientHeight,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    scrollTo: top => {
      area.scrollTop = top
      listeners.forEach(listener => listener())
    },
  }
  return { area, listeners }
}

describe('backToTop — кнопка «наверх»', () => {
  it('BT3: запись с showsPanel: false не вызывает нижнюю панель, но остаётся в слоте', () => {
    const alone = foldEntries([
      { id: 'backToTop', slots: [item('backToTop', { showsPanel: false })] },
    ]).slots.statusBarSlot
    expect(alone.map(entry => entry.id)).toEqual(['backToTop'])
    expect(resolvePanelVisible(undefined, countPanelSlots(alone))).toBe(false)
    expect(resolvePanelVisible(true, countPanelSlots(alone))).toBe(true)

    const withPager = foldEntries([
      { id: 'backToTop', slots: [item('backToTop', { showsPanel: false })] },
      { id: 'pagination', slots: [item('paginationControl')] },
    ]).slots.statusBarSlot
    expect(withPager.map(entry => entry.id)).toEqual([
      'backToTop',
      'paginationControl',
    ])
    expect(resolvePanelVisible(undefined, countPanelSlots(withPager))).toBe(
      true,
    )
  })

  it('BT12: порог сообщается сразу и потом только при пересечении, а не на каждое событие прокрутки', () => {
    const { area, listeners } = fakeArea(300)
    const changes: boolean[] = []
    const stop = watchThreshold(area, undefined, past => changes.push(past))
    expect(changes).toEqual([false])

    for (let top = 0; top <= 1200; top += 40) area.scrollTo(top)
    for (let top = 1200; top >= 0; top -= 40) area.scrollTo(top)
    expect(changes).toEqual([false, true, false])

    const custom: boolean[] = []
    const stopCustom = watchThreshold(area, 100, past => custom.push(past))
    area.scrollTo(99)
    area.scrollTo(100)
    area.scrollTo(500)
    expect(custom).toEqual([false, true])

    stop()
    stopCustom()
    expect(listeners.size).toBe(0)
  })

  it('BT13: при enableStatusBar: false плагин инертен с причиной noStatusBar', () => {
    expect(backToTopInertReason({ options: { enableStatusBar: false } })).toBe(
      'noStatusBar',
    )
    expect(backToTopInertReason({ options: {} })).toBeUndefined()
    expect(
      backToTopInertReason({ options: { enableStatusBar: true } }),
    ).toBeUndefined()
  })
})
