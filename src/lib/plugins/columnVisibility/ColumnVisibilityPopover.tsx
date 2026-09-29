/**
 * Поповер меню колонок на Base UI Popover. Живёт в отдельном чанке: открытием
 * управляет эагерная кнопка (`ColumnVisibilityButton`), поэтому клик до догрузки
 * не теряется. `Escape` и клик снаружи закрывают поповер, фокус — на кнопку.
 */
import { useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import type { Table } from '../../types'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'

import styles from './ColumnVisibilityMenu.module.css'

export interface ColumnVisibilityPopoverProps {
  table: Table<any, any>
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ColumnVisibilityPopover = ({
  table,
  active,
  open,
  onOpenChange,
}: ColumnVisibilityPopoverProps) => {
  const labels = useLocalization()
  const { columns: ColumnsIcon } = useIcons()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={labels.columns}
        icon={<ColumnsIcon width={18} height={18} />}
        active={active}
        data-testid="column-visibility-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          className={clsx(DATA_GRID_THEME_CLASS, styles.positioner)}
        >
          <Popover.Popup
            aria-label={labels.columns}
            initialFocus={searchRef}
            finalFocus={triggerRef}
            className={clsx(DATA_GRID_THEME_CLASS, styles.popup)}
            data-testid="column-visibility-menu"
          >
            <ColumnVisibilityMenu table={table} searchRef={searchRef} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
