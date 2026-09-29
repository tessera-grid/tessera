/**
 * DP5: детект коллизии id плагинов; DP13: локальный state не делит ключ со стоковым
 * срезом. DP5: `id` — единый ключ scope (hooks/локальный state/
 * генерируемая фича), поэтому дубль ловится и дев-варнится ядром (сам варн — в
 * useEffect useCreateTable; здесь проверяется чистая логика).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { definePlugin, setPluginState } from '../core/definePlugin'
import {
  buildTesseraFeatures,
  findDuplicatePluginIds,
  foldEntries,
} from '../core/features'
import { columnSorting } from '../plugins/columnSorting'

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

describe('ключ локального state (DP13)', () => {
  it('DP13: плагин с id стокового среза не делит с ним состояние', () => {
    const sortingNamesake = definePlugin()({
      id: 'sorting',
      state: () => ({ note: 'mine' }),
    })
    const entries = [
      {
        id: 'reactivity',
        features: { coreReactivityFeature: storeReactivityBindings() },
      },
      columnSorting(),
      sortingNamesake(),
    ]
    const folded = foldEntries(entries)
    const table = constructTable({
      features: buildTesseraFeatures(entries as never),
      data: [{ id: '1', name: 'A' }],
      columns: [{ id: 'name', accessorKey: 'name' }],
      getRowId: (row: { id: string }) => row.id,
      ...folded.options,
    } as never) as any

    expect(table.atoms.sorting.get()).toEqual([])
    expect(table.atoms['plugin:sorting'].get()).toEqual({ note: 'mine' })

    table.setSorting([{ id: 'name', desc: false }])
    expect(table.atoms['plugin:sorting'].get()).toEqual({ note: 'mine' })

    setPluginState(table, 'sorting', { note: 'changed' })
    expect(table.atoms.sorting.get()).toEqual([{ id: 'name', desc: false }])
    expect(table.atoms['plugin:sorting'].get()).toEqual({ note: 'changed' })
  })
})
