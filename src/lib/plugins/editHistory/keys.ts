/**
 * Клавиши истории в канале клавиш навигации (ADR 0222, §10): Ctrl/Cmd+Z — отменить,
 * Ctrl/Cmd+Shift+Z и Ctrl+Y — повторить; буква — по коду клавиши (ADR 0220). Открытый редактор
 * и поле поиска держат свою отмену: туда клавиши навигации не доходят.
 */
import type {
  NavigationKeyEvent,
  NavigationKeys,
} from '../../core/bodyContributions'
import { step } from './history'

const ctrl = (event: NavigationKeyEvent) =>
  (event.ctrlKey || event.metaKey) && !event.altKey

export const directionOfKey = (
  event: NavigationKeyEvent,
): 'undo' | 'redo' | undefined => {
  if (!ctrl(event)) return undefined
  if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo'
  if (event.code === 'KeyY' && !event.shiftKey) return 'redo'
  return undefined
}

export const editHistoryKeys: NavigationKeys = {
  id: 'editHistory',
  onKey: (event, { table }) => {
    const direction = directionOfKey(event)
    if (!direction) return false
    void step(table, direction, 'keyboard')
    return true
  },
}
