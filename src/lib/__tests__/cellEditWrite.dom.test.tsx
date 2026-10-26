// @vitest-environment happy-dom
/**
 * Итог правки в кэше серверной модели строк (ADR 0139, EW1–EW6): строка из ответа
 * `onCellEdit`, разбор текста по `parseValue`/`dataType` колонки или по прежнему значению
 * ячейки, путь `accessorKey` вглубь, отказ записи с советом, клиентский режим без записи.
 * Запуск: npx vitest run --config vitest.node.config.ts cellEditWrite
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../core/logger'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  serverRowModel,
  type CellEditingHooks,
  type ServerRowsRequest,
} from '../plugins'
import {
  commitEditSession,
  startEditSession,
} from '../plugins/cellEditing/session'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  price: number
  vip: boolean
  born: Date
  day: string
  note: string | null
  address: { city: string; zip: string }
  total: number
}

const itemAt = (i: number): Item => ({
  id: `r${i}`,
  name: `N${i}`,
  price: 10 + i,
  vip: false,
  born: new Date('2000-01-01T00:00:00Z'),
  day: '2000-01-01',
  note: null,
  address: { city: 'Paris', zip: '75000' },
  total: 1,
})

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'price', accessorKey: 'price' },
  { id: 'vip', accessorKey: 'vip' },
  { id: 'born', accessorKey: 'born' },
  { id: 'day', accessorKey: 'day', dataType: 'dateString' },
  { id: 'note', accessorKey: 'note', dataType: 'number' },
  { id: 'city', accessorKey: 'address.city' },
  {
    id: 'cents',
    accessorKey: 'price',
    parseValue: (text: string) => Number(text) / 100,
  },
  { id: 'total', accessorFn: (row: Item) => row.total * 2 },
]
const NO_DATA: Item[] = []
const CLIENT_DATA = [itemAt(0), itemAt(1)]

let root: Root
let table: any

const getRows = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, i) => itemAt(start + i)),
})

const Grid = ({ server = true }: { server?: boolean }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: server ? NO_DATA : CLIENT_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      ...(server
        ? [serverRowModel({ getRows, rowCount: 100, blockSize: 10 })]
        : []),
      cellEditing({ onCellEdit: () => {} }),
    ] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<{ original: Item }>
const row = (id: string) => source().byId(id)!.original

/** Пользователь правит ячейку и сохраняет текст; `onCellEdit` отвечает `answer`. */
const edit = async (
  rowId: string,
  columnId: string,
  text: string,
  onCellEdit: CellEditingHooks['onCellEdit'] = () => {},
) => {
  act(() =>
    startEditSession(table, source().byId(rowId) as never, { id: columnId }),
  )
  await act(async () => {
    commitEditSession(table, { rowId, columnId }, text, { onCellEdit })
  })
}

let warn: ReturnType<typeof vi.spyOn>
const warned = () =>
  warn.mock.calls.some((call: unknown[]) =>
    String(call[0]).includes('cellEditing: the saved value is not written'),
  )

beforeEach(async () => {
  __resetLogger()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  root = createRoot(document.createElement('div'))
  act(() => root.render(<Grid />))
  act(() => source().observe!({ first: 0, last: 9, fast: false }))
  await act(async () => {})
})

afterEach(() => {
  act(() => root.unmount())
  warn.mockRestore()
})

describe('Итог правки в кэше серверной модели (ADR 0139)', () => {
  it('EW1: onCellEdit может вернуть сохранённую строку — сразу или промисом; строка — объект с тем же id; в серверной модели она заменяет строку в кэше, перерисовывается только эта строка; ответ с другим id строкой не считается', async () => {
    const neighbour = source().byId('r2')
    // Сразу: сервер округлил цену и посчитал итог.
    await edit('r1', 'price', '12.34', () => ({
      ...itemAt(1),
      price: 12.3,
      total: 7,
    }))
    expect(row('r1')).toMatchObject({ price: 12.3, total: 7 })
    expect(source().byId('r2')).toBe(neighbour)

    // Промисом.
    await edit('r3', 'name', 'typed', () =>
      Promise.resolve({ ...itemAt(3), name: 'Saved' }),
    )
    expect(row('r3').name).toBe('Saved')

    // Ответ не строка (другой id) — пишется разобранный текст, а не ответ.
    await edit('r4', 'price', '99', () =>
      Promise.resolve({ ...itemAt(5), price: 1 }),
    )
    expect(row('r4').price).toBe(99)
    expect(row('r4').id).toBe('r4')
  })

  it('EW2: без возвращённой строки значение для записи — parseValue(text, row) колонки, если он задан; иначе по dataType: number — число, boolean — true/false без учёта регистра, date — Date, dateString — YYYY-MM-DD, text — как есть; пустое поле у всех типов, кроме text, — null', async () => {
    // parseValue главнее типа: центы колонки «cents».
    await edit('r1', 'cents', '1250')
    expect(row('r1').price).toBe(12.5)
    // dataType «number» у колонки с пустым значением.
    await edit('r1', 'note', ' 42 ')
    expect(row('r1').note).toBe(42)
    await edit('r2', 'note', '')
    expect(row('r2').note).toBeNull()
    // dataType «dateString»: дата строкой без времени.
    await edit('r1', 'day', '2026-10-26')
    expect(row('r1').day).toBe('2026-10-26')
    await edit('r2', 'day', '2026-10-26T12:00:00Z')
    expect(row('r2').day).toBe('2026-10-26')
    await edit('r3', 'day', '')
    expect(row('r3').day).toBeNull()
    // Текст — как есть, с пробелами.
    await edit('r1', 'name', ' a b ')
    expect(row('r1').name).toBe(' a b ')
  })

  it('EW3: без dataType тип выводится из прежнего значения ячейки: число, булево или Date; строка или пусто — text', async () => {
    await edit('r1', 'price', '7.5')
    expect(row('r1').price).toBe(7.5)
    await edit('r1', 'vip', 'TRUE')
    expect(row('r1').vip).toBe(true)
    await edit('r1', 'born', '2026-10-26T00:00:00Z')
    expect(row('r1').born).toBeInstanceOf(Date)
    expect((row('r1').born as Date).toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    )
    await edit('r1', 'name', '42')
    expect(row('r1').name).toBe('42')
  })

  it('EW4: вложенный путь accessorKey (a.b) пишется вглубь, остальные поля строки не меняются', async () => {
    await edit('r1', 'city', 'Rome')
    expect(row('r1').address).toEqual({ city: 'Rome', zip: '75000' })
    expect(row('r1')).not.toHaveProperty(['address.city'])
    expect(row('r1').name).toBe('N1')
  })

  it('EW5: колонка с accessorFn или значение, которое не разбирается: кэш не меняется, в консоли браузера совет вернуть строку из onCellEdit или задать dataType/parseValue', async () => {
    const before = source().byId('r1')
    await edit('r1', 'total', '5')
    expect(source().byId('r1')).toBe(before)
    expect(warned()).toBe(true)

    warn.mockClear()
    __resetLogger()
    await edit('r1', 'price', 'abc')
    expect(source().byId('r1')).toBe(before)
    await edit('r1', 'vip', 'maybe')
    expect(source().byId('r1')).toBe(before)
    expect(warned()).toBe(true)
  })

  it('EW6: в клиентском режиме ни возвращённая строка, ни разобранное значение никуда не пишутся', async () => {
    // Набор фич таблицы фиксируется при монтировании: клиентская таблица — своим корнем.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid server={false} />))
    expect(table.setRowData).toBeUndefined()
    const data = table.options.data as Item[]
    const before = source().byId('r1')
    await edit('r1', 'price', '99', () => ({ ...itemAt(1), price: 5 }))
    await edit('r1', 'price', '77')
    expect(source().byId('r1')).toBe(before)
    expect(table.options.data).toBe(data)
    expect(data[1]!.price).toBe(11)
    expect(warned()).toBe(false)
  })
})
