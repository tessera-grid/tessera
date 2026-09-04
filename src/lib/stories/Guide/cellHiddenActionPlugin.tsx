import { TablePlugin } from '../../plugins/types'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

// Слот ячейки объявлен декларативно в записи реестра (см. Table.tsx).
export const cellHiddenActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {}
