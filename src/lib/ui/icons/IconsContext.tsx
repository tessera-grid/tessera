import {
  ComponentType,
  ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'

import {
  ArrowLeftToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsDown,
  ChevronsUpDown,
  CircleAlert,
  Clock,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FileText,
  ListFilter,
  LocateFixed,
  Lock,
  Rows3,
  Square,
  SquareCheck,
  Funnel,
  Search,
  X,
  Group,
  GripVertical,
  Minus,
  MoreVertical,
  Pencil,
  Pin,
  Info,
  RotateCw,
  PencilLine,
  Undo2,
} from 'lucide-react'

import { EmptyStateIllustration } from './EmptyStateIllustration'
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
  /** Закреплённая колонка (по умолчанию — та же, что `pin`) */
  pinned: IconComponent
  /** Группировка */
  group: IconComponent
  /** Сгруппированная колонка (по умолчанию — та же, что `group`) */
  grouped: IconComponent
  /** Разворачивание строк */
  expand: IconComponent
  /** Раскрытая строка: по умолчанию тот же шеврон с поворотом; свой значок — без поворота */
  expanded: IconComponent
  /** Раскрыть все строки — кнопка в шапке колонки раскрытия (ADR 0160): двойной шеврон */
  expandAll: IconComponent
  /** Свернуть все строки: по умолчанию тот же шеврон с поворотом; свой значок — без поворота */
  collapseAll: IconComponent
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
  /** Кнопка фильтра при активном фильтре колонки (по умолчанию — та же, что `filter`) */
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
  /** Кнопка списка часов и минут у поля времени (ADR 0183, PK20) */
  chooseTime: IconComponent
  /** Метка ячейки, сохранение которой отклонено сервером */
  saveFailed: IconComponent
  /** Пункт меню, чьё действие отклонено (ADR 0078) */
  actionFailed: IconComponent
  /** «Стоп» занятой кнопки: нажатие отменяет её действие (ADR 0153) */
  cancelAction: IconComponent
  /** Блок ошибки догрузки ленты и его кнопка повтора (ADR 0081) */
  loadMoreFailed: IconComponent
  retry: IconComponent
  /** Иллюстрация заглушек пустой таблицы (ADR 0123) */
  emptyState: IconComponent
  /** Плашка и заглушка ошибки загрузки данных (ADR 0096) */
  loadFailed: IconComponent
  /** Кнопка «наверх» в нижней панели (ADR 0082) */
  backToTop: IconComponent
  /** Кнопка журнала отказов в тулбаре (ADR 0177) */
  failureLog: IconComponent
  /** «Показать» записи журнала отказов: прокрутка к цели (ADR 0177) */
  failureShow: IconComponent
  /** Иллюстрация пустого журнала отказов (ADR 0177) */
  failureLogEmpty: IconComponent
  /** Кнопка пульта черновиков в тулбаре (ADR 0178) */
  unsavedChanges: IconComponent
  /** «Применить» черновика в пульте (ADR 0178) */
  draftApply: IconComponent
  /** «Отбросить» черновика в пульте (ADR 0178) */
  draftDiscard: IconComponent
  /** Иллюстрация пустого пульта черновиков (ADR 0178) */
  unsavedChangesEmpty: IconComponent
  /** Кнопка «к первой колонке» в нижней панели (ADR 0105) */
  backToStart: IconComponent
  /** Пункт меню, заблокированный с причиной (ADR 0078) */
  actionBlocked: IconComponent
  /** Пункт-раздел меню и строка «назад» раздела (ADR 0079) */
  submenu: IconComponent
  menuBack: IconComponent
  /** Варианты осей панели экспорта (ADR 0074): строки и колонки */
  exportRowsAll: IconComponent
  exportRowsView: IconComponent
  exportRowsPage: IconComponent
  exportRowsSelected: IconComponent
  exportColumnsVisible: IconComponent
  exportColumnsAll: IconComponent
}

export const DEFAULT_ICONS: TableIcons = {
  drag: GripVertical,
  sort: ChevronsUpDown,
  sortAsc: ChevronUp,
  sortDesc: ChevronDown,
  pin: Pin,
  pinned: Pin,
  group: Group,
  grouped: Group,
  expand: ChevronDown,
  expanded: ChevronDown,
  expandAll: ChevronsDown,
  collapseAll: ChevronsDown,
  checkboxOutline: CheckboxOutlineIcon,
  checkboxChecked: Check,
  checkboxIndeterminate: Minus,
  menu: MoreVertical,
  edit: Pencil,
  columns: Columns3,
  download: Download,
  filter: Funnel,
  // Та же воронка: включённый фильтр показывает точка (ADR 0062), а не смена значка.
  filterActive: Funnel,
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
  chooseTime: Clock,
  saveFailed: CircleAlert,
  actionFailed: CircleAlert,
  cancelAction: Square,
  loadMoreFailed: CircleAlert,
  retry: RotateCw,
  emptyState: EmptyStateIllustration,
  loadFailed: CircleAlert,
  backToTop: ArrowUpToLine,
  failureLog: CircleAlert,
  failureShow: LocateFixed,
  failureLogEmpty: EmptyStateIllustration,
  unsavedChanges: PencilLine,
  draftApply: Check,
  draftDiscard: Undo2,
  unsavedChangesEmpty: EmptyStateIllustration,
  backToStart: ArrowLeftToLine,
  actionBlocked: Lock,
  submenu: ChevronRight,
  menuBack: ChevronLeft,
  exportRowsAll: Rows3,
  exportRowsView: ListFilter,
  exportRowsPage: FileText,
  exportRowsSelected: SquareCheck,
  exportColumnsVisible: Eye,
  exportColumnsAll: Columns3,
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
