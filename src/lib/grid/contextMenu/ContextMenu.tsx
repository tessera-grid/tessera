// ContextMenu (эагерный): слушатель contextmenu + состояние открытия. Base UI-меню
// (ContextMenuPopup) грузится лениво — floating-ui в базовый бандл не тянется: при
// первом наведении на тело грида или фокусе внутри него, а правый клик до загрузки
// открывает меню после неё (ADR 0061, LZ6–LZ10). Рендерится DataGrid'ом при активном
// плагине contextMenu (`enableContextMenu`). ADR 0030.
import { Suspense, useEffect, useState } from 'react'

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
  const labels = useLocalization()
  const opening = useLazyOpening(table)
  const { cancel, pending, request } = opening
  // Проверка доступности пунктов — с открытия до закрытия (ADR 0078).
  const session = useAvailabilityChecks()
  const { start: startChecks } = session

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

  useEffect(() => {
    const t = table as ContextMenuTable
    const onContextMenu = (event: MouseEvent) => {
      const scroller = getScrollElement()
      const cellEl = (event.target as Element | null)?.closest?.(CELL)
      const rowEl = cellEl?.closest?.('[data-row-id]')
      // Вне тела нашего грида — уступаем нативному меню браузера.
      if (!scroller || !cellEl || !rowEl || !scroller.contains(cellEl)) {
        return
      }
      const rowId = rowEl.getAttribute('data-row-id')
      const columnId = cellEl.getAttribute('data-column-id')
      if (!rowId || !columnId) {
        return
      }
      const context = buildContext(t, rowId, columnId)
      if (!context) {
        return
      }
      const actions = resolveVisibleActions(
        t.getContextMenuActions?.() ?? [],
        context,
      )
      // Пустое меню — не открываем, уступаем нативному (CM5).
      if (actions.length === 0) {
        return
      }
      event.preventDefault()
      const next = { x: event.clientX, y: event.clientY, actions, context }
      request(MENU_LOAD, () => {
        startChecks(actions, context)
        markActionErrorsSeen(actions, context)
        setState(next)
      })
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [table, getScrollElement, request, startChecks])

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
        onClose={() => {
          session.stop()
          clearSeenActionErrors(state.actions, state.context)
          setState(null)
        }}
      />
    </Suspense>
  )
}

ContextMenu.displayName = 'ContextMenu'
