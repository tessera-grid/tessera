/**
 * Пункт поповера (ADR 0183, PK3) поверх любого элемента: `<Menu.Item />`, `<Select.Item />`,
 * `<Combobox.Item />`, `<Radio.Root />`, `<button>`, `<li>`, `<label>`. Слоты — значок, подпись,
 * подсказка и метка справа (`PopupItemMark`); своё содержимое — детьми.
 */
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { forwardRef } from 'react'

import { useRender } from '@base-ui/react/use-render'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { useIcons } from '../icons'
import { Tooltip } from '../Tooltip'

import styles from './PopupItem.module.css'

export interface PopupItemProps extends HTMLAttributes<HTMLElement> {
  /** Элемент пункта; по умолчанию `<div>`. */
  render?: ReactElement
  /** Значок слева; `null` — пустое место значка, подпись на одной линии с соседями. */
  icon?: ReactNode
  /**
   * Что значит значок — цветная точка (ADR 0224): подсказка над областью от края пункта до подписи
   * на всю высоту; на касаниях — удержанием.
   */
  iconHint?: string
  label?: ReactNode
  /** Подсказка справа от подписи: сочетание клавиш, «по возрастанию». */
  hint?: ReactNode
  /** Вторая строка мелким текстом под подписью (ADR 0204, HT5). */
  caption?: ReactNode
  /** Справа, последним: метка `PopupItemMark` или кнопка пункта. */
  end?: ReactNode
  /** Подпись переносится, значки и метка — по первой строке. */
  wrap?: boolean
}

export const PopupItem = forwardRef<HTMLElement, PopupItemProps>(
  (
    {
      render,
      icon,
      iconHint,
      label,
      hint,
      caption,
      end,
      wrap,
      className,
      children,
      ...rest
    },
    ref,
  ) =>
    useRender({
      render,
      ref,
      defaultTagName: 'div',
      props: {
        ...rest,
        className: clsx(wrap ? styles.wrap : styles.item, className),
        children: (
          <>
            {icon !== undefined &&
              (iconHint ? (
                <Tooltip title={iconHint} longPress>
                  <span
                    className={styles.icon}
                    data-popup-item-icon=""
                    data-hint=""
                    aria-hidden
                  >
                    {icon}
                  </span>
                </Tooltip>
              ) : (
                <span
                  className={styles.icon}
                  data-popup-item-icon=""
                  aria-hidden
                >
                  {icon}
                </span>
              ))}
            {label !== undefined && (
              // Части пункта находят по data-атрибутам, а не по именам классов.
              <span className={styles.label} data-popup-item-label="">
                {label}
                {caption !== undefined && (
                  <span className={styles.caption} data-popup-item-caption="">
                    {caption}
                  </span>
                )}
              </span>
            )}
            {children}
            {hint !== undefined && (
              <span className={styles.hint} data-popup-item-hint="" aria-hidden>
                {hint}
              </span>
            )}
            {end}
          </>
        ),
      },
    }),
)
PopupItem.displayName = 'PopupItem'

/** Состояние пункта меткой справа (ADR 0078, ADR 0079). */
export type PopupItemStatus =
  'checked' | 'submenu' | 'pending' | 'failed' | 'blocked'

export interface PopupItemMarkProps extends HTMLAttributes<HTMLElement> {
  /** Элемент метки: `<Select.ItemIndicator />`; по умолчанию `<span>`. */
  render?: ReactElement
  /** Значок по состоянию; без него — дети. */
  status?: PopupItemStatus
}

export const PopupItemMark = ({
  render,
  status,
  className,
  children,
  ...rest
}: PopupItemMarkProps) => {
  const {
    actionFailed: FailedIcon,
    actionBlocked: BlockedIcon,
    submenu: SubmenuIcon,
  } = useIcons()
  const icon =
    status === 'pending' ? (
      <span className={styles.spinner} data-item-spinner="" />
    ) : status === 'failed' ? (
      <FailedIcon width={14} height={14} />
    ) : status === 'blocked' ? (
      <BlockedIcon width={14} height={14} />
    ) : status === 'submenu' ? (
      <SubmenuIcon width={14} height={14} />
    ) : status === 'checked' ? (
      <Check width={14} height={14} />
    ) : (
      children
    )
  return useRender({
    render,
    defaultTagName: 'span',
    props: {
      'aria-hidden': true,
      'data-popup-item-mark': status ?? '',
      ...rest,
      className: clsx(
        styles.mark,
        status === 'failed' && styles.failed,
        status === 'blocked' && styles.blocked,
        className,
      ),
      children: icon,
    },
  })
}
