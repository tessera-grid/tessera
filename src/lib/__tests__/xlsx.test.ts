/**
 * Генератор `.xlsx` (ADR 0073, XL1–XL6, XL8, XL12): файл читает независимый читатель
 * (ExcelJS), а не наш же разбор формата.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { exportFormats } from '../plugins/dataExport'
import type { ExportData } from '../plugins/dataExport'
import { buildXlsx } from '../plugins/dataExportModel/xlsxBuild'

const read = async (blob: Blob) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await blob.arrayBuffer()) as never)
  return workbook
}

/** Тип колонки выгрузки (ADR 0172, DT17). */
const DAY = { name: 'dateString', base: 'dateString' } as const
const MOMENT = { name: 'dateTimeString', base: 'dateTimeString' } as const

const sheetOf = async (data: ExportData, options = {}) =>
  (await read(await buildXlsx(data, options))).worksheets[0]!

/** Значения строки листа без пустого нулевого элемента ExcelJS. */
const rowValues = (sheet: ExcelJS.Worksheet, row: number) =>
  (sheet.getRow(row).values as unknown[]).slice(1)

const DATA: ExportData = {
  columns: [
    { id: 'name', header: 'Name' },
    { id: 'age', header: 'Age' },
  ],
  rows: [
    ['Alice', 30],
    ['Bob', 41],
  ],
}

describe('xlsx — генератор (ADR 0073)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('XL1: exportFormats.xlsx() — формат xlsx; файл читается ExcelJS: лист, шапка и значения совпадают с данными', async () => {
    const format = exportFormats.xlsx({ sheetName: 'People' })
    expect(format.id).toBe('xlsx')
    expect(format.extension).toBe('xlsx')
    expect(format.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const workbook = await read((await format.serialize(DATA)) as Blob)
    const sheet = workbook.worksheets[0]!
    expect(workbook.worksheets).toHaveLength(1)
    expect(sheet.name).toBe('People')
    expect(rowValues(sheet, 1)).toEqual(['Name', 'Age'])
    expect(rowValues(sheet, 2)).toEqual(['Alice', 30])
    expect(rowValues(sheet, 3)).toEqual(['Bob', 41])
    expect(sheet.rowCount).toBe(3)
  })

  it('XL2: типы по значению — число, логическое, Date с форматом даты, текст; null, undefined, NaN и бесконечность — пустые', async () => {
    const sheet = await sheetOf({
      columns: ['n', 'b', 'd', 's', 'o', 'e1', 'e2', 'e3', 'e4'].map(id => ({
        id,
        header: id,
      })),
      rows: [
        [
          1.5,
          true,
          new Date(Date.UTC(2026, 9, 9, 12, 30, 15)),
          'text',
          { a: 1 },
          null,
          undefined,
          Number.NaN,
          Number.POSITIVE_INFINITY,
        ],
      ],
      timeZone: 'UTC',
    })
    const cells = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(c =>
      sheet.getRow(2).getCell(c),
    )
    expect(cells[0]!.type).toBe(ExcelJS.ValueType.Number)
    expect(cells[0]!.value).toBe(1.5)
    expect(cells[1]!.type).toBe(ExcelJS.ValueType.Boolean)
    expect(cells[1]!.value).toBe(true)
    expect(cells[2]!.type).toBe(ExcelJS.ValueType.Date)
    expect((cells[2]!.value as Date).toISOString()).toBe(
      '2026-10-09T12:30:15.000Z',
    )
    expect(cells[2]!.numFmt).toBe('yyyy-mm-dd hh:mm:ss')
    expect(cells[3]!.type).toBe(ExcelJS.ValueType.String)
    expect(cells[3]!.value).toBe('text')
    expect(cells[4]!.value).toBe('{"a":1}')
    for (const cell of cells.slice(5)) {
      expect(cell.type).toBe(ExcelJS.ValueType.Null)
    }
  })

  it('XL3: колонки date/datetime — строки по DF2; date — день без сдвига, datetime и Date — стенное время timeZone с секундами; неразборчивое — текст', async () => {
    const columns = [
      { id: 'day', header: 'Day', dataType: DAY },
      {
        id: 'at',
        header: 'At',
        dataType: {
          ...MOMENT,
          parseDate: (v: unknown) => `${v as string}Z`,
        },
      },
      { id: 'moment', header: 'Moment', dataType: MOMENT },
    ]
    const sheet = await sheetOf(
      {
        columns,
        rows: [
          [
            '2026-03-01',
            '2026-03-01T22:15:30',
            new Date('2026-03-01T22:15:30Z'),
          ],
          ['soon', 'never', 'later'],
        ],
        timeZone: 'UTC',
      },
      { timeZone: 'Asia/Tokyo' },
    )
    const [day, at, moment] = [1, 2, 3].map(c => sheet.getRow(2).getCell(c))
    // Календарный день не сдвигается поясом.
    expect((day!.value as Date).toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(day!.numFmt).toBe('mm-dd-yy')
    // Момент — стенное время пояса формата (Токио, +9), а не пояса данных выгрузки.
    expect((at!.value as Date).toISOString()).toBe('2026-03-02T07:15:30.000Z')
    expect((moment!.value as Date).toISOString()).toBe(
      '2026-03-02T07:15:30.000Z',
    )
    // Без пояса формата — пояс данных выгрузки (фильтра).
    const utc = await sheetOf({
      columns,
      rows: [['2026-03-01', '2026-03-01T22:15:30', null]],
      timeZone: 'UTC',
    })
    expect((utc.getRow(2).getCell(2).value as Date).toISOString()).toBe(
      '2026-03-01T22:15:30.000Z',
    )
    expect(rowValues(sheet, 3)).toEqual(['soon', 'never', 'later'])
  })

  it('XL4: текст не становится формулой; спецсимволы XML экранированы, управляющие символы удалены', async () => {
    const sheet = await sheetOf({
      columns: [{ id: 'v', header: '<Value & "more">' }],
      rows: [['=1+1'], ['a<b>&"c"'], ['x\u0001y\u0008z'], ['\uD800lone']],
    })
    const formula = sheet.getRow(2).getCell(1)
    expect(formula.type).toBe(ExcelJS.ValueType.String)
    expect(formula.value).toBe('=1+1')
    expect(sheet.getRow(1).getCell(1).value).toBe('<Value & "more">')
    expect(sheet.getRow(3).getCell(1).value).toBe('a<b>&"c"')
    expect(sheet.getRow(4).getCell(1).value).toBe('xyz')
    expect(sheet.getRow(5).getCell(1).value).toBe('lone')
  })

  it('XL5: шапка жирная и закреплена, автофильтр на ней; ширины колонок из size', async () => {
    const sheet = await sheetOf({
      columns: [
        { id: 'name', header: 'Name', size: 140 },
        { id: 'age', header: 'Age', size: 70 },
      ],
      rows: DATA.rows,
    })
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true)
    expect(sheet.getRow(2).getCell(1).font?.bold).toBeFalsy()
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBe('A1:B3')
    expect(sheet.getColumn(1).width).toBe(20)
    expect(sheet.getColumn(2).width).toBe(10)
  })

  it('XL6: колонки, закреплённые слева, закреплены в Excel; закреплённые справа — обычные', async () => {
    const sheet = await sheetOf({
      columns: [
        { id: 'a', header: 'A', pinned: 'start' },
        { id: 'b', header: 'B', pinned: 'start' },
        { id: 'c', header: 'C', pinned: false },
        { id: 'd', header: 'D', pinned: 'end' },
      ],
      rows: [[1, 2, 3, 4]],
    })
    expect(sheet.views[0]).toMatchObject({
      state: 'frozen',
      xSplit: 2,
      ySplit: 1,
    })
    expect(rowValues(sheet, 2)).toEqual([1, 2, 3, 4])
  })

  it('XL8: части сжаты deflate; без CompressionStream — без сжатия, файл читается', async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => [
      `Name ${i % 7}`,
      i % 3,
    ])
    const data = { columns: DATA.columns, rows }
    const packed = await buildXlsx(data)
    const stored = await buildXlsx(data, { compress: false })
    expect(packed.size).toBeLessThan(stored.size / 3)

    vi.stubGlobal('CompressionStream', undefined)
    const fallback = await buildXlsx(data)
    expect(fallback.size).toBe(stored.size)
    const sheet = (await read(fallback)).worksheets[0]!
    expect(rowValues(sheet, 2001)).toEqual(['Name 4', 1])
  })

  it('XL12: строки сверх предела листа продолжаются на следующих листах с той же шапкой; ни одна не теряется', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => [`r${i}`, i])
    const workbook = await read(
      await buildXlsx(
        { columns: DATA.columns, rows },
        { maxRowsPerSheet: 4, sheetName: 'Data' },
      ),
    )
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      'Data',
      'Data 2',
      'Data 3',
    ])
    const values = workbook.worksheets.flatMap(sheet => {
      expect(rowValues(sheet, 1)).toEqual(['Name', 'Age'])
      return Array.from({ length: sheet.rowCount - 1 }, (_, i) =>
        rowValues(sheet, i + 2),
      )
    })
    expect(values).toEqual(rows)
  })
})
