// @vitest-environment happy-dom
/**
 * Дев-варн на несколько владельцев `cellSlot` (ADR 0028, DP16): владение ячейкой
 * эксклюзивно, ядро предупреждает по числу владельцев после дедупа по `id`.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../core/logger'
import { useCreateTable } from '../core/useCreateTable'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const DATA = [{ id: '1', name: 'A' }]

const owner = (pluginId: string, slotId: string) => ({
  id: pluginId,
  slots: [{ id: slotId, slot: 'cellSlot', component: () => null }],
})

/** Сообщения о владельцах `cellSlot` за монтирование таблицы с набором плагинов. */
const cellSlotWarnings = (plugins: unknown[]) => {
  __resetLogger()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const Grid = () => {
    useCreateTable({ columns: COLUMNS, data: DATA, plugins } as never)
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Grid />))
  act(() => root.render(<Grid />))
  act(() => root.unmount())
  const messages = warn.mock.calls
    .map(call => String(call[0]))
    .filter(message => message.includes('cellSlot'))
  warn.mockRestore()
  __resetLogger()
  return messages
}

describe('владельцы cellSlot', () => {
  it('DP16: разные владельцы cellSlot дают один дев-варн со списком; один владелец и дубль id — без варна', () => {
    const conflict = cellSlotWarnings([
      owner('a', 'first'),
      owner('b', 'second'),
    ])
    expect(conflict).toHaveLength(1)
    expect(conflict[0]).toContain('first, second')

    expect(cellSlotWarnings([owner('a', 'first')])).toEqual([])
    expect(cellSlotWarnings([owner('a', 'same'), owner('b', 'same')])).toEqual(
      [],
    )
  })
})
