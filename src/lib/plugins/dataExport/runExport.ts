/**
 * Запуск выгрузки (ADR 0044, §5–§7): клиентская выгрузка собирает данные, сериализует
 * и скачивает; серверная отдаёт запрос потребителю.
 */
import { logError } from '../../core/logger'
import { isThenable } from '../../core/thenable'
import { downloadFile } from './download'
import {
  collectExportData,
  exportColumnsOf,
  headerOf,
  selectedRowIdsOf,
} from './exportData'
import { exportConfigOf, settingsFromArg, whereOf } from './settings'
import type {
  ExportFormat,
  ExportHooks,
  ExportRequest,
  ExportSettings,
} from './types'

type HooksTable = { getHooks?: () => Record<string, unknown> | undefined }

const hooksOf = (table: unknown): Partial<ExportHooks> =>
  ((table as HooksTable).getHooks?.()?.dataExport as
    Partial<ExportHooks> | undefined) ?? {}

export const formatOf = (table: unknown, settings: ExportSettings) => {
  const formats = exportConfigOf(table)!.formats
  return formats.find(format => format.id === settings.format) ?? formats[0]
}

const filenameOf = (
  table: unknown,
  settings: ExportSettings,
  format: ExportFormat,
): string => {
  const filename = exportConfigOf(table)?.filename
  return typeof filename === 'function'
    ? filename(settings, format)
    : (filename ?? 'export')
}

const invoke = (
  table: unknown,
  callback: ((request: ExportRequest) => void | Promise<void>) | undefined,
  request: ExportRequest,
): Promise<void> | undefined => {
  const fail = (error: unknown) =>
    logError(
      table as never,
      `dataExport: колбэк завершился ошибкой: ${error instanceof Error ? error.message : String(error)}`,
    )
  try {
    const result = callback?.(request)
    if (isThenable(result)) {
      return Promise.resolve(result).then(undefined, fail)
    }
  } catch (error) {
    fail(error)
  }
  return undefined
}

/**
 * Выполняет выгрузку с настройками. Возвращает промис, пока потребитель не завершил
 * серверный `onExport` (EX28); иначе `undefined`. Отказ логируется и не пробрасывается.
 */
export const runExport = (
  table: unknown,
  settings: ExportSettings,
): Promise<void> | undefined => {
  const hooks = hooksOf(table)
  const config = exportConfigOf(table)!
  const format = formatOf(table, settings)

  if (whereOf(table, settings) === 'server') {
    const columns = exportColumnsOf(table, settings.columns).map(column => ({
      id: column.id,
      header: headerOf(column),
    }))
    return invoke(table, hooks.onExport, {
      settings,
      format,
      columns,
      ...(settings.rows === 'selected'
        ? { rowIds: selectedRowIdsOf(table) }
        : {}),
    })
  }

  const data = collectExportData(table, {
    rows: settings.rows,
    columns: settings.columns,
    formatValue: config.formatValue,
  })
  const filename = filenameOf(table, settings, format)
  downloadFile(format.serialize(data), filename, format)
  return invoke(table, hooks.onExported, {
    settings,
    format,
    columns: data.columns,
    rowCount: data.rows.length,
    filename,
  })
}

/** `table.exportData(arg?)` (EX30): тот же путь, что у «Выгрузить» в панели. */
export const exportByArg = (
  table: unknown,
  arg?: string | Partial<ExportSettings>,
): Promise<void> => {
  const settings = settingsFromArg(table, arg)
  return settings
    ? (runExport(table, settings) ?? Promise.resolve())
    : Promise.resolve()
}
