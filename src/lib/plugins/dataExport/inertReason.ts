import type { PluginInertReason } from '../../core/pluginDiagnostics'
import type { ExportRows } from './types'
import type { ResolvedExportOptions } from './settings'

type ExportTable = {
  options: { exportOptions?: ResolvedExportOptions }
  getHooks?: () => Record<string, unknown> | undefined
}

const ALL_ROWS: ExportRows[] = ['all', 'view', 'page', 'selected']

/**
 * Серверная выгрузка без `onExport` ничего не выгрузит (EX29); без тулбара нет только
 * кнопки — `table.exportData()` работает (PB8). Значения строк тут объявленные (`allow`), без фильтра по активным
 * плагинам: фильтр читает `getPluginDiagnostics()`, то есть этот же `diagnose`.
 */
export const exportInertReason = (
  table: unknown,
): PluginInertReason | undefined => {
  const { options, getHooks } = table as ExportTable
  const config = options.exportOptions
  const hooks = getHooks?.call(table)?.dataExport as
    { onExport?: unknown } | undefined
  const runsOnServer =
    !!config?.server &&
    (config.allow?.rows ?? ALL_ROWS).some(rows => rows !== 'page')
  return runsOnServer && !hooks?.onExport ? 'noOnExport' : undefined
}
