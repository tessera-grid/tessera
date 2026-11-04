/**
 * Запись плагина rowSelectionModel на `definePlugin`: модель выбора строк без интерфейса
 * (ADR 0014, ADR 0120). Выбор — срез `rowSelection`; выбранные строки залиты и несут
 * `aria-selected` (в роли grid). Колонка флажков, Space, счётчик и колбэки пользователя —
 * у `rowSelection`, который включает эту модель.
 */
import { isPlaceholderRow } from '../../core/lazyPlaceholder'
import {
  type RowSelectionState,
  rowSelectionFeature,
  type RowData,
  type TableFeatures,
} from '@tanstack/react-table'

import type { Row, Table } from '../../types'
import { announceLabel } from '../../core/announcer'
import { type BodyContributions, withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import {
  effectiveSelectionOf,
  isAllSelection,
  type RowSelectionValue,
} from '../../core/rowSelectionAll'
import {
  serverRowModelReason,
  warnPluginInert,
} from '../../core/pluginDiagnostics'
import { GROUP_ROW_PREFIX, type RowSource } from '../../core/rowSource'
import {
  type SelectionSummary,
  selectionPartsLabel,
  selectionSummaryOf,
} from './selectionCount'
import { groupingLength, isGroupingActive, subRowsOf } from './selectionHelpers'
import { rowSelectionModelLabels } from './labels'

export interface RowSelectionModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /**
   * Флажки у вложенных строк (ADR 0162): `true` — с каскадом на поддерево, `'self'` — каждая
   * строка выбирается сама; без него — флажки только у строк верхнего уровня.
   */
  subRows?: boolean | 'self'
  /**
   * Выбранные строки по `id` или «всё, кроме» `{ all, except, groups?, branches? }` серверной
   * модели строк (ADR 0138, §9; ADR 0148; ADR 0162): задаёт приложение; без него срез хранит
   * грид.
   */
  rowSelection?: RowSelectionValue
  /** Новое значение среза после каждого изменения изнутри грида. */
  onRowSelectionChange?: (next: RowSelectionValue) => void
  /** Начальное значение среза, которым владеет грид. */
  initialRowSelection?: RowSelectionValue
}

/** Фичи модели выбора; интерфейс несёт те же — по ним выводится тип среза. */
export const rowSelectionModelFeatures = { rowSelectionFeature }

/**
 * Строка, которую выбирает «всё, кроме»: в дереве серверной модели — корень, а с `subRows` —
 * любая строка (ADR 0138, §14; ADR 0162); при серверной группировке — строка данных, а не
 * группа (ADR 0144, §5).
 */
const rootRow = (table: unknown) => (id: string) =>
  groupingLength(table) > 0
    ? !id.startsWith(GROUP_ROW_PREFIX)
    : !!subRowsOf(table) ||
      ((table as { getRowSource?: () => RowSource<{ depth: number }> })
        .getRowSource?.()
        .byId(id)?.depth ?? 0) === 0

/** Предки строки дерева серверной модели — путь её узла в дереве выбора (ADR 0162). */
const rowPathOf = (table: unknown) => (id: string) =>
  (table as { getRowSource?: () => RowSource })
    .getRowSource?.()
    .ancestors?.(id) ?? []

/** Строка-группа строки данных при серверной группировке (ADR 0148); без неё — нет. */
const rowGroupOf = (table: unknown) => (id: string) =>
  groupingLength(table) > 0
    ? (table as { getRowSource?: () => RowSource<{ parentId?: string }> })
        .getRowSource?.()
        .byId(id)?.parentId
    : undefined

/**
 * Выбор недоступен при АКТИВНОЙ группировке: сгруппированная модель производна,
 * выбором владеет группировка. Функциональный `enableRowSelection` согласует и
 * агрегаты (getIsAllPageRowsSelected и т.п.).
 */
const enableRowSelection = (row: Row<any, any>): boolean => {
  // Скелет-строка ленивых детей — не данные (ADR 0155, §3).
  if (isPlaceholderRow(row)) return false
  if (!isGroupingActive(row.table)) {
    return true
  }
  warnPluginInert(row.table, 'rowSelectionModel', 'grouping')
  return false
}

/**
 * Каскад TanStack — в клиентском режиме; в серверной модели каскад ведёт дерево выбора
 * (ADR 0162, §2).
 */
const enableSubRowSelection = (row: Row<any, any>) =>
  !serverRowModelReason(row.table)

const NO_SELECTION: RowSelectionState = {}

const selectionKeys = new WeakMap<object, string>()

const keyOf = (option: unknown) =>
  typeof option === 'function' ? 'fn' : String(option)

/**
 * Смена опций выбора меняет смысл среза — выбор сбрасывается (ADR 0039, RX13). Монтирование
 * и новая ссылка на предикат — не смена: начальный выбор остаётся (ADR 0120, MP9).
 */
const resetOnSelectionChange = (table: unknown) => {
  const t = table as Table<any, any>
  const key = `${keyOf(t.options.enableRowSelection)}/${keyOf(t.options.enableSubRowSelection)}`
  const previous = selectionKeys.get(t.store)
  selectionKeys.set(t.store, key)
  if (previous !== undefined && previous !== key) t.resetRowSelection(true)
}

interface SelectionAtom {
  get: () => RowSelectionState | undefined
  subscribe: (listener: () => void) => { unsubscribe: () => void }
}

/**
 * Смена выбора объявляется числом выбранных строк — тем же, что у счётчика нижней панели
 * (ADR 0032, W9; ADR 0138, SD51). Срез пересчитан без смены числа — объявления нет.
 */
const announceSelection = (table: unknown) => {
  const atom = (table as { atoms: { rowSelection?: SelectionAtom } }).atoms
    .rowSelection
  if (!atom) return undefined
  const keyOf = (summary: SelectionSummary) => JSON.stringify(summary)
  let last = keyOf(selectionSummaryOf(table, atom.get()))
  const subscription = atom.subscribe(() => {
    const summary = selectionSummaryOf(table, atom.get())
    const key = keyOf(summary)
    if (key === last) return
    last = key
    announceLabel(table, labels =>
      'count' in summary
        ? rowSelectionModelLabels(labels).announceSelection(summary.count)
        : selectionPartsLabel(labels, summary),
    )
  })
  return () => subscription.unsubscribe()
}

const rowSelectionModelEntry = definePlugin<RowSelectionModelOptions>()({
  id: 'rowSelectionModel',
  labels: [rowSelectionModelLabels],
  features: rowSelectionModelFeatures,
  slices: ['rowSelection'],
  reconcile: resetOnSelectionChange,
  setup: () => table => announceSelection(table),
  // Выключенная модель не показывает выбор: эффективный срез пуст, сохранённый не
  // меняется (ADR 0039) — включили снова, выбор вернулся. «Всё, кроме» TanStack видит
  // объектом, где выбрана каждая строка вне исключений (ADR 0138, §9).
  narrow: o => ({
    rowSelection: (value: RowSelectionValue | undefined, table: unknown) => {
      if (o.enabled === false) {
        return value && (isAllSelection(value) || Object.keys(value).length)
          ? NO_SELECTION
          : value
      }
      // Узлам групп и веток нужен путь строки из источника таблицы — без неё пересчёт после
      // коммита.
      if (
        isAllSelection(value) &&
        (value.groups?.length || value.branches?.length) &&
        !table
      ) {
        return undefined
      }
      return isAllSelection(value)
        ? effectiveSelectionOf(
            value,
            table ? rootRow(table) : undefined,
            table ? rowGroupOf(table) : undefined,
            table ? rowPathOf(table) : undefined,
          )
        : value
    },
  }),
  options: o => ({
    // При disabled — жёстко false (иначе present-but-disabled фича активна:
    // v9 фиксирует набор фич на маунте, гейт рантайм-тоггла — опцией).
    enableRowSelection: o.enabled === false ? false : enableRowSelection,
    // `'self'` — флажки у вложенных строк без каскада (ADR 0162, §1).
    enableSubRowSelection: o.subRows === true ? enableSubRowSelection : false,
    rowSelectionSubRows: o.enabled === false ? false : (o.subRows ?? false),
    // Клик по флажку не выделяет диапазон: выбор диапазоном — не жест грида.
    enableRowRangeSelection: false,
  }),
  diagnose: table => (isGroupingActive(table) ? 'grouping' : undefined),
})

/**
 * `aria-selected` выбираемых строк и `aria-multiselectable` корня — с клавиатурной
 * навигацией, вкладом в тело (ADR 0170, §5).
 */
const rowSelectionBody: BodyContributions = {
  row: {
    id: 'rowSelectionModel',
    select: (_state, { row, navigation }) =>
      navigation && (row.getCanSelect?.() ?? false)
        ? (row.getIsSelected?.() ?? false)
        : undefined,
    render: (selected: boolean | undefined) =>
      selected === undefined ? null : { attrs: { 'aria-selected': selected } },
  },
  root: {
    id: 'rowSelectionModel',
    attrs: ({ navigation }) =>
      navigation ? { 'aria-multiselectable': true } : undefined,
  },
}

export const rowSelectionModel = withBody(
  rowSelectionModelEntry,
  rowSelectionBody,
)

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    rowSelectionModelPlugin: {
      rowSelectionSubRows?: RowSelectionModelOptions['subRows']
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
