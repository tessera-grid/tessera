/**
 * Фокус после шага гайда (ADR 0117, SN35, SN53, SN55–SN58). Нажатия и клавиши шагов —
 * синтетические: фокус от скрипта Chromium рисует кольцом, а клавиши ставят признак
 * клавиатурного ввода, — оставленный шагом фокус выглядел бы как от клавиатуры. Фокус —
 * часть состояния шага, только если шаг про клавиатуру (`keyboard`) или фокус в поле ввода,
 * контроле формы или открытом поповере; иначе по завершении действия шага он уходит.
 */
import { INPUT_MODALITY_ATTR } from '../../core/inputModality'

/** Панель гайда и консоль истории. */
export const OWN_CHROME = '[data-testid="guide"], [data-testid="story-console"]'

/** Поле ввода и контрол формы: редактор ячейки закрывается, потеряв фокус. */
const FIELD =
  'input:not([type="button"], [type="submit"], [type="reset"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="spinbutton"], [role="radio"], [role="checkbox"], [role="switch"], [role="slider"]'
const POPUP =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]'

/** Фокус, который шаг держит: поле ввода, контрол формы и всё внутри поповера. */
const holdsFocus = (element: Element) =>
  element.matches(FIELD) || !!element.closest(POPUP)

/** Нажатие по панели не забирает фокус у поля, контрола и поповера таблицы (SN35, SN53). */
export const keepsFocus = () => {
  const active = document.activeElement
  return (
    !!active &&
    active !== document.body &&
    !active.closest(OWN_CHROME) &&
    holdsFocus(active)
  )
}

/** Пока действие шага идёт, сторож проверяет его раз в столько мс. */
const BUSY_MS = 100

const INPUTS = ['keydown', 'pointerdown', 'touchstart']

/** Действие шага (`stepAction`) дошло: фокус уходит до отметки `done` — её ждут проверки. */
export const STEP_ACTION_DONE = 'guide-step-action-done'

export interface FocusGuard {
  /** Переход к шагу: фокус человека снова не его, итог шага — после действия. */
  stepChanged: () => void
  dispose: () => void
}

/**
 * Сторож фокуса гайда с корнем `guide`. Фокус шага, который не про клавиатуру, уходит на
 * кнопку панели, с которой его забрало действие, иначе снимается; признак ввода — каким
 * был до клавиш шага (SN56). Фокус, поставленный человеком, — до перехода его (SN58).
 */
export const createFocusGuard = (
  guide: HTMLElement,
  isKeyboardStep: () => boolean,
): FocusGuard => {
  const root = document.documentElement
  let timer = 0
  let human = false
  let origin: HTMLElement | undefined
  // Признак ввода до первой клавиши шага: `undefined` — клавиш шага не было.
  let modality: string | null | undefined
  const busy = () =>
    guide.dataset.stepAction === 'running' ||
    guide.hasAttribute('data-guide-showing')
  const release = (actionDone = false) => {
    window.clearTimeout(timer)
    timer = 0
    if (human || isKeyboardStep()) return
    if (actionDone ? guide.hasAttribute('data-guide-showing') : busy()) {
      schedule(BUSY_MS)
      return
    }
    if (modality !== undefined) {
      root.setAttribute(INPUT_MODALITY_ATTR, modality ?? 'pointer')
      modality = undefined
    }
    const active = document.activeElement
    const back = origin?.isConnected ? origin : undefined
    origin = undefined
    if (
      !(active instanceof HTMLElement) ||
      active === document.body ||
      active.closest(OWN_CHROME) ||
      holdsFocus(active)
    )
      return
    back?.focus({ preventScroll: true })
    if (document.activeElement === active) active.blur()
  }
  // Вне действия шага — следующей задачей: фокус уходит до снимка и проверок шага.
  function schedule(ms = 0) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => release(), ms)
  }
  const onFocusIn = (event: FocusEvent) => {
    if (!(event.target instanceof Element) || event.target.closest(OWN_CHROME))
      return
    const from = event.relatedTarget
    if (from instanceof HTMLElement && from.closest(OWN_CHROME)) origin = from
    schedule()
  }
  // Настоящий ввод сам ставит признак ввода; вне панели — это фокус человека. Пока идёт
  // действие шага, ввод в таблицу держит щит (SN43).
  const onInput = (event: Event) => {
    if (!event.isTrusted) {
      if (event.type === 'keydown' && modality === undefined)
        modality = root.getAttribute(INPUT_MODALITY_ATTR)
      return
    }
    modality = undefined
    if (busy()) return
    // Tab с панели уводит фокус человека в таблицу; прочий ввод в панель — переход гайда.
    const tab = event instanceof KeyboardEvent && event.key === 'Tab'
    if (
      !tab &&
      event.target instanceof Element &&
      event.target.closest(OWN_CHROME)
    )
      return
    human = true
  }
  const onActionDone = () => release(true)
  document.addEventListener('focusin', onFocusIn, true)
  for (const type of INPUTS) window.addEventListener(type, onInput, true)
  guide.addEventListener(STEP_ACTION_DONE, onActionDone)
  return {
    stepChanged: () => {
      human = false
      schedule()
    },
    dispose: () => {
      window.clearTimeout(timer)
      document.removeEventListener('focusin', onFocusIn, true)
      for (const type of INPUTS) window.removeEventListener(type, onInput, true)
      guide.removeEventListener(STEP_ACTION_DONE, onActionDone)
    },
  }
}
