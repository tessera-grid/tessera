import { memo, useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { SlotAction } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { ActionMenuPopup } from './ActionMenuPopup'

import buttonStyles from './ActionButton.module.css'
import '../cellControls/buttonVisibility.css'

interface ActionInlineMenuProps {
  action: SlotAction
  /** Контекст слота (заголовок/ячейка) — прозрачно передаётся в признаки действия. */
  context: any
  /** Контракт видимости обёртки: `cell` (hover ячейки) или `row` (hover строки). */
  variant?: 'cell' | 'row'
}

/**
 * Инлайн-подача действия как мини-меню (поповер): иконка-кнопка действия сама
 * служит триггером, раскрывая его `menuItems` тем же телом, что и кебаб
 * (`ActionMenuPopup`). Применяется, когда инлайн-клик неоднозначен и нужен выбор
 * варианта (закрепление при обеих доступных сторонах, `inlineAsMenu`). Внешне
 * повторяет `ActionButton` (обёртка ревила, тултип, `data-button-active`,
 * `className`/`adornment` дескриптора), поэтому DOM-контракт кнопки не меняется.
 */
export const ActionInlineMenu = memo(
  ({ action, context, variant = 'cell' }: ActionInlineMenuProps) => {
    const labels = useLocalization()

    // Пока меню открыто — держим триггер видимым (курсор ушёл в портал, ячейка
    // вне hover), как в `ActionMenu`.
    const [open, setOpen] = useState(false)

    const label = action.label(context, labels)
    const ariaLabel = action.ariaLabel?.(context, labels) ?? label
    const active = action.active?.(context) ?? false
    const adornment = action.adornment?.(context)

    const button = (
      <Menu.Trigger
        render={
          <IconButton className={action.className?.(context)} aria-label={ariaLabel}>
            {action.icon(context)}
          </IconButton>
        }
      />
    )

    const hiddenClass =
      variant === 'row' ? 'row__button--hidden' : 'cell__button--hidden'
    const wrapperBase = variant === 'row' ? 'row__button' : 'cell__button'

    // Триггером служит сама кнопка действия (без обёртки-тултипа: она разрывает
    // якорение поповера у Base UI — как в кебабе `ActionMenu`, полагаемся на
    // `aria-label`). Пока меню открыто — держим кнопку видимой.
    return (
      <Menu.Root onOpenChange={setOpen}>
        <div
          className={clsx(wrapperBase, !open && hiddenClass)}
          data-button-active={active}
        >
          {adornment ? (
            <span className={buttonStyles.anchor}>
              {button}
              {adornment}
            </span>
          ) : (
            button
          )}
        </div>
        <ActionMenuPopup actions={[action]} context={context} />
      </Menu.Root>
    )
  },
)

ActionInlineMenu.displayName = 'ActionInlineMenu'
