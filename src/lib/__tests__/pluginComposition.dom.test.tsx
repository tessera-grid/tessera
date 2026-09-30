// @vitest-environment happy-dom
/**
 * Композиция плагинов (ADR 0010, IV4–IV8, IV10): пользовательский плагин приносит
 * фичу, колонку и состояние тем же способом, что встроенный; `commonFeature` есть
 * всегда; сервисные колонки — по наличию плагина и `order`; `columnOrder`
 * потребителя переставляет и их; пиннинг сервисных колонок сливается с
 * пользовательским, внешний срез потребителя главнее внутреннего.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { injectServiceColumns, type ServiceColumn } from '../core/createColumns'
import { mergeServiceColumnPinning } from '../core/createState'
import { definePlugin } from '../core/definePlugin'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { useCreateTable } from '../core/useCreateTable'
import { rowSelection } from '../plugins'
import { COLUMN_SELECTION_ID } from '../plugins/rowSelection/rowSelectionColumn'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'rank', accessorKey: 'rank', header: 'Rank' },
]
const data = [
  { id: '1', name: 'A', rank: 1 },
  { id: '2', name: 'B', rank: 2 },
]

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const mount = (options: Record<string, unknown>) => {
  const Host = () => {
    captured = useCreateTable({ columns, data, ...options } as never)
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => root!.render(<Host />))
}

const leafIds = () =>
  captured.getVisibleLeafColumns().map((column: { id: string }) => column.id)

const service = (
  id: string,
  order: number,
  side: ServiceColumn['side'] = 'leading',
): ServiceColumn => ({
  id,
  order,
  side,
  make: () => ({ id, header: id }),
})

describe('композиция плагинов', () => {
  it('IV4: пользовательский плагин приносит фичу со срезом состояния, сервисную колонку и локальное состояние', () => {
    const probe = definePlugin<{ enabled?: boolean }>()({
      id: 'probe',
      features: {
        probeFeature: {
          getInitialState: (state: Record<string, unknown>) => ({
            ...state,
            probeSlice: 'seeded',
          }),
        },
      },
      state: () => ({ note: 'local' }),
      column: service('probe-column', 5),
    })
    mount({ plugins: [probe()] })

    expect(captured.atoms.probeSlice.get()).toBe('seeded')
    expect(captured.atoms['plugin:probe'].get()).toEqual({ note: 'local' })
    expect(leafIds()).toEqual(['probe-column', 'name', 'rank'])
  })

  it('IV5: commonFeature есть в наборе при любом списке плагинов', () => {
    expect(Object.keys(buildTesseraFeatures([]))).toContain('commonFeature')
    expect(Object.keys(buildTesseraFeatures([rowSelection()]))).toContain(
      'commonFeature',
    )
    mount({ plugins: [] })
    expect(typeof captured.getHooks).toBe('function')
    expect(typeof captured.getRenderSlots).toBe('function')
  })

  it('IV6: порядок сервисных колонок — по order, при равенстве — по месту в списке', () => {
    const injected = injectServiceColumns(
      [{ id: 'name' }],
      [
        service('b', 1),
        service('a', 0),
        service('c', 1),
        service('tail', 0, 'trailing'),
      ],
    ) as { id: string }[]
    expect(injected.map(column => column.id)).toEqual([
      'a',
      'b',
      'c',
      'name',
      'tail',
    ])
  })

  it('IV7: columnOrder потребителя переставляет и сервисные колонки', () => {
    mount({
      plugins: [rowSelection()],
      state: { columnOrder: ['name', COLUMN_SELECTION_ID, 'rank'] },
    })
    expect(leafIds()).toEqual(['name', COLUMN_SELECTION_ID, 'rank'])
  })

  it('IV8: сервисная колонка есть только у присутствующего включённого плагина', () => {
    const ids = (entries: Parameters<typeof foldEntries>[0]) =>
      foldEntries(entries).serviceColumns.map(column => column.id)
    expect(ids([rowSelection()])).toEqual([COLUMN_SELECTION_ID])
    expect(ids([])).toEqual([])
    expect(ids([rowSelection({ enabled: false })])).toEqual([])
  })

  it('IV10: пиннинг сервисных колонок сливается с пользовательским; внешний срез потребителя главнее внутреннего', () => {
    const pins = [
      { id: 'lead', pin: { side: 'start', when: 'with-user' } as const },
      { id: 'always', pin: { side: 'start', when: 'always' } as const },
      { id: 'trail', pin: { side: 'end', when: 'with-user' } as const },
    ]
    expect(mergeServiceColumnPinning(undefined, pins)).toEqual({
      start: ['always'],
      end: [],
    })
    expect(
      mergeServiceColumnPinning({ start: ['name'], end: ['rank'] }, pins),
    ).toEqual({ start: ['lead', 'always', 'name'], end: ['rank', 'trail'] })

    mount({
      plugins: [rowSelection()],
      state: { columnPinning: { start: ['name'], end: [] } },
    })
    expect(captured.atoms.columnPinning.get()).toEqual({
      start: [COLUMN_SELECTION_ID, 'name'],
      end: [],
    })
  })
})
