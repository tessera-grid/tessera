/**
 * Поверхность поповера (ADR 0183, PK1): позиционер и попап любого примитива Base UI —
 * `Popover`, `Menu`, `Combobox`, `Select` — с темой портала, зазором до якоря и видом поверхности
 * (ADR 0017, PP1–PP6). Опции примитива задаются на его элементах, свой класс попапа — размеры.
 */
import type { ReactElement, ReactNode } from 'react'

import { useRender } from '@base-ui/react/use-render'
import clsx from 'clsx'

import { usePortalThemeClass, usePortalThemeData } from '../theme'
import { POPUP_SIDE_OFFSET } from './offset'

import styles from './Popup.module.css'

export interface PopupSurfaceProps {
  /** Позиционер примитива с его опциями: `<Menu.Positioner side="bottom" align="end" />`. */
  positioner: ReactElement
  /** Попап примитива с его опциями: `<Popover.Popup aria-label="…" />`. */
  popup: ReactElement
  /** Свой класс попапа: ширина и раскладка поверх поверхности. */
  className?: string
  children?: ReactNode
}

export const PopupSurface = ({
  positioner,
  popup,
  className,
  children,
}: PopupSurfaceProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const surface = useRender({
    render: popup,
    props: {
      className: clsx(themeClass, styles.popup, className),
      children,
    },
  })
  return useRender({
    render: positioner,
    props: {
      ...themeData,
      sideOffset: POPUP_SIDE_OFFSET,
      className: clsx(themeClass, styles.positioner),
      children: surface,
    },
  })
}
