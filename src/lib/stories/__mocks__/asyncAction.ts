import { useEffect, useRef, useState } from 'react'
import { expect, userEvent } from 'storybook/test'

import { settle, until } from './catalogPlay'

/** Сколько «сервер» думает перед ответом в демо асинхронного действия. */
export const ASYNC_ACTION_MS = 1500

/** Чем кончается действие: отказом или успехом. */
export type AsyncOutcome = 'fail' | 'succeed'

/**
 * Демо асинхронного действия кнопки (ADR 0098, ADR 0127, ADR 0177 §2): нажатие — ожидание,
 * через {@link ASYNC_ACTION_MS} — ответ: при отказе дуга встаёт и гаснет, при успехе гаснет на
 * бегу; отметки отказа на кнопке нет. Во время ожидания кнопка нажатия игнорирует сама.
 */
export const useAsyncAction = (outcome: AsyncOutcome) => {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = () => {
    setPending(true)
    setFailed(false)
    timer.current = setTimeout(() => {
      setPending(false)
      setFailed(outcome === 'fail')
    }, ASYNC_ACTION_MS)
  }

  return { pending, failed, onClick, 'data-outcome': outcome }
}

const outcomeButton = (canvas: HTMLElement, outcome: AsyncOutcome) =>
  canvas.querySelector<HTMLButtonElement>(`button[data-outcome="${outcome}"]`)!

/** Фаза дуги ожидания кнопки (ADR 0127, ADR 0136). */
const arcPhase = (button: HTMLElement) =>
  button.querySelector<SVGSVGElement>(':scope > svg[data-pending-arc]')?.dataset
    .phase

/**
 * Сценарий историй «Async action»: дуга ожидания; при отказе она встаёт и гаснет, при успехе
 * гаснет на бегу; отметки отказа на кнопке нет. История заканчивается в покое.
 */
export const playAsyncAction = async (canvas: HTMLElement) => {
  const failing = outcomeButton(canvas, 'fail')
  const succeeding = outcomeButton(canvas, 'succeed')
  await userEvent.click(failing)
  await userEvent.click(succeeding)
  for (const button of [failing, succeeding]) {
    await until(() => expect(button).toHaveAttribute('aria-busy', 'true'))
    expect(arcPhase(button)).toBe('pending')
  }
  await until(() => expect(failing).not.toHaveAttribute('aria-busy'))
  expect(arcPhase(failing)).toBe('stopping')
  await until(() => expect(succeeding).not.toHaveAttribute('aria-busy'))
  await until(() => expect(arcPhase(failing)).toBeUndefined())
  await until(() => expect(arcPhase(succeeding)).toBeUndefined())
  for (const button of [failing, succeeding])
    expect(button.querySelector('[data-failure-indicator]')).toBeNull()

  // Повтор — снова ожидание.
  await userEvent.click(failing)
  await until(() => expect(failing).toHaveAttribute('aria-busy', 'true'))
  await until(() => expect(failing).not.toHaveAttribute('aria-busy'))
  await until(() => expect(arcPhase(failing)).toBeUndefined())
  // Нажатия сценария оставляют фокус на кнопке — покой истории без кольца фокуса.
  const focused = canvas.ownerDocument.activeElement
  if (focused instanceof HTMLElement && canvas.contains(focused)) focused.blur()
  expect(canvas.contains(canvas.ownerDocument.activeElement)).toBe(false)
  await settle()
}
