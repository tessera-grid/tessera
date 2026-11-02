import { ChangeEvent, memo } from 'react'

import { Checkbox } from '@base-ui/react/checkbox'
import clsx from 'clsx'

import { usePendingControl } from '../buttonStates/useButtonStates'
import { useIcons } from '../icons'

import styles from './SelectCheckbox.module.css'

export interface SelectCheckboxProps {
  selected: boolean
  indeterminate?: boolean
  disabled?: boolean
  label?: string
  /** `0` — флажок в порядке Tab и внутри композита Base UI (поповер тулбара). */
  tabIndex?: number
  /** Ждёт сохранения: дуга по контуру, `aria-busy`, нажатия игнорируются (ADR 0176, AC5). */
  pending?: boolean
  onClick: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void
}

export const SelectCheckbox = memo(
  ({
    selected,
    indeterminate,
    disabled,
    label,
    tabIndex,
    pending,
    onClick,
  }: SelectCheckboxProps) => {
    const {
      checkboxChecked: CheckedIcon,
      checkboxIndeterminate: IndeterminateIcon,
    } = useIcons()
    const busy = usePendingControl(!!pending)

    const handleCheckedChange = (
      checked: boolean,
      details?: { event?: Event },
    ) => {
      if (pending) return
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
      <span {...busy.host}>
        <Checkbox.Root
          className={clsx(
            'row-select-checkbox',
            styles.checkbox,
            busy.control.className,
          )}
          checked={selected}
          indeterminate={indeterminate}
          onCheckedChange={handleCheckedChange}
          disabled={disabled}
          // Явный `undefined` перебил бы tabindex самого Base UI.
          {...(tabIndex === undefined ? {} : { tabIndex })}
          aria-label={label}
          aria-busy={busy.control['aria-busy']}
          data-pending-outside={busy.control['data-pending-outside']}
          data-pending-leaving={busy.control['data-pending-leaving']}
        >
          <Checkbox.Indicator keepMounted className={styles.indicator}>
            {indeterminate ? (
              <IndeterminateIcon className={styles.icon} />
            ) : selected ? (
              <CheckedIcon className={styles.icon} />
            ) : null}
          </Checkbox.Indicator>
        </Checkbox.Root>
        {busy.arc}
      </span>
    )
  },
)

SelectCheckbox.displayName = 'SelectCheckbox'
