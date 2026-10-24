// Ширина колонок контролов по кнопке грида из темы (ADR 0135, GZ6): при теме по умолчанию
// записи нет — ширина из определения колонки; своя тема — авто-слайс размеров до отрисовки.
import { type RefObject, useRef } from 'react'

import {
  ACTION_BUTTON_DEFAULT_SIZE,
  GRID_BUTTON_SIZE_VAR,
  controlColumnSize,
} from '../core/createColumns/actionColumnParams'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'
import type { ColumnSizingState, Updater } from '../types'

interface ControlSizedTable {
  getAllLeafColumns: () => {
    id: string
    columnDef: { controlSized?: boolean }
  }[]
  setColumnAutoSizing?: (updater: Updater<ColumnSizingState>) => void
}

export const useControlColumnSizes = (
  table: unknown,
  wrapperRef: RefObject<HTMLElement | null>,
  /** Смена ключа перечитывает токен: тема, появление корня грида. */
  remeasureKey: string,
) => {
  const t = table as ControlSizedTable
  const ids = t
    .getAllLeafColumns()
    .filter(column => column.columnDef.controlSized)
    .map(column => column.id)
  const idsKey = ids.join('|')
  // Что записано в авто-слайс: ширина своей темы по колонкам или ничего. Сеттер — только
  // при смене записи: вызов без изменений React может подтвердить лишним рендером.
  const written = useRef('')

  useIsomorphicLayoutEffect(() => {
    const node = wrapperRef.current
    if (!node || !t.setColumnAutoSizing) {
      return
    }
    const button = parseFloat(
      getComputedStyle(node).getPropertyValue(GRID_BUTTON_SIZE_VAR),
    )
    const themed =
      Number.isFinite(button) && button !== ACTION_BUTTON_DEFAULT_SIZE
    const width = themed ? controlColumnSize(button) : undefined
    const next = width === undefined ? '' : `${idsKey}=${width}`
    if (next === written.current) {
      return
    }
    const previousIds = written.current.split('=')[0]?.split('|') ?? []
    written.current = next
    t.setColumnAutoSizing(prev => {
      const sizing = { ...prev }
      for (const id of previousIds) delete sizing[id]
      if (width !== undefined) for (const id of ids) sizing[id] = width
      return sizing
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по составу колонок и ключу темы
  }, [t, wrapperRef, idsKey, remeasureKey])
}
