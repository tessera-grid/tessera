/**
 * Модификатор платформы для синтетических клавиш историй (ADR 0232, KX11): `Cmd` на Apple,
 * `Ctrl` на остальных — как ждёт таблица.
 */
import { detectKeyboardPlatform } from '../../core/keyboardPlatform'

export const mod = (): { metaKey: true } | { ctrlKey: true } =>
  detectKeyboardPlatform() === 'apple' ? { metaKey: true } : { ctrlKey: true }

/**
 * Тесты считают платформу «не Apple» на любой машине: сочетания с `Ctrl` в наборах одинаковы на
 * Windows, Linux и Mac разработчика. Свою платформу тест задаёт опцией `keyboardPlatform`.
 */
export const pinTestPlatform = () => {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    get: () => 'Win32',
  })
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    get: () => ({ platform: 'Windows' }),
  })
}
