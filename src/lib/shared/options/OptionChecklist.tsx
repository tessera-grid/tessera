/**
 * Список вариантов с флажками (ADR 0048, §3; ADR 0175, ED9–ED10): виртуализирован, стрелки,
 * Home и End ходят по всему списку, фокус — на одном флажке. Его берут панель фильтра
 * вариантов и редактор `multiSelect`.
 */
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { Checkbox } from '@base-ui/react/checkbox'

import type { ColumnOption, OptionValue } from '../../core/columnOptions'
import { LoadErrorBlock } from '../../ui/LoadMoreError/LoadMoreError'
import { Skeleton } from '../../ui/Skeleton'
import { Stub } from '../../ui/Stub'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'

import checkboxStyles from '../../ui/SelectCheckbox/SelectCheckbox.module.css'
import hidden from '../../ui/visuallyHidden.module.css'
import styles from './OptionChecklist.module.css'

const ROW_HEIGHT = 32
const OVERSCAN = 8
const MAX_VISIBLE_ROWS = 8

export interface OptionChecklistProps {
  id: string
  options: readonly ColumnOption[]
  isSelected: (value: OptionValue) => boolean
  onToggle: (value: OptionValue, checked: boolean) => void
  /** Доступное имя группы флажков. */
  label: string
  busy?: boolean
  /** Счётчики строк по значению — у фильтра. */
  counts?: ReadonlyMap<unknown, number>
  testId: string
}

export const OptionChecklist = ({
  id,
  options,
  isSelected,
  onToggle,
  label,
  busy,
  counts,
  testId,
}: OptionChecklistProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialRect: { width: 0, height: MAX_VISIBLE_ROWS * ROW_HEIGHT },
  })

  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))
  // Виртуализация: фокус — на вариант, когда он смонтирован.
  const [pendingFocus, setPendingFocus] = useState(false)
  // Новый диапазон виртуализатора — новый массив: эффект повторяется после прокрутки.
  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    if (!pendingFocus) return
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"] [role="checkbox"]`,
    )
    if (target) {
      target.focus()
      setPendingFocus(false)
    }
  }, [pendingFocus, activeIndex, virtualItems])

  const onKeyDown = (event: KeyboardEvent) => {
    const last = options.length - 1
    const next =
      event.key === 'ArrowDown'
        ? Math.min(activeIndex + 1, last)
        : event.key === 'ArrowUp'
          ? Math.max(activeIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    setActive(next)
    virtualizer.scrollToIndex(next)
    setPendingFocus(true)
  }

  return (
    <div
      ref={scrollRef}
      className={styles.scroller}
      aria-busy={busy || undefined}
      data-testid={testId}
    >
      <div
        ref={listRef}
        id={id}
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
        role="group"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {virtualItems.map(item => {
          const option = options[item.index]!
          const checked = isSelected(option.value)
          return (
            <div
              key={String(option.value)}
              className={styles.item}
              style={{ transform: `translateY(${item.start}px)` }}
              data-option-index={item.index}
              data-value={String(option.value)}
            >
              <label className={styles.row}>
                <Checkbox.Root
                  className={checkboxStyles.checkbox}
                  checked={checked}
                  onCheckedChange={next => onToggle(option.value, next)}
                  tabIndex={item.index === activeIndex ? 0 : -1}
                  onFocus={() => setActive(item.index)}
                >
                  <Checkbox.Indicator
                    keepMounted
                    className={checkboxStyles.indicator}
                  >
                    {checked && <CheckIcon />}
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <Tooltip title={option.label} overflowOnly>
                  <span className={styles.label}>{option.label}</span>
                </Tooltip>
                {counts && (
                  <span
                    className={styles.count}
                    data-testid="filter-option-count"
                  >
                    {counts.get(option.value) ?? 0}
                  </span>
                )}
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CheckIcon = () => {
  const { checkboxChecked: Icon } = useIcons()
  return <Icon className={checkboxStyles.icon} />
}

/** Подписи состояний списка — от владельца: фильтра или редактора. */
export interface OptionStatusLabels {
  loading: string
  empty: string
  error: string
  retry: string
}

/** Строк-скелетов на месте списка, пока варианты загружаются. */
const SKELETON_ROWS = 4

/**
 * Загрузка, «нет вариантов» или отказ загрузки — вместо списка, компонентами кита (ADR 0175,
 * ED24): строки-скелеты, заглушка `Stub`, блок ошибки загрузки с повтором.
 */
export const OptionStatus = ({
  status,
  labels,
  onRetry,
  reason,
  retryTestId,
}: {
  status: 'loading' | 'empty' | 'error'
  labels: OptionStatusLabels
  onRetry?: () => void
  /** Причина отказа загрузки — из ответа справочника. */
  reason?: string
  retryTestId: string
}) => {
  if (status === 'error')
    return (
      <div className={styles.error} role="alert">
        <LoadErrorBlock
          title={labels.error}
          reason={reason}
          retryLabel={labels.retry}
          onRetry={() => onRetry?.()}
          testId={retryTestId}
        />
      </div>
    )
  if (status === 'empty')
    return (
      <Stub
        className={styles.stub}
        title={labels.empty}
        data-testid="options-empty"
      />
    )
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className={hidden['visually-hidden']}>{labels.loading}</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton width={`${70 - index * 10}%`} height={10} />
        </div>
      ))}
    </div>
  )
}
