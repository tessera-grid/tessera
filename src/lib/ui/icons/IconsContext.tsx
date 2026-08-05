import {
  ComponentType,
  ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'

import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Group,
  GripVertical,
  Minus,
  Pin,
  PinOff,
} from 'lucide-react'

import { CheckboxOutlineIcon } from './icons'

/**
 * Иконкам таблицы передают только размер и класс — этого достаточно и для
 * lucide-иконок, и для in-house `SvgIcon`. Узкий тип избавляет от несовместимости
 * между `SVGProps` и `LucideProps`.
 */
export type IconComponent = ComponentType<{
  width?: number | string
  height?: number | string
  className?: string
}>

/**
 * Набор иконок таблицы. Любую можно переопределить через проп `icons` у DataGrid.
 */
export interface TableIcons {
  /** Индикатор перетаскивания строк/колонок */
  drag: IconComponent
  /** Сортировка не задана */
  sort: IconComponent
  /** Сортировка по возрастанию */
  sortAsc: IconComponent
  /** Сортировка по убыванию */
  sortDesc: IconComponent
  /** Закрепление колонки */
  pin: IconComponent
  /** Закрепленная колонка */
  pinned: IconComponent
  /** Группировка */
  group: IconComponent
  /** Разворачивание строк */
  expand: IconComponent
  /** Развернутая строка */
  expanded: IconComponent
  /** Чекбокс — пустой */
  checkboxOutline: IconComponent
  /** Чекбокс — отмеченный */
  checkboxChecked: IconComponent
  /** Чекбокс — неопределённое состояние */
  checkboxIndeterminate: IconComponent
}

export const DEFAULT_ICONS: TableIcons = {
  drag: GripVertical,
  sort: ChevronsUpDown,
  sortAsc: ChevronUp,
  sortDesc: ChevronDown,
  pin: Pin,
  pinned: PinOff,
  group: Group,
  expand: ChevronDown,
  expanded: ChevronUp,
  checkboxOutline: CheckboxOutlineIcon,
  checkboxChecked: Check,
  checkboxIndeterminate: Minus,
}

const IconsContext = createContext<TableIcons>(DEFAULT_ICONS)

/**
 * Возвращает текущий набор иконок (дефолтный или переопределённый через DataGrid).
 */
export const useIcons = (): TableIcons => useContext(IconsContext)

export interface IconsProviderProps {
  icons?: Partial<TableIcons>
  children: ReactNode
}

export const IconsProvider = ({ icons, children }: IconsProviderProps) => {
  const value = useMemo(
    () => (icons ? { ...DEFAULT_ICONS, ...icons } : DEFAULT_ICONS),
    [icons],
  )

  return <IconsContext.Provider value={value}>{children}</IconsContext.Provider>
}
