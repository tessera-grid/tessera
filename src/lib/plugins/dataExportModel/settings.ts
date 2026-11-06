/**
 * Оси настроек выгрузки (ADR 0044, §2, §6, §7): какие значения присутствуют по
 * активным плагинам, какие разрешены `allow`, начальные значения, место выполнения.
 */
import { logError, logWarn } from '../../util/logger'
import { dataModeOf } from '../../core/dataMode'
import {
  type PluginDiagnostic,
  type PluginInertReason,
  serverRowModelReason,
} from '../../core/pluginDiagnostics'
import { tableAllSelection } from '../../core/rowSelectionAll'
import { selectedRowIdsOf } from './exportData'
import type {
  ExportAllow,
  ExportColumns,
  ExportFormat,
  ExportPreset,
  ExportRows,
  ExportSettings,
} from './types'

/** Что учитывает значение `view`. */
export type ExportViewFeature = 'sorting' | 'filtering'

const VIEW_PLUGINS: Record<string, ExportViewFeature> = {
  columnSorting: 'sorting',
  columnSortingModel: 'sorting',
  columnFiltering: 'filtering',
  columnFilteringModel: 'filtering',
  quickSearch: 'filtering',
  quickSearchModel: 'filtering',
}

/** Плагины, с которыми значение строк есть: интерфейс или его модель (ADR 0120). */
const ROWS_PLUGINS: Partial<Record<ExportRows, readonly string[]>> = {
  page: ['pagination', 'paginationModel'],
  selected: ['rowSelection', 'rowSelectionModel'],
}

const ROWS_ORDER: ExportRows[] = ['all', 'view', 'page', 'selected']
const COLUMNS_ORDER: ExportColumns[] = ['visible', 'all']

/** Опции выгрузки в опциях таблицы (кладёт плагин). */
export interface ResolvedExportOptions {
  formats: ExportFormat[]
  maxLoadedRows?: number
  allow?: ExportAllow
  presets?: ExportPreset[]
  filename?:
    string | ((settings: ExportSettings, format: ExportFormat) => string)
  formatValue?: (context: {
    value: unknown
    row: unknown
    column: { id: string }
  }) => unknown
}

/** Полного набора строк на клиенте нет: значения строк, кроме `page`, выгружает сервер (ADR 0169). */
export const exportsOnServer = (table: unknown) =>
  dataModeOf(table, 'export') === 'server'

export interface Choice<T> {
  value: T
  disabled: boolean
  /** Почему значение недоступно не по `allow` (серверная модель строк, ADR 0138, §10). */
  reason?: PluginInertReason
}

export interface ExportAxes {
  rows: Choice<ExportRows>[]
  columns: Choice<ExportColumns>[]
  formats: Choice<string>[]
  /** Для подписи значения `view`: что учитывается. */
  viewBy: ExportViewFeature[]
}

type ExportTable = {
  options: { exportOptions?: ResolvedExportOptions }
  getPluginDiagnostics?: () => PluginDiagnostic[]
}

export const exportConfigOf = (table: unknown) =>
  (table as ExportTable).options.exportOptions

const activePlugins = (table: unknown): Set<string> =>
  new Set(
    (table as ExportTable)
      .getPluginDiagnostics?.()
      .filter(diagnostic => diagnostic.status === 'active')
      .map(diagnostic => diagnostic.id),
  )

const choice = <T>(
  value: T,
  allowed: readonly T[] | undefined,
  extraDisabled = false,
): Choice<T> => ({
  value,
  disabled:
    extraDisabled || (allowed !== undefined && !allowed.includes(value)),
})

export const resolveAxes = (table: unknown): ExportAxes | undefined => {
  const config = exportConfigOf(table)
  if (!config) return undefined

  const active = activePlugins(table)
  const viewBy = Object.entries(VIEW_PLUGINS)
    .filter(([id]) => active.has(id))
    .map(([, feature]) => feature)
    .filter((feature, index, all) => all.indexOf(feature) === index)
  const noSelection =
    !tableAllSelection(table) && selectedRowIdsOf(table).length === 0
  // Строк у грида нет: `all` и `selected` выгружает только сервер (ADR 0190, §1).
  const serverRows = exportsOnServer(table)
    ? undefined
    : serverRowModelReason(table)

  // Без сортировки и фильтров `view` серверной модели — весь список: `all` повторял бы его.
  const onlyList = !!serverRows && viewBy.length === 0
  const present = (rows: ExportRows) =>
    rows === 'view'
      ? viewBy.length > 0 || !!serverRows
      : rows === 'all'
        ? !onlyList
        : !ROWS_PLUGINS[rows] || ROWS_PLUGINS[rows].some(id => active.has(id))

  return {
    rows: ROWS_ORDER.filter(present).map(rows =>
      serverRows && (rows === 'all' || rows === 'selected')
        ? { value: rows, disabled: true, reason: serverRows }
        : choice(rows, config.allow?.rows, rows === 'selected' && noSelection),
    ),
    columns: COLUMNS_ORDER.map(columns =>
      choice(columns, config.allow?.columns),
    ),
    formats: config.formats.map(format =>
      choice(format.id, config.allow?.formats),
    ),
    viewBy,
  }
}

const firstEnabled = <T>(choices: Choice<T>[], wanted?: T): T | undefined =>
  choices.find(item => item.value === wanted && !item.disabled)?.value ??
  choices.find(item => !item.disabled)?.value

/**
 * Настройки: желаемые значения, где они доступны, иначе первое доступное каждой оси.
 * `undefined` — в какой-то оси нет доступных значений.
 */
export const resolveSettings = (
  axes: ExportAxes,
  wanted: Partial<ExportSettings> = {},
): ExportSettings | undefined => {
  const rows = firstEnabled(axes.rows, wanted.rows)
  const columns = firstEnabled(axes.columns, wanted.columns)
  const format = firstEnabled(axes.formats, wanted.format)
  return rows && columns && format ? { rows, columns, format } : undefined
}

/** Единственная доступная комбинация: у каждой оси одно доступное значение. */
export const singleSettings = (
  axes: ExportAxes,
): ExportSettings | undefined => {
  const only = <T>(choices: Choice<T>[]) => {
    const enabled = choices.filter(item => !item.disabled)
    return enabled.length === 1 ? enabled[0].value : undefined
  }
  const rows = only(axes.rows)
  const columns = only(axes.columns)
  const format = only(axes.formats)
  return rows && columns && format ? { rows, columns, format } : undefined
}

const isEnabled = <T>(choices: Choice<T>[], value: T): boolean =>
  choices.some(item => item.value === value && !item.disabled)

/** Быстрый набор поверх настроек: ось выставляется, только если значение доступно. */
export const applyPreset = (
  axes: ExportAxes,
  base: ExportSettings,
  preset: ExportPreset,
): ExportSettings => ({
  rows:
    preset.rows && isEnabled(axes.rows, preset.rows) ? preset.rows : base.rows,
  columns:
    preset.columns && isEnabled(axes.columns, preset.columns)
      ? preset.columns
      : base.columns,
  format:
    preset.format && isEnabled(axes.formats, preset.format)
      ? preset.format
      : base.format,
})

/** Аргумент `table.exportData`: настройки по умолчанию, объект осей или id набора (EX30). */
export const settingsFromArg = (
  table: unknown,
  arg?: string | Partial<ExportSettings>,
): ExportSettings | undefined => {
  const config = exportConfigOf(table)
  const axes = resolveAxes(table)
  if (!config || !axes) return undefined
  const fail = (message: string) => {
    logError(table as never, `dataExport: ${message}`)
    return undefined
  }

  const defaults = resolveSettings(axes)
  if (!defaults) return fail('нет доступных настроек выгрузки')

  if (typeof arg === 'string') {
    const preset = config.presets?.find(candidate => candidate.id === arg)
    return preset
      ? applyPreset(axes, defaults, preset)
      : fail(`набор «${arg}» неизвестен`)
  }
  if (arg === undefined) return defaults

  const checks: [string, Choice<string>[], string | undefined][] = [
    ['rows', axes.rows, arg.rows],
    ['columns', axes.columns, arg.columns],
    ['format', axes.formats, arg.format],
  ]
  for (const [axis, choices, value] of checks) {
    if (value !== undefined && !isEnabled(choices, value)) {
      return fail(`значение «${value}» оси «${axis}» недоступно`)
    }
  }
  return resolveSettings(axes, arg)
}

/** Серверные значения строк выгружает потребитель; `page` — клиент (ADR 0044, §6). */
const isServerRows = (table: unknown, rows: ExportRows) =>
  !!exportConfigOf(table) && exportsOnServer(table) && rows !== 'page'

export const whereOf = (
  table: unknown,
  settings: ExportSettings,
): 'client' | 'server' =>
  isServerRows(table, settings.rows) ? 'server' : 'client'

/**
 * Оси до прихода данных: клиентские значения строк недоступны — выгрузка дала бы файл
 * с одной шапкой (ADR 0122, TF7). Серверные остаются: данные у сервера.
 */
export const axesBeforeData = (
  table: unknown,
  axes: ExportAxes,
): ExportAxes => ({
  ...axes,
  rows: axes.rows.map(item =>
    item.disabled || isServerRows(table, item.value)
      ? item
      : { ...item, disabled: true },
  ),
})

/** Предупреждение о быстром наборе без единого доступного значения. */
export const warnUnusablePresets = (
  table: unknown,
  axes: ExportAxes,
  presets: ExportPreset[] | undefined,
) => {
  for (const preset of presets ?? []) {
    const usable =
      (!preset.rows || isEnabled(axes.rows, preset.rows)) &&
      (!preset.columns || isEnabled(axes.columns, preset.columns)) &&
      (!preset.format || isEnabled(axes.formats, preset.format))
    if (!usable) {
      logWarn(
        table as never,
        `dataExport: набор «${preset.id}» задаёт недоступное значение оси`,
        `dataExport:preset:${preset.id}`,
      )
    }
  }
}
