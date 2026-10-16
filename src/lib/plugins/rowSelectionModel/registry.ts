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
import { warnPluginInert } from '../../core/pluginDiagnostics'
import { isGroupingActive } from './selectionHelpers'

export interface RowSelectionModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
  /** Выбранные строки по `id`: задаёт приложение; без него срез хранит грид. */
  rowSelection?: RowSelectionState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onRowSelectionChange?: (next: RowSelectionState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialRowSelection?: RowSelectionState
}

/** Фичи модели выбора; интерфейс несёт те же — по ним выводится тип среза. */
export const rowSelectionModelFeatures = { rowSelectionFeature }

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

const NO_SELECTION: RowSelectionState = {}

export const rowSelectionModel = definePlugin<RowSelectionModelOptions>()({
  id: 'rowSelectionModel',
  features: rowSelectionModelFeatures,
  slices: ['rowSelection'],
  // Выключенная модель не показывает выбор: эффективный срез пуст, сохранённый не
  // меняется (ADR 0039) — включили снова, выбор вернулся.
  narrow: o =>
    o.enabled === false
      ? {
          rowSelection: (value?: RowSelectionState) =>
            value && Object.keys(value).length ? NO_SELECTION : value,
        }
      : undefined,
  options: o => ({
    // При disabled — жёстко false (иначе present-but-disabled фича активна:
    // v9 фиксирует набор фич на маунте, гейт рантайм-тоггла — опцией).
    enableRowSelection: o.enabled === false ? false : enableRowSelection,
    enableSubRowSelection: o.subRows ?? false,
    // Клик по флажку не выделяет диапазон: выбор диапазоном — не жест грида.
    enableRowRangeSelection: false,
  }),
  diagnose: table => (isGroupingActive(table) ? 'grouping' : undefined),
})
