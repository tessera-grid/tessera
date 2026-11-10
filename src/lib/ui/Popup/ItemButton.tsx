/**
 * Кнопка в пункте и записи поповера (ADR 0183, PK34): компактный квадрат кита справа в строке —
 * одна на все поповеры; пункт и запись вмещают её целиком, а её значок стоит на их поле справа,
 * как метка пункта.
 */
import { forwardRef } from 'react'

import { IconButton, type IconButtonProps } from '../IconButton'

export interface ItemButtonProps extends Omit<
  IconButtonProps,
  'shape' | 'size' | 'variant'
> {
  /** Тултип и доступное имя кнопки. */
  label: string
}

export const ItemButton = forwardRef<HTMLButtonElement, ItemButtonProps>(
  (props, ref) => (
    <IconButton
      ref={ref}
      {...props}
      // Пункт и запись по нему отводят кнопке место: значок — на их поле справа.
      data-item-button=""
      shape="square"
      size="compact"
    />
  ),
)

ItemButton.displayName = 'ItemButton'
