/**
 * Поповер-панель (ADR 0183, PK2): заголовок, содержимое и кнопки внизу по раскладке ADR 0017
 * (PP11–PP13). Заголовок связывают с попапом через `titleId` и `aria-labelledby` попапа.
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

import clsx from 'clsx'

import styles from './Popup.module.css'

/** Ряд кнопок внизу панели — и там, где содержимое поповера собирает он сам (ADR 0017, PP12). */
export const PopupFooter = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    data-popup-footer=""
    {...rest}
    className={clsx(styles.panelFooter, className)}
  />
)

export interface PopupPanelProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  title?: ReactNode
  /** id заголовка — для `aria-labelledby` попапа. */
  titleId?: string
  /** Кнопки внизу; подпись в их ряду ставится слева через `margin-inline-end: auto`. */
  footer?: ReactNode
  footerClassName?: string
}

export const PopupPanel = forwardRef<HTMLDivElement, PopupPanelProps>(
  (
    { title, titleId, footer, footerClassName, className, children, ...rest },
    ref,
  ) => (
    <div {...rest} ref={ref} className={clsx(styles.panel, className)}>
      {title !== undefined && (
        <p id={titleId} className={styles.panelTitle}>
          {title}
        </p>
      )}
      {children}
      {footer !== undefined && (
        <PopupFooter className={footerClassName}>{footer}</PopupFooter>
      )}
    </div>
  ),
)
PopupPanel.displayName = 'PopupPanel'
