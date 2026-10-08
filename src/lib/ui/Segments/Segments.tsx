import type { CSSProperties, ReactNode } from 'react'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import clsx from 'clsx'

import styles from './Segments.module.css'

export interface SegmentOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface SegmentsProps<V extends string = string> {
  value: V
  options: SegmentOption<V>[]
  onValueChange: (value: V) => void
  /** Доступное имя группы: `aria-label` или id подписи в `aria-labelledby`. */
  'aria-label'?: string
  'aria-labelledby'?: string
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Сегменты (ADR 0074): выбор одного из немногих коротких вариантов — дорожка с
 * приподнятой рамкой выбранного, которая переезжает к новому выбору. Семантика `radiogroup` Base UI: стрелки переводят
 * выбор, Tab попадает на выбранный.
 */
export const Segments = <V extends string>({
  value,
  options,
  onValueChange,
  disabled,
  className,
  ...rest
}: SegmentsProps<V>) => {
  const index = options.findIndex(option => option.value === value)
  return (
    <RadioGroup
      value={value}
      onValueChange={next => onValueChange(next as V)}
      disabled={disabled}
      className={clsx(styles.track, className)}
      style={{ '--_count': options.length, '--_index': index } as CSSProperties}
      {...rest}
    >
      {/* Рамка выбранного — одна на дорожку и ездит к выбранному сегменту (SG4). */}
      {index >= 0 && <span className={styles.indicator} aria-hidden />}
      {options.map(option => (
        <Radio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={styles.segment}
          data-value={option.value}
        >
          <span className={styles.label}>{option.label}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
