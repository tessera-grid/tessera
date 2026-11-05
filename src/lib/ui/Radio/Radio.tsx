/**
 * Радио кита (ADR 0183, PK14) поверх Base UI `Radio`: кружок с точкой выбранного, кольцо фокуса,
 * выключенное, высокая контрастность. Строку с подписью собирает `PopupItem`.
 */
import type { ComponentPropsWithoutRef } from 'react'
import { forwardRef } from 'react'

import { Radio as BaseRadio } from '@base-ui/react/radio'
import clsx from 'clsx'

import styles from './Radio.module.css'

export type RadioProps = Omit<
  ComponentPropsWithoutRef<typeof BaseRadio.Root>,
  'children'
>

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(
  ({ className, ...rest }, ref) => (
    <BaseRadio.Root
      {...rest}
      ref={ref}
      className={clsx(styles.radio, className as string | undefined)}
    >
      <BaseRadio.Indicator className={styles.dot} data-radio-dot="" />
    </BaseRadio.Root>
  ),
)
Radio.displayName = 'Radio'
