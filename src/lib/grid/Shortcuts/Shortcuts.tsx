import { useEffect, useMemo, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'

import {
  keyboardPlatformOf,
  primaryModifier,
} from '../../core/keyboardPlatform'
import {
  keyboardShortcut,
  shortcutSectionLabel,
  type ShortcutSection,
} from '../../core/keyboardShortcut'
import { useLocalization } from '../../core/localization'
import { shortcutDefinitions } from '../../core/shortcuts'
import { Field, SearchField } from '../../ui/Field/Field'
import { useIcons } from '../../ui/icons'
import { PopupItem } from '../../ui/Popup/PopupItem'
import { PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'

import styles from './Shortcuts.module.css'

export const OPEN_SHORTCUTS_EVENT = 'tessera:open-shortcuts'

export const openShortcuts = (table: unknown) => {
  document.dispatchEvent(
    new CustomEvent(OPEN_SHORTCUTS_EVENT, { detail: { table } }),
  )
}

const SECTIONS: readonly ShortcutSection[] = [
  'navigation',
  'selection',
  'editing',
  'moving',
  'menu',
]

interface ShortcutsProps {
  table: unknown
  getRootElement: () => HTMLElement | null
}

export const Shortcuts = ({ table, getRootElement }: ShortcutsProps) => {
  const labels = useLocalization()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { search: SearchIcon } = useIcons()

  useEffect(() => {
    const show = () => {
      const active = document.activeElement as HTMLElement | null
      returnFocus.current = active?.closest(
        '[data-testid="view-settings-popover"]',
      )
        ? document.querySelector<HTMLElement>(
            '[data-testid="view-settings-button"]',
          )
        : active
      setOpen(true)
    }
    const root = getRootElement()
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Slash' ||
        event.altKey ||
        event.shiftKey ||
        !primaryModifier(event, keyboardPlatformOf(table))
      )
        return
      event.preventDefault()
      show()
    }
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<{ table: unknown }>).detail?.table === table)
        show()
    }
    root?.addEventListener('keydown', onKeyDown)
    document.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen)
    return () => {
      root?.removeEventListener('keydown', onKeyDown)
      document.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen)
    }
  }, [getRootElement, table])

  const definitions = shortcutDefinitions(table)
  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return SECTIONS.flatMap(section => {
      const items = definitions.filter(
        definition =>
          definition.section === section &&
          (!needle ||
            definition.label(labels).toLocaleLowerCase().includes(needle)),
      )
      return items.length > 0 ? [{ section, items }] : []
    })
  }, [definitions, labels, query])

  const close = () => {
    setOpen(false)
    setQuery('')
    setTimeout(() => returnFocus.current?.focus(), 0)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={next => (next ? setOpen(true) : close())}
    >
      <Popover.Portal>
        <PopupSurface
          positioner={
            <Popover.Positioner
              anchor={{
                getBoundingClientRect: () =>
                  getRootElement()?.getBoundingClientRect() ?? new DOMRect(),
              }}
              side="bottom"
              align="center"
            />
          }
          popup={
            <Popover.Popup
              aria-label={labels.shortcuts}
              initialFocus={searchRef}
              finalFocus={returnFocus}
              data-testid="keyboard-shortcuts"
            />
          }
          className={styles.popup}
        >
          <PopupPanel title={labels.shortcuts} className={styles.panel}>
            <SearchField
              icon={<SearchIcon width={16} height={16} />}
              clear={
                query
                  ? {
                      label: labels.shortcutsSearch,
                      onClick: () => {
                        setQuery('')
                        searchRef.current?.focus()
                      },
                    }
                  : undefined
              }
            >
              <Field
                ref={searchRef}
                type="search"
                aria-label={labels.shortcutsSearch}
                placeholder={labels.shortcutsSearch}
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </SearchField>
            <div className={styles.list} data-shortcuts-list="">
              {groups.length === 0 && (
                <p className={styles.empty}>{labels.shortcutsEmpty}</p>
              )}
              {groups.map(({ section, items }) => (
                <section key={section} className={styles.group}>
                  <h3 className={styles.title}>
                    {shortcutSectionLabel(labels, section)}
                  </h3>
                  <ul className={styles.items}>
                    {items.map(definition => {
                      const shortcut = keyboardShortcut(
                        table,
                        labels,
                        definition.combo,
                      )
                      return (
                        <PopupItem
                          key={`${definition.section}:${definition.combo}`}
                          render={<li aria-keyshortcuts={shortcut.aria} />}
                          label={definition.label(labels)}
                          hint={shortcut.text}
                        />
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
