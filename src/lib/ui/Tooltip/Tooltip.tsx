import { ReactElement, ReactNode } from 'react'

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import clsx from 'clsx'

import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import styles from './Tooltip.module.css'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  /** Текст подсказки */
  title: ReactNode
  /** Триггер подсказки (единственный элемент) */
  children: ReactElement
  /** Отключить подсказку (триггер рендерится без неё) */
  disabled?: boolean
  /** Сторона появления */
  side?: TooltipSide
  /** Задержка перед показом, мс */
  delayDuration?: number
}

/**
 * Подсказка на базе Base UI (фундамент shadcn). Нативная замена MUI Tooltip.
 */
export const Tooltip = ({
  title,
  children,
  disabled = false,
  side = 'top',
  delayDuration = 200,
}: TooltipProps) => {
  if (disabled || !title) {
    return children
  }

  return (
    <BaseTooltip.Provider delay={delayDuration}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner
            side={side}
            sideOffset={6}
            className={clsx(DATA_GRID_THEME_CLASS, styles.positioner)}
          >
            <BaseTooltip.Popup
              className={clsx(DATA_GRID_THEME_CLASS, styles.content)}
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
    </BaseTooltip.Provider>
  )
}
