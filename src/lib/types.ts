/**
 * Единый импорт-слой типов TanStack Table v9 из `@tanstack/react-table`. Весь
 * `src/lib/**` берёт типы ОТСЮДА.
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
