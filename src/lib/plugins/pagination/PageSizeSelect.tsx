/**
 * Выбор размера страницы на Base UI Select (PG4). Грузится отдельным чанком:
 * позиционирование тянет floating-ui. Открытие контролирует обёртка: клик по её
 * заглушке до загрузки открывает список после неё (PG20).
 */
import { Select } from '@base-ui/react/select'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

import { usePortalThemeClass } from '../../core/themeVariables'
import styles from './Pagination.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { useTriggerWidth } from '../../ui/Popup/useTriggerWidth'

export interface PageSizeSelectProps {
  label: string
  pageSize: number
  pageSizes: number[]
  onChange: (pageSize: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PageSizeSelect = ({
  label,
  pageSize,
  pageSizes,
  onChange,
  open,
  onOpenChange,
}: PageSizeSelectProps) => {
  const themeClass = usePortalThemeClass()
  const {
    setTrigger,
    onOpenChange: measureTrigger,
    minWidth,
  } = useTriggerWidth()
  return (
    <Select.Root
      value={pageSize}
      open={open}
      onOpenChange={next => {
        measureTrigger(next)
        onOpenChange(next)
      }}
      onValueChange={value => {
        if (value !== null) {
          onChange(value)
        }
      }}
    >
      <Select.Label className={styles.label}>{label}</Select.Label>
      <Select.Trigger
        ref={setTrigger}
        className={styles.trigger}
        data-testid="page-size-select"
      >
        <Select.Value />
        <Select.Icon className={styles.triggerIcon}>
          <ChevronDown width={14} height={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          alignItemWithTrigger={false}
          className={clsx(themeClass, styles.positioner)}
        >
          <Select.Popup
            className={clsx(themeClass, styles.popup)}
            style={{ minWidth }}
          >
            <Select.List>
              {pageSizes.map(size => (
                <Select.Item key={size} value={size} className={styles.item}>
                  <Select.ItemText>{size}</Select.ItemText>
                  <Select.ItemIndicator className={styles.itemCheck}>
                    <Check width={14} height={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
