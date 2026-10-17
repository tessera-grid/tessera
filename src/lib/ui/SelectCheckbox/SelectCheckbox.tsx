import { ChangeEvent, memo } from 'react'

import { Checkbox } from '@base-ui/react/checkbox'
import clsx from 'clsx'

import { useIcons } from '../icons'

import styles from './SelectCheckbox.module.css'

export interface SelectCheckboxProps {
  selected: boolean
  indeterminate?: boolean
  disabled?: boolean
  label?: string
  onClick: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void
}

export const SelectCheckbox = memo(
  ({
    selected,
    indeterminate,
    disabled,
    label,
    onClick,
  }: SelectCheckboxProps) => {
    const {
      checkboxChecked: CheckedIcon,
      checkboxIndeterminate: IndeterminateIcon,
    } = useIcons()

    const handleCheckedChange = (
      checked: boolean,
      details?: { event?: Event },
    ) => {
      // Синтезируем минимальное событие: обработчики TanStack читают target.checked,
      // канал действий — тип исходного события (ADR 0125).
      onClick(
        {
          target: { checked },
          nativeEvent: details?.event,
        } as unknown as ChangeEvent<HTMLInputElement>,
        checked,
      )
    }

    return (
      <Checkbox.Root
        className={clsx('row-select-checkbox', styles.checkbox)}
        checked={selected}
        indeterminate={indeterminate}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        aria-label={label}
      >
        <Checkbox.Indicator keepMounted className={styles.indicator}>
          {indeterminate ? (
            <IndeterminateIcon className={styles.icon} />
          ) : selected ? (
            <CheckedIcon className={styles.icon} />
          ) : null}
        </Checkbox.Indicator>
      </Checkbox.Root>
    )
  },
)

SelectCheckbox.displayName = 'SelectCheckbox'
