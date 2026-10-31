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
    getServiceColumn: () => { controlSized?: boolean } | undefined
  }[]
  setColumnAutoSizing?: (updater: Updater<ColumnSizingState>) => void
}

/** Размер кнопки грида в px: проба переводит `rem`/`em`/`calc()` токена в пиксели. */
const buttonSizeOf = (node: HTMLElement) => {
  const probe = document.createElement('span')
  probe.hidden = true
  probe.style.width = `var(${GRID_BUTTON_SIZE_VAR})`
  node.append(probe)
  const size = parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return size
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
    .filter(column => column.getServiceColumn()?.controlSized)
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
    const button = buttonSizeOf(node)
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
    // Обёртка таблицы новая на каждой перерисовке, а проба форсирует пересчёт стилей —
    // только по составу колонок и ключу темы.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по составу колонок и ключу темы
  }, [wrapperRef, idsKey, remeasureKey])
}
