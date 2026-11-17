/**
 * Клавиши истории в канале клавиш навигации (ADR 0222, §10; ADR 0232, KX13): `Cmd+Z` на Apple и
 * `Ctrl+Z` на остальных — отменить; повторить — `Cmd+Shift+Z` на Apple, `Ctrl+Y` и `Ctrl+Shift+Z`
 * на остальных; буква — по коду клавиши (ADR 0220). Открытый редактор
 * и поле поиска держат свою отмену: туда клавиши навигации не доходят.
 */
import type {
  NavigationKeyEvent,
  NavigationKeys,
} from '../../core/bodyContributions'
import { step } from './history'
import { editHistoryLabels } from './labels'
import {
  type KeyboardPlatform,
  keyboardPlatformOf,
  primaryModifier,
} from '../../core/keyboardPlatform'

export const directionOfKey = (
  event: NavigationKeyEvent,
  platform: KeyboardPlatform,
): 'undo' | 'redo' | undefined => {
  if (!primaryModifier(event, platform) || event.altKey) return undefined
  if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo'
  if (event.code === 'KeyY' && !event.shiftKey && platform === 'other')
    return 'redo'
  return undefined
}

export const editHistoryKeys: NavigationKeys = {
  id: 'editHistory',
  shortcuts: [
    {
      combo: 'Mod+Z',
      section: 'editing',
      label: labels => editHistoryLabels(labels).undo,
    },
    {
      combo: 'Mod+Shift+Z',
      section: 'editing',
      label: labels => editHistoryLabels(labels).redo,
    },
  ],
  onKey: (event, { table }) => {
    const direction = directionOfKey(event, keyboardPlatformOf(table))
    if (!direction) return false
    void step(table, direction, 'keyboard')
    return true
  },
}
