/**
 * Группа пунктов поповера (ADR 0183, PK4): подпись группы и разделитель над ней. Корень и
 * подпись — элементы примитива (`<Menu.Group />`, `<Menu.GroupLabel />`) или свои.
 */
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

import { useRender } from '@base-ui/react/use-render'
import clsx from 'clsx'

import styles from './PopupGroup.module.css'

export interface PopupGroupProps extends HTMLAttributes<HTMLElement> {
  /** Корень группы; по умолчанию `<div>`. */
  render?: ReactElement
  label?: ReactNode
  /** Элемент подписи: `<Menu.GroupLabel />` или `<span id={…} />`; по умолчанию `<span>`. */
  labelRender?: ReactElement
  /** Линия над группой — между группами, не над первой. */
  divided?: boolean
}

export const PopupGroup = ({
  render,
  label,
  labelRender,
  divided,
  className,
  children,
  ...rest
}: PopupGroupProps) => {
  const caption = useRender({
    render: labelRender,
    enabled: label !== undefined,
    defaultTagName: 'span',
    props: { className: styles.label, children: label },
  })
  return useRender({
    render,
    defaultTagName: 'div',
    props: {
      ...rest,
      className: clsx(styles.group, divided && styles.divided, className),
      'data-divided': divided || undefined,
      children: (
        <>
          {caption}
          {children}
        </>
      ),
    },
  })
}
