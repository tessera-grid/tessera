import { useEffect } from 'react'

import type {
  BodyEventTarget,
  RootHookProps,
} from '../../core/bodyContributions'
import { abortCellSelectionCopy, copyCellSelection } from './copy'

/** Жесты, клавиши и копирование — у включённого интерфейса; модель выделение лишь показывает. */
export const isInteractive = (table: unknown) =>
  (table as { options?: { cellSelectionInteraction?: boolean } }).options
    ?.cellSelectionInteraction === true

/**
 * Копирование выделения ячеек в буфер: нативное `copy` над телом (ADR 0029, ADR 0170, §3).
 * Текстовое выделение пользователя не трогаем. Незагруженные строки серверной модели
 * догружаются, буфер пишется позже (ADR 0146).
 */
export const copyOnEvent = (
  event: ClipboardEvent,
  { table }: BodyEventTarget,
) => {
  if (!isInteractive(table)) return
  const textSelection = window.getSelection?.()
  if (textSelection && !textSelection.isCollapsed && textSelection.toString()) {
    return
  }
  const result = copyCellSelection(table, {
    clipboardData: event.clipboardData ?? undefined,
    source: 'keyboard',
  })
  if (result === 'copied') {
    event.preventDefault()
  }
}

/** Ждущее копирование уходит вместе с таблицей (ADR 0146, XC17). */
export const useCopyAbort = ({ table }: RootHookProps) => {
  // Обёртка таблицы новая на каждом рендере, хранилище — одно на её жизнь.
  const store = (table as unknown as { store: object }).store
  useEffect(() => () => abortCellSelectionCopy(store), [store])
}
