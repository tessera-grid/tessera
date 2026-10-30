/** Фокус: запрос от клавиатуры, восстановление и следование за переставленной строкой. */
import { setPluginState } from '../definePlugin'
import { getDisplayColumns } from '../displayColumns'
import {
  KEYBOARD_NAVIGATION,
  type NavTable,
  reportNavigation,
  resolveActive,
} from './model'

interface FocusTracking {
  /** Переход с клавиатуры: новая активная ячейка должна взять фокус. */
  pending: boolean
  /** Фокус переходит вслед за строкой без прокрутки к ней (ADR 0157, §3). */
  quiet?: boolean
  /** Фокус последним был на ячейке грида (для восстановления после анмаунта). */
  within: boolean
  /** Идёт ввод указателем: фокус от него не перенаправляется на активную ячейку. */
  pointer: boolean
  /** Строка/колонка, за которой активная ячейка следует после перестановки. */
  follow?: { rowId?: string; columnId?: string }
}

const focusTracking = new WeakMap<object, FocusTracking>()

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем
// `cell.getContext().table`, а store у них один.
export const trackingOf = (table: NavTable): FocusTracking => {
  let tracking = focusTracking.get(table.store)
  if (!tracking) {
    tracking = { pending: false, within: false, pointer: false }
    focusTracking.set(table.store, tracking)
  }
  return tracking
}

/**
 * Перевести активную ячейку на новую позицию её строки/колонки после действия,
 * переставившего их (перенос колонки — сразу, строки — когда придут новые данные).
 */
export const applyFollow = (t: NavTable) => {
  const tracking = trackingOf(t)
  const follow = tracking.follow
  if (!follow) {
    return
  }
  const active = resolveActive(t, t.store.get())
  const rowIndex =
    follow.rowId === undefined
      ? active.rowIndex
      : t.getRowSource().indexOf(follow.rowId)
  const columnIndex =
    follow.columnId === undefined
      ? undefined
      : getDisplayColumns(t).indexById.get(follow.columnId)
  if (follow.rowId !== undefined && rowIndex === -1) {
    return
  }
  const next = { rowIndex, columnIndex: columnIndex ?? active.columnIndex }
  if (
    next.rowIndex === active.rowIndex &&
    next.columnIndex === active.columnIndex
  ) {
    return
  }
  // Следовать до конца кадра: эффективное состояние (ADR 0039) догоняет новые
  // данные ещё одной перерисовкой, и индекс строки в ней может снова сдвинуться.
  requestAnimationFrame(() => {
    if (tracking.follow === follow) {
      tracking.follow = undefined
    }
  })
  tracking.pending = true
  reportNavigation(t, 'moveActiveCell', 'auto', () => ({
    from: active,
    to: next,
  }))
  setPluginState(t, KEYBOARD_NAVIGATION, next)
}
