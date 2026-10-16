import { type ClipboardEvent as ReactClipboardEvent, useCallback } from 'react'

import { announceLabel } from '../core/announcer'
import {
  cellRangesToHtml,
  cellRangesToTsv,
  countCells,
  hasSelectedCells,
} from '../core/clipboard'
import type { Table } from '../types'

/**
 * Копирование выделения ячеек в буфер. Инертно без плагина cellSelection:
 * getSelectedCellRangesData есть только когда зарегистрирована stock-фича
 * (ядро плагин не импортит — читаем duck-typed, ADR 0029). Нативное copy-событие
 * всплывает от сфокусированной ячейки; текстовое выделение пользователя не трогаем.
 */
export const useCellSelectionCopy = (table: Table<any, any>) => {
  const getRanges = (table as any).getSelectedCellRangesData as
    (() => unknown[][][]) | undefined

  return useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      // Копирует только плагин интерфейса: модель выделение лишь показывает (ADR 0120).
      if (
        typeof getRanges !== 'function' ||
        (table.options as { cellSelectionInteraction?: boolean })
          .cellSelectionInteraction !== true
      ) {
        return
      }
      const textSelection = window.getSelection?.()
      if (
        textSelection &&
        !textSelection.isCollapsed &&
        textSelection.toString()
      ) {
        return
      }
      const regions = getRanges()
      if (!hasSelectedCells(regions)) {
        return
      }
      event.preventDefault()
      event.clipboardData.setData('text/plain', cellRangesToTsv(regions))
      event.clipboardData.setData('text/html', cellRangesToHtml(regions))
      announceLabel(table, l => l.announceCopy(countCells(regions)))
    },
    [getRanges, table],
  )
}
