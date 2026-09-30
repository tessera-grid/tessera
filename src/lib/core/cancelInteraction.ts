/**
 * Отмена идущего действия, запрещённого на лету (ADR 0039, §5, RX14–RX15): так,
 * будто пользователь нажал Escape.
 */

/** Перетаскивание dnd-kit: указательные сенсоры отменяют его по Escape на document. */
export const cancelDragLikeEscape = () => {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
    }),
  )
}

/** Признак события отмены: слушатель конца ресайза не зовёт бизнес-колбэк. */
export const RESIZE_CANCEL = Symbol('tessera.resizeCancel')

export const isResizeCancel = (event: unknown): boolean =>
  !!(event as Record<symbol, unknown> | undefined)?.[RESIZE_CANCEL]

interface ResizeTable {
  atoms: {
    columnResizing?: {
      get: () =>
        | {
            columnSizingStart?: [string, number][]
            startOffset?: number | null
          }
        | undefined
    }
  }
  setColumnSizing: (
    updater: (old: Record<string, number>) => Record<string, number>,
  ) => void
}

/**
 * Ресайз колонки: завершить протяжку помеченным событием (TanStack снимает свои
 * слушатели документа) и вернуть ширины, с которых она началась.
 */
export const cancelColumnResize = (table: unknown) => {
  const t = table as ResizeTable
  const info = t.atoms.columnResizing?.get()
  const start = info?.columnSizingStart ?? []
  // clientX — точка начала протяжки: TanStack завершает её с нулевым смещением.
  const events = [
    new MouseEvent('mouseup', {
      bubbles: true,
      clientX: info?.startOffset ?? 0,
    }),
    new Event('touchend', { bubbles: true }),
  ]
  for (const event of events) {
    Object.defineProperty(event, RESIZE_CANCEL, { value: true })
    document.dispatchEvent(event)
  }
  if (start.length) {
    t.setColumnSizing(old => ({ ...old, ...Object.fromEntries(start) }))
  }
}
