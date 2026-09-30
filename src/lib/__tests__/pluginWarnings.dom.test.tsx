// @vitest-environment happy-dom
/**
 * Дев-варны набора плагинов (ADR 0028): дубль `id` (DP5) и несколько владельцев
 * `cellSlot` (DP16) — владение ячейкой эксклюзивно, ядро предупреждает по числу
 * владельцев после дедупа по `id`.
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

/** Дев-варны с `topic` за монтирование таблицы с набором плагинов. */
const warningsAbout = (topic: string, plugins: unknown[]) => {
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
    .filter(message => message.includes(topic))
  warn.mockRestore()
  __resetLogger()
  return messages
}

describe('владельцы cellSlot', () => {
  it('DP16: разные владельцы cellSlot дают один дев-варн со списком; один владелец и дубль id — без варна', () => {
    const conflict = warningsAbout('cellSlot', [
      owner('a', 'first'),
      owner('b', 'second'),
    ])
    expect(conflict).toHaveLength(1)
    expect(conflict[0]).toContain('first, second')

    expect(warningsAbout('cellSlot', [owner('a', 'first')])).toEqual([])
    expect(
      warningsAbout('cellSlot', [owner('a', 'same'), owner('b', 'same')]),
    ).toEqual([])
  })
})

describe('коллизия id плагинов', () => {
  it('DP5: дубль id плагинов даёт один дев-варн с этим id; разные id — без варна', () => {
    const plugin = (id: string) => ({ id })
    const duplicate = warningsAbout('дублирующиеся id', [
      plugin('a'),
      plugin('b'),
      plugin('a'),
    ])
    expect(duplicate).toHaveLength(1)
    expect(duplicate[0]).toContain('a')
    expect(
      warningsAbout('дублирующиеся id', [plugin('a'), plugin('b')]),
    ).toEqual([])
  })
})
