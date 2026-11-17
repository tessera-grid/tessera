// @vitest-environment happy-dom
/**
 * Признак последнего ввода на корне документа (ADR 0231, TV2): палец, мышь, клавиша.
 * Запуск: npx vitest run --config vitest.node.config.ts inputModality
 */
import { describe, expect, test } from 'vitest'

import { INPUT_MODALITY_ATTR, trackInputModality } from '../core/inputModality'

const modality = () =>
  document.documentElement.getAttribute(INPUT_MODALITY_ATTR)
const pointer = (type: string, pointerType: string) =>
  document.body.dispatchEvent(
    new PointerEvent(type, { pointerType, bubbles: true }),
  )
const key = (name: string) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true }),
  )

describe('Признак ввода (ADR 0231)', () => {
  test('TV2: касание пальцем ставит на корень документа `data-tsr-input="touch"`; мышь — `pointer`, клавиша — `keyboard`', () => {
    trackInputModality()
    pointer('pointerdown', 'touch')
    expect(modality()).toBe('touch')
    // Движение мыши после пальца возвращает указатель.
    pointer('pointermove', 'mouse')
    expect(modality()).toBe('pointer')
    pointer('pointerdown', 'touch')
    pointer('pointerdown', 'mouse')
    expect(modality()).toBe('pointer')
    pointer('pointerdown', 'pen')
    expect(modality()).toBe('pointer')
    key('ArrowDown')
    expect(modality()).toBe('keyboard')
    // Движение мыши клавиатурный признак не снимает, модификатор — не ввод.
    pointer('pointermove', 'mouse')
    key('Shift')
    expect(modality()).toBe('keyboard')
    pointer('pointerdown', 'touch')
    pointer('pointermove', 'touch')
    expect(modality()).toBe('touch')
  })
})
