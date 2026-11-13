/**
 * Запуск выгрузки (ADR 0044, §5–§7): клиентская выгрузка собирает данные, сериализует
 * и скачивает; серверная отдаёт запрос потребителю.
 */
import { announceLabel } from '../../core/announcer'
import {
  type CancelSource,
  lateAnswer,
  registerPending,
} from '../../core/cancellation'
import {
  type ActionReport,
  reportAction,
  reportOutcome,
} from '../../core/debugActions'
import { logError, logWarn } from '../../util/logger'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { isThenable } from '../../util/thenable'
import { downloadFile } from './download'
import {
  collectExportData,
  exportColumnsOf,
  headerOf,
  listRowsLoaderOf,
  pageRowsLoaderOf,
  selectedRowIdsOf,
  serverRowsRequestOf,
} from './exportData'
import { exportConfigOf, settingsFromArg, whereOf } from './settings'
import type {
  ExportContent,
  ExportContext,
  ExportFormat,
  ExportHooks,
  ExportRequest,
  ExportSettings,
} from './types'
import { actionLabelOf } from '../../core/actions'

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
  callback:
    | ((
        request: ExportRequest,
        context?: ExportContext,
      ) => void | Promise<void>)
    | undefined,
  request: ExportRequest,
  outcome?: ActionReport,
  /**
   * Отказ пробрасывается, а не логируется: отказ серверной выгрузки отмечает кнопку
   * (ADR 0136, FB6), приложение знает о нём из своего промиса.
   */
  rethrow = false,
  context?: ExportContext,
): Promise<void> | undefined => {
  const fail = (error: unknown) =>
    logError(
      table as never,
      `dataExport: колбэк завершился ошибкой: ${error instanceof Error ? error.message : String(error)}`,
    )
  try {
    const result = context ? callback?.(request, context) : callback?.(request)
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
 * Ожидание выгрузки — в реестре отмены (ADR 0153): отмена прерывает `signal` и снимает
 * ожидание сразу, без отказа; ответ после отмены не скачивает файл.
 */
const cancellable = (
  table: unknown,
  format: ExportFormat,
  outcome: ActionReport | undefined,
  run: (context: ExportContext) => Promise<void> | undefined,
): Promise<void> | undefined => {
  const controller = new AbortController()
  let cancelled: (() => void) | undefined
  const stopped = new Promise<void>(resolve => (cancelled = resolve))
  const pending = run({ signal: controller.signal })
  if (!pending) return undefined
  const cancel = (source: CancelSource) => {
    if (controller.signal.aborted) return
    controller.abort()
    unregister()
    reportAction(table, {
      plugin: 'dataExport',
      action: 'cancel',
      detail: { action: format.id },
      source,
      cause: outcome?.cause,
    })
    announceLabel(table, labels =>
      labels.announceActionCancelled(
        actionLabelOf(
          table,
          { plugin: 'dataExportModel', action: 'exportData' },
          labels,
        ),
      ),
    )
    cancelled!()
  }
  const unregister = registerPending(table, {
    kind: 'export',
    id: format.id,
    cancel,
    // Таблица ушла со страницы — выгрузка бросается молча, файла нет (XV11).
    drop: () => {
      if (controller.signal.aborted) return
      controller.abort()
      unregister()
      cancelled!()
    },
  })
  const settled = pending.then(
    () => {
      if (controller.signal.aborted) return lateAnswer(table)
      unregister()
    },
    (error: unknown) => {
      if (controller.signal.aborted) return lateAnswer(table, error)
      unregister()
      throw error
    },
  )
  return Promise.race([settled, stopped])
}

/**
 * Выполняет выгрузку с настройками. Возвращает промис, пока потребитель не завершил
 * серверный `onExport` (EX28) или асинхронный формат не собран (XL7); иначе
 * `undefined`. Отказ `onExport` и формата отклоняет промис, отказ `onExported` — только
 * логируется.
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
    return cancellable(table, format, outcome, context =>
      invoke(
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
        context,
      ),
    )
  }

  const write = (
    context: ExportContext,
    loaded?: Parameters<typeof collectExportData>[2],
  ) => {
    const data = collectExportData(
      table,
      {
        rows: settings.rows,
        columns: settings.columns,
        formatValue: config.formatValue,
      },
      loaded,
    )
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
    const content = format.serialize(data, context)
    if (!isThenable(content)) return finish(content)
    // Асинхронный формат (xlsx): кнопка ждёт; отказ отклоняет промис — его причина на
    // отметке кнопки (ADR 0136, FB6). После отмены файл не скачивается.
    return Promise.resolve(content).then(resolved =>
      context.signal.aborted ? undefined : finish(resolved),
    )
  }
  const load =
    pageRowsLoaderOf(table, settings.rows) ??
    listRowsLoaderOf(table, settings.rows)
  return cancellable(table, format, outcome, context => {
    const result = load
      ? load(context.signal).then(rows =>
          context.signal.aborted ? undefined : write(context, rows),
        )
      : write(context)
    if (outcome && (load || result)) reportOutcome(table, outcome, result)
    return result
  })
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
