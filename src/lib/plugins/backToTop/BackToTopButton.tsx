/**
 * Кнопка «наверх» в нижней панели (ADR 0082). Место держится всегда — меняется
 * только видимость (BT4); после нажатия кнопка ждёт ухода фокуса в состоянии
 * `aria-disabled` (BT8).
 */
import { useEffect, useRef, useState } from 'react'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import styles from './BackToTop.module.css'
import { findGridScroller, jumpToTop, watchThreshold } from './model'

const ICON_SIZE = 16

export const BackToTopButton = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const ref = useRef<HTMLButtonElement>(null)
  const [past, setPast] = useState(false)
  const [focused, setFocused] = useState(false)
  const threshold = (table.options as { backToTopThreshold?: number })
    .backToTopThreshold

  useEffect(() => {
    const scroller = findGridScroller(ref.current)
    if (!scroller) {
      return
    }
    return watchThreshold(scroller, threshold, setPast)
  }, [threshold])

  const shown = past || focused

  return (
    <span className={styles.slot} data-shown={shown || undefined}>
      <IconButton
        ref={ref}
        label={labels.backToTop}
        shape="square"
        disabled={!past}
        tooltipWhenDisabled
        data-testid="back-to-top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => {
          // Safari не фокусирует кнопку по клику: без фокуса она скрылась бы сразу.
          ref.current?.focus({ preventScroll: true })
          const scroller = findGridScroller(ref.current)
          if (past && scroller) {
            jumpToTop(table, scroller)
          }
        }}
      >
        <icons.backToTop width={ICON_SIZE} height={ICON_SIZE} />
      </IconButton>
    </span>
  )
}
