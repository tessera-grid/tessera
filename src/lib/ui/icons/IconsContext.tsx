import {
  ComponentType,
  ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'

import {
  MoveHorizontal,
  UnfoldHorizontal,
  ArrowLeftToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Sigma,
  ChevronsDown,
  ChevronsUpDown,
  Eraser,
  CircleAlert,
  CircleCheck,
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
  SlidersHorizontal,
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
  Redo2,
  History,
} from 'lucide-react'

import { EmptyStateIllustration } from './EmptyStateIllustration'
import { CheckboxOutlineIcon } from './icons'

/**
 * Table icons receive only a size and a class — enough for lucide icons and for the in-house
 * `SvgIcon`. The narrow type avoids incompatibilities between `SVGProps` and `LucideProps`.
 */
export type IconComponent = ComponentType<{
  width?: number | string
  height?: number | string
  className?: string
}>

/**
 * The table's icon set. Any of them can be overridden through the DataGrid `icons` prop.
 */
export interface TableIcons {
  /** Row and column drag indicator */
  drag: IconComponent
  /** No sorting set */
  sort: IconComponent
  /** Ascending sort */
  sortAsc: IconComponent
  /** Descending sort */
  sortDesc: IconComponent
  /** Pin a column */
  pin: IconComponent
  /** A pinned column (the same as `pin` by default) */
  pinned: IconComponent
  /** Grouping */
  group: IconComponent
  /** A grouped column (the same as `group` by default) */
  grouped: IconComponent
  /** Column summary — the function of the total and group values (ADR 0230) */
  summary: IconComponent
  /** Expand rows */
  expand: IconComponent
  /** An expanded row: by default the same chevron, rotated; a custom icon isn't rotated */
  expanded: IconComponent
  /** Expand all rows — the button in the expand column header (ADR 0160): a double chevron */
  expandAll: IconComponent
  /** Collapse all rows: by default the same chevron, rotated; a custom icon isn't rotated */
  collapseAll: IconComponent
  /** Checkbox — empty */
  checkboxOutline: IconComponent
  /** Checkbox — checked */
  checkboxChecked: IconComponent
  /** Checkbox — indeterminate */
  checkboxIndeterminate: IconComponent
  /** Header actions kebab button */
  menu: IconComponent
  /** Edit a cell */
  edit: IconComponent
  /** Columns menu button in the toolbar */
  columns: IconComponent
  /** "View settings" button in the toolbar (ADR 0215) */
  viewSettings: IconComponent
  /** "Export" button in the toolbar */
  download: IconComponent
  /** Filter button in the header (`columnFiltering`) */
  filter: IconComponent
  /** Filter button when the column filter is active (the same as `filter` by default) */
  filterActive: IconComponent
  /** Quick search field in the toolbar (`quickSearch`) */
  search: IconComponent
  /** Clear a field and remove a filter in the summary */
  clear: IconComponent
  /** Search field hint: which columns are searched (ADR 0053) */
  info: IconComponent
  /** The "Hide column" item in the header kebab */
  hideColumn: IconComponent
  /** A hidden column in the "Columns" menu: remove its sort, filter and grouping (ADR 0204) */
  clearColumnTransforms: IconComponent
  /** Pagination buttons: first / previous / next / last page */
  firstPage: IconComponent
  previousPage: IconComponent
  nextPage: IconComponent
  lastPage: IconComponent
  /** Month paging in the date filter calendar (ADR 0047) */
  previousMonth: IconComponent
  nextMonth: IconComponent
  /** Button with the hour and minute list next to the time field (ADR 0183, PK20) */
  chooseTime: IconComponent
  /** Mark of a cell whose save the server rejected */
  saveFailed: IconComponent
  /** A menu item whose action was rejected (ADR 0078) */
  actionFailed: IconComponent
  /** "Stop" on a busy button: pressing cancels its action (ADR 0153) */
  cancelAction: IconComponent
  /** The "Paste" answer to the question before pasting (ADR 0219, WR3); "Don't paste" uses `clear` */
  pasteConfirm: IconComponent
  /** The infinite-scroll load-more error block and its retry button (ADR 0081) */
  loadMoreFailed: IconComponent
  retry: IconComponent
  /** Illustration of empty-table stubs (ADR 0123) */
  emptyState: IconComponent
  /** Alert and stub of a data load error (ADR 0096) */
  loadFailed: IconComponent
  /** An `Alert` in the success tone without its own icon (ADR 0227) */
  alertSuccess: IconComponent
  /** An `Alert` in the neutral tone without its own icon (ADR 0227) */
  alertNeutral: IconComponent
  /** "Back to top" button in the status bar (ADR 0082) */
  backToTop: IconComponent
  /** Failure log button in the toolbar (ADR 0177) */
  failureLog: IconComponent
  /** "Show" on a failure log entry: scroll to the target (ADR 0177) */
  failureShow: IconComponent
  /** Illustration of an empty failure log (ADR 0177) */
  failureLogEmpty: IconComponent
  /** Unsaved-changes panel button in the toolbar (ADR 0178) */
  unsavedChanges: IconComponent
  /** "Apply" of a draft in the panel (ADR 0178) */
  draftApply: IconComponent
  /** "Discard" of a draft in the panel (ADR 0178) */
  draftDiscard: IconComponent
  /** Illustration of an empty unsaved-changes panel (ADR 0178) */
  unsavedChangesEmpty: IconComponent
  /** "Undo" in the toolbar and menu (ADR 0222) */
  undo: IconComponent
  /** "Redo" in the toolbar and menu (ADR 0222) */
  redo: IconComponent
  /** Edit history button in the toolbar (ADR 0222) */
  editHistory: IconComponent
  /** Illustration of an empty edit history (ADR 0222) */
  editHistoryEmpty: IconComponent
  /** "To first column" button in the status bar (ADR 0105) */
  backToStart: IconComponent
  /** A menu item disabled with a reason (ADR 0078) */
  actionBlocked: IconComponent
  /** A section menu item and the section's "back" row (ADR 0079) */
  submenu: IconComponent
  menuBack: IconComponent
  /** Autofit width to content (ADR 0217): one column and all columns */
  autosizeColumn: IconComponent
  autosizeAllColumns: IconComponent
  /** Export panel axis options (ADR 0074): rows and columns */
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
  summary: Sigma,
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
  viewSettings: SlidersHorizontal,
  download: Download,
  filter: Funnel,
  // Та же воронка: включённый фильтр показывает точка (ADR 0062), а не смена значка.
  filterActive: Funnel,
  search: Search,
  clear: X,
  info: Info,
  hideColumn: EyeOff,
  clearColumnTransforms: Eraser,
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
  pasteConfirm: Check,
  loadMoreFailed: CircleAlert,
  retry: RotateCw,
  emptyState: EmptyStateIllustration,
  loadFailed: CircleAlert,
  alertSuccess: CircleCheck,
  alertNeutral: Info,
  backToTop: ArrowUpToLine,
  failureLog: CircleAlert,
  failureShow: LocateFixed,
  failureLogEmpty: EmptyStateIllustration,
  unsavedChanges: PencilLine,
  draftApply: Check,
  draftDiscard: Undo2,
  unsavedChangesEmpty: EmptyStateIllustration,
  undo: Undo2,
  redo: Redo2,
  editHistory: History,
  editHistoryEmpty: EmptyStateIllustration,
  backToStart: ArrowLeftToLine,
  actionBlocked: Lock,
  submenu: ChevronRight,
  menuBack: ChevronLeft,
  autosizeColumn: MoveHorizontal,
  autosizeAllColumns: UnfoldHorizontal,
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
