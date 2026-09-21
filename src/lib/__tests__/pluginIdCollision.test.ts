/**
 * DP5: детект коллизии id плагинов. `id` — единый ключ scope (hooks/локальный state/
 * генерируемая фича), поэтому дубль ловится и дев-варнится ядром (сам варн — в
 * useEffect useCreateTable; здесь проверяется чистая логика).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { findDuplicatePluginIds } from '../core/features'

describe('findDuplicatePluginIds (DP5)', () => {
  it('уникальные id → пусто', () => {
    expect(
      findDuplicatePluginIds([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
    ).toEqual([])
  })

  it('дубль id → возвращается единожды', () => {
    expect(
      findDuplicatePluginIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }]),
    ).toEqual(['a'])
  })

  it('несколько разных дублей', () => {
    expect(
      findDuplicatePluginIds([
        { id: 'a' },
        { id: 'a' },
        { id: 'b' },
        { id: 'b' },
      ]),
    ).toEqual(['a', 'b'])
  })
})
