/**
 * Вклад модели выделения ячеек в тело (ADR 0170, §5): состояние ячейки — выбрана, в фокусе,
 * края диапазона, `tabIndex` без навигации — и `aria-multiselectable` корня.
 */
import type {
  BodyContributions,
  CellContributionContext,
} from '../../core/bodyContributions'

/** Поверхность стоковой фичи на ячейке. */
interface SelectionCell {
  getCanSelect?: () => boolean
  getIsSelected?: () => boolean
  getIsFocused: () => boolean
  getTabIndex: () => number
  getSelectionEdges: () => {
    top: boolean
    right: boolean
    bottom: boolean
    left: boolean
  }
}

interface Membership {
  isSelected: boolean
  isFocused: boolean
  /** Roving tabindex: 0 у ячейки в фокусе, -1 у прочих выбираемых. */
  tabIndex: number
  edgeTop: boolean
  edgeRight: boolean
  edgeBottom: boolean
  edgeLeft: boolean
}

const NO_EDGES = { top: false, right: false, bottom: false, left: false }

/** Членство ячейки в выделении; `null` у невыбираемой (служебные колонки). */
const selectMembership = (
  _state: unknown,
  { cell }: CellContributionContext,
): Membership | null => {
  const c = cell as unknown as SelectionCell
  if (
    typeof c.getIsSelected !== 'function' ||
    (typeof c.getCanSelect === 'function' && !c.getCanSelect())
  ) {
    return null
  }
  const isSelected = c.getIsSelected()
  const edges = isSelected ? c.getSelectionEdges() : NO_EDGES
  return {
    isSelected,
    isFocused: c.getIsFocused(),
    tabIndex: c.getTabIndex(),
    edgeTop: edges.top,
    edgeRight: edges.right,
    edgeBottom: edges.bottom,
    edgeLeft: edges.left,
  }
}

const edgeColor = (on: boolean) =>
  on ? 'var(--tsr-comp-cell-selected-border-color)' : 'transparent'

export const cellSelectionModelBody: BodyContributions = {
  cell: {
    id: 'cellSelectionModel',
    // Методы выделения ячейки читают срез выделения сами (ADR 0195).
    slices: ['cellSelection'],
    select: selectMembership,
    render: (membership: Membership | null, { navigation }) =>
      membership && {
        attrs: {
          'data-cell-selectable': true,
          'data-cell-selected': membership.isSelected || undefined,
          'data-cell-focused': membership.isFocused || undefined,
          'aria-selected': navigation ? membership.isSelected : undefined,
        },
        style: membership.isSelected
          ? {
              '--tsr-sel-edge-top': edgeColor(membership.edgeTop),
              '--tsr-sel-edge-right': edgeColor(membership.edgeRight),
              '--tsr-sel-edge-bottom': edgeColor(membership.edgeBottom),
              '--tsr-sel-edge-left': edgeColor(membership.edgeLeft),
            }
          : undefined,
        tabIndex: membership.tabIndex,
      },
  },
  root: {
    id: 'cellSelectionModel',
    attrs: ({ navigation }) =>
      navigation ? { 'aria-multiselectable': true } : undefined,
  },
}
