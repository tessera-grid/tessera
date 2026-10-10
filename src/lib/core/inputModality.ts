/**
 * Последний ввод — клавиатура или указатель (ADR 0084, CB5): признак на корне
 * документа рисует кольцо фокуса и там, где браузер не даёт `:focus-visible` фокусу
 * от скрипта — Firefox после ввода мышью. Корень, а не грид: календарь фильтра — в
 * портале. Слушатели ставятся один раз на документ.
 */
export const INPUT_MODALITY_ATTR = 'data-tsr-input'

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

let tracking = false

export const trackInputModality = () => {
  if (tracking || typeof document === 'undefined') return
  tracking = true
  const root = document.documentElement
  document.addEventListener(
    'keydown',
    event => {
      if (!MODIFIER_KEYS.has(event.key)) {
        root.setAttribute(INPUT_MODALITY_ATTR, 'keyboard')
      }
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    () => root.setAttribute(INPUT_MODALITY_ATTR, 'pointer'),
    true,
  )
}
