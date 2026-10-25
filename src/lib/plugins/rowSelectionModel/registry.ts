/**
 * Запись плагина rowSelectionModel на `definePlugin`: модель выбора строк без интерфейса
 * (ADR 0014, ADR 0120). Выбор — срез `rowSelection`; выбранные строки залиты и несут
 * `aria-selected` (в роли grid). Колонка флажков, Space, счётчик и колбэки пользователя —
 * у `rowSelection`, который включает эту модель.
 */
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
import type { RowSource } from '../../core/rowSource'
import { isGroupingActive } from './selectionHelpers'

export interface RowSelectionModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
  /**
   * Выбранные строки по `id` или «всё, кроме» `{ all: true, except }` серверной модели
   * строк (ADR 0138, §9): задаёт приложение; без него срез хранит грид.
   */
  rowSelection?: RowSelectionValue
  /** Новое значение среза после каждого изменения изнутри грида. */
  onRowSelectionChange?: (next: RowSelectionValue) => void
  /** Начальное значение среза, которым владеет грид. */
  initialRowSelection?: RowSelectionValue
}

/** Фичи модели выбора; интерфейс несёт те же — по ним выводится тип среза. */
export const rowSelectionModelFeatures = { rowSelectionFeature }

/** Строка — корень: в дереве серверной модели выбираются только корни (ADR 0138, §14). */
const rootRow = (table: unknown) => (id: string) =>
  ((table as { getRowSource?: () => RowSource<{ depth: number }> })
    .getRowSource?.()
    .byId(id)?.depth ?? 0) === 0

/**
 * Выбор недоступен при АКТИВНОЙ группировке: сгруппированная модель производна,
 * выбором владеет группировка. Функциональный `enableRowSelection` согласует и
 * агрегаты (getIsAllPageRowsSelected и т.п.).
 */
const enableRowSelection = (row: Row<any, any>): boolean => {
  if (!isGroupingActive(row.table)) {
    return true
  }
  warnPluginInert(row.table, 'rowSelectionModel', 'grouping')
  return false
}

/** В дереве серверной модели вложенные строки не выбираются: флажки только у корней. */
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
      return isAllSelection(value)
        ? effectiveSelectionOf(value, table ? rootRow(table) : undefined)
        : value
    },
  }),
  options: o => ({
    // При disabled — жёстко false (иначе present-but-disabled фича активна:
    // v9 фиксирует набор фич на маунте, гейт рантайм-тоггла — опцией).
    enableRowSelection: o.enabled === false ? false : enableRowSelection,
    enableSubRowSelection: o.subRows ? enableSubRowSelection : false,
    // Клик по флажку не выделяет диапазон: выбор диапазоном — не жест грида.
    enableRowRangeSelection: false,
  }),
  diagnose: table => (isGroupingActive(table) ? 'grouping' : undefined),
})
