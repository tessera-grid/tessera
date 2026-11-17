/**
 * `table.showFailureLog()` (ADR 0227, §1): открыть журнал отказов — его зовёт плашка итога
 * применения. Открывает кнопка журнала в тулбаре: без неё на странице вызов ничего не делает.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'

interface FailureLogTableAPI {
  /** Открыть журнал отказов. */
  showFailureLog: () => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    failureLogFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    failureLogFeature: FailureLogTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/** Открытие журнала: его ставит смонтированная кнопка журнала. */
const openers = new WeakMap<object, () => void>()

// По хранилищу: таблица и её обёртка `useTable` делят одно.
const keyOf = (table: unknown) =>
  (table as { store?: object }).store ?? (table as object)

/** Кнопка журнала отдаёт своё открытие; возвращает снятие. */
export const registerFailureLogOpener = (table: unknown, open: () => void) => {
  const key = keyOf(table)
  openers.set(key, open)
  return () => {
    if (openers.get(key) === open) openers.delete(key)
  }
}

export const failureLogFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('failureLogFeature', table, {
      table_showFailureLog: {
        fn: () => openers.get(keyOf(table))?.(),
      },
    })
  },
}
