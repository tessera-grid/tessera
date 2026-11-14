/**
 * Фильтр видов записей консоли (ADR 0124, CL8): кнопка «Фильтры» и поповер, как меню
 * колонок, — строки с галочками и «Показать все».
 */
import { useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

import { contrastAttribute, portalThemeClass } from '../../ui/theme/portalTheme'
import type { ContrastMode } from '../../ui/theme/types'
import { Button } from '../../ui/Button'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { Checkbox } from '../../ui/Checkbox/Checkbox'
import { useStoryLocale } from '../__mocks__/storyLocale'
import type { ConsoleKind } from './consoleLog'
import { shellText } from './storyShell'

import styles from './ConsoleFilters.module.css'

export const ConsoleFilters = ({
  kinds,
  labels,
  colors,
  hidden,
  onToggle,
  onShowAll,
}: {
  kinds: readonly ConsoleKind[]
  labels: Record<ConsoleKind, string>
  /** Метка вида — та же, что у записей в списке. */
  colors: Record<ConsoleKind, string>
  hidden: ReadonlySet<ConsoleKind>
  onToggle: (kind: ConsoleKind) => void
  onShowAll: () => void
}) => {
  const locale = useStoryLocale()
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Портал — в body: тему и контраст истории он берёт у предка кнопки при открытии.
  const [theme, setTheme] = useState({
    dark: false,
    contrast: undefined as ContrastMode | undefined,
  })
  return (
    <Popover.Root
      onOpenChange={open => {
        const trigger = triggerRef.current
        if (!open || !trigger) return
        setTheme({
          dark: trigger.closest('.dark') !== null,
          contrast:
            (trigger
              .closest('[data-tsr-contrast]')
              ?.getAttribute('data-tsr-contrast') as ContrastMode | null) ??
            undefined,
        })
      }}
    >
      <Popover.Trigger
        ref={triggerRef}
        render={props => (
          <Button
            {...props}
            variant="outline"
            data-testid="story-console-filters"
          >
            {shellText(locale, 'consoleFilters')}
            <span aria-hidden="true" className={styles.chevron}>
              <ChevronDown width={14} height={14} />
            </span>
          </Button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(portalThemeClass(theme.dark), styles.positioner)}
          data-tsr-contrast={contrastAttribute(theme.contrast)}
        >
          <Popover.Popup
            aria-label={shellText(locale, 'consoleFiltersMenu')}
            finalFocus={triggerRef}
            className={clsx(portalThemeClass(theme.dark), styles.popup)}
            data-testid="story-console-filters-menu"
          >
            <div className={styles.menu}>
              <ul className={styles.list}>
                {kinds.map(kind => (
                  <li key={kind}>
                    <label className={styles.row} data-console-filter={kind}>
                      <Checkbox
                        checked={!hidden.has(kind)}
                        label={labels[kind]}
                        onCheckedChange={() => onToggle(kind)}
                      />
                      <span
                        aria-hidden="true"
                        className={styles.dot}
                        style={{ background: colors[kind] }}
                      />
                      <span>{labels[kind]}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className={styles.footer}>
                <Button
                  variant="ghost"
                  disabled={hidden.size === 0}
                  onClick={onShowAll}
                >
                  {shellText(locale, 'consoleShowAll')}
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
