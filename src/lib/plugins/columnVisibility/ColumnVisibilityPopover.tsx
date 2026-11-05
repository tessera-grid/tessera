/**
 * Поповер меню колонок на Base UI Popover. Живёт в отдельном чанке: открытием
 * управляет эагерная кнопка (`ColumnVisibilityButton`), поэтому клик до догрузки
 * не теряется. `Escape` и клик снаружи закрывают поповер, фокус — на кнопку.
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'

import { useLocalization } from '../../core/localization'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import type { Table } from '../../types'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'

import styles from './ColumnVisibilityMenu.module.css'
import { columnVisibilityLabels } from './labels'

export interface ColumnVisibilityPopoverProps {
  table: Table<any, any>
  /** Подпись кнопки: с числом скрытых колонок, когда они есть. */
  label: string
  icon: ReactNode
  /** Сколько колонок скрыто — число бабла кнопки (ADR 0129). */
  count: number
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ColumnVisibilityPopover = ({
  table,
  label,
  icon,
  active,
  count,
  open,
  onOpenChange,
}: ColumnVisibilityPopoverProps) => {
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={active}
        count={count}
        data-testid="column-visibility-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={columnVisibilityLabels(labels).columns}
              initialFocus={searchRef}
              finalFocus={triggerRef}
              data-testid="column-visibility-menu"
            />
          }
          className={styles.popup}
        >
          <ColumnVisibilityMenu table={table} searchRef={searchRef} />
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
