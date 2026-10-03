/**
 * Поповер сводки фильтров (ADR 0045, §5): фильтр на строку — колонка, условие,
 * пометка скрытой колонки, сброс; внизу «Сбросить фильтры». `Escape` и клик
 * снаружи закрывают поповер, фокус — на кнопку.
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import {
  setColumnFilterByUser,
  setColumnFiltersByUser,
} from '../../core/filtering'
import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import type { Table } from '../../types'
import { useIcons } from '../../ui/icons'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { optionLabelOf } from '../../core/columnOptions'
import { describeFilter } from './describeFilter'
import type { FilterSummaryItem } from './filterSummary'

import styles from './FilterSummary.module.css'

interface FilterSummaryPopoverProps {
  table: Table<any, any>
  items: FilterSummaryItem[]
  label: string
  icon: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const FilterSummaryPopover = ({
  table,
  items,
  label,
  icon,
  open,
  onOpenChange,
}: FilterSummaryPopoverProps) => {
  const themeClass = usePortalThemeClass()
  const labels = useLocalization()
  const { clear: ClearIcon, hideColumn: HiddenIcon } = useIcons()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const locale = (
    table.options as { columnFilteringDateLocale?: { code?: string } }
  ).columnFilteringDateLocale?.code

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={items.length > 0}
        disabled={items.length === 0}
        data-testid="filter-summary-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, styles.positioner)}
        >
          <Popover.Popup
            aria-label={labels.filters(0, 0)}
            finalFocus={triggerRef}
            className={clsx(themeClass, styles.popup)}
            data-testid="filter-summary"
          >
            <ul className={styles.list}>
              {items.map(item => (
                <li
                  key={item.columnId}
                  className={styles.item}
                  data-column-id={item.columnId}
                  data-hidden-column={item.hidden || undefined}
                >
                  <span className={styles.text}>
                    <span className={styles.header}>{item.header}</span>
                    <span className={styles.condition}>
                      {describeFilter(item.filter, labels, {
                        locale,
                        optionLabel: value =>
                          optionLabelOf(table, item.column, value),
                      })}
                    </span>
                    {item.hidden && (
                      <span className={styles.hidden}>
                        <HiddenIcon width={14} height={14} aria-hidden />
                        {labels.columnHidden}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={labels.removeFilter(item.header)}
                    onClick={() =>
                      setColumnFilterByUser(table, item.columnId, undefined)
                    }
                    data-testid="filter-summary-remove"
                  >
                    <ClearIcon width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.reset}
                onClick={() => setColumnFiltersByUser(table, [])}
                data-testid="filter-summary-reset"
              >
                {labels.resetFilters}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
