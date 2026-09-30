/**
 * Срезы, которые ядро контролирует само: пиннинг (сервисные колонки как
 * display-transform) и размеры (пользовательский ресайз + авто-слайс плагинов).
 */
import { useCallback, useMemo, useState } from 'react'

import { functionalUpdate } from '@tanstack/react-table'
import type {
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from '@tanstack/react-table'

import {
  defaultColumnPinningState,
  isSameColumnSizing,
  mergeColumnSizing,
  mergeServiceColumnPinning,
  type ServiceColumnPin,
} from './createState'

export const useControlledPinning = (
  externalPinning: ColumnPinningState | undefined,
  externalOnPinning: OnChangeFn<ColumnPinningState> | undefined,
  servicePins: { id: string; pin?: ServiceColumnPin }[],
) => {
  const [internalPinning, setInternalPinning] = useState<ColumnPinningState>(
    defaultColumnPinningState,
  )
  const userPinning = externalPinning ?? internalPinning
  const setUserPinning = externalOnPinning ?? setInternalPinning
  const serviceIds = useMemo(() => servicePins.map(c => c.id), [servicePins])

  const displayedPinning = useMemo(
    () => mergeServiceColumnPinning(userPinning, servicePins),
    [userPinning, servicePins],
  )

  const onColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
    updater =>
      setUserPinning((prev: ColumnPinningState) => {
        // prev — чистый пользовательский; реконструируем отображаемый (со
        // сервисными), применяем апдейт, срезаем сервисные обратно.
        const displayed = mergeServiceColumnPinning(prev, servicePins)
        const next = functionalUpdate(updater, displayed)
        return {
          start: (next.start ?? []).filter(
            (id: string) => !serviceIds.includes(id),
          ),
          end: (next.end ?? []).filter(
            (id: string) => !serviceIds.includes(id),
          ),
        }
      }),
    [setUserPinning, servicePins, serviceIds],
  )

  return { displayedPinning, onColumnPinningChange }
}

export const useControlledSizing = (
  externalSizing: ColumnSizingState | undefined,
  externalOnSizing: OnChangeFn<ColumnSizingState> | undefined,
) => {
  const [internalSizing, setInternalSizing] = useState<ColumnSizingState>({})
  const [autoSizing, setAutoSizing] = useState<ColumnSizingState>({})

  const displayedSizing = useMemo(
    () => mergeColumnSizing(externalSizing, internalSizing, autoSizing),
    [externalSizing, internalSizing, autoSizing],
  )

  // Авто-слайс пишут плагины в setup (generic-escape); setup перезапускается
  // при смене аргументов → writer бейлит при равенстве, чтобы не перерисовывать зря.
  const onColumnAutoSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    updater =>
      setAutoSizing(prev => {
        const next = functionalUpdate(updater, prev)
        return isSameColumnSizing(prev, next) ? prev : next
      }),
    [],
  )

  return {
    displayedSizing,
    onColumnSizingChange: externalOnSizing ?? setInternalSizing,
    onColumnAutoSizingChange,
  }
}
