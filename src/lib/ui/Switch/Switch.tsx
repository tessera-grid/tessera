import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react'

import { Switch as BaseSwitch } from '@base-ui/react/switch'
import clsx from 'clsx'

import { usePendingControl } from '../buttonStates/useButtonStates'

import styles from './Switch.module.css'

export type SwitchProps = ComponentPropsWithoutRef<typeof BaseSwitch.Root> & {
  /** Ждёт сохранения: дуга по контуру, `aria-busy`, нажатия игнорируются (ADR 0176, AC5). */
  pending?: boolean
}

/**
 * Переключатель на базе Base UI (фундамент shadcn). Стилизован под наш набор
 * CSS-переменных (--tsr-comp-switch-*).
 */
export const Switch = forwardRef<
  ElementRef<typeof BaseSwitch.Root>,
  SwitchProps
>(({ className, pending = false, onCheckedChange, ...rest }, ref) => {
  const busy = usePendingControl(pending)
  return (
    <span {...busy.host}>
      <BaseSwitch.Root
        ref={ref}
        className={clsx(styles.switch, busy.control.className, className)}
        aria-busy={busy.control['aria-busy']}
        data-pending-outside={busy.control['data-pending-outside']}
        data-pending-leaving={busy.control['data-pending-leaving']}
        onCheckedChange={(checked, details) => {
          if (!pending) onCheckedChange?.(checked, details)
        }}
        {...rest}
      >
        <BaseSwitch.Thumb className={styles.thumb} />
      </BaseSwitch.Root>
      {busy.arc}
    </span>
  )
})

Switch.displayName = 'Switch'
