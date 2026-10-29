/**
 * Формат `.xlsx` (ADR 0073, §1): лёгкая запись; генератор листа грузится отдельным
 * модулем при первой выгрузке и не входит в начальную загрузку приложения.
 */
import type { BuildXlsxOptions } from './xlsxBuild'
import type { ExportFormat } from './types'

export type XlsxFormatOptions = Pick<BuildXlsxOptions, 'timeZone' | 'sheetName'>

type Builder = typeof import('./xlsxBuild')

let builder: Promise<Builder> | undefined

/** Модуль генератора: один раз на документ; отказ загрузки — повтор при следующей выгрузке. */
const loadBuilder = () => {
  builder ??= import('./xlsxBuild').catch((error: unknown) => {
    builder = undefined
    throw error
  })
  return builder
}

export const xlsxFormat = (options: XlsxFormatOptions = {}): ExportFormat => ({
  id: 'xlsx',
  label: 'Excel',
  extension: 'xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  serialize: async (data, context) => {
    const builder = await loadBuilder()
    context?.signal.throwIfAborted()
    return builder.buildXlsx(data, options)
  },
})
