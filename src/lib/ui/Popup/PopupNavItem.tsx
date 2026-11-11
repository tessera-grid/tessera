/**
 * Пункт перехода поповера (ADR 0215, §3): строка-кнопка на другой уровень — значок, подпись,
 * короткое значение справа многоточием с полным текстом в тултипе и шеврон. Без перехода строка
 * видна, но не нажимается. Тот же вид — у строки «назад» уровня.
 */
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'

import clsx from 'clsx'

import { Tooltip } from '../Tooltip'

import { PopupItem, PopupItemMark } from './PopupItem'

import styles from './PopupNavItem.module.css'

export interface PopupNavItemProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  icon?: ReactNode
  label: ReactNode
  /** Короткое значение справа. */
  value?: string
  /** Перехода нет: без шеврона и нажатия. */
  disabled?: boolean
  /** Шеврон справа — переход вглубь; строке «назад» он не нужен. */
  chevron?: boolean
  /** Подпись переносится, значки — по первой строке. */
  wrap?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

export const PopupNavItem = ({
  icon,
  label,
  value,
  disabled = false,
  chevron = true,
  wrap,
  onClick,
  className,
  children,
  ...rest
}: PopupNavItemProps) => (
  <PopupItem
    {...rest}
    wrap={wrap}
    render={<button type="button" />}
    className={clsx(styles.nav, className)}
    icon={icon}
    label={label}
    aria-disabled={disabled || undefined}
    data-disabled={disabled || undefined}
    onClick={disabled ? undefined : onClick}
    end={chevron && !disabled ? <PopupItemMark status="submenu" /> : undefined}
  >
    {value !== undefined && (
      <Tooltip title={value} overflowOnly>
        <span className={styles.value} data-popup-nav-value="">
          <span className={styles.valueText}>{value}</span>
        </span>
      </Tooltip>
    )}
    {children}
  </PopupItem>
)
