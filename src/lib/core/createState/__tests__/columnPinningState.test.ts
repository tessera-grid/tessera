import { describe, expect, test } from 'vitest'

import { COLUMN_SELECTION_ID } from '../../../plugins/rowSelection'
import { ROW_ACTIONS_COLUMN_ID } from '../../createColumns'
import {
  mergeColumnPinning,
  mergeServiceColumnPinning,
} from '../columnPinningState'

// Сеть безопасности под инверсию ядра (docs/decisions/0010-invert-core-plugins-registry.md,
// требование R10 — «логика state сохранена: merge пиннинга»). `mergeColumnPinning`
// — чистая функция и точка отсчёта, переживающая смену публичного API
// (enable* → presence-based плагины): её сигнатура при инверсии не меняется,
// поэтому эти проверки остаются валидным оракулом слияния пиннинга до и после
// рефакторинга. Один инвариант слияния — один тест.

describe('mergeColumnPinning — инвариант слияния пиннинга (R10)', () => {
  test('объединяет left и right независимо друг от друга', () => {
    const merged = mergeColumnPinning(
      { left: ['a'], right: ['x'] },
      { left: ['b'], right: ['y'] },
    )
    expect(merged.left).toEqual(['a', 'b'])
    expect(merged.right).toEqual(['x', 'y'])
  })

  test('prev идёт перед next (порядок слияния сохранён)', () => {
    const merged = mergeColumnPinning(
      { left: ['first'], right: [] },
      { left: ['second'], right: [] },
    )
    expect(merged.left).toEqual(['first', 'second'])
  })

  test('дедуплицирует повторяющиеся id, сохраняя первое вхождение', () => {
    const merged = mergeColumnPinning(
      { left: ['a', 'b'], right: ['x'] },
      { left: ['b', 'c'], right: ['x', 'y'] },
    )
    // `b` из prev остаётся на своей позиции, дубль из next поглощается.
    expect(merged.left).toEqual(['a', 'b', 'c'])
    expect(merged.right).toEqual(['x', 'y'])
  })

  test('undefined prev трактуется как пустой пиннинг', () => {
    const merged = mergeColumnPinning(undefined, { left: ['b'], right: ['y'] })
    expect(merged.left).toEqual(['b'])
    expect(merged.right).toEqual(['y'])
  })

  test('undefined next трактуется как пустой пиннинг', () => {
    const merged = mergeColumnPinning({ left: ['a'], right: ['x'] }, undefined)
    expect(merged.left).toEqual(['a'])
    expect(merged.right).toEqual(['x'])
  })

  test('оба undefined дают пустой, но полностью заполненный по форме результат', () => {
    const merged = mergeColumnPinning(undefined, undefined)
    expect(merged).toEqual({ left: [], right: [] })
  })

  test('частично заданные стороны (только left / только right) не роняют результат', () => {
    const merged = mergeColumnPinning(
      { left: ['a'], right: [] },
      { left: [], right: ['y'] },
    )
    expect(merged.left).toEqual(['a'])
    expect(merged.right).toEqual(['y'])
  })
})

// mergeServiceColumnPinning — генерик-слияние сервисных колонок (перенесено из
// useCreateState при инверсии, Landing B). Применяется ядром всегда, независимо от
// наличия фичи columnPinning. Прежние merge-ассерты сохранены.
describe('mergeServiceColumnPinning — пиннинг сервисных колонок (R10)', () => {
  const services = [
    {
      id: COLUMN_SELECTION_ID,
      pin: { side: 'left' as const, when: 'with-user' as const },
    },
    {
      id: ROW_ACTIONS_COLUMN_ID,
      pin: { side: 'right' as const, when: 'always' as const },
    },
  ]

  test('без пользовательского left-пиннинга трейлинг уходит вправо, лидирующие — не влево', () => {
    const merged = mergeServiceColumnPinning({ left: [], right: [] }, services)
    expect(merged.right).toContain(ROW_ACTIONS_COLUMN_ID)
    expect(merged.left).not.toContain(COLUMN_SELECTION_ID)
  })

  test('внешний left-пиннинг втягивает лидирующие сервисные колонки в левый блок', () => {
    const merged = mergeServiceColumnPinning(
      { left: ['a'], right: [] },
      services,
    )
    expect(merged.left).toContain(COLUMN_SELECTION_ID)
    expect(merged.left).toContain('a')
    expect(merged.right).toContain(ROW_ACTIONS_COLUMN_ID)
  })

  test('лидирующие ставятся перед пользовательскими в левом блоке', () => {
    const merged = mergeServiceColumnPinning({ left: ['a'], right: [] }, [
      { id: COLUMN_SELECTION_ID, pin: { side: 'left', when: 'with-user' } },
    ])
    expect(merged.left).toEqual([COLUMN_SELECTION_ID, 'a'])
  })

  test('undefined пиннинг трактуется как пустой', () => {
    const merged = mergeServiceColumnPinning(undefined, services)
    expect(merged.right).toContain(ROW_ACTIONS_COLUMN_ID)
    expect(merged.left).toEqual([])
  })
})
