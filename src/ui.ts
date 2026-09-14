export {
  CellButton,
  type CellEditButtonProps,
} from './lib/grid/Actions/CellButton'
export { RowButton, type RowButtonProps } from './lib/grid/Actions/RowButton'
export { Switch, type SwitchProps } from './lib/ui/Switch'

// Контролы встроенных плагинов — для сборки своих колонок/слотов в их визуале.
// Импорт с конкретных файлов (v8-плагинные barrel'ы удалены на cutover, ADR 0026;
// сами контролы — агностичные survivor'ы).
export {
  SortButton,
  type SortButtonProps,
} from './lib/plugins/columnSorting/SortButton'
export {
  PinButton,
  type PinButtonProps,
} from './lib/plugins/columnPinning/PinButton'
export {
  ResizeHandler,
  type ResizeSplitterProps,
} from './lib/plugins/columnSizing/ResizeHandler'
export {
  SelectCheckbox,
  type SelectCheckboxProps,
} from './lib/plugins/rowSelection/SelectCheckbox'
export { ExpandButton } from './lib/plugins/rowExpanding/ExpandButton'
export {
  GroupButton,
  type GroupButtonProps,
} from './lib/plugins/rowGrouping/GroupButton'
