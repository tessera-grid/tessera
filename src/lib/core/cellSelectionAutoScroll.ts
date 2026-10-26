/**
 * Авто-прокрутка контейнера во время drag-выделения ячеек, когда курсор у края
 * таблицы или за её пределами. Стоковая v9-фича расширяет выделение только по
 * `mouseenter` ячейки — за краем ячеек под курсором нет, поэтому прокрутку и
 * до-расширение делаем сами.
 *
 * Ядровой шов (ядро плагин не импортит): активен только при наличии фичи
 * (`getSelectedCellRangesData` есть ⇒ плагин cellSelection подключён) и только пока
 * открыта drag-сессия (`_isSelectingCells`). Расширение — публичным
 * `selectCellRange` к ячейке под клампнутым в границы контейнера курсором: точно и
 * самокорректируемо (следует за прокруткой без синтеза событий). См. ADR 0029.
 *
 * КРИТИЧНО: эффект живёт один раз (`[]`), а `table`/`getScrollElement` читаются
 * через ref'ы. Иначе идущая drag-сессия рвётся: выделение меняет состояние на
 * каждый кадр → ре-рендер → (при смене identity `table`) пере-запуск эффекта →
 * cleanup → `cancelAnimationFrame` убивает rAF-цикл до первого кадра.
 */
import { useEffect } from 'react'

import { scrollLayer } from './scrollStretch'
import { useLatest } from './useLatest'

interface AutoScrollTable {
  getSelectedCellRangesData?: () => unknown
  _isSelectingCells?: boolean
  getFocusedCell?: () =>
    { row: { id: string }; column: { id: string } } | undefined
  selectCellRange?: (range: {
    anchorRowId: string
    anchorColumnId: string
    focusRowId: string
    focusColumnId: string
  }) => void
}

/** Ширина краевой зоны (px) и максимальная скорость прокрутки (px/кадр). */
const EDGE = 48
const MAX_SPEED = 22

const CELL = '.data-grid__body-cell[data-column-id]'

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

/** Скорость пропорциональна заходу в краевую зону, за краем — потолок. */
const speed = (penetration: number) =>
  clamp(penetration / EDGE, 0, 1) * MAX_SPEED

export const useCellSelectionAutoScroll = (
  table: unknown,
  getScrollElement: () => HTMLElement | null,
): void => {
  // Ref'ы держат актуальные table/getScrollElement, не пере-создавая эффект.
  const tableRef = useLatest(table)
  const getScrollRef = useLatest(getScrollElement)

  useEffect(() => {
    let raf = 0
    let dragging = false
    const pointer = { x: 0, y: 0 }

    const stop = () => {
      dragging = false
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseup', stop, true)
    }

    const onMove = (event: MouseEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
    }

    const onDown = (event: MouseEvent) => {
      if (dragging) {
        return
      }
      const t = tableRef.current as AutoScrollTable
      // Инертно без плагина: метода фичи нет — сессию не открываем.
      if (typeof t.getSelectedCellRangesData !== 'function') {
        return
      }
      const scroller = getScrollRef.current()
      const cell = (event.target as Element | null)?.closest?.(CELL)
      // Сессия открывается только при mousedown по выбираемой ячейке нашего грида.
      if (!scroller || !cell || !scroller.contains(cell)) {
        return
      }
      pointer.x = event.clientX
      pointer.y = event.clientY
      dragging = true
      document.addEventListener('mousemove', onMove, true)
      document.addEventListener('mouseup', stop, true)
      raf = requestAnimationFrame(tick)
    }

    const tick = () => {
      if (!dragging) {
        return
      }
      raf = requestAnimationFrame(tick)
      const t = tableRef.current as AutoScrollTable
      const scroller = getScrollRef.current()
      // Ждём реальной drag-сессии фичи (mousedown без протяжки её не открывает).
      if (!scroller || !t._isSelectingCells) {
        return
      }
      const r = scroller.getBoundingClientRect()
      let dx = 0
      let dy = 0
      if (pointer.y < r.top + EDGE) {
        dy = -speed(r.top + EDGE - pointer.y)
      } else if (pointer.y > r.bottom - EDGE) {
        dy = speed(pointer.y - (r.bottom - EDGE))
      }
      if (pointer.x < r.left + EDGE) {
        dx = -speed(r.left + EDGE - pointer.x)
      } else if (pointer.x > r.right - EDGE) {
        dx = speed(pointer.x - (r.right - EDGE))
      }
      if (dx === 0 && dy === 0) {
        return
      }
      scrollLayer(scroller).scrollBy(dy, dx)

      // Расширяем активный диапазон к ячейке под курсором, клампнутым в контейнер
      // (за краем курсора нет ячейки — берём крайнюю видимую в ту сторону).
      const anchor = t.getFocusedCell?.()
      if (!anchor) {
        return
      }
      const cx = clamp(pointer.x, r.left + 1, r.right - 1)
      const cy = clamp(pointer.y, r.top + 1, r.bottom - 1)
      const cell = (
        document.elementFromPoint(cx, cy) as Element | null
      )?.closest?.(CELL)
      const rowEl = cell?.closest?.('[data-row-id]')
      const focusRowId = rowEl?.getAttribute('data-row-id')
      const focusColumnId = cell?.getAttribute('data-column-id')
      if (!focusRowId || !focusColumnId) {
        return
      }
      t.selectCellRange?.({
        anchorRowId: anchor.row.id,
        anchorColumnId: anchor.column.id,
        focusRowId,
        focusColumnId,
      })
    }

    document.addEventListener('mousedown', onDown, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      stop()
    }
  }, [tableRef, getScrollRef])
}
