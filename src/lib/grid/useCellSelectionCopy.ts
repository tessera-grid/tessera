import {
  type ClipboardEvent as ReactClipboardEvent,
  useCallback,
  useEffect,
} from 'react'

import {
  abortCellSelectionCopy,
  copyCellSelection,
} from '../core/cellSelectionCopy'
import { isCellSelectionInteractive } from '../core/pluginDiagnostics'
import type { Table } from '../types'

/**
 * Копирование выделения ячеек в буфер. Инертно без плагина cellSelection:
 * getSelectedCellRangesData есть только когда зарегистрирована stock-фича
 * (ядро плагин не импортит — читаем duck-typed, ADR 0029). Нативное copy-событие
 * всплывает от сфокусированной ячейки; текстовое выделение пользователя не трогаем.
 * Незагруженные строки серверной модели догружаются, буфер пишется позже (ADR 0146).
 */
export const useCellSelectionCopy = (table: Table<any, any>) => {
  const getRanges = (table as any).getSelectedCellRangesData as
    (() => unknown[][][]) | undefined
  // Обёртка таблицы новая на каждом рендере, хранилище — одно на её жизнь.
  const store = (table as unknown as { store: object }).store
  useEffect(() => () => abortCellSelectionCopy(store), [store])

  return useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      // Копирует только плагин интерфейса: модель выделение лишь показывает (ADR 0120).
      if (
        typeof getRanges !== 'function' ||
        !isCellSelectionInteractive(table)
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
      const result = copyCellSelection(table, {
        clipboardData: event.clipboardData,
        source: 'keyboard',
      })
      if (result === 'copied') {
        event.preventDefault()
      }
    },
    [getRanges, table],
  )
}
