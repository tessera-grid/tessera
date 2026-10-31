// Ячейка с ошибкой — `aria-invalid` (ADR 0150, §4). Ставит его кнопка, которая показывает
// точку ошибки ячейки: атрибутами ячейки ядро плагинам не управляет, признак — в DOM, как
// у тронутой пальцем ячейки (core/touchedCell.ts).
import { useRef } from 'react'

import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

export const CellInvalid = () => {
  const marker = useRef<HTMLSpanElement>(null)
  useIsomorphicLayoutEffect(() => {
    const cell = marker.current?.closest('.data-grid__body-cell')
    if (!cell) return undefined
    cell.setAttribute('aria-invalid', 'true')
    return () => cell.removeAttribute('aria-invalid')
  }, [])
  return <span ref={marker} hidden />
}
