/**
 * Клавиатурное действие columnSorting (ADR 0021): `Enter` на сортируемом заголовке
 * — следующий порядок сортировки тем же путём, что и кнопка (`Shift` — мульти).
 */
import type { MouseEvent } from 'react'

import type { HeaderKeyboardAction } from '../../core/keyboardActions'
import { sortHeaderAction } from './sortHeaderAction'

export const sortKeyboardAction: HeaderKeyboardAction = {
  id: 'columnSorting.toggle',
  scope: 'header',
  keys: ['Enter'],
  visible: ({ column }) => column.getCanSort?.() ?? false,
  // Стоковый обработчик читает из события только модификатор мульти-сорта.
  run: (ctx, event) =>
    sortHeaderAction.onSelect?.(
      ctx,
      event as unknown as MouseEvent<HTMLButtonElement>,
    ),
}
