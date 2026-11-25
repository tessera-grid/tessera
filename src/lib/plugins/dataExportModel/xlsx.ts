/**
 * Формат `.xlsx` (ADR 0073, §1): лёгкая запись; генератор листа грузится отдельным
 * модулем при первой выгрузке и не входит в начальную загрузку приложения.
 */
import type { BuildXlsxOptions } from './xlsxBuild'
import type { ExportFormat } from './types'

export type XlsxFormatOptions = Pick<
  BuildXlsxOptions,
  'timeZone' | 'sheetName'
> & {
  /** Собирать XLSX в Worker, если браузер и данные это позволяют. По умолчанию false. */
  worker?: boolean
}

const workerFormats = new WeakSet<ExportFormat>()

export const usesXlsxWorker = (format: ExportFormat) =>
  workerFormats.has(format) && typeof Worker !== 'undefined'

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

export const xlsxFormat = ({
  worker = false,
  ...options
}: XlsxFormatOptions = {}): ExportFormat => {
  const format: ExportFormat = {
    id: 'xlsx',
    label: 'Excel',
    extension: 'xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    serialize: async (data, context) => {
      const signal = context?.signal
      signal?.throwIfAborted()
      if (
        usesXlsxWorker(format) &&
        !data.columns.some(column => column.dataType?.parseDate)
      ) {
        try {
          const { serializeXlsxInWorker } = await import('./xlsxWorkerClient')
          return await serializeXlsxInWorker(data, options, signal)
        } catch {
          // CSP, запуск Worker и неподдерживаемые значения: локальный генератор.
          signal?.throwIfAborted()
        }
      }
      const builder = await loadBuilder()
      signal?.throwIfAborted()
      return builder.buildXlsx(data, options)
    },
  }
  if (worker) workerFormats.add(format)
  return format
}
