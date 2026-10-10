/**
 * Кнопка «наверх» в нижней панели (ADR 0082). Место держится всегда — меняется
 * только видимость (BT4); после нажатия кнопка ждёт ухода фокуса в состоянии
 * `aria-disabled` (BT8).
 */
import { useEffect, useRef, useState } from 'react'

import { Button } from '@base-ui/react/button'

import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { Tooltip } from '../../ui/Tooltip'
import buttonStyles from '../../ui/ToolbarButton/ToolbarButton.module.css'
import { useIcons } from '../../ui/icons'
import styles from './BackToTop.module.css'
import { findGridScroller, jumpToTop, watchThreshold } from './model'

const ICON_SIZE = 18

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
      <Tooltip title={labels.backToTop}>
        <Button
          ref={ref}
          type="button"
          aria-label={labels.backToTop}
          disabled={!past}
          focusableWhenDisabled
          className={buttonStyles.toolbarButton}
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
        </Button>
      </Tooltip>
    </span>
  )
}
