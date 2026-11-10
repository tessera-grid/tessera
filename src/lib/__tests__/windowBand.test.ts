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
    // Полоса создаётся в покое (WB10): первый сдвиг — далеко за окно покоя.
    band(range(0, 9))
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
    edge(range(0, 9))
    expect(span(edge(range(985, 994)))).toEqual([984, 999])
    expect(span(edge(range(990, 999)))).toEqual([984, 999])
    // Пустой список — пустое окно.
    expect(createWindowBand()(range(0, 0, 0))).toEqual([])

    windowBand.enabled = false
    const off = createWindowBand()
    expect(span(off(range(100, 109)))).toEqual([95, 114])
    expect(span(off(range(105, 114)))).toEqual([100, 119])
  })

  it('WB10: полоса создаётся в покое и уходит в покой по rest — окно видимое и симметричный запас, смена размера списка покоя не снимает; сдвиг начала видимого снимает покой — окно покоя держится как полоса, затем полоса по ходу; grow из покоя — полоса вперёд от видимого, вне покоя ничего не меняет', () => {
    const band = createWindowBand()
    expect(band.isResting()).toBe(true)
    expect(span(band(range(0, 9)))).toEqual([0, 14])
    expect(span(band(range(0, 9, 2000)))).toEqual([0, 14])
    // Сдвиг держит окно покоя, пока видимое внутри и впереди не меньше половины запаса.
    expect(span(band(range(1, 10)))).toEqual([0, 14])
    expect(band.isResting()).toBe(false)
    // Впереди 2 < ⌈5 / 2⌉ — полоса по ходу: впереди 2×запас, позади 1.
    expect(span(band(range(3, 12)))).toEqual([2, 22])

    // Покой по rest — смена списка строк: окно снова видимое и симметричный запас.
    band.rest()
    expect(span(band(range(3, 12)))).toEqual([0, 17])
    // Рост из покоя без сдвига — полоса вперёд от видимого.
    expect(band.grow()).toBe(true)
    expect(span(band(range(3, 12)))).toEqual([2, 22])
    // Вне покоя рост окна не меняет.
    expect(band.grow()).toBe(false)
    expect(span(band(range(3, 12)))).toEqual([2, 22])
  })
})
