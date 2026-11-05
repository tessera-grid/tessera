/**
 * Вид флажка без поведения (ADR 0183, PK18; ADR 0172, DT18): значение булевой ячейки. Тот же вид,
 * что у `Checkbox`, но не нажимается и не в порядке фокуса; скринридеру — картинка с именем.
 * Отдельным модулем: ячейки грида рисуют его без Base UI `Checkbox`.
 */
import clsx from 'clsx'

import { useIcons } from '../icons'

import styles from './Checkbox.module.css'

export interface CheckboxViewProps {
  checked: boolean
  indeterminate?: boolean
  /** Значение для скринридера: «Да» или «Нет». */
  label?: string
  className?: string
}

export const CheckboxIcon = ({
  checked,
  indeterminate,
}: Pick<CheckboxViewProps, 'checked' | 'indeterminate'>) => {
  const {
    checkboxChecked: CheckedIcon,
    checkboxIndeterminate: IndeterminateIcon,
  } = useIcons()
  // Ключ иконки из `icons`: какая показана, видно и при своём наборе иконок.
  if (indeterminate)
    return (
      <IndeterminateIcon
        data-icon="checkboxIndeterminate"
        className={styles.icon}
      />
    )
  return checked ? (
    <CheckedIcon data-icon="checkboxChecked" className={styles.icon} />
  ) : null
}

export const CheckboxView = ({
  checked,
  indeterminate,
  label,
  className,
}: CheckboxViewProps) => (
  <span
    role="img"
    aria-label={label}
    data-checked={checked || undefined}
    data-indeterminate={indeterminate || undefined}
    data-readonly=""
    className={clsx('check-mark', styles.checkbox, className)}
  >
    <span className={styles.indicator}>
      <CheckboxIcon checked={checked} indeterminate={indeterminate} />
    </span>
  </span>
)
