/**
 * CSV по RFC 4180 (ADR 0044, EX12–EX16): разделитель `,`, перевод строки CRLF,
 * поля с `,` `"` CR LF — в кавычках, защита от формул, UTF-8 BOM.
 */
import { toExportText } from './exportData'
import type { ExportData, ExportFormat } from './types'

export interface CsvFormatOptions {
  /** UTF-8 BOM в начале файла: без него Excel читает не-ASCII как ANSI. По умолчанию `true`. */
  bom?: boolean
  /** Префикс `'` текстовым полям, которые Excel выполнил бы как формулу. По умолчанию `true`. */
  sanitizeFormulas?: boolean
}

const BOM = '﻿'
const FORMULA_START = /^[=+\-@\t\r]/

const quote = (field: string): string =>
  /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field

const field = (value: unknown, sanitize: boolean): string => {
  const text = toExportText(value)
  const guarded =
    sanitize && typeof value === 'string' && FORMULA_START.test(text)
      ? `'${text}`
      : text
  return quote(guarded)
}

export const csvFormat = ({
  bom = true,
  sanitizeFormulas = true,
}: CsvFormatOptions = {}): Omit<ExportFormat, 'serialize'> & {
  serialize: (data: ExportData) => string
} => ({
  id: 'csv',
  label: 'CSV',
  extension: 'csv',
  mimeType: 'text/csv;charset=utf-8',
  serialize: ({ columns, rows }: ExportData) => {
    const lines = [
      columns.map(column => field(column.header, sanitizeFormulas)).join(','),
      ...rows.map(row => row.map(v => field(v, sanitizeFormulas)).join(',')),
    ]
    return (bom ? BOM : '') + lines.join('\r\n')
  },
})
