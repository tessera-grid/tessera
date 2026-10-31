// @vitest-environment happy-dom
/**
 * Дев-варны набора плагинов (ADR 0028): дубль `id` (DP5) и несколько владельцев
 * `cellSlot` (DP16) — владение ячейкой эксклюзивно, ядро предупреждает по числу
 * владельцев после дедупа по `id`; перезапись опций и хуков чужим плагином (ADR 0140,
 * OW1–OW4).
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../util/logger'
import { useCreateTable } from '../core/useCreateTable'
import { columnFilteringModel, quickSearchModel } from '../plugins'
import { builtinPluginEntries } from './builtinPlugins'

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
let lastTable: any

const warningsAbout = (topic: string, plugins: unknown[]) => {
  __resetLogger()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const Grid = () => {
    lastTable = useCreateTable({
      columns: COLUMNS,
      data: DATA,
      plugins,
    } as never)
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

describe('перезапись опций и хуков (ADR 0140)', () => {
  const OVERWRITE = 'is overwritten by'

  it('OW1: две записи с разными id задают одну опцию таблицы с разными значениями (Object.is): предупреждение в консоли с ключом и id обоих; значение — от последней в plugins', () => {
    const conflict = warningsAbout(OVERWRITE, [
      { id: 'first', options: { someOption: 1 } },
      { id: 'second', options: { someOption: 2 } },
    ])
    expect(conflict).toHaveLength(1)
    expect(conflict[0]).toContain('option "someOption"')
    expect(conflict[0]).toContain('"first"')
    expect(conflict[0]).toContain('"second"')
    expect(lastTable.options.someOption).toBe(2)
  })

  it('OW2: две записи с разными id пишут хуки под одним ключом: предупреждение в консоли с ключом и id обоих; хуки — от последней', () => {
    const conflict = warningsAbout(OVERWRITE, [
      { id: 'first', hooks: { shared: { answer: () => 1 } } },
      { id: 'second', hooks: { shared: { answer: () => 2 } } },
    ])
    expect(conflict).toHaveLength(1)
    expect(conflict[0]).toContain('hook "shared"')
    expect(conflict[0]).toContain('"first"')
    expect(conflict[0]).toContain('"second"')
    expect(lastTable.getHooks().shared.answer()).toBe(2)
  })

  it('OW3: записи, задающие одну опцию одинаковым значением, не предупреждают: серверные фильтры колонок и быстрый поиск вместе (filterFromLeafRows, manualFiltering) — без предупреждений', () => {
    expect(
      warningsAbout(OVERWRITE, [
        columnFilteringModel({ server: true } as never),
        quickSearchModel({ server: true } as never),
      ]),
    ).toEqual([])
    expect(lastTable.options).toMatchObject({
      manualFiltering: true,
      filterFromLeafRows: true,
    })
  })

  it('OW4: все встроенные плагины в одной таблице не дают ни одного предупреждения о перезаписи', () => {
    expect(warningsAbout(OVERWRITE, builtinPluginEntries())).toEqual([])
  })
})
