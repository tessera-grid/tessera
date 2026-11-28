/**
 * Сериализация выделения ячеек в буфер обмена (ADR 0029): `copy` над телом и пункт
 * «Копировать» плагина cellSelection.
 *
 * Сама v9-фича намеренно НЕ сериализует данные: разделитель, представление null и
 * quoting — прикладные решения. Здесь — дефолт Tessera: TSV + HTML-таблица.
 */

/** Значение ячейки → текст. `null`/`undefined` → пустая строка. */
const cellText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

/** Поле TSV с `\t`/`\n`/`\r`/`"` заворачивается в кавычки с удвоением внутренних. */
const quoteTsvField = (text: string): string =>
  /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Selection regions (`getSelectedCellRangesData()` → `[region][row][column]`) as TSV: columns
 * separated by tabs, rows by newlines, disjoint regions by an empty line.
 */
export const cellRangesToTsv = (regions: unknown[][][]): string =>
  regions
    .map(region =>
      region
        .map(row => row.map(v => quoteTsvField(cellText(v))).join('\t'))
        .join('\n'),
    )
    .join('\n\n')

/** The same regions as HTML tables (rich paste into Excel or Sheets). */
export const cellRangesToHtml = (regions: unknown[][][]): string =>
  regions
    .map(
      region =>
        `<table>${region
          .map(
            row =>
              `<tr>${row
                .map(v => `<td>${escapeHtml(cellText(v))}</td>`)
                .join('')}</tr>`,
          )
          .join('')}</table>`,
    )
    .join('')

/**
 * Текст буфера в строки и ячейки (ADR 0219, WR2): колонки — таб, строки — `\n` и `\r\n`,
 * поле в кавычках с `""` и переводами строк внутри — как кладут Excel и Google Sheets;
 * хвостовая пустая строка отбрасывается.
 */
export const parseClipboardText = (text: string): string[][] => [
  ...clipboardRows(text),
]

/** Строки буфера по одной — разбор кусками с уступкой потока (ADR 0219, §10). */
export function* clipboardRows(text: string): Generator<string[]> {
  let row: string[] = []
  let field = ''
  let quoted = false
  let fieldStart = true
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"' && fieldStart) {
      quoted = true
      fieldStart = false
      continue
    }
    fieldStart = false
    if (char === '\t') {
      row.push(field)
      field = ''
      fieldStart = true
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      yield row
      row = []
      field = ''
      fieldStart = true
    } else field += char
  }
  if (!fieldStart || field !== '' || row.length > 0) {
    row.push(field)
    yield row
  }
}

/** Свой формат буфера: значения в типе колонки для вставки между гридами (ADR 0219, WR4). */
export const TESSERA_FORMAT = 'application/x-tessera'

const DATE_KEY = '$date'

/** Регион значений в свой формат: даты — ISO. */
export const valuesToTesseraFormat = (region: readonly unknown[][]): string =>
  JSON.stringify({
    version: 1,
    rows: region.map(row =>
      row.map(value =>
        value instanceof Date
          ? { [DATE_KEY]: value.toISOString() }
          : (value ?? null),
      ),
    ),
  })

/** Свой формат буфера в значения; не наш формат — `undefined`. */
export const tesseraFormatToValues = (
  data: string | undefined,
): unknown[][] | undefined => {
  if (!data) return undefined
  try {
    const parsed = JSON.parse(data) as { version?: unknown; rows?: unknown }
    if (parsed.version !== 1 || !Array.isArray(parsed.rows)) return undefined
    return (parsed.rows as unknown[]).map(row =>
      Array.isArray(row)
        ? row.map(value =>
            value !== null &&
            typeof value === 'object' &&
            DATE_KEY in value &&
            Object.keys(value).length === 1
              ? new Date(String((value as Record<string, unknown>)[DATE_KEY]))
              : value,
          )
        : [],
    )
  } catch {
    return undefined
  }
}

/** Whether the regions contain at least one cell (an empty array or empty regions → no). */
export const hasSelectedCells = (regions: unknown[][][]): boolean =>
  regions.some(region => region.some(row => row.length > 0))

/** Число ячеек во всех регионах выделения. */
export const countCells = (regions: unknown[][][]): number =>
  regions.reduce(
    (sum, region) => sum + region.reduce((n, row) => n + row.length, 0),
    0,
  )
