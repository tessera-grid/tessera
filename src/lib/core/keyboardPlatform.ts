/**
 * Платформа клавиатуры и основной модификатор сочетаний (ADR 0232, §4, KX11): `Cmd` на Apple,
 * `Ctrl` на остальных; второй модификатор сочетание не запускает. Платформу таблица определяет
 * сама, опция ядра `keyboardPlatform` задаёт её явно.
 */

/** Keyboard platform: `apple` means macOS, iPadOS, iOS. */
export type KeyboardPlatform = 'apple' | 'other'

/** Core option: `'auto'` detects it from the browser. */
export type KeyboardPlatformOption = 'auto' | KeyboardPlatform

const APPLE = /mac|iphone|ipad|ipod|ios/i

/** Платформа по браузеру: `userAgentData.platform`, без него — `navigator.platform`. */
export const detectKeyboardPlatform = (): KeyboardPlatform => {
  if (typeof navigator === 'undefined') return 'other'
  const data = (navigator as { userAgentData?: { platform?: string } })
    .userAgentData?.platform
  return APPLE.test(data || navigator.platform || '') ? 'apple' : 'other'
}

/** Платформа таблицы: опция `keyboardPlatform`, без неё — по браузеру. */
export const keyboardPlatformOf = (table: unknown): KeyboardPlatform => {
  const option = (
    table as { options?: { keyboardPlatform?: KeyboardPlatformOption } }
  )?.options?.keyboardPlatform
  return option === 'apple' || option === 'other'
    ? option
    : detectKeyboardPlatform()
}

interface Modifiers {
  ctrlKey: boolean
  metaKey: boolean
}

/** Нажат основной модификатор платформы и не нажат второй. */
export const primaryModifier = (
  event: Modifiers,
  platform: KeyboardPlatform,
): boolean =>
  platform === 'apple'
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey

/** Нажат хоть один модификатор — сочетание, а не одиночная клавиша. */
export const anyModifier = (event: Modifiers & { altKey: boolean }) =>
  event.ctrlKey || event.metaKey || event.altKey
