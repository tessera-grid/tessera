// Cutover (grid) — v9-порт ActionMenu: схлопнутая подача действий слота (кебаб ⋮ +
// раскрывающееся меню Base UI). Отличие от v8: useSubscribeStore убран —
// реактивность даёт родительская ActionsZone (подписка на состояние).
import { useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { useLocalization } from '../../../lib/core/localization'
import { IconButton } from '../../../lib/ui/IconButton'
import { useIcons } from '../../../lib/ui/icons'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'

import styles from '../../../lib/grid/headerActions/ActionMenu.module.css'
import '../../../lib/grid/cellControls/buttonVisibility.css'

interface ActionMenuProps {
  actions: SlotAction[]
  context: any
  variant?: 'cell' | 'row'
}

export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
}: ActionMenuProps) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()

  const [open, setOpen] = useState(false)

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
    <Menu.Root onOpenChange={setOpen}>
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
