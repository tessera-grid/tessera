import { keyboardPlatformOf } from './keyboardPlatform'
import type { TableLabels } from './localization'

export type ShortcutSection =
  'navigation' | 'selection' | 'editing' | 'moving' | 'menu'

export interface KeyboardShortcutDefinition {
  combo: string
  section: ShortcutSection
  label: (labels: TableLabels) => string
}

export interface ShortcutView {
  text: string
  aria: string
}

const KEYS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Enter: 'Enter',
  Escape: 'Esc',
  ' ': 'Space',
}

/** Сочетание в виде платформы и в синтаксисе `aria-keyshortcuts`. */
export const keyboardShortcut = (
  table: unknown,
  labels: TableLabels,
  combo: string,
): ShortcutView => {
  const apple = keyboardPlatformOf(table) === 'apple'
  const parts = combo.split('+')
  const key = parts.pop()!
  const modifiers = parts.map(part => {
    if (part === 'Mod') return apple ? labels.shortcutCmd : labels.shortcutCtrl
    if (part === 'Alt')
      return apple ? labels.shortcutOption : labels.shortcutAlt
    if (part === 'Shift')
      return apple ? labels.shortcutShiftApple : labels.shortcutShift
    return part
  })
  const ariaModifiers = parts.map(part =>
    part === 'Mod' ? (apple ? 'Meta' : 'Control') : part,
  )
  return {
    text: [...modifiers, KEYS[key] ?? key].join(apple ? '' : '+'),
    aria: [...ariaModifiers, key].join('+'),
  }
}

export const shortcutTitle = (
  table: unknown,
  labels: TableLabels,
  label: string,
  combo: string,
) => `${label} · ${keyboardShortcut(table, labels, combo).text}`

export const shortcutSectionLabel = (
  labels: TableLabels,
  section: ShortcutSection,
) =>
  ({
    navigation: labels.shortcutNavigation,
    selection: labels.shortcutSelection,
    editing: labels.shortcutEditing,
    moving: labels.shortcutMoving,
    menu: labels.shortcutMenu,
  })[section]
