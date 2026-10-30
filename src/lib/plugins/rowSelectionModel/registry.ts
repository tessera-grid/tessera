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
} from '@tanstack/react-table'

import type { Row } from '../../types'
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
import { groupingLength, isGroupingActive, subRowsOf } from './selectionHelpers'

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

export const rowSelectionModel = definePlugin<RowSelectionModelOptions>()({
  id: 'rowSelectionModel',
  features: rowSelectionModelFeatures,
  slices: ['rowSelection'],
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
