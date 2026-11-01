/**
 * Ручка перетаскивания строки и колонки — вид (ADR 0168, §1): компактная квадратная кнопка
 * кита со значком перетаскивания. Захват, жесты и меню ручки даёт модель в `shared/dnd`.
 */
import { forwardRef, type ReactNode } from 'react'

import clsx from 'clsx'

import { useIcons } from '../icons'
import { IconButton, type IconButtonProps } from '../IconButton'
import { HiddenButtonContext } from '../IconButton/iconReveal'

import styles from './DragHandle.module.css'
import '../cellControls/buttonVisibility.css'

export interface DragHandleProps extends Omit<
  IconButtonProps,
  'shape' | 'size' | 'children'
> {
  kind: 'row' | 'column'
  /** Меню ручки — рядом с кнопкой, внутри её обёртки. */
  menu?: ReactNode
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ kind, menu, className, ...props }, ref) => {
    const { drag: DragIcon } = useIcons()
    const button = (
      <IconButton
        ref={ref}
        shape="square"
        size="compact"
        className={clsx(styles.handle, 'drag__handler--column', className)}
        {...props}
      >
        {/* Строка раскрывает иконку прозрачностью, колонка — обёрткой по ширине. */}
        <DragIcon
          className={clsx(
            kind === 'row' && [
              'cell__button',
              'cell__button--hidden',
              'row__button',
              'row__button--hidden',
            ],
          )}
        />
      </IconButton>
    )
    return kind === 'row' ? (
      <>
        <HiddenButtonContext.Provider value>
          {button}
        </HiddenButtonContext.Provider>
        {menu}
      </>
    ) : (
      // Ручка колонки шириной 0 до наведения: раскрывается и сдвигает подпись (ADR 0114).
      // Меню — внутри обёртки: служебные узлы портала не встают в ряд заголовка.
      <div
        className={clsx(
          'cell__button',
          'cell__button--hidden',
          styles.columnHandle,
        )}
      >
        {button}
        {menu}
      </div>
    )
  },
)

DragHandle.displayName = 'DragHandle'
