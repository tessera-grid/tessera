// Cutover (grid) — v9-порт ActionMenu: схлопнутая подача действий слота (кебаб ⋮ +
// раскрывающееся меню Base UI). Отличие от v8: useSubscribeStore убран —
// реактивность даёт родительская ActionsZone (подписка на состояние).
// Открытием управляет ленивая обёртка (ActionMenu.lazy): контролируемый `open`
// позволяет открыть меню сразу после догрузки чанка, если по плейсхолдеру уже
// кликнули.
import { Menu } from '@base-ui/react/menu'
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
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      {variant === 'row' ? (
        <div className={clsx('row__button', !open && 'row__button--hidden')}>
          {trigger}
        </div>
      ) : (
        trigger
      )}
      <ActionMenuPopup actions={actions} context={context} />
    </Menu.Root>
  )
}

ActionMenu.displayName = 'ActionMenu'
