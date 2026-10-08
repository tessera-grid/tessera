/**
 * Генератор `.xlsx` (ADR 0073): типизированные ячейки, шапка, ширины, закрепление,
 * продолжение на следующих листах. Чистая функция без DOM; лист строится кусками с
 * отдачей главного потока, части архива сжимаются вне него (`zip.ts`).
 */
import { cellToWallValue } from '../../core/wallTime'
import { toExportText } from './exportData'
import type { ExportColumn, ExportData } from './types'
import { buildZip, crc32Update, type ZipEntry } from './zip'

export interface BuildXlsxOptions {
  /** Пояс стенного времени дат; по умолчанию — пояс данных выгрузки, иначе браузера. */
  timeZone?: string
  sheetName?: string
  /** Строк на листе вместе с шапкой (предел Excel — 1 048 576). */
  maxRowsPerSheet?: number
  /** `false` — части без сжатия. */
  compress?: boolean
}

export const EXCEL_MAX_ROWS = 1_048_576

const MS_PER_DAY = 86_400_000
/** 1970-01-01 в днях Excel (система 1900). */
const EXCEL_EPOCH_DAYS = 25_569
/** Работа главного потока между паузами, мс. */
const SLICE_MS = 8
/** Ширина символа Excel в px шрифта по умолчанию. */
const CHAR_PX = 7

const STYLE_HEADER = 1
const STYLE_DATE = 2
const STYLE_DATETIME = 3

// Недопустимые в XML 1.0 символы и одиночные суррогаты.
const INVALID_XML = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]' +
    '|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]',
  'g',
)

const escapeXml = (text: string) =>
  text
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const columnName = (index: number) => {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

type DateKind = 'date' | 'datetime' | undefined

const dateKindOf = (column: ExportColumn): DateKind => {
  const filter = column.filter
  const type = typeof filter === 'object' ? filter?.type : filter
  return type === 'date' || type === 'datetime' ? type : undefined
}

const textCell = (ref: string, text: string, style = 0) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`

const dateCell = (ref: string, wallMs: number, dateOnly: boolean) =>
  `<c r="${ref}" s="${dateOnly ? STYLE_DATE : STYLE_DATETIME}"><v>${wallMs / MS_PER_DAY + EXCEL_EPOCH_DAYS}</v></c>`

interface CellContext {
  kind: DateKind
  parse?: (value: unknown) => unknown
  timeZone?: string
}

const cellXml = (ref: string, value: unknown, context: CellContext) => {
  if (value === null || value === undefined) return ''
  if (context.kind && !(value instanceof Date)) {
    const wall = cellToWallValue(
      context.parse ? context.parse(value) : value,
      context.timeZone,
    )
    if (wall) return dateCell(ref, wall.ms, context.kind === 'date')
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : ''
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  }
  if (value instanceof Date) {
    const wall = cellToWallValue(value, context.timeZone)
    return wall ? dateCell(ref, wall.ms, context.kind === 'date') : ''
  }
  return textCell(ref, toExportText(value))
}

const yieldToMain = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

const sheetNameOf = (base: string, index: number) => {
  const clean = base.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet'
  const suffix = index === 0 ? '' : ` ${index + 1}`
  return clean.slice(0, 31 - suffix.length) + suffix
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const sheetHead = (columns: ExportColumn[], frozenColumns: number) => {
  const pane =
    frozenColumns > 0
      ? `<pane xSplit="${frozenColumns}" ySplit="1" topLeftCell="${columnName(frozenColumns)}2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/>`
      : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>'
  const widths = columns
    .map((column, index) =>
      column.size
        ? `<col min="${index + 1}" max="${index + 1}" width="${Math.max(1, Math.round((column.size / CHAR_PX) * 100) / 100)}" customWidth="1"/>`
        : '',
    )
    .join('')
  const header = columns
    .map((column, index) =>
      textCell(`${columnName(index)}1`, column.header, STYLE_HEADER),
    )
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (widths ? `<cols>${widths}</cols>` : '') +
    `<sheetData><row r="1">${header}</row>`
  )
}

const lastRef = (columns: ExportColumn[], rows: number) =>
  `${columnName(Math.max(0, columns.length - 1))}${rows + 1}`

/** Книга `.xlsx` из данных выгрузки. */
export const buildXlsx = async (
  data: ExportData,
  {
    timeZone = data.timeZone,
    sheetName = 'Sheet1',
    maxRowsPerSheet = EXCEL_MAX_ROWS,
    compress = true,
  }: BuildXlsxOptions = {},
): Promise<Blob> => {
  const { columns, rows } = data
  const encoder = new TextEncoder()
  const contexts: CellContext[] = columns.map(column => ({
    kind: dateKindOf(column),
    parse: typeof column.filter === 'object' ? column.filter?.parse : undefined,
    timeZone,
  }))
  const refs = columns.map((_, index) => columnName(index))
  let frozenColumns = 0
  while (columns[frozenColumns]?.pinned === 'start') frozenColumns++

  const perSheet = Math.max(1, maxRowsPerSheet - 1)
  const sheetCount = Math.max(1, Math.ceil(rows.length / perSheet))
  const sheets: ZipEntry[] = []
  const names: string[] = []
  let sliceStart = performance.now()

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const from = sheet * perSheet
    const to = Math.min(rows.length, from + perSheet)
    const chunks: Uint8Array[] = []
    let crc = 0
    let buffer = sheetHead(columns, frozenColumns)
    const flush = () => {
      const chunk = encoder.encode(buffer)
      crc = crc32Update(crc, chunk)
      chunks.push(chunk)
      buffer = ''
    }

    for (let r = from; r < to; r++) {
      const excelRow = r - from + 2
      const row = rows[r]!
      let xml = `<row r="${excelRow}">`
      for (let c = 0; c < columns.length; c++) {
        xml += cellXml(`${refs[c]}${excelRow}`, row[c], contexts[c]!)
      }
      buffer += `${xml}</row>`
      if (performance.now() - sliceStart > SLICE_MS) {
        flush()
        await yieldToMain()
        sliceStart = performance.now()
      }
    }
    buffer += `</sheetData><autoFilter ref="A1:${lastRef(columns, to - from)}"/></worksheet>`
    flush()
    sheets.push({ name: `xl/worksheets/sheet${sheet + 1}.xml`, chunks, crc })
    names.push(sheetNameOf(sheetName, sheet))
  }

  const text = (name: string, content: string): ZipEntry => ({
    name,
    chunks: [encoder.encode(content)],
  })
  const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const sheetIds = names.map((_, index) => index + 1)

  return buildZip(
    [
      text(
        '[Content_Types].xml',
        `${xmlHead}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetIds.map(id => `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
      ),
      text(
        '_rels/.rels',
        `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
      text(
        'xl/workbook.xml',
        `${xmlHead}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((_, index) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${escapeXml(names[index]!.replace(/'/g, "''"))}'!$A$1:$${columnName(Math.max(0, columns.length - 1))}$${Math.min(perSheet, rows.length - index * perSheet) + 1}</definedName>`).join('')}</definedNames></workbook>`,
      ),
      text(
        'xl/_rels/workbook.xml.rels',
        `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetIds.map(id => `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
      text('xl/styles.xml', STYLES),
      ...sheets,
    ],
    { compress },
  )
}
