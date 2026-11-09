/**
 * Полоса окна (ADR 0202, WB1): видимое и запас по ходу прокрутки, перестройка по исчерпанию.
 * Запуск: npx vitest run --config vitest.node.config.ts windowBand
 */
import { afterEach, describe, expect, it } from 'vitest'

import { createWindowBand, windowBand } from '../core/virtualization/windowBand'

const range = (startIndex: number, endIndex: number, count = 1000) => ({
  startIndex,
  endIndex,
  overscan: 5,
  count,
})
const span = (indexes: number[]) => [indexes[0], indexes.at(-1)]

afterEach(() => {
  windowBand.enabled = true
})

describe('Полоса окна (ADR 0202)', () => {
  it('WB1: полоса — видимое, впереди 2×запас, позади 1; держится, пока впереди не меньше половины запаса или у края; при смене направления разворачивается; выключенная — симметричный запас', () => {
    const band = createWindowBand()
    // Вперёд: 10 впереди, 1 позади.
    expect(span(band(range(100, 109)))).toEqual([99, 119])
    // Впереди 5, затем 3 — держится.
    expect(span(band(range(105, 114)))).toEqual([99, 119])
    expect(span(band(range(107, 116)))).toEqual([99, 119])
    // Впереди 2 < ⌈5 / 2⌉ — перестройка от видимого.
    expect(span(band(range(108, 117)))).toEqual([107, 127])
    // Назад: разворот — 10 позади по ходу, 1 впереди.
    expect(span(band(range(106, 115)))).toEqual([96, 116])
    expect(span(band(range(99, 108)))).toEqual([96, 116])
    expect(span(band(range(98, 107)))).toEqual([88, 108])
    // Видимое вышло за полосу прыжком — перестройка.
    expect(span(band(range(500, 509)))).toEqual([499, 519])

    // У края списка полоса держится до конца.
    const edge = createWindowBand()
    expect(span(edge(range(985, 994)))).toEqual([984, 999])
    expect(span(edge(range(990, 999)))).toEqual([984, 999])
    // Пустой список — пустое окно.
    expect(createWindowBand()(range(0, 0, 0))).toEqual([])

    windowBand.enabled = false
    const off = createWindowBand()
    expect(span(off(range(100, 109)))).toEqual([95, 114])
    expect(span(off(range(105, 114)))).toEqual([100, 119])
  })
})
