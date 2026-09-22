export { cellSelection } from './registry'
export type { CellSelectionOptions } from './types'

// Реэкспорт ядровой сериализации буфера — чтобы потребитель мог собрать свою
// копию (напр. с заголовками) поверх table.getSelectedCellRangesData().
export {
  cellRangesToTsv,
  cellRangesToHtml,
  hasSelectedCells,
} from '../../core/clipboard'
