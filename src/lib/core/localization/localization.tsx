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
  /** Пункт меню / тумблер «закрепить слева» */
  pinLeft: string
  /** Пункт меню / тумблер «закрепить справа» */
  pinRight: string
  /** Тултип «сортировать по возрастанию» */
  sortAscending: string
  /** Тултип «сортировать по убыванию» */
  sortDescending: string
  /** Тултип «сбросить сортировку» */
  clearSort: string
  /**
   * Доступное имя приоритета столбца в мультисортировке (`position` из `total`,
   * 1-based). Уходит в `aria-label` кнопки — числовой бейдж приоритета скринридер
   * не читает, поэтому порядок сортировки проговаривается тут.
   */
  sortPriority: (position: number, total: number) => string
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
  /** Доступное имя кебаб-кнопки меню действий заголовка (`aria-label`/тултип) */
  headerMenu: string
  /** Доступное имя контекстного меню (`aria-label` на `role="menu"`) */
  contextMenu: string
  /** Пункт «Копировать» (контекстное меню / действия выделения) */
  copy: string
}

export const DEFAULT_LABELS: TableLabels = {
  expand: 'Expand',
  collapse: 'Collapse',
  pin: 'Pin column',
  unpin: 'Unpin column',
  pinLeft: 'Pin left',
  pinRight: 'Pin right',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sorting',
  sortPriority: (position, total) => `Sort priority ${position} of ${total}`,
  group: 'Group',
  ungroup: 'Ungroup',
  table: 'Data table',
  selectRow: 'Select row',
  selectAll: 'Select all rows',
  headerMenu: 'Column options',
  contextMenu: 'Context menu',
  copy: 'Copy',
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
