/**
 * Набор включённых действий для раскладки зоны (ADR 0156, §2): пока заголовок тронут —
 * указатель над ним, клавиатурный фокус внутри или открыт его поповер, — смена
 * включённости ряд не перестраивает. Подписка на заголовок ставится, только пока
 * раскладка отстаёт от живого набора: обычное наведение зону не перерисовывает.
 */
import {
  type RefObject,
  createContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

/** Элемент заголовка, чьи кнопки рисует зона; без него набор не удерживается. */
export const ActionsHostContext = createContext<
  RefObject<HTMLElement | null> | undefined
>(undefined)

/** Указатель над заголовком: касание держит его до касания вне заголовка. */
const pointers = new WeakMap<HTMLElement, { over: boolean }>()

const watchPointer = (host: HTMLElement) => {
  if (pointers.has(host)) return
  const state = { over: false }
  pointers.set(host, state)
  host.addEventListener('pointerover', () => {
    state.over = true
  })
  host.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch') return
    if (!host.contains(event.relatedTarget as Node | null)) state.over = false
  })
}

/** Фокус в поповере, который открыла кнопка заголовка: меню закрывается раньше выбора. */
const focusInOwnPopup = (host: HTMLElement) => {
  const focused = document.activeElement
  if (!focused || host.contains(focused)) return false
  const owner = focused
    .closest('[role="menu"], [role="dialog"]')
    ?.getAttribute('aria-labelledby')
  return !!owner && !!host.querySelector(`[id="${CSS.escape(owner)}"]`)
}

const touched = (host: HTMLElement) =>
  !!pointers.get(host)?.over ||
  !!host.querySelector(':focus-visible, [data-popup-open]') ||
  focusInOwnPopup(host)

const idle = () => () => {}

/** Ключ набора: id включённых через запятую, по алфавиту. */
export const useHeldActive = (
  live: string,
  host: RefObject<HTMLElement | null> | undefined,
): string => {
  const [held, setHeld] = useState(live)
  const pending = !!host && held !== live

  useEffect(() => {
    if (host?.current) watchPointer(host.current)
  }, [host])

  const subscribe = (onChange: () => void) => {
    const el = host?.current
    if (!el) return () => {}
    const outside = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      if (el.contains(event.target as Node | null)) return
      const state = pointers.get(el)
      if (state) state.over = false
      onChange()
    }
    // Во время `focusout` фокус ещё не ушёл: проверка — задачей позже.
    const blurred = () => setTimeout(onChange, 0)
    document.addEventListener('focusin', onChange, true)
    document.addEventListener('focusout', blurred, true)
    document.addEventListener('pointerdown', outside, true)
    el.addEventListener('pointerout', onChange)
    const popups = new MutationObserver(onChange)
    popups.observe(el, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-popup-open'],
    })
    return () => {
      document.removeEventListener('focusin', onChange, true)
      document.removeEventListener('focusout', blurred, true)
      document.removeEventListener('pointerdown', outside, true)
      el.removeEventListener('pointerout', onChange)
      popups.disconnect()
    }
  }
  const isTouched = useSyncExternalStore(
    pending ? subscribe : idle,
    () => pending && !!host?.current && touched(host.current),
    () => false,
  )

  if (held !== live && !isTouched) setHeld(live)
  return isTouched ? held : live
}
