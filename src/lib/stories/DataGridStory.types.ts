// Пропсы и дефолты демо-компонента историй DataGrid.
import { ColumnDef, ExpandedState } from '@tanstack/react-table'
import type { TesseraFeatureEntry } from '../../lib/core/features'
import { CreateDataGridOptions } from '../../lib/core/useCreateTable'
import { DataGridProps } from '../../lib/grid/dataGridTypes'
import { useColumns } from './__mocks__/columns'
import type { ColumnVisibilityHooks } from '../../lib/plugins/columnVisibility'
import type { PaginationHooks } from '../../lib/plugins/pagination'
import { RowExpandingHooks } from '../../lib/plugins/rowExpanding'
import { RowSelectionHooks } from '../../lib/plugins/rowSelection'
import { FeatureToggles } from './__mocks__/utils/argsToPlugins'

export const COLUMN_COUNT = 20
export const DATA_COUNT = 10

export interface StoryProps extends CreateDataGridOptions, FeatureToggles {
  columnCount: number
  dataCount: number

  /**
   * Явный набор данных вместо генерируемого по dataCount.
   * Используется группой Sizing/Data для параметризованных данных.
   */
  dataOverride?: any[]
  /**
   * Явный набор колонок вместо генерируемого `useColumns(columnCount)`. Даёт
   * тестам seam, чтобы подать колонки с известными `header`/`size` и сверяться с
   * ними, а не с литералами дефолтного мока.
   */
  columnsOverride?: ColumnDef<any, any>[]
  /**
   * Начальный grouping-state (список колонок). Если задан — StoryComponent
   * контролирует grouping и прокидывает onGroupingChange (интерактивно).
   */
  initialGrouping?: string[]
  /**
   * Начальное раскрытие строк (дерево/группы). `true` — раскрыть всё, чтобы
   * фича была видна сразу. По умолчанию всё свёрнуто.
   */
  initialExpanded?: ExpandedState
  /** Дополнительные записи плагинов поверх тумблеров (демо и тесты тулбара). */
  extraPlugins?: TesseraFeatureEntry[]

  containerHeight: number
  /** Ширина контейнера истории, px; по умолчанию — вся ширина. */
  containerWidth?: number
  height: DataGridProps['height']
  maxHeight: DataGridProps['maxHeight']
  colorMode: DataGridProps['colorMode']
  /** Подписи грида (переопределение части `DEFAULT_LABELS`). */
  localization?: DataGridProps['localization']

  showStub: boolean
  showHeaderGroups: boolean
  /** Проверка значения редактора cellEditing (`validate`). */
  validateCellEdit?: (value: string) => string | null

  showBatchToolbar: boolean
  isAllRowsSelected: boolean

  /**
   * Проброс hook закрепления столбца (`columnPinning.onTogglePin`) наружу.
   * Нужен визуальным тестам, чтобы наблюдать вызов hook при переключении пина.
   * В обычных историях не задаётся.
   */
  onTogglePin?: (pinned: boolean) => void

  /**
   * Проброс hook сортировки столбца (`columnSorting.onToggleColumnSort`) наружу.
   * Нужен визуальным тестам, чтобы наблюдать вызов hook при переключении сортировки.
   * В обычных историях не задаётся.
   */
  onToggleColumnSort?: (
    id: string,
    sortDirection: 'asc' | 'desc' | false,
  ) => void

  /**
   * Проброс hooks выбора строк (`rowSelection.onSelectRow` /
   * `onSelectAllRowsOnPage`) наружу. Нужны визуальным тестам, чтобы наблюдать
   * вызов hook при переключении строки и «выбрать все на странице».
   * В обычных историях не задаются (дефолт — no-op).
   */
  onSelectRow?: RowSelectionHooks['onSelectRow']
  onSelectAllRowsOnPage?: RowSelectionHooks['onSelectAllRowsOnPage']

  /**
   * Проброс hook раскрытия строки (`rowExpanding.onExpandRow`) наружу. Нужен
   * визуальным тестам, чтобы наблюдать вызов hook при тоггле раскрытия.
   * В обычных историях не задаётся (дефолт — no-op).
   */
  onExpandRow?: RowExpandingHooks['onExpandRow']

  /** Проброс колбэка меню колонок (`columnVisibility`) наружу — для визуальных тестов. */
  onToggleColumnVisibility?: ColumnVisibilityHooks['onToggleColumnVisibility']

  /** Проброс колбэка пагинации (`pagination`) наружу — для визуальных тестов. */
  onPageChange?: PaginationHooks['onPageChange']

  updateArgs: (args: Partial<Pick<StoryProps, 'isAllRowsSelected'>>) => void
}
