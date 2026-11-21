import { useCallback, useSyncExternalStore } from 'react'

/**
 * Последний ввод — клавиатура, указатель или палец (ADR 0084, CB5; ADR 0231, §2): признак на корне
 * документа рисует кольцо фокуса и там, где браузер не даёт `:focus-visible` фокусу
 * от скрипта — Firefox после ввода мышью. Корень, а не грид: календарь фильтра — в
 * портале. Слушатели ставятся один раз на документ.
 */
export const INPUT_MODALITY_ATTR = 'data-tsr-input'

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
const listeners = new Set<() => void>()

let tracking = false

/** Ввод пальцем: последний ввод — касание или указатель грубый (ADR 0231, §8). */
export const isTouchInput = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.getAttribute(INPUT_MODALITY_ATTR) === 'touch' ||
    (typeof matchMedia === 'function' &&
      matchMedia('(pointer: coarse)').matches))

export const setInputModality = (value: 'touch' | 'pointer' | 'keyboard') => {
  trackInputModality()
  document.documentElement.setAttribute(INPUT_MODALITY_ATTR, value)
  listeners.forEach(listener => listener())
}

export const trackInputModality = () => {
  if (tracking || typeof document === 'undefined') return
  tracking = true
  const root = document.documentElement
  const changed = () => listeners.forEach(listener => listener())
  document.addEventListener(
    'keydown',
    event => {
      if (!MODIFIER_KEYS.has(event.key)) {
        root.setAttribute(INPUT_MODALITY_ATTR, 'keyboard')
        changed()
      }
    },
    true,
  )
  // Палец — свой ввод (ADR 0231, §2): вид под палец и на экране с наведением.
  document.addEventListener(
    'pointerdown',
    event => {
      root.setAttribute(
        INPUT_MODALITY_ATTR,
        event.pointerType === 'touch' ? 'touch' : 'pointer',
      )
      changed()
    },
    true,
  )
  // Мышь после пальца возвращает наведение; клавиатурный признак движение мыши не снимает.
  document.addEventListener(
    'pointermove',
    event => {
      if (
        event.pointerType === 'mouse' &&
        root.getAttribute(INPUT_MODALITY_ATTR) === 'touch'
      ) {
        root.setAttribute(INPUT_MODALITY_ATTR, 'pointer')
        changed()
      }
    },
    true,
  )
}

const noSubscribe = () => () => {}
const serverSnapshot = () => false

/** Подписка только узлов, чья раскладка зависит от ввода; остальные реагируют через CSS. */
export const useTouchInput = (enabled: boolean) => {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled || typeof document === 'undefined') return noSubscribe()
      trackInputModality()
      listeners.add(listener)
      const coarse = matchMedia('(pointer: coarse)')
      coarse.addEventListener('change', listener)
      return () => {
        listeners.delete(listener)
        coarse.removeEventListener('change', listener)
      }
    },
    [enabled],
  )
  const snapshot = useCallback(() => enabled && isTouchInput(), [enabled])
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
