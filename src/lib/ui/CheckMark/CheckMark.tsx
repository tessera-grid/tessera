import clsx from 'clsx'

import { useIcons } from '../icons'

import styles from './CheckMark.module.css'

export interface CheckMarkProps {
  checked: boolean
  /** Текст значения для скринридера: «Да» или «Нет». */
  label: string
  className?: string
}

/**
 * Значок булева значения (ADR 0172, DT18): вид флажка выбора без роли контрола — его
 * нельзя нажать и он не в порядке фокуса; скринридеру — подпись значения.
 */
export const CheckMark = ({ checked, label, className }: CheckMarkProps) => {
  const { checkboxChecked: CheckedIcon } = useIcons()
  return (
    <span
      role="img"
      aria-label={label}
      data-checked={checked || undefined}
      className={clsx('check-mark', styles.mark, className)}
    >
      {checked && <CheckedIcon aria-hidden className={styles.icon} />}
    </span>
  )
}

CheckMark.displayName = 'CheckMark'
