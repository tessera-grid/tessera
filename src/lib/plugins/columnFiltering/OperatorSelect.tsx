/** Выбор условия фильтра колонки (ADR 0045, §4): общий у панелей всех типов. */
import type { RefObject } from 'react'

import { Select } from '@base-ui/react/select'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { useTriggerWidth } from '../../ui/Popup/useTriggerWidth'

import styles from './FilterPanel.module.css'

interface OperatorSelectProps<T extends string> {
  value: T
  operators: readonly T[]
  labelOf: (operator: T) => string
  onChange: (operator: T) => void
  triggerRef?: RefObject<HTMLElement | null>
}

export const OperatorSelect = <T extends string>({
  value,
  operators,
  labelOf,
  onChange,
  triggerRef,
}: OperatorSelectProps<T>) => {
  const labels = useLocalization()
  const themeClass = usePortalThemeClass()
  const trigger = useTriggerWidth(triggerRef)
  return (
    <Select.Root
      value={value}
      onOpenChange={trigger.onOpenChange}
      onValueChange={next => {
        if (next !== null) onChange(next)
      }}
    >
      <Select.Trigger
        ref={trigger.ref}
        className={styles.trigger}
        aria-label={labels.filterCondition}
        data-testid="filter-operator"
      >
        <Select.Value>{labelOf(value)}</Select.Value>
        <Select.Icon className={styles.triggerIcon}>
          <ChevronDown width={14} height={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={POPUP_SIDE_OFFSET}
          alignItemWithTrigger={false}
          className={clsx(themeClass, styles.selectPositioner)}
        >
          <Select.Popup
            className={clsx(themeClass, styles.selectPopup)}
            style={{ minWidth: trigger.minWidth }}
          >
            <Select.List>
              {operators.map(operator => (
                <Select.Item
                  key={operator}
                  value={operator}
                  className={styles.selectItem}
                  data-operator={operator}
                >
                  <Select.ItemText>{labelOf(operator)}</Select.ItemText>
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
