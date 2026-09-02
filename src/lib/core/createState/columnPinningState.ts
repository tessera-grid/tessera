import { useEffect, useState } from 'react'

import { ColumnPinningState, OnChangeFn } from '@tanstack/react-table'

export const mergeColumnPinning = (
  prevColumnPinning: ColumnPinningState | undefined,
  nextColumnPinning: ColumnPinningState | undefined,
): ColumnPinningState => {
  return {
    left: [
      ...new Set([
        ...(prevColumnPinning?.left || []),
        ...(nextColumnPinning?.left || []),
      ]),
    ],
    right: [
      ...new Set([
        ...(prevColumnPinning?.right || []),
        ...(nextColumnPinning?.right || []),
      ]),
    ],
  }
}

export interface ServiceColumnPin {
  side: 'left' | 'right'
  when: 'always' | 'with-user'
}

/**
 * Слияние пользовательского пиннинга с сервисными колонками (ADR 0010, R10).
 * Только МЕХАНИКА: ядро исполняет пиннинг, объявленный самими колонками (`pin`),
 * а политику (какая сторона / всегда или только с пользователем) задаёт
 * плагин-владелец. Генерик по списку — без знания конкретных плагинов, поэтому
 * применяется всегда и не зависит от наличия фичи columnPinning.
 */
export const mergeServiceColumnPinning = (
  pinning: ColumnPinningState | undefined,
  serviceColumns: { id: string; pin?: ServiceColumnPin }[],
): ColumnPinningState => {
  const active = pinning ?? { left: [], right: [] }
  const userLeft = active.left ?? []
  const userRight = active.right ?? []
  const hasUserLeft = userLeft.length > 0
  const hasUserRight = userRight.length > 0

  const pinnedTo = (side: ServiceColumnPin['side'], hasUser: boolean) =>
    serviceColumns
      .filter(
        column =>
          column.pin?.side === side &&
          (column.pin.when === 'always' || hasUser),
      )
      .map(column => column.id)

  // Сервисные колонки прижаты к внешнему краю блока: лидирующие — слева перед
  // пользовательскими, трейлинг — справа после них.
  return {
    left: [...new Set([...pinnedTo('left', hasUserLeft), ...userLeft])],
    right: [...new Set([...userRight, ...pinnedTo('right', hasUserRight)])],
  }
}

export const defaultColumnPinningState: ColumnPinningState = {
  left: [],
  right: [],
}

export interface ColumnPinningStateReturnType {
  columnPinning: ColumnPinningState
  onColumnPinningChange: OnChangeFn<ColumnPinningState>
}

export const useColumnPinningState = (
  initialColumnPinningState = defaultColumnPinningState,
): ColumnPinningStateReturnType => {
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    mergeColumnPinning(defaultColumnPinningState, initialColumnPinningState),
  )

  useEffect(() => {
    setColumnPinning(
      mergeColumnPinning(defaultColumnPinningState, initialColumnPinningState),
    )
  }, [initialColumnPinningState])

  return { columnPinning, onColumnPinningChange: setColumnPinning }
}
