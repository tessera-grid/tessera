/**
 * Поповер сводки фильтров (ADR 0045, §5): фильтр на строку — колонка, условие,
 * пометка скрытой колонки, сброс; внизу «Сбросить фильтры». `Escape` и клик
 * снаружи закрывают поповер, фокус — на кнопку.
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'

import {
  setColumnFilterByUser,
  setColumnFiltersByUser,
} from '../../shared/filtering/filtering'
import { Bubble } from '../../ui/Bubble/Bubble'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import { PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { useLocalization } from '../../core/localization'
import type { Table } from '../../types'
import { Button } from '../../ui/Button'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { Tooltip } from '../../ui/Tooltip'
import { filterOptionLabelOf } from '../columnFilteringModel/options'
import { formatDataTypeValue } from '../../core/dataTypeFormat'
import { describeFilter } from './describeFilter'
import type { FilterSummaryItem } from './filterSummary'

import styles from './FilterSummary.module.css'
import { columnFilteringLabels } from './labels'
import { filteringLabels } from '../../shared/filtering/labels'

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
  const labels = useLocalization()
  const { clear: ClearIcon, hideColumn: HiddenIcon } = useIcons()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useScrollFade<HTMLUListElement>()
  const locale = table.options.dateLocale?.code

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={items.length > 0}
        count={items.length}
        disabled={items.length === 0}
        data-testid="filter-summary-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={columnFilteringLabels(labels).filters}
              finalFocus={triggerRef}
              data-testid="filter-summary"
            />
          }
          className={styles.popup}
        >
          <PopupPanel
            title={columnFilteringLabels(labels).filters}
            footer={
              <Button
                variant="ghost"
                onClick={() => setColumnFiltersByUser(table, [])}
                data-testid="filter-summary-reset"
              >
                {filteringLabels(labels).resetFilters}
              </Button>
            }
          >
            <ul ref={listRef} className={styles.list} data-popup-scroller="">
              {items.map(item => {
                const condition = describeFilter(item.filter, labels, {
                  locale,
                  optionLabel: value =>
                    filterOptionLabelOf(table, item.column as never, value),
                  numberText: value =>
                    formatDataTypeValue(table, item.column, value, undefined),
                })
                return (
                  <li
                    key={item.columnId}
                    data-column-id={item.columnId}
                    data-hidden-column={item.hidden || undefined}
                  >
                    <PopupEntry
                      fit
                      mark={<Bubble size="dot" tone="active" />}
                      label={item.header}
                      actions={
                        <ItemButton
                          label={columnFilteringLabels(labels).removeFilter(
                            item.header,
                          )}
                          onClick={() =>
                            setColumnFilterByUser(
                              table,
                              item.columnId,
                              undefined,
                            )
                          }
                          data-testid="filter-summary-remove"
                        >
                          <ClearIcon />
                        </ItemButton>
                      }
                    >
                      <Tooltip title={condition} overflowOnly>
                        <span
                          className={styles.condition}
                          data-filter-condition=""
                        >
                          {condition}
                        </span>
                      </Tooltip>
                      {item.hidden && (
                        <span className={styles.hidden}>
                          <HiddenIcon width={14} height={14} aria-hidden />
                          {columnFilteringLabels(labels).columnHidden}
                        </span>
                      )}
                    </PopupEntry>
                  </li>
                )
              })}
            </ul>
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
