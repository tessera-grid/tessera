import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import clsx from 'clsx'
import type { ReactNode, RefObject } from 'react'

import { usePortalThemeData, usePortalThemeClass } from '../theme'
import type { TooltipSide } from './Tooltip'
import styles from './Tooltip.module.css'

export interface TooltipPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Якорь позиционирования — триггер, отрисованный эагерно в `Tooltip`. */
  anchor: RefObject<HTMLElement | null>
  title: ReactNode
  side: TooltipSide
  /**
   * Указатель на самой подсказке держит её открытой (WCAG 1.4.13) — только у
   * подсказки обрезанного текста. Иначе подсказка пропускает указатель насквозь (ADR 0100).
   */
  interactive?: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

/**
 * Base UI-попап подсказки. Живёт в отдельном чанке: `@base-ui/react/tooltip` тянет
 * floating-ui-позиционирование, поэтому грузится лениво, а не в начальный бандл.
 * Открытием управляет родительский `Tooltip` (контролируемый `open`) — попап лишь
 * позиционируется у внешнего `anchor` и отображается; из-за этого потеря hover при
 * догрузке чанка исключена.
 */
const TooltipPopup = ({
  open,
  onOpenChange,
  anchor,
  title,
  side,
  interactive = false,
  onPointerEnter,
  onPointerLeave,
}: TooltipPopupProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  return (
    <BaseTooltip.Root open={open} onOpenChange={onOpenChange}>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          anchor={anchor}
          side={side}
          sideOffset={6}
          className={clsx(
            themeClass,
            styles.positioner,
            !interactive && styles.passThrough,
          )}
          {...themeData}
        >
          <BaseTooltip.Popup
            className={clsx(themeClass, styles.content)}
            data-tooltip-popup=""
            onPointerEnter={interactive ? onPointerEnter : undefined}
            onPointerLeave={interactive ? onPointerLeave : undefined}
          >
            {title}
            <BaseTooltip.Arrow className={styles.arrow}>
              <svg width="12" height="6" viewBox="0 0 12 6" aria-hidden>
                <path d="M0 0 H12 L6 6 Z" />
              </svg>
            </BaseTooltip.Arrow>
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

export default TooltipPopup
