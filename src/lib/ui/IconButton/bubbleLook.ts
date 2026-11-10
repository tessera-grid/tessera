import { useState } from 'react'

export interface BubbleLook {
  /** Число на бабле; 0 — точка. */
  count: number
  tone: 'active' | 'draft' | 'error'
}

const same = (a: BubbleLook, b: BubbleLook) =>
  a.count === b.count && a.tone === b.tone

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Вид бабла кнопки (ADR 0129, AV12): показанный бабл следует пропам, уходящий до конца
 * перехода держит последний показанный вид — число, тон, размер и место: иначе цифра пропадает
 * сразу, а точка съезжает на своё место. После ухода (`settle` — конец перехода) вид снова
 * текущий; при уменьшенном движении ухода нет, и держать нечего.
 */
export const useBubbleLook = (look: BubbleLook, shown: boolean) => {
  const [state, setState] = useState({ shown, lastShown: look, leaving: false })
  if (shown !== state.shown)
    setState({
      shown,
      lastShown: shown ? look : state.lastShown,
      leaving: !shown && !reducedMotion(),
    })
  else if (shown && !same(state.lastShown, look))
    setState({ ...state, lastShown: look })
  const settle = () =>
    setState(current =>
      current.leaving ? { ...current, leaving: false } : current,
    )
  const view = !shown && state.leaving ? state.lastShown : look
  return { ...view, shown, settle }
}
