/**
 * Контролы высот историй DataGrid (ADR 0117, SN9): текстовые, чтобы значение можно было
 * стереть; пусто — умолчание, число — пиксели, иное — CSS-значение.
 * Запуск: npx vitest run --config vitest.node.config.ts storySizeArgs
 */
import { describe, expect, it } from 'vitest'

import { dataGridArgTypes } from '../stories/__mocks__/utils/dataGridControls'
import { normalizeArgs } from '../stories/__mocks__/utils/normalizeArgs'

const SIZES = ['height', 'maxHeight', 'containerHeight'] as const

const controlType = (control: unknown) =>
  typeof control === 'string' ? control : (control as { type?: string })?.type

describe('контролы высот историй (ADR 0117)', () => {
  it('SN9: контролы height, maxHeight, containerHeight — текстовые: пусто — умолчание (аргумент не задан), число — пиксели, иное — CSS-значение как есть', () => {
    for (const name of SIZES) {
      expect(controlType(dataGridArgTypes[name].control), name).toBe('text')
      const size = (value: unknown) => normalizeArgs({ [name]: value })[name]
      expect(size(''), name).toBeUndefined()
      expect(size('  '), name).toBeUndefined()
      expect(size('400'), name).toBe(400)
      expect(size(' 320 '), name).toBe(320)
      expect(size(500), name).toBe(500)
      expect(size('100%'), name).toBe('100%')
      expect(size('auto'), name).toBe('auto')
      expect(size('50vh'), name).toBe('50vh')
      expect(size(undefined), name).toBeUndefined()
    }
  })
})
