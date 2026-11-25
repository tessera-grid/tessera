import {
  createContext,
  type FocusEvent as ReactFocusEvent,
  type RefObject,
  useCallback,
  useContext,
  useRef,
} from 'react'

import { setPluginState } from '../definePlugin'
import { getDisplayColumns } from '../displayColumns'
import { isFooterInline } from '../footer'
import { useTableState } from '../reactivity'
import { isFocusLost } from './actions'
import { trackingOf } from './focus'
import { ensureCellVisible } from './geometry'
import { getHeaderOwner } from './header'
import {
  type ActiveCell,
  clampActiveColumn,
  HEADER_ROW_INDEX,
  KEYBOARD_NAVIGATION,
  rawActiveCellOf,
  reportNavigation,
  type NavTable,
  ROW_FOCUS_COLUMN,
  SCROLLER_SELECTOR,
  isFooterRowIndex,
  isKeyboardNavigationEnabled,
  isTreeGrid,
  resolveActive,
} from './model'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

/**
 * Навигация включена у грида (ADR 0170, §1): ячейки и строки под memo опцию не
 * перечитывают — смену флага на лету им приносит контекст.
 */
export const KeyboardNavigationContext = createContext(false)

/**
 * Индекс активной строки/колонки для пиновки в `rangeExtractor`; `undefined` без
 * плагина. Строка заголовка (`-1`) виртуализатором строк не пинуется.
 */
export const useActiveCellIndex = (
  table: unknown,
  axis: keyof ActiveCell,
): number | undefined =>
  useTableState(table as never, (state: unknown) =>
    isKeyboardNavigationEnabled(table)
      ? resolveActive(table as NavTable, state as Record<string, unknown>)[axis]
      : undefined,
  ) as number | undefined

export interface KeyboardNavigationCell {
  ref: RefObject<HTMLDivElement | null>
  tabIndex: number
  isActive: boolean
  onFocus: (event: ReactFocusEvent<HTMLElement>) => void
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void
}

/**
 * Участие ячейки (заголовка или тела) в навигации; `null` без плагина или при
 * `participates=false` (плейсхолдер шапки) — тогда ячейка не получает ни
 * `tabindex`, ни обработчиков. Заголовок передаёт `headerId` и активен, когда
 * владеет активной позицией шапки; `columnId` у него — первый лист. Активная
 * ячейка несёт `tabindex=0`, по запросу с клавиатуры доводит себя в вид и берёт
 * фокус.
 */
export const useKeyboardNavigationCell = (
  table: unknown,
  rowIndex: number,
  columnId: string,
  participates = true,
  headerId?: string,
): KeyboardNavigationCell | null => {
  const enabled = useContext(KeyboardNavigationContext)
  const isActive = useTableState(table as never, (state: unknown) =>
    selectNavigationCell(table, state, {
      rowIndex,
      columnId,
      participates: participates && enabled,
      headerId,
    }),
  ) as boolean | null
  return useKeyboardNavigationCellBinding(
    table,
    isActive,
    rowIndex,
    columnId,
    headerId,
  )
}

interface NavigationCellTarget {
  rowIndex: number
  columnId: string
  /** Ячейка в навигации: она включена, и ячейка не плейсхолдер шапки и не копия. */
  participates: boolean
  headerId?: string
}

/** Проверка ячейки тела: к колонке переходим только в строке активной позиции (ADR 0239). */
const isActiveBodyCell = (
  table: NavTable,
  state: Record<string, unknown>,
  rowIndex: number,
  columnId: string,
): boolean => {
  const raw = rawActiveCellOf(state)
  const rawRow = raw?.rowIndex ?? HEADER_ROW_INDEX
  // Нижняя граница шапки может поднять отрицательный индекс только до нуля.
  if (rowIndex > 0 && rawRow < rowIndex) return false

  const bodyRows = table.getRowSource().count()
  const last = bodyRows + (table.options.enableFooter ? 1 : 0) - 1
  const row = Math.min(
    rawRow < 0 ? Math.max(rawRow, -table.getHeaderGroups().length) : rawRow,
    last,
  )
  if (
    row !== rowIndex ||
    (raw?.columnIndex === ROW_FOCUS_COLUMN &&
      rowIndex < bodyRows &&
      isTreeGrid(table))
  )
    return false

  const ids = getDisplayColumns(table).ids
  return ids[clampActiveColumn(raw?.columnIndex, ids.length)] === columnId
}

/** Активна ли ячейка; `null` — ячейка в навигации не участвует. */
export const selectNavigationCell = (
  table: unknown,
  state: unknown,
  { rowIndex, columnId, participates, headerId }: NavigationCellTarget,
): boolean | null => {
  if (!participates) {
    return null
  }
  const t = table as NavTable
  if (headerId === undefined && rowIndex >= 0) {
    return isActiveBodyCell(
      t,
      state as Record<string, unknown>,
      rowIndex,
      columnId,
    )
  }
  const active = resolveActive(t, state as Record<string, unknown>)
  if (headerId !== undefined) {
    return (
      active.rowIndex < 0 &&
      getHeaderOwner(t, active.rowIndex, active.columnIndex)?.id === headerId
    )
  }
  return (
    active.rowIndex === rowIndex &&
    getDisplayColumns(t).ids[active.columnIndex] === columnId
  )
}

/**
 * Привязка ячейки к навигации по готовому `isActive`: ячейка тела выбирает его в своём
 * узле подписки (ADR 0170, §3).
 */
export const useKeyboardNavigationCellBinding = (
  table: unknown,
  isActive: boolean | null,
  rowIndex: number,
  columnId: string,
  headerId?: string,
): KeyboardNavigationCell | null => {
  const t = table as NavTable
  const ref = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!isActive || !el) {
      return
    }
    const tracking = trackingOf(t)
    // Фокус потерян вместе с размонтированным узлом (напр. после сортировки) —
    // вернуть его активной ячейке.
    const lostFocus =
      tracking.within &&
      (document.activeElement === null ||
        document.activeElement === document.body)
    if (!tracking.pending && !lostFocus) {
      return
    }
    tracking.pending = false
    const quiet = tracking.quiet
    tracking.quiet = false
    // Ячейка переехала вслед за строкой, а фокус внутри неё (поле правки) — он на месте.
    if (quiet && el.contains(document.activeElement)) {
      return
    }
    const scroller = el.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (scroller && !quiet) {
      // Шапка и закреплённый футер — sticky: по вертикали доводить не нужно;
      // незакреплённый футер — строка в потоке (ADR 0118, §6).
      ensureCellVisible(
        el,
        scroller,
        rowIndex < 0 || (isFooterRowIndex(t, rowIndex) && !isFooterInline(t)),
      )
    }
    el.focus({ preventScroll: true })
  }, [isActive, t, rowIndex])

  const onFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      // Фокус уже перенаправлен (вход в грид с клавиатуры) — это событие устарело.
      if (event.target !== document.activeElement) {
        return
      }
      trackingOf(t).within = true
      // Фокус внутри виджета ячейки (всплывает) тоже делает ячейку активной.
      const columnIndex = getDisplayColumns(t).indexById.get(columnId)
      const active = resolveActive(t, t.store.get())
      const owned =
        headerId !== undefined &&
        active.rowIndex < 0 &&
        getHeaderOwner(t, active.rowIndex, active.columnIndex)?.id === headerId
      if (
        columnIndex !== undefined &&
        !owned &&
        (active.rowIndex !== rowIndex || active.columnIndex !== columnIndex)
      ) {
        reportNavigation(t, 'moveActiveCell', 'pointer', () => ({
          from: active,
          to: { rowIndex, columnIndex },
        }))
        setPluginState(t, KEYBOARD_NAVIGATION, { rowIndex, columnIndex })
      }
    },
    [t, rowIndex, columnId, headerId],
  )

  const onBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null
      const el = event.currentTarget
      const root = el.closest(SCROLLER_SELECTOR)
      if (next && root?.contains(next)) {
        return
      }
      // Сфокусированный виджет ячейки исчез из DOM (напр. закрылся редактор) —
      // вернуть фокус на ячейку, а не терять его в body.
      const widget = event.target as HTMLElement
      if (widget !== el && !next) {
        setTimeout(() => {
          if (!widget.isConnected && isFocusLost() && el.isConnected) {
            el.focus({ preventScroll: true })
          }
        }, 0)
      }
      // Узел мог уйти из DOM вместе со строкой — это не уход фокуса из грида.
      queueMicrotask(() => {
        if (el.isConnected) {
          trackingOf(t).within = false
        }
      })
    },
    [t],
  )

  if (isActive === null) {
    return null
  }
  return { ref, tabIndex: isActive ? 0 : -1, isActive, onFocus, onBlur }
}

/**
 * Участие строки тела treegrid в навигации (фокус на строке, ADR 0032, W16);
 * `null` вне treegrid или без плагина. Реагирует только на фокус самой строки —
 * фокус ячеек всплывает сквозь неё.
 */
export const useKeyboardNavigationRow = (
  table: unknown,
  rowIndex: number,
): KeyboardNavigationCell | null => {
  const t = table as NavTable
  const ref = useRef<HTMLDivElement>(null)
  const enabled = useContext(KeyboardNavigationContext)

  const isActive = useTableState(table as never, (state: unknown) => {
    if (!enabled || !isTreeGrid(t)) {
      return null
    }
    const active = resolveActive(t, state as Record<string, unknown>)
    return (
      active.rowIndex === rowIndex && active.columnIndex === ROW_FOCUS_COLUMN
    )
  }) as boolean | null

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!isActive || !el) {
      return
    }
    const tracking = trackingOf(t)
    if (!tracking.pending) {
      return
    }
    tracking.pending = false
    const scroller = el.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (scroller) {
      ensureCellVisible(el, scroller, false)
    }
    el.focus({ preventScroll: true })
  }, [isActive, t])

  const onFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (
        event.target !== event.currentTarget ||
        event.target !== document.activeElement
      ) {
        return
      }
      trackingOf(t).within = true
      const active = resolveActive(t, t.store.get())
      if (
        active.rowIndex !== rowIndex ||
        active.columnIndex !== ROW_FOCUS_COLUMN
      ) {
        setPluginState(t, KEYBOARD_NAVIGATION, {
          rowIndex,
          columnIndex: ROW_FOCUS_COLUMN,
        })
      }
    },
    [t, rowIndex],
  )

  const onBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return
      }
      const el = event.currentTarget
      const next = event.relatedTarget as Node | null
      if (next && el.closest(SCROLLER_SELECTOR)?.contains(next)) {
        return
      }
      queueMicrotask(() => {
        if (el.isConnected) {
          trackingOf(t).within = false
        }
      })
    },
    [t],
  )

  if (isActive === null) {
    return null
  }
  return { ref, tabIndex: isActive ? 0 : -1, isActive, onFocus, onBlur }
}
