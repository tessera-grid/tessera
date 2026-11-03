// Пропсы и дефолты демо-компонента историй DataGrid.
import {
  ColumnDef,
  type ColumnPinningState,
  ExpandedState,
} from '@tanstack/react-table'
import type { TesseraFeatureEntry } from '../../lib/core/features'
import type { CoreOptions } from '../../lib/core/commonFeature.types'
import type { DefaultColumnSizing } from '../../lib/core/defaultColumn'
import { DataGridProps } from '../../lib/grid/dataGridTypes'
import { useColumns } from './__mocks__/columns'
import type { Nesting } from './__mocks__/data'
import type { ColumnSortingHooks } from '../../lib/plugins/columnSorting'
import type { ColumnVisibilityHooks } from '../../lib/plugins/columnVisibility'
import type { PaginationHooks } from '../../lib/plugins/pagination'
import { RowExpandingHooks } from '../../lib/plugins/rowExpanding'
import { RowSelectionHooks } from '../../lib/plugins/rowSelection'
import { FeatureToggles } from './__mocks__/utils/argsToPlugins'
import type { ConsoleLog } from './demos/consoleLog'

export const COLUMN_COUNT = 20
export const DATA_COUNT = 10

export interface StoryProps extends CoreOptions, FeatureToggles {
  /** Размеры колонок без своих (ADR 0077). */
  defaultColumn?: DefaultColumnSizing
  columnCount: number
  dataCount: number
  /** Вложенность генерируемого мока строк: `nested` — дети у каждой 10-й строки. */
  dataNesting?: Nesting
  /** Шапка генерируемых колонок: `nested` — группы заголовков. */
  headerNesting?: Nesting

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
   * Начальное закрепление колонок. Если задано — StoryComponent контролирует срез
   * `columnPinning` (закрепление до прихода данных, когда кнопок шапки ещё нет).
   */
  initialColumnPinning?: ColumnPinningState
  /** Все колонки скрыты состоянием приложения (`columnVisibility`, ADR 0123); на лету. */
  hideAllColumns?: boolean
  /**
   * «Сервер» отвечает на повтор загрузки (ADR 0096): после `onRetry` — загрузка, затем
   * ошибка снята, а при первой загрузке приходят строки.
   */
  retrySucceeds?: boolean
  /** Первая колонка данных закреплена слева сразу при открытии; переключается на лету. */
  pinFirstColumn?: boolean
  /**
   * Начальное раскрытие строк (дерево/группы). `true` — раскрыть всё, чтобы
   * фича была видна сразу. По умолчанию всё свёрнуто.
   */
  initialExpanded?: ExpandedState
  /** Раскрыть все строки или свернуть их — на лету (ADR 0117, SN10). */
  expandAll?: boolean
  /** Дополнительные записи плагинов поверх тумблеров (демо и тесты тулбара). */
  extraPlugins?: TesseraFeatureEntry[]
  /** Консоль истории (ADR 0124): колбэки, состояние и жизненный цикл грида. */
  consoleLog?: ConsoleLog

  containerHeight: number | string
  /**
   * Контейнер приложения пунктирной рамкой с подписью высоты (ADR 0131): высота
   * контейнера держится и под консолью.
   */
  containerFrame?: boolean
  /** Панель приложения над гридом в контейнере, px (ADR 0131, `height: 'auto'`). */
  appPanelHeight?: number
  /** Класс на корне грида — стили темы приложения (ADR 0077, RH3). */
  gridClassName?: string
  /** Ширина контейнера истории, px; по умолчанию — вся ширина. */
  containerWidth?: number
  height: DataGridProps['height']
  maxHeight: DataGridProps['maxHeight']
  colorMode: DataGridProps['colorMode']
  /** Повышенный контраст (ADR 0088). */
  contrast?: DataGridProps['contrast']
  /** Подписи грида (переопределение части `DEFAULT_LABELS`). */
  localization?: DataGridProps['localization']
  /** Свои иконки грида (переопределение части иконок по ключу). */
  icons?: DataGridProps['icons']
  /** Свой вид заглушек пустой таблицы по причине (ADR 0123). */
  stubs?: DataGridProps['stubs']
  /** Язык подписей: `ru` — русский словарь историй под `localization`. */
  locale?: 'en' | 'ru'

  showStub: boolean
  /** Проверка значения редактора cellEditing (`validate`). */
  validateCellEdit?: (value: string) => string | null
  /** Колонки, которые правит демо правки; по умолчанию — возраст, визиты и пол. */
  editableColumns?: readonly string[]

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
  onToggleColumnSort?: ColumnSortingHooks['onToggleColumnSort']

  /**
   * Проброс hooks выбора строк (`rowSelection.onSelectRow` /
   * `onSelectAllRows`) наружу. Нужны визуальным тестам, чтобы наблюдать
   * вызов hook при переключении строки и «выбрать все на странице».
   * В обычных историях не задаются (дефолт — no-op).
   */
  onSelectRow?: RowSelectionHooks['onSelectRow']
  onSelectAllRows?: RowSelectionHooks['onSelectAllRows']

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

  updateArgs: (args: Partial<StoryProps>) => void
}
