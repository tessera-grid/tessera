import { INPUT_MODALITY_ATTR } from '../../core/inputModality'
import {
  KeyboardEvent,
  MouseEvent,
  TouchEvent,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import {
  resizeCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import { HandleMenu, useHandleMenu } from '../../shared/handleMenu/HandleMenu'
import { reportAction } from '../../core/debugActions'
import styles from './ResizeHandler.module.css'
import '../../ui/cellControls/buttonVisibility.css'
import { columnSizingLabels } from './labels'
import { useResizeLine } from './resizeLine'
import { useResizeAutoScroll } from './resizeAutoScroll'

/** Шаг изменения ширины стрелкой и Shift+стрелкой, px. */
const KEY_STEP = 10
const LARGE_KEY_STEP = 50
/** Сдвиг указателя, после которого нажатие — ресайз, а не клик (px). */
const CLICK_TOLERANCE = 3

/** Событие из портала меню ширины: всплывает по дереву React, но не по DOM грипа. */
const fromMenu = (event: MouseEvent | TouchEvent) =>
  !event.currentTarget.contains(event.target as Node)

export interface ResizeSplitterProps {
  isResizing: boolean
  onResize: (event: unknown) => void
  onResizeEnd: (event: unknown) => void
  /** Протяжка завершилась без результата (ADR 0040, §1). */
  onResizeCancel: (reason: SessionCancelReason) => void
  /** Escape во время протяжки — отменить её. */
  onEscape: () => void
  onResetSize: (event: unknown) => void
  /** Изменить ширину на `delta` px с клавиатуры или из меню. */
  onResizeBy: (delta: number) => void
  /** Подогнать ширину по содержимому: колонку или все (ADR 0217). */
  onAutosize?: (source: 'pointer' | 'keyboard') => void
  onAutosizeAll?: (source: 'pointer' | 'keyboard') => void
  size: number
  minSize: number
  /** `undefined` — без верхней границы. */
  maxSize?: number
  disabled?: boolean
  /** Таблица — для объявления ошибки загрузки меню (ADR 0061). */
  table?: unknown
  /** Колонка грипа — цель действий клавиш в канале действий (ADR 0125). */
  columnId?: string
}

export const ResizeHandler = memo(
  ({
    isResizing,
    onResize,
    onResizeEnd,
    onResizeCancel,
    onEscape,
    onResetSize,
    onResizeBy,
    onAutosize,
    onAutosizeAll,
    size,
    minSize,
    maxSize,
    disabled = false,
    table,
    columnId,
  }: ResizeSplitterProps) => {
    const labels = useLocalization()
    const wrapperRef = useRef<HTMLDivElement>(null)
    const separatorRef = useRef<HTMLSpanElement>(null)
    const pressedX = useRef<number | null>(null)
    /** Касание без сдвига уже открыло меню — `click` после него не повторяет. */
    const tapped = useRef(false)
    // Грип тонкий — контура ожидания на нём не видно: `aria-busy` и курсор `progress`.
    const menu = useHandleMenu(
      table,
      all => columnSizingLabels(all).columnWidth,
      'columnSizing',
    )
    const menuOpen = menu.open
    const active = isResizing || menuOpen || menu.trigger.pending
    const [keyboardFocus, setKeyboardFocus] = useState(false)
    const lineShown = !disabled && (active || keyboardFocus)
    useResizeLine(wrapperRef, separatorRef, lineShown, styles.line)
    useResizeAutoScroll(wrapperRef, isResizing && !disabled, {
      table,
      minSize,
      maxSize,
    })

    const onResizeStart = useCallback(
      (event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
        if (fromMenu(event)) return
        tapped.current = false
        const touchX =
          'touches' in event ? event.touches[0]?.clientX : undefined
        pressedX.current = 'clientX' in event ? event.clientX : (touchX ?? null)
        document.body.style.cursor = 'col-resize'
        // Нажатие внутри выделения текста WebKit начинает перетаскивать выделение, и движения
        // указателя до протяжки не доходят.
        window.getSelection()?.removeAllRanges()
        onResize(event)
        const onKey = (evt: globalThis.KeyboardEvent) => {
          if (evt.key === 'Escape') {
            onEscape()
          }
        }
        const listener = (evt: Event) => {
          // Касание без сдвига — меню ширины: после протяжки TanStack WebKit не шлёт
          // `click` (ADR 0086, TU4).
          if (evt.type === 'touchend' && touchX !== undefined) {
            const endX = (evt as globalThis.TouchEvent).changedTouches[0]
              ?.clientX
            if (
              !disabled &&
              endX !== undefined &&
              Math.abs(endX - touchX) < CLICK_TOLERANCE
            ) {
              tapped.current = true
              menu.request()
            }
          }
          // Отмена — без бизнес-колбэка успеха (ADR 0040, §1).
          const reason = resizeCancelReason(evt)
          if (reason) {
            onResizeCancel(reason)
          } else {
            onResizeEnd(evt)
          }
          document.removeEventListener('mouseup', listener)
          document.removeEventListener('touchend', listener)
          document.removeEventListener('keydown', onKey)
          document.body.style.cursor = 'default'
        }
        document.addEventListener('mouseup', listener)
        document.addEventListener('touchend', listener)
        document.addEventListener('keydown', onKey)
      },
      [onResizeEnd, onResizeCancel, onEscape, onResize, disabled, menu],
    )

    // Клик без сдвига — меню ширины (WCAG 2.5.7, ADR 0034); протяжка — ресайз.
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
      if (fromMenu(event)) return
      const start = pressedX.current
      pressedX.current = null
      if (tapped.current) {
        tapped.current = false
        return
      }
      if (
        disabled ||
        (start !== null && Math.abs(event.clientX - start) >= CLICK_TOLERANCE)
      ) {
        return
      }
      menu.request()
    }

    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      // Клавиша на разделителе, получившем фокус от указателя, — тоже фокус клавиатуры.
      setKeyboardFocus(true)
      const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP
      const report = (action: string, delta?: number) =>
        reportAction(table, {
          plugin: 'columnSizing',
          action,
          detail: { columnId, ...(delta !== undefined && { delta }) },
          source: 'keyboard',
        })
      if (event.key === 'ArrowLeft') {
        report('resizeBy', -step)
        onResizeBy(-step)
      } else if (event.key === 'ArrowRight') {
        report('resizeBy', step)
        onResizeBy(step)
      } else if (event.key === 'Home') {
        report('resetSize')
        onResetSize(event)
      } else if (event.key === 'Escape') {
        menu.trigger.onCancel()
        return
      } else {
        return
      }
      event.preventDefault()
    }

    const getMenuItems = () => [
      {
        id: 'widen',
        label: columnSizingLabels(labels).widenColumn,
        disabled: maxSize !== undefined && size >= maxSize,
        onSelect: () => onResizeBy(LARGE_KEY_STEP),
      },
      {
        id: 'narrow',
        label: columnSizingLabels(labels).narrowColumn,
        disabled: size <= minSize,
        onSelect: () => onResizeBy(-LARGE_KEY_STEP),
      },
      {
        id: 'reset',
        label: columnSizingLabels(labels).resetColumnWidth,
        onSelect: () => onResetSize(undefined),
      },
      ...(onAutosize
        ? [
            {
              id: 'autosize',
              label: columnSizingLabels(labels).autosizeColumn,
              onSelect: (event?: { detail?: number }) =>
                onAutosize(event?.detail === 0 ? 'keyboard' : 'pointer'),
            },
          ]
        : []),
      ...(onAutosizeAll
        ? [
            {
              id: 'autosizeAll',
              label: columnSizingLabels(labels).autosizeAllColumns,
              onSelect: (event?: { detail?: number }) =>
                onAutosizeAll(event?.detail === 0 ? 'keyboard' : 'pointer'),
            },
          ]
        : []),
    ]

    return (
      <>
        <div
          ref={wrapperRef}
          onClick={onClick}
          // Двойной клик подгоняет ширину: меню ручки, открытое первым кликом, закрывается (ADR 0217).
          onDoubleClick={
            disabled || !onAutosize
              ? undefined
              : () => {
                  menu.close()
                  onAutosize('pointer')
                }
          }
          onPointerEnter={menu.trigger.onIntent}
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          aria-disabled={disabled}
          className={clsx(
            styles.wrapper,
            'cell__button',
            'cell__button--hidden',
            'resize__handler--column',
          )}
          data-button-active={active}
          data-resize-line={lineShown || undefined}
          data-lazy-pending={menu.trigger.pending || undefined}
        >
          <div
            className={clsx(
              'resize__handler--column--background',
              styles.background,
            )}
          >
            <span
              ref={separatorRef}
              role="separator"
              tabIndex={disabled ? -1 : 0}
              aria-label={columnSizingLabels(labels).resizeColumn}
              aria-orientation="vertical"
              aria-valuenow={Math.round(size)}
              aria-valuemin={minSize}
              aria-valuemax={maxSize}
              aria-disabled={disabled}
              aria-busy={menu.trigger.pending || undefined}
              onKeyDown={disabled ? undefined : onKeyDown}
              onFocus={event => {
                // Firefox не даёт `:focus-visible` фокусу, вернувшемуся из меню после клавиши.
                setKeyboardFocus(
                  event.currentTarget.matches(':focus-visible') ||
                    document.documentElement.getAttribute(
                      INPUT_MODALITY_ATTR,
                    ) === 'keyboard',
                )
                menu.trigger.onIntent?.()
              }}
              onBlur={() => {
                setKeyboardFocus(false)
                menu.trigger.onCancel()
              }}
              className={styles.handler}
            />
          </div>
          {/* Меню — внутри обёртки: служебные узлы портала не встают в ряд кнопок. */}
          {menuOpen && (
            <HandleMenu
              anchor={wrapperRef}
              focusTarget={separatorRef}
              label={columnSizingLabels(labels).columnWidth}
              getItems={getMenuItems}
              onClose={menu.close}
              table={table}
              plugin="columnSizing"
            />
          )}
        </div>
      </>
    )
  },
)

ResizeHandler.displayName = 'ResizeHandler'
