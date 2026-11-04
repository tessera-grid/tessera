/**
 * Кнопки «наверх» и «к первой колонке» в нижней панели (ADR 0082, ADR 0105). Место
 * держится всегда — меняется только видимость (BT4); у «к первой колонке» — только пока
 * тело прокручивается по горизонтали (BT18). После нажатия кнопка ждёт ухода фокуса в
 * состоянии `aria-disabled` (BT8).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import { useEffect, useRef, useState } from 'react'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { scrollLayer } from '../../core/scrollStretch'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import styles from './BackToTop.module.css'
import {
  type EdgeAxis,
  findGridScroller,
  scrollToStart,
  scrollToTop,
  scrollsHorizontally,
  watchThreshold,
} from './model'
import { backToTopLabels } from './labels'

const ICON_SIZE = 16

interface EdgeOptions {
  backToTopThreshold?: number
  backToTopHorizontalThreshold?: number
  backToTopAxes?: 'vertical' | 'horizontal' | 'both'
}

/** Следит, прокручивается ли тело по горизонтали: ширина колонок и области меняется. */
const useScrollsHorizontally = (
  slot: { current: HTMLElement | null },
  active: boolean,
) => {
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const scroller = findGridScroller(slot.current)
    if (!active || !scroller) {
      return
    }
    const check = () => setScrolls(scrollsHorizontally(scroller))
    check()
    const observer = new ResizeObserver(check)
    observer.observe(scroller)
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild)
    return () => observer.disconnect()
  }, [slot, active])
  return scrolls
}

const EdgeButton = ({
  table,
  axis,
}: StatusBarComponentProps & { axis: EdgeAxis }) => {
  const labels = useLocalization()
  const icons = useIcons()
  const slot = useRef<HTMLSpanElement>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const [past, setPast] = useState(false)
  const [focused, setFocused] = useState(false)
  const options = table.options as EdgeOptions
  const axes = options.backToTopAxes ?? 'both'
  const enabled = axes === 'both' || axes === axis
  const horizontal = axis === 'horizontal'
  const threshold = horizontal
    ? options.backToTopHorizontalThreshold
    : options.backToTopThreshold
  const scrolls = useScrollsHorizontally(slot, enabled && horizontal)

  useEffect(() => {
    const scroller = findGridScroller(slot.current)
    if (!enabled || !scroller) {
      return
    }
    return watchThreshold(scrollLayer(scroller).area, threshold, setPast, axis)
  }, [enabled, threshold, axis])

  if (!enabled) {
    return null
  }

  const shown = past || focused
  const Icon = horizontal ? icons.backToStart : icons.backToTop

  return (
    <span
      ref={slot}
      className={styles.slot}
      data-shown={shown || undefined}
      hidden={horizontal && !scrolls}
    >
      <IconButton
        ref={ref}
        label={
          horizontal
            ? backToTopLabels(labels).backToStart
            : backToTopLabels(labels).backToTop
        }
        shape="square"
        disabled={!past}
        tooltipWhenDisabled
        data-testid={horizontal ? 'back-to-start' : 'back-to-top'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={event => {
          reportAction(table, {
            plugin: 'backToTop',
            action: horizontal ? 'scrollToStart' : 'scrollToTop',
            source: sourceOf(event),
          })
          // Safari не фокусирует кнопку по клику: без фокуса она скрылась бы сразу.
          ref.current?.focus({ preventScroll: true })
          const scroller = findGridScroller(slot.current)
          if (past && scroller) {
            ;(horizontal ? scrollToStart : scrollToTop)(table, scroller)
          }
        }}
      >
        <Icon width={ICON_SIZE} height={ICON_SIZE} />
      </IconButton>
    </span>
  )
}

export const BackToTopButton = (props: StatusBarComponentProps) => (
  <EdgeButton {...props} axis="vertical" />
)

export const BackToStartButton = (props: StatusBarComponentProps) => (
  <EdgeButton {...props} axis="horizontal" />
)
