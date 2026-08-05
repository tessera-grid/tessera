import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react'

import { Switch as BaseSwitch } from '@base-ui/react/switch'
import clsx from 'clsx'

import styles from './Switch.module.css'

export type SwitchProps = ComponentPropsWithoutRef<typeof BaseSwitch.Root>

/**
 * Переключатель на базе Base UI (фундамент shadcn). Стилизован под наш набор
 * CSS-переменных (--data-grid-switch-*).
 */
export const Switch = forwardRef<
  ElementRef<typeof BaseSwitch.Root>,
  SwitchProps
>(({ className, ...rest }, ref) => (
  <BaseSwitch.Root
    ref={ref}
    className={clsx(styles.switch, className)}
    {...rest}
  >
    <BaseSwitch.Thumb className={styles.thumb} />
  </BaseSwitch.Root>
))

Switch.displayName = 'Switch'
