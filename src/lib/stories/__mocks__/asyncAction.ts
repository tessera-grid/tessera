import { useEffect, useRef, useState } from 'react'
import { expect, userEvent } from 'storybook/test'

import { settle, until } from './catalogPlay'

/** Сколько «сервер» думает перед ответом в демо асинхронного действия. */
export const ASYNC_ACTION_MS = 1500

/** Чем кончается действие: отказом (вспышка ошибки) или успехом (просто покой). */
export type AsyncOutcome = 'fail' | 'succeed'

/** Текст отметки отказа в демо (ADR 0127): причина и подсказка повтора. */
export const ASYNC_FAILURE = 'Failed: the server is unavailable. Click to retry'

/**
 * Демо асинхронного действия кнопки (ADR 0055, ADR 0098, ADR 0127): нажатие — ожидание,
 * через {@link ASYNC_ACTION_MS} — ответ: отказ со вспышкой ошибки и отметкой или успех;
 * следующее нажатие — повтор, отметка снимается. Во время ожидания кнопка нажатия
 * игнорирует сама.
 */
export const useAsyncAction = (outcome: AsyncOutcome) => {
  const [pending, setPending] = useState(false)
  const [errorFlash, setErrorFlash] = useState(0)
  const [failure, setFailure] = useState<string>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = () => {
    setPending(true)
    setFailure(undefined)
    timer.current = setTimeout(() => {
      setPending(false)
      if (outcome === 'fail') {
        setErrorFlash(key => key + 1)
        setFailure(ASYNC_FAILURE)
      }
    }, ASYNC_ACTION_MS)
  }

  return { pending, errorFlash, failure, onClick, 'data-outcome': outcome }
}

const outcomeButton = (canvas: HTMLElement, outcome: AsyncOutcome) =>
  canvas.querySelector<HTMLButtonElement>(`button[data-outcome="${outcome}"]`)!

/** Показана ли отметка отказа кнопки (ADR 0127). */
const failureShown = (button: HTMLElement) =>
  button.querySelector<HTMLElement>('[data-failure-indicator]')?.dataset
    .shown === 'true'

/** Фаза дуги ожидания и отказа кнопки (ADR 0127). */
const arcPhase = (button: HTMLElement) =>
  button.querySelector<SVGSVGElement>(':scope > svg[data-pending-arc]')?.dataset
    .phase

/**
 * Сценарий историй «Async action»: отказ — дуга ожидания, вспышка ошибки, покой с
 * отметкой отказа, повтор её снимает; успех — дуга и покой без вспышки и отметки. История
 * заканчивается в покое.
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
  await until(() => expect(failing).toHaveAttribute('data-error-flash'))
  expect(failing).not.toHaveAttribute('aria-busy')
  expect(arcPhase(failing)).toBe('error')
  await until(() => expect(succeeding).not.toHaveAttribute('aria-busy'))
  expect(succeeding).not.toHaveAttribute('data-error-flash')
  await until(() => expect(failing).not.toHaveAttribute('data-error-flash'))
  await until(() => expect(failureShown(failing)).toBe(true))
  expect(failing).toHaveAccessibleDescription(ASYNC_FAILURE)
  expect(failureShown(succeeding)).toBe(false)

  // Повтор снимает отметку на время ожидания; отказ возвращает её.
  await userEvent.click(failing)
  await until(() => expect(failing).toHaveAttribute('aria-busy', 'true'))
  expect(failureShown(failing)).toBe(false)
  await until(() => expect(failing).not.toHaveAttribute('aria-busy'))
  await until(() => expect(failing).not.toHaveAttribute('data-error-flash'))
  await until(() => expect(failureShown(failing)).toBe(true))
  // Нажатия сценария оставляют фокус на кнопке — покой истории без кольца фокуса.
  const focused = canvas.ownerDocument.activeElement
  if (focused instanceof HTMLElement && canvas.contains(focused)) focused.blur()
  expect(canvas.contains(canvas.ownerDocument.activeElement)).toBe(false)
  await settle()
}
