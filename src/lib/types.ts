/**
 * Единый импорт-слой типов TanStack Table v9. Весь `src/lib/**` берёт типы ОТСЮДА.
 * Cutover выполнен: источник — `@tanstack/react-table` (v9 под настоящим именем),
 * прежний алиас `@tanstack/table-v9` удалён (ADR 0026).
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
