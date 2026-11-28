/**
 * Флажок кита (ADR 0183, PK15, PK18) поверх Base UI `Checkbox`: отмечен, частично, выключен,
 * ожидание дугой снаружи (ADR 0176, AC5), ошибка. Один на всю таблицу: выбор строк и колонок,
 * список вариантов, правка булевой ячейки и — в режиме `readOnly` — значение булевой ячейки.
 */
import type { FocusEventHandler, KeyboardEventHandler, Ref } from 'react'
import { forwardRef } from 'react'

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import clsx from 'clsx'

import { usePendingControl } from '../buttonStates/useButtonStates'
import { CheckboxIcon, CheckboxView } from './CheckboxView'
import { Tooltip } from '../Tooltip'

import styles from './Checkbox.module.css'

export interface CheckboxProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  /** Checkbox name; in `readOnly` mode — the value for screen readers: "Yes" or "No". */
  label?: string
  /** Tooltip, for example a keyboard shortcut; none by default. */
  tooltip?: string
  'aria-keyshortcuts'?: string
  /**
   * Value only (ADR 0172, DT18): the same look, but not pressable and not in the focus order;
   * screen readers get an image named `label`.
   */
  readOnly?: boolean
  /** `0` — the checkbox is in the Tab order and inside a Base UI composite (a toolbar popover). */
  tabIndex?: number
  /** Waiting to be saved: an arc along the outline, `aria-busy`, presses are ignored (ADR 0176, AC5). */
  pending?: boolean
  /** The value wasn't accepted: an error-colored border, `aria-invalid`. */
  invalid?: boolean
  'aria-describedby'?: string
  className?: string
  onCheckedChange?: (checked: boolean, event: Event | undefined) => void
  onFocus?: FocusEventHandler<HTMLElement>
  onBlur?: FocusEventHandler<HTMLElement>
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}

export const Checkbox = forwardRef<HTMLElement, CheckboxProps>(
  (
    {
      checked,
      indeterminate,
      disabled,
      label,
      tooltip,
      readOnly,
      tabIndex,
      pending,
      invalid,
      className,
      onCheckedChange,
      ...rest
    },
    ref,
  ) => {
    const busy = usePendingControl(!!pending)

    if (readOnly) {
      return (
        <CheckboxView
          checked={checked}
          indeterminate={indeterminate}
          label={label}
          className={className}
        />
      )
    }

    const control = (
      <span {...busy.host}>
        <BaseCheckbox.Root
          {...rest}
          ref={ref as Ref<HTMLSpanElement>}
          className={clsx(styles.checkbox, busy.control.className, className)}
          checked={checked}
          indeterminate={indeterminate}
          onCheckedChange={(next, details) => {
            if (pending) return
            onCheckedChange?.(next, details?.event)
          }}
          disabled={disabled}
          {...(tabIndex === undefined ? {} : { tabIndex })}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-busy={busy.control['aria-busy']}
          data-pending-outside={busy.control['data-pending-outside']}
          data-pending-leaving={busy.control['data-pending-leaving']}
        >
          <BaseCheckbox.Indicator keepMounted className={styles.indicator}>
            <CheckboxIcon checked={checked} indeterminate={indeterminate} />
          </BaseCheckbox.Indicator>
        </BaseCheckbox.Root>
        {busy.arc}
      </span>
    )
    return tooltip ? (
      <Tooltip title={tooltip} longPress>
        {control}
      </Tooltip>
    ) : (
      control
    )
  },
)
Checkbox.displayName = 'Checkbox'
