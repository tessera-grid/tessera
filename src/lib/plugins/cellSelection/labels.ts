/** Подписи `cellSelection` (ADR 0182, §8): ключи словаря таблицы `cellSelection.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CellSelectionLabels {
  /** Пункт «Копировать» (контекстное меню / действия выделения) */
  copy: string
  /** Объявление копирования выделения (`cells` — число ячеек) */
  announceCopy: (cells: number) => string
  /** Объявление ожидания копирования: догружаются строки выделения (ADR 0146) */
  announceCopyLoading: (rows: number) => string
  /** Отказ копирования: строк выделения больше предела `maxCopyRows` (ADR 0146) */
  copyTooManyRows: (rows: number, max: number) => string
  /** Отказ копирования: браузер не дал записать в буфер обмена (ADR 0146) */
  copyClipboardDenied: string
  /** Действие: выделить ячейки */
  actionSelect: string
  /** Действие: расширить выделение */
  actionExtendSelection: string
  /** Действие: изменить диапазон маркером угла (ADR 0198) */
  actionResizeRange: string
}

export const cellSelectionLabels = defineLabels<CellSelectionLabels>()(
  'cellSelection',
  {
    copy: 'Copy',
    announceCopy: 'Copied {count} cells',
    announceCopy_one: 'Copied {count} cell',
    announceCopyLoading: 'Copying: loading {count} rows',
    announceCopyLoading_one: 'Copying: loading {count} row',
    copyTooManyRows: 'The limit is {max} rows. Use export',
    copyClipboardDenied: "The browser didn't allow writing to the clipboard",
    actionSelect: 'Select cells',
    actionExtendSelection: 'Extend the selection',
    actionResizeRange: 'Resize the selection',
  },
  {
    announceCopy: ['count'],
    announceCopyLoading: ['count'],
    copyTooManyRows: ['count', 'max'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    cellSelection: typeof cellSelectionLabels
  }
}
