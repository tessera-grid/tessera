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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  CircleAlert,
  Columns3,
  Download,
  EyeOff,
  Funnel,
  Search,
  X,
  Group,
  GripVertical,
  Minus,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Info,
} from 'lucide-react'

import { CheckboxOutlineIcon, FilterActiveIcon } from './icons'

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
  /** Кебаб-кнопка меню действий заголовка */
  menu: IconComponent
  /** Редактирование ячейки */
  edit: IconComponent
  /** Кнопка меню колонок в тулбаре */
  columns: IconComponent
  /** Кнопка «Экспорт» в тулбаре */
  download: IconComponent
  /** Кнопка фильтра в заголовке (`columnFiltering`) */
  filter: IconComponent
  /** Кнопка фильтра при активном фильтре колонки */
  filterActive: IconComponent
  /** Поле быстрого поиска в тулбаре (`quickSearch`) */
  search: IconComponent
  /** Очистка поля и сброс фильтра в сводке */
  clear: IconComponent
  /** Подсказка поля поиска: по каким колонкам ищем (ADR 0053) */
  info: IconComponent
  /** Пункт «Скрыть колонку» в кебабе заголовка */
  hideColumn: IconComponent
  /** Кнопки пагинации: первая / предыдущая / следующая / последняя страница */
  firstPage: IconComponent
  previousPage: IconComponent
  nextPage: IconComponent
  lastPage: IconComponent
  /** Листание месяцев в календаре фильтра дат (ADR 0047) */
  previousMonth: IconComponent
  nextMonth: IconComponent
  /** Метка ячейки, сохранение которой отклонено сервером */
  saveFailed: IconComponent
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
  menu: MoreVertical,
  edit: Pencil,
  columns: Columns3,
  download: Download,
  filter: Funnel,
  filterActive: FilterActiveIcon,
  search: Search,
  clear: X,
  info: Info,
  hideColumn: EyeOff,
  firstPage: ChevronsLeft,
  previousPage: ChevronLeft,
  nextPage: ChevronRight,
  lastPage: ChevronsRight,
  previousMonth: ChevronLeft,
  nextMonth: ChevronRight,
  saveFailed: CircleAlert,
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
