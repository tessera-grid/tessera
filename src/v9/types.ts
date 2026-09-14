/**
 * Фаза A — единый импорт-слой типов v9 для параллельного слоя миграции.
 *
 * Весь `src/v9/**` берёт типы TanStack ОТСЮДА, а не напрямую из пакета. На cutover
 * (финал миграции) достаточно перецелить этот один реэкспорт с алиаса
 * `@tanstack/table-v9` на `@tanstack/react-table` (v9 под настоящим именем) и
 * удалить алиас — остальной v9-слой не трогается.
 */
export type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  ColumnDefTemplate,
  ColumnSizingState,
  Header,
  HeaderContext,
  HeaderGroup,
  Row,
  RowData,
  Table,
  TableFeature,
  TableFeatures,
  TableOptions,
  TableState,
  Updater,
  OnChangeFn,
} from '@tanstack/react-table'

// Контракт commonFeature (объявляет declaration merging при импорте типов файла).
export type {
  CommonHooks,
  CommonOptions,
  CommonTableAPI,
  CommonColumnAPI,
  CommonHeaderAPI,
  CommonRowAPI,
  CommonHeaderGroupAPI,
  LogLevel,
  RenderSlotsV9,
  SlotActionsV9,
  SlotActionMenuV9,
} from './core/commonFeature.types'
