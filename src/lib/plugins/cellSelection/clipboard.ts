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
 * Регионы выделения (`getSelectedCellRangesData()` → `[регион][строка][колонка]`)
 * в TSV: колонки — таб, строки — перевод строки, непересекающиеся регионы —
 * пустая строка между ними.
 */
export const cellRangesToTsv = (regions: unknown[][][]): string =>
  regions
    .map(region =>
      region
        .map(row => row.map(v => quoteTsvField(cellText(v))).join('\t'))
        .join('\n'),
    )
    .join('\n\n')

/** Те же регионы как HTML-таблицы (rich-paste в Excel/Sheets). */
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

/** Есть ли в регионах хоть одна ячейка (пустой массив/пустые регионы → нет). */
export const hasSelectedCells = (regions: unknown[][][]): boolean =>
  regions.some(region => region.some(row => row.length > 0))

/** Число ячеек во всех регионах выделения. */
export const countCells = (regions: unknown[][][]): number =>
  regions.reduce(
    (sum, region) => sum + region.reduce((n, row) => n + row.length, 0),
    0,
  )
