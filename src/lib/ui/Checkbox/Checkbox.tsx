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

import styles from './Checkbox.module.css'

export interface CheckboxProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  /** Имя флажка; в режиме `readOnly` — значение для скринридера: «Да» или «Нет». */
  label?: string
  /**
   * Только значение (ADR 0172, DT18): тот же вид, но не нажимается и не в порядке фокуса;
   * скринридеру — картинка с именем `label`.
   */
  readOnly?: boolean
  /** `0` — флажок в порядке Tab и внутри композита Base UI (поповер тулбара). */
  tabIndex?: number
  /** Ждёт сохранения: дуга по контуру, `aria-busy`, нажатия игнорируются (ADR 0176, AC5). */
  pending?: boolean
  /** Значение не принято: рамка цветом ошибки, `aria-invalid`. */
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

    return (
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
  },
)
Checkbox.displayName = 'Checkbox'
