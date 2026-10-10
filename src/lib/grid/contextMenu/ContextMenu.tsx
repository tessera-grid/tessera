// ContextMenu (эагерный): слушатель contextmenu + состояние открытия. Base UI-меню
// (ContextMenuPopup) грузится лениво — floating-ui в базовый бандл не тянется: при
// первом наведении на тело грида или фокусе внутри него, а правый клик до загрузки
// открывает меню после неё (ADR 0061, LZ6–LZ10). Рендерится DataGrid'ом при активном
// плагине contextMenu (`enableContextMenu`). ADR 0030.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useLazyOpening } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import {
  clearSeenActionErrors,
  markActionErrorsSeen,
  resolveVisibleActions,
  type ContextMenuAction,
  type ContextMenuContext,
} from '../../core/headerActions'
import { useAvailabilityChecks } from '../headerActions/useAvailabilityChecks'

const ContextMenuPopupImpl = preloadable(() =>
  import('./ContextMenuPopup').then(m => m.ContextMenuPopup),
)

const MENU_LOAD = {
  load: ContextMenuPopupImpl.reload,
  isReady: ContextMenuPopupImpl.isLoaded,
  label: (labels: { contextMenu: string }) => labels.contextMenu,
}

const CELL = '.data-grid__body-cell[data-column-id]'
/** Долгое нажатие пальцем (ADR 0086, §5): удержание и допуск сдвига. */
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP = 10

interface OpenState {
  x: number
  y: number
  actions: ContextMenuAction[]
  context: ContextMenuContext
}

/** Duck-typed поверхность таблицы (ядро плагин не импортит). */
interface ContextMenuTable {
  getContextMenuActions?: () => ContextMenuAction[] | undefined
  getRow?: (id: string) => {
    getAllCells?: () => {
      column: { id: string }
      getContext: () => ContextMenuContext
      getIsSelected?: () => boolean
      getCanSelect?: () => boolean
    }[]
  }
  setFocusedCell?: (rowId: string, columnId: string) => void
  getSelectedCellCount?: () => number
}

/**
 * Строит контекст пункта: контекст ячейки под курсором + сводка выбора.
 *
 * Выбираемость ячейки решает сама фича (`getCanSelect`): сервисные колонки
 * (чекбокс/действия) невыбираемы, поэтому их правый клик НЕ трогает выделение и
 * `isInSelection=false` — пункты, гейтящиеся на выделении (напр. «Копировать»),
 * там не показываются, и меню уступает нативному (CM5/CM10). CM7: правый клик по
 * выбираемой, но невыделенной ячейке сначала выделяет её.
 */
const buildContext = (
  t: ContextMenuTable,
  rowId: string,
  columnId: string,
): ContextMenuContext | null => {
  const cell = t
    .getRow?.(rowId)
    ?.getAllCells?.()
    .find(c => c.column.id === columnId)
  if (!cell) {
    return null
  }
  const featureOn = typeof cell.getIsSelected === 'function'
  const canSelect = featureOn && (cell.getCanSelect?.() ?? true)
  const wasSelected = featureOn ? cell.getIsSelected!() : false
  if (canSelect && !wasSelected && typeof t.setFocusedCell === 'function') {
    t.setFocusedCell(rowId, columnId)
  }
  // Выбираемая ячейка после авто-выделения входит в выделение; сервисная — нет.
  const isInSelection = canSelect ? true : wasSelected
  const count = canSelect
    ? wasSelected
      ? (t.getSelectedCellCount?.() ?? 1)
      : 1
    : featureOn
      ? (t.getSelectedCellCount?.() ?? 0)
      : 0
  return {
    ...cell.getContext(),
    selection: {
      count,
      isSingle: count === 1,
      isMultiple: count > 1,
      isInSelection,
    },
  }
}

export interface ContextMenuProps {
  table: unknown
  getScrollElement: () => HTMLElement | null
}

export const ContextMenu = ({ table, getScrollElement }: ContextMenuProps) => {
  const [state, setState] = useState<OpenState | null>(null)
  /** Пальцы на экране и открытие меню в точке — для долгого нажатия. */
  const fingers = useRef(new Set<number>())
  const openAtRef = useRef<
    ((target: EventTarget | null, x: number, y: number) => boolean) | null
  >(null)
  const labels = useLocalization()
  const opening = useLazyOpening(table)
  const { cancel, pending, request } = opening
  // Проверка доступности пунктов — с открытия до закрытия (ADR 0078).
  const session = useAvailabilityChecks()
  const { start: startChecks, extend } = session
  const openContext = state?.context
  const extendContextChecks = useCallback(
    (items: ContextMenuAction[]) => extend(items, openContext),
    [extend, openContext],
  )

  // Модуль меню — при первом наведении на тело грида или фокусе внутри него.
  useEffect(() => {
    if (ContextMenuPopupImpl.isLoaded()) return
    const onApproach = (event: Event) => {
      const scroller = getScrollElement()
      if (!scroller?.contains(event.target as Node)) return
      void ContextMenuPopupImpl.load().catch(() => {})
      stop()
    }
    const stop = () => {
      document.removeEventListener('pointerover', onApproach, true)
      document.removeEventListener('focusin', onApproach, true)
    }
    document.addEventListener('pointerover', onApproach, true)
    document.addEventListener('focusin', onApproach, true)
    return stop
  }, [getScrollElement])

  // Ожидание загрузки отменяют Escape, прокрутка грида пользователем (колесо,
  // касание — не прокрутка к ячейке, которую фокусирует сам правый клик) и нажатие мимо.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    const scroller = getScrollElement()
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', cancel, true)
    scroller?.addEventListener('wheel', cancel, { passive: true })
    scroller?.addEventListener('touchmove', cancel, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', cancel, true)
      scroller?.removeEventListener('wheel', cancel)
      scroller?.removeEventListener('touchmove', cancel)
    }
  })

  // Долгое ожидание: курсор `progress` над гридом и `aria-busy` на нём.
  useEffect(() => {
    const scroller = getScrollElement()
    if (!pending || !scroller) return
    scroller.setAttribute('aria-busy', 'true')
    scroller.setAttribute('data-lazy-pending', '')
    return () => {
      scroller.removeAttribute('aria-busy')
      scroller.removeAttribute('data-lazy-pending')
    }
  }, [pending, getScrollElement])

  // Пункты есть — ячейки тела на касание не дают выноску iOS и выделение текста:
  // долгое нажатие принадлежит меню (ADR 0086, TU8).
  useEffect(() => {
    const scroller = getScrollElement()
    const has = ((table as ContextMenuTable).getContextMenuActions?.() ?? [])
      .length
    if (!scroller || !has) return
    scroller.setAttribute('data-context-menu-touch', '')
    return () => scroller.removeAttribute('data-context-menu-touch')
  })

  useEffect(() => {
    const t = table as ContextMenuTable
    /** Открыть меню ячейки под `target` в точке; `false` — меню здесь нет (CM5). */
    const openAt = (target: EventTarget | null, x: number, y: number) => {
      const scroller = getScrollElement()
      const cellEl = (target as Element | null)?.closest?.(CELL)
      const rowEl = cellEl?.closest?.('[data-row-id]')
      // Вне тела нашего грида — уступаем нативному меню браузера.
      if (!scroller || !cellEl || !rowEl || !scroller.contains(cellEl)) {
        return false
      }
      const rowId = rowEl.getAttribute('data-row-id')
      const columnId = cellEl.getAttribute('data-column-id')
      if (!rowId || !columnId) {
        return false
      }
      const context = buildContext(t, rowId, columnId)
      if (!context) {
        return false
      }
      const actions = resolveVisibleActions(
        t.getContextMenuActions?.() ?? [],
        context,
      )
      // Пустое меню — не открываем, уступаем нативному (CM5).
      if (actions.length === 0) {
        return false
      }
      const next = { x, y, actions, context }
      request(MENU_LOAD, () => {
        startChecks(actions, context)
        markActionErrorsSeen(context)
        setState(next)
      })
      return true
    }

    openAtRef.current = openAt

    const onContextMenu = (event: MouseEvent) => {
      // Палец на экране: нативный `contextmenu` касания (Android) — за долгим нажатием.
      if (fingers.current.size > 0) {
        const scroller = getScrollElement()
        if (
          scroller?.contains(event.target as Node | null) &&
          scroller.hasAttribute('data-context-menu-touch')
        ) {
          event.preventDefault()
        }
        return
      }
      if (openAt(event.target, event.clientX, event.clientY)) {
        event.preventDefault()
      }
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [table, getScrollElement, request, startChecks])

  // Долгое нажатие пальцем на ячейку тела открывает меню (ADR 0086, §5). Подписка
  // одна на всё время жизни: перерисовка меню не рвёт начатое удержание.
  useEffect(() => {
    let press: {
      id: number
      x: number
      y: number
      timer: number
      scroll: string
    } | null = null
    const scrollOf = (el: HTMLElement | null) =>
      el ? `${el.scrollLeft}:${el.scrollTop}` : ''
    /** Меню открыто удержанием: отпускание пальца — не нажатие мимо. */
    let opened = false
    const stopPress = () => {
      if (press) window.clearTimeout(press.timer)
      press = null
    }
    // Без отмены `touchend` браузер шлёт `mousedown` и `click` отпускания: фокус
    // уходит из только что открытого немодального меню, и оно закрывается.
    const onTouchEnd = (event: TouchEvent) => {
      if (!opened || event.touches.length > 0) return
      opened = false
      if (event.cancelable) event.preventDefault()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      fingers.current.add(event.pointerId)
      // Второй палец — жест, а не долгое нажатие.
      if (press || fingers.current.size > 1) {
        stopPress()
        return
      }
      const scroller = getScrollElement()
      const target = event.target as Element | null
      if (!scroller?.contains(target) || !target?.closest(CELL)) return
      const { clientX: x, clientY: y } = event
      press = {
        id: event.pointerId,
        x,
        y,
        scroll: scrollOf(scroller),
        timer: window.setTimeout(() => {
          press = null
          opened = !!openAtRef.current?.(target, x, y)
        }, LONG_PRESS_MS),
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (
        press?.id === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
          LONG_PRESS_SLOP
      ) {
        stopPress()
      }
    }
    const onPointerEnd = (event: PointerEvent) => {
      fingers.current.delete(event.pointerId)
      if (press?.id === event.pointerId) stopPress()
    }

    // Прокрутка отменяет удержание; сдвиг на пиксель и обратно перед нажатием
    // (stickyGeometry, ADR 0085) позицию не меняет и не отменяет.
    const onScroll = () => {
      if (press && press.scroll !== scrollOf(getScrollElement())) stopPress()
    }
    const scroller = getScrollElement()
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('touchend', onTouchEnd, {
      capture: true,
      passive: false,
    })
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerEnd, true)
    window.addEventListener('pointercancel', onPointerEnd, true)
    scroller?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stopPress()
      window.removeEventListener('touchend', onTouchEnd, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerEnd, true)
      window.removeEventListener('pointercancel', onPointerEnd, true)
      scroller?.removeEventListener('scroll', onScroll)
    }
  }, [getScrollElement])

  if (!state) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <ContextMenuPopupImpl.Component
        x={state.x}
        y={state.y}
        actions={state.actions}
        context={state.context}
        labels={labels}
        session={session}
        extendChecks={extendContextChecks}
        onClose={() => {
          session.stop()
          clearSeenActionErrors(state.context)
          setState(null)
        }}
      />
    </Suspense>
  )
}

ContextMenu.displayName = 'ContextMenu'
