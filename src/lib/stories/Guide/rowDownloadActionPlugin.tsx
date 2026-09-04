import { TablePlugin } from '../../plugins/types'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

// Кнопка скачивания объявлена декларативно в записи реестра (см. Table.tsx).
export const rowDownloadActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {}
