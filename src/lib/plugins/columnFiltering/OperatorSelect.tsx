/** Выбор условия фильтра колонки (ADR 0045, §4): общий у панелей всех типов. */
import type { RefObject } from 'react'

import { Select } from '@base-ui/react/select'

import { PopupItem, PopupItemMark } from '../../ui/Popup/PopupItem'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { SelectTrigger } from '../../ui/SelectTrigger/SelectTrigger'
import { useLocalization } from '../../core/localization'
import { useTriggerWidth } from '../../ui/Popup/useTriggerWidth'

import styles from './FilterPanel.module.css'
import { columnFilteringLabels } from './labels'

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
  const {
    setTrigger,
    onOpenChange: measureTrigger,
    minWidth,
  } = useTriggerWidth()
  return (
    <Select.Root
      value={value}
      onOpenChange={measureTrigger}
      onValueChange={next => {
        if (next !== null) onChange(next)
      }}
    >
      <Select.Trigger
        ref={node => {
          setTrigger(node)
          if (triggerRef) triggerRef.current = node
        }}
        render={<SelectTrigger className={styles.trigger} />}
        aria-label={columnFilteringLabels(labels).filterCondition}
        data-testid="filter-operator"
      >
        <Select.Value>{labelOf(value)}</Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <PopupSurface
          positioner={
            <Select.Positioner
              side="bottom"
              align="start"
              alignItemWithTrigger={false}
            />
          }
          popup={<Select.Popup style={{ minWidth }} />}
        >
          <Select.List>
            {operators.map(operator => (
              <PopupItem
                key={operator}
                render={<Select.Item value={operator} />}
                data-operator={operator}
                label={
                  <Select.ItemText render={<span />}>
                    {labelOf(operator)}
                  </Select.ItemText>
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
