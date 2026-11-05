/**
 * Выбор размера страницы на Base UI Select (PG4). Грузится отдельным чанком:
 * позиционирование тянет floating-ui. Открытие контролирует обёртка: клик по её
 * заглушке до загрузки открывает список после неё (PG20).
 */
import { useId } from 'react'

import { Select } from '@base-ui/react/select'

import { PopupItem, PopupItemMark } from '../../ui/Popup/PopupItem'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import styles from './Pagination.module.css'
import { useTriggerWidth } from '../../ui/Popup/useTriggerWidth'
import { SelectTrigger } from '../../ui/SelectTrigger/SelectTrigger'

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
  const labelId = useId()
  const triggerId = useId()
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
      {/* Своя подпись, а не Select.Label: Base UI заменяет её id своим. */}
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      {/* Имя — подпись и видимое значение, как у заглушки до загрузки (WCAG 2.5.3, PG21). */}
      <Select.Trigger
        id={triggerId}
        aria-labelledby={`${labelId} ${triggerId}`}
        ref={setTrigger}
        render={<SelectTrigger />}
        data-testid="page-size-select"
      >
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <PopupSurface
          positioner={
            <Select.Positioner
              side="bottom"
              align="end"
              alignItemWithTrigger={false}
            />
          }
          popup={<Select.Popup style={{ minWidth }} />}
        >
          <Select.List>
            {pageSizes.map(size => (
              <PopupItem
                key={size}
                render={<Select.Item value={size} />}
                label={
                  <Select.ItemText render={<span />}>{size}</Select.ItemText>
                }
                end={
                  <PopupItemMark
                    render={<Select.ItemIndicator />}
                    status="checked"
                  />
                }
              />
            ))}
          </Select.List>
        </PopupSurface>
      </Select.Portal>
    </Select.Root>
  )
}
