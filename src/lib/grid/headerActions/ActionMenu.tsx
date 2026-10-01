// ActionMenu: схлопнутая подача действий слота (кебаб ⋮ + раскрывающееся меню
// Base UI). Реактивность даёт родительская ActionsZone (подписка на состояние).
// Открытием управляет ленивая обёртка (ActionMenu.lazy): контролируемый `open`
// позволяет открыть меню сразу после догрузки чанка, если по плейсхолдеру уже
// кликнули.
import { Menu } from '@base-ui/react/menu'
import { useState } from 'react'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface ActionMenuProps {
  actions: SlotAction[]
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
  open,
  onOpenChange,
}: ActionMenuProps) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()
  // Закрытое, но ещё не завершившее закрытие меню: фокус на кебаб Base UI возвращает
  // в конце — до него кебаб держится видимым (AM25, AM26).
  const [settledOpen, setSettledOpen] = useState(open)

  const trigger = (
    <Menu.Trigger
      render={
        <IconButton className={styles.trigger} aria-label={labels.headerMenu}>
          <MenuIcon width={16} height={16} />
        </IconButton>
      }
    />
  )

  return (
    <Menu.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={setSettledOpen}
    >
      {variant === 'row' ? (
        <div
          className={clsx(
            'row__button',
            !(open || settledOpen) && 'row__button--hidden',
          )}
        >
          {trigger}
        </div>
      ) : (
        // Как остальные кнопки ячейки/заголовка: по наведению или фокусу; пока меню
        // открыто или закрывается, `data-button-active` держит кебаб видимым (ADR 0024,
        // AM24, AM25).
        <div
          className="cell__button cell__button--hidden"
          data-button-active={open || settledOpen}
        >
          {trigger}
        </div>
      )}
      <ActionMenuPopup actions={actions} context={context} />
    </Menu.Root>
  )
}

ActionMenu.displayName = 'ActionMenu'
