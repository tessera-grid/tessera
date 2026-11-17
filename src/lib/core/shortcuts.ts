import { bodyOf } from './bodyContributions'
import type { KeyboardShortcutDefinition } from './keyboardShortcut'

const CORE_NAVIGATION: readonly KeyboardShortcutDefinition[] = [
  {
    combo: 'ArrowUp',
    section: 'navigation',
    label: labels => labels.shortcutMoveCell,
  },
  {
    combo: 'Home',
    section: 'navigation',
    label: labels => labels.shortcutCellEdge,
  },
  {
    combo: 'PageDown',
    section: 'navigation',
    label: labels => labels.shortcutPage,
  },
  {
    combo: 'Mod+Enter',
    section: 'navigation',
    label: labels => labels.shortcutActionMode,
  },
]

/** Сочетания включённых плагинов и ядра для сводки текущей таблицы (ADR 0232, KX18). */
export const shortcutDefinitions = (
  table: unknown,
): KeyboardShortcutDefinition[] => {
  const t = table as {
    options?: { enableKeyboardNavigation?: boolean }
    getKeyboardActions?: () => { shortcut?: KeyboardShortcutDefinition }[]
  }
  const definitions = [
    ...(t.getKeyboardActions?.() ?? []).flatMap(action =>
      action.shortcut ? [action.shortcut] : [],
    ),
    ...bodyOf(table).keys.flatMap(keys => keys.shortcuts ?? []),
  ]
  if (t.options?.enableKeyboardNavigation) {
    definitions.push(...CORE_NAVIGATION)
  }
  definitions.push({
    combo: 'Mod+/',
    section: 'menu',
    label: labels => labels.shortcuts,
  })
  return definitions.filter(
    (definition, index) =>
      definitions.findIndex(
        other =>
          other.combo === definition.combo &&
          other.section === definition.section &&
          other.label === definition.label,
      ) === index,
  )
}
