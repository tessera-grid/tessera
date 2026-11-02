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

import { __resetLogger } from '../util/logger'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import { parseNumberInput } from '../plugins/columnFiltering/FilterPanel'
import {
  cellEditing,
  serverRowModel,
  type CellEditingHooks,
  type ServerRowsRequest,
} from '../plugins'
import {
  cancelEditSession,
  readEditSession,
  saveEdit,
  setEditText,
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
  manager: { id: string; name: string }
  amount?: string
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
  manager: { id: 'm1', name: 'Ann' },
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
  { id: 'when', accessorKey: 'when', dataType: 'dateTime' },
  { id: 'stamp', accessorKey: 'stamp', dataType: 'dateTimeString' },
  {
    id: 'status',
    accessorKey: 'status',
    dataType: 'select',
    options: [
      { value: 'a', label: 'Active' },
      { value: 'z', label: 'Archived' },
    ],
  },
  { id: 'weight', accessorKey: 'weight', dataType: 'kilograms' },
  // Свой разбор колонки главнее разбора её типа (ED2).
  {
    id: 'grams',
    accessorKey: 'weight',
    dataType: 'kilograms',
    parseValue: (text: string) => Number(text),
  },
  { id: 'manager', accessorKey: 'manager', dataType: 'object' },
  { id: 'amount', accessorKey: 'amount', dataType: 'numberString' },
  {
    id: 'owner',
    accessorKey: 'manager',
    dataType: 'object',
    parseValue: (text: string) => {
      const [id, name] = text.split(':')
      return { id, name }
    },
  },
]
const NO_DATA: Item[] = []
const CLIENT_DATA = [itemAt(0), itemAt(1)]

let root: Root
let table: any

const getRows = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, i) => itemAt(start + i)),
})

/** Свой тип с разбором: граммы из килограммов (DT14). */
const kilograms = vi.fn((text: string) => Number(text) * 1000)
const DATA_TYPES = {
  kilograms: { extends: 'number', parseValue: kilograms },
}

const Grid = ({
  server = true,
  locale,
}: {
  server?: boolean
  locale?: string
}) => {
  table = useCreateTable({
    rowCount: 100,
    locale,
    dataTypes: DATA_TYPES,
    columns: COLUMNS as never,
    data: server ? NO_DATA : CLIENT_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      ...(server ? [serverRowModel({ getRows, blockSize: 10 })] : []),
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
    saveEdit(table, { rowId, columnId }, { text }, { onCellEdit })
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

  it('EW5: колонка с accessorFn: кэш не меняется, в консоли браузера совет вернуть строку из onCellEdit; значение, которое не разбирается, не сохраняется — ошибка поля, onCellEdit не зовётся', async () => {
    const before = source().byId('r1')
    await edit('r1', 'total', '5')
    expect(source().byId('r1')).toBe(before)
    expect(warned()).toBe(true)

    const onCellEdit = vi.fn()
    await edit('r1', 'price', 'abc', onCellEdit)
    expect(source().byId('r1')).toBe(before)
    expect(readEditSession(table)?.invalid).toBe('Enter a number')
    await edit('r1', 'vip', 'maybe', onCellEdit)
    expect(source().byId('r1')).toBe(before)
    expect(readEditSession(table)?.invalid).toBe('Invalid value')
    expect(onCellEdit).not.toHaveBeenCalled()
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

  it('DT14: поле числа в панели фильтра и ввод правки разбирают десятичный знак и разряды языка («1,5» и «1 234,5» в ru); разбор правки понимает dateTime и dateTimeString, select — по подписи варианта, свой тип — своим parseValue', async () => {
    const saved = (key: string) =>
      (row('r1') as unknown as Record<string, unknown>)[key]
    expect(parseNumberInput('1,5', 'ru-RU')).toBe(1.5)
    expect(parseNumberInput('1 234,5', 'ru-RU')).toBe(1234.5)
    expect(parseNumberInput('1,234.5', 'en-US')).toBe(1234.5)
    expect(parseNumberInput('abc', 'ru-RU')).toBeNaN()

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid locale="ru-RU" />))
    act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await act(async () => {})

    await edit('r1', 'note', '1 234,5')
    expect(row('r1').note).toBe(1234.5)
    await edit('r1', 'when', '2026-10-31T14:05:00Z')
    expect(saved('when')).toEqual(new Date('2026-10-31T14:05:00Z'))
    await edit('r1', 'stamp', '2026-10-31T14:05:00Z')
    expect(saved('stamp')).toBe('2026-10-31T14:05:00.000Z')
    await edit('r1', 'status', 'archived')
    expect(saved('status')).toBe('z')
    await edit('r1', 'weight', '2')
    expect(saved('weight')).toBe(2000)
  })

  it('TY8: набранный текст в запись разбирает только свой parseValue; без него правка не сохраняется — ошибка поля и совет в консоли задать parseValue или редактор (ADR 0174, ADR 0175)', async () => {
    await edit('r1', 'manager', 'Bob')
    expect(row('r1').manager).toEqual({ id: 'm1', name: 'Ann' })
    expect(readEditSession(table)?.invalid).toBe('Invalid value')
    expect(
      warn.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes(
          'object column turns the entered text into a record only by its parseValue',
        ),
      ),
    ).toBe(true)

    await edit('r1', 'owner', 'm2:Bob')
    expect(row('r1').manager).toEqual({ id: 'm2', name: 'Bob' })
  })
  it('TY12: разбор правки numberString — по языку таблицы в десятичную строку: «1 234,50» в ru — "1234.50" (ADR 0174)', async () => {
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid locale="ru-RU" />))
    act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await act(async () => {})

    await edit('r1', 'amount', '1 234,50')
    expect(row('r1').amount).toBe('1234.50')
    // Знаки дальше 15-го сохраняются: строка не проходит через float.
    await edit('r1', 'amount', '12 345 678 901 234 567,89')
    expect(row('r1').amount).toBe('12345678901234567.89')
    await edit('r1', 'amount', '1e3')
    expect(row('r1').amount).toBe('12345678901234567.89')
    expect(readEditSession(table)?.invalid).toBe('Enter a number')
  })
})

describe('Значение правки в типе колонки (ADR 0175)', () => {
  const remount = async (server: boolean) => {
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid server={server} locale="ru-RU" />))
    if (server) act(() => source().observe!({ first: 0, last: 9, fast: false }))
    await act(async () => {})
  }

  it('ED1: onCellEdit получает value в типе колонки и text — набранный текст — в клиентском и серверном режимах; validate получает то же значение и текст, onEditCancel.draft — черновик в типе колонки', async () => {
    for (const server of [false, true]) {
      await remount(server)
      const onCellEdit = vi.fn()
      const validate = vi.fn(() => null)
      const onEditCancel = vi.fn()
      act(() =>
        startEditSession(table, source().byId('r1') as never, { id: 'price' }),
      )
      expect(readEditSession(table)).toMatchObject({ draft: 11, text: '11' })
      act(() => setEditText(table, '12,5'))
      expect(readEditSession(table)).toMatchObject({
        draft: 12.5,
        text: '12,5',
      })
      await act(async () => {
        saveEdit(
          table,
          { rowId: 'r1', columnId: 'price' },
          { text: '12,5' },
          { onCellEdit, validate },
        )
      })
      expect(validate).toHaveBeenCalledWith(
        12.5,
        expect.objectContaining({ row: expect.anything() }),
        '12,5',
      )
      expect(onCellEdit).toHaveBeenCalledWith(
        expect.objectContaining({ value: 12.5, text: '12,5', original: 11 }),
        { signal: expect.any(AbortSignal) },
      )

      act(() =>
        startEditSession(table, source().byId('r1') as never, { id: 'note' }),
      )
      act(() => setEditText(table, '3'))
      act(() => cancelEditSession(table, 'cancel', { onEditCancel }))
      expect(onEditCancel).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'cancel', draft: 3, text: '3' }),
      )
    }
  })

  it('ED2: ввод разбирается по базовому типу при сохранении; parseValue колонки главнее parseValue типа, оба — главнее встроенного разбора; серверная модель пишет в кэш то же значение без второго разбора', async () => {
    const onCellEdit = vi.fn()
    const saved = (key: string) =>
      (row('r1') as unknown as Record<string, unknown>)[key]
    kilograms.mockClear()
    await edit('r1', 'weight', '2', onCellEdit)
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 2000, text: '2' }),
      { signal: expect.any(AbortSignal) },
    )
    expect(kilograms).toHaveBeenCalledTimes(1)
    expect(saved('weight')).toBe(2000)

    await edit('r1', 'grams', '5', onCellEdit)
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 5 }),
      { signal: expect.any(AbortSignal) },
    )
    expect(kilograms).toHaveBeenCalledTimes(1)

    await edit('r1', 'when', '2026-10-31T14:05:00Z', onCellEdit)
    const value = onCellEdit.mock.lastCall![0].value
    expect(value).toBeInstanceOf(Date)
    expect(saved('when')).toBe(value)
  })
})
