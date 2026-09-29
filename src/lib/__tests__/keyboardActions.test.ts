/**
 * Headless-проверки канала keyboardActions (ADR 0021, KN27): свёртка из активных
 * записей, дедуп по id, отсутствие действий у enabled:false.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import { foldEntries } from '../core/features'
import type { KeyboardAction } from '../core/keyboardActions'
import { cellEditing } from '../plugins/cellEditing'
import { columnSorting } from '../plugins/columnSorting'
import { rowExpanding } from '../plugins/rowExpanding'
import { rowSelection } from '../plugins/rowSelection'

const ids = (actions: KeyboardAction[]) => actions.map(action => action.id)

describe('keyboardActions — канал клавиатурных действий', () => {
  it('KN27: действия сворачиваются из активных записей (дедуп по id), у enabled:false их нет', () => {
    const active = foldEntries([
      rowSelection(),
      columnSorting(),
      rowExpanding(),
      cellEditing(),
    ] as never)
    expect(ids(active.keyboardActions)).toEqual([
      'rowSelection.toggle',
      'columnSorting.toggle',
      'rowExpanding.toggle',
      'cellEditing.start',
    ])

    const disabled = foldEntries([
      rowSelection({ enabled: false }),
      columnSorting({ enabled: false }),
      rowExpanding({ enabled: false }),
      cellEditing({ enabled: false }),
    ] as never)
    expect(disabled.keyboardActions).toHaveLength(0)

    const first: KeyboardAction = {
      id: 'dup',
      scope: 'cell',
      keys: ['Enter'],
      run: () => {},
    }
    const second: KeyboardAction = { ...first, keys: ['F2'] }
    const folded = foldEntries([
      { id: 'a', keyboardActions: [first] },
      { id: 'b', keyboardActions: [second] },
    ] as never)
    expect(folded.keyboardActions).toEqual([second])
  })

  it('KN29: из применимых действий на одной клавише побеждает больший priority, при равенстве — порядок plugins', () => {
    const action = (id: string, priority?: number): KeyboardAction => ({
      id,
      scope: 'cell',
      keys: ['Enter'],
      priority,
      run: () => {},
    })
    const folded = foldEntries([
      { id: 'a', keyboardActions: [action('low', -1), action('first')] },
      { id: 'b', keyboardActions: [action('second', 0)] },
      { id: 'c', keyboardActions: [action('high', 10)] },
    ] as never)
    expect(ids(folded.keyboardActions)).toEqual([
      'high',
      'first',
      'second',
      'low',
    ])
  })
})
