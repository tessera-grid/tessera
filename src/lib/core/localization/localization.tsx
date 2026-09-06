import { ReactNode, createContext, useContext, useMemo } from 'react'

/**
 * Подписи элементов управления таблицы. Любую можно переопределить через
 * проп `localization` у DataGrid — для локализации или смены формулировок.
 */
export interface TableLabels {
  /** Тултип кнопки разворачивания строки */
  expand: string
  /** Тултип кнопки сворачивания строки */
  collapse: string
  /** Тултип кнопки закрепления колонки */
  pin: string
  /** Тултип кнопки открепления колонки */
  unpin: string
  /** Тултип «сортировать по возрастанию» */
  sortAscending: string
  /** Тултип «сортировать по убыванию» */
  sortDescending: string
  /** Тултип «сбросить сортировку» */
  clearSort: string
  /** Тултип кнопки группировки */
  group: string
  /** Тултип кнопки разгруппировки */
  ungroup: string
  /** Доступное имя таблицы (`aria-label` на `role="table"`) */
  table: string
  /** Доступное имя чекбокса выбора строки */
  selectRow: string
  /** Доступное имя чекбокса выбора всех строк */
  selectAll: string
}

export const DEFAULT_LABELS: TableLabels = {
  expand: 'Expand',
  collapse: 'Collapse',
  pin: 'Pin column',
  unpin: 'Unpin column',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sorting',
  group: 'Group',
  ungroup: 'Ungroup',
  table: 'Data table',
  selectRow: 'Select row',
  selectAll: 'Select all rows',
}

const LocalizationContext = createContext<TableLabels>(DEFAULT_LABELS)

/**
 * Возвращает текущие подписи (дефолтные или переопределённые через DataGrid).
 */
export const useLocalization = (): TableLabels =>
  useContext(LocalizationContext)

export interface LocalizationProviderProps {
  localization?: Partial<TableLabels>
  children: ReactNode
}

export const LocalizationProvider = ({
  localization,
  children,
}: LocalizationProviderProps) => {
  const value = useMemo(
    () =>
      localization ? { ...DEFAULT_LABELS, ...localization } : DEFAULT_LABELS,
    [localization],
  )

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  )
}
