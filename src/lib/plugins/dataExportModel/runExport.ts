/**
 * Запуск выгрузки (ADR 0044, §5–§7): клиентская выгрузка собирает данные, сериализует
 * и скачивает; серверная отдаёт запрос потребителю.
 */
import { type ActionReport, reportOutcome } from '../../core/debugActions'
import { logError, logWarn } from '../../core/logger'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { isThenable } from '../../core/thenable'
import { downloadFile } from './download'
import {
  collectExportData,
  exportColumnsOf,
  headerOf,
  selectedRowIdsOf,
  serverRowsRequestOf,
} from './exportData'
import { exportConfigOf, settingsFromArg, whereOf } from './settings'
import type {
  ExportContent,
  ExportFormat,
  ExportHooks,
  ExportRequest,
  ExportSettings,
} from './types'

type HooksTable = { getHooks?: () => Record<string, unknown> | undefined }

const hooksOf = (table: unknown): Partial<ExportHooks> =>
  ((table as HooksTable).getHooks?.()?.dataExportModel as
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
  outcome?: ActionReport,
  /**
   * Отказ пробрасывается, а не логируется: отказ серверной выгрузки отмечает кнопку
   * (ADR 0136, FB6), приложение знает о нём из своего промиса.
   */
  rethrow = false,
): Promise<void> | undefined => {
  const fail = (error: unknown) =>
    logError(
      table as never,
      `dataExport: колбэк завершился ошибкой: ${error instanceof Error ? error.message : String(error)}`,
    )
  try {
    const result = callback?.(request)
    // Итог — по промису колбэка (ADR 0125).
    if (outcome) reportOutcome(table, outcome, result)
    if (isThenable(result)) {
      return Promise.resolve(result).then(undefined, (error: unknown) => {
        if (rethrow) throw error
        fail(error)
      })
    }
  } catch (error) {
    fail(error)
  }
  return undefined
}

/**
 * Выполняет выгрузку с настройками. Возвращает промис, пока потребитель не завершил
 * серверный `onExport` (EX28) или асинхронный формат не собран (XL7); иначе
 * `undefined`. Отказ `onExport` отклоняет промис, отказ формата логируется и отклоняет
 * промис, отказ `onExported` — только логируется.
 */
export const runExport = (
  table: unknown,
  settings: ExportSettings,
  /** Действие, чей итог сообщить в канал действий (ADR 0125). */
  outcome?: ActionReport,
): Promise<void> | undefined => {
  const hooks = hooksOf(table)
  const config = exportConfigOf(table)!
  const format = formatOf(table, settings)

  if (whereOf(table, settings) === 'server') {
    const columns = exportColumnsOf(table, settings.columns).map(column => ({
      id: column.id,
      header: headerOf(column),
    }))
    return invoke(
      table,
      hooks.onExport,
      {
        settings,
        format,
        columns,
        ...(settings.rows === 'selected'
          ? { rowIds: selectedRowIdsOf(table) }
          : {}),
        ...serverRowsRequestOf(table),
      },
      outcome,
      true,
    )
  }

  const data = collectExportData(table, {
    rows: settings.rows,
    columns: settings.columns,
    formatValue: config.formatValue,
  })
  const filename = filenameOf(table, settings, format)
  const finish = (content: ExportContent) => {
    downloadFile(content, filename, format)
    return invoke(table, hooks.onExported, {
      settings,
      format,
      columns: data.columns,
      rowCount: data.rows.length,
      filename,
    })
  }
  const content = format.serialize(data)
  if (!isThenable(content)) return finish(content)
  // Асинхронный формат (xlsx): кнопка ждёт; отказ логируется и отклоняет промис.
  const built = Promise.resolve(content).then(
    resolved => finish(resolved),
    (error: unknown) => {
      logError(
        table as never,
        `dataExport: формат ${format.id} не собран: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    },
  )
  if (outcome) reportOutcome(table, outcome, built)
  return built
}

/** `table.exportData(arg?)` (EX30): тот же путь, что у «Выгрузить» в панели. */
export const exportByArg = (
  table: unknown,
  arg?: string | Partial<ExportSettings>,
  outcome?: ActionReport,
): Promise<void> => {
  const settings = settingsFromArg(table, arg)
  if (!settings) return Promise.resolve()
  // Явный вызов приложения не блокируется, но до данных файл выйдет пустым (ADR 0122, TF12).
  if (isSkeletonShown(table) && whereOf(table, settings) === 'client') {
    logWarn(
      table as never,
      'dataExport: выгрузка до прихода данных — в файле будет только шапка',
      'dataExport:beforeData',
    )
  }
  return runExport(table, settings, outcome) ?? Promise.resolve()
}
