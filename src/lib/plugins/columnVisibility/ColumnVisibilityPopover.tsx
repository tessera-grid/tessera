/**
 * Поповер меню колонок на Base UI Popover. Живёт в отдельном чанке: открытием
 * управляет эагерная кнопка (`ColumnVisibilityButton`), поэтому клик до догрузки
 * не теряется. `Escape` и клик снаружи закрывают поповер, фокус — на кнопку.
 */
import { type ReactNode, useRef, useState } from 'react'

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
  /** `details` — подробности Base UI: источник открытия для канала действий. */
  onOpenChange: (open: boolean, details?: unknown) => void
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
  // Каждое открытие — свой сеанс меню: подсказки «остаются» прошлого открытия не переживают
  // повторное открытие во время ухода поповера (ADR 0204, HT6).
  const [session, setSession] = useState(0)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) setSession(value => value + 1)
        onOpenChange(next, details)
      }}
    >
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
          <ColumnVisibilityMenu
            key={session}
            table={table}
            searchRef={searchRef}
          />
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
