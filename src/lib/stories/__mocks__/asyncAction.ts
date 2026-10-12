import { useEffect, useRef, useState } from 'react'
import { expect, userEvent } from 'storybook/test'

import { settle, until } from './catalogPlay'

/** Сколько «сервер» думает перед ответом в демо асинхронного действия. */
export const ASYNC_ACTION_MS = 1500

/** Чем кончается действие: отказом (вспышка ошибки) или успехом (просто покой). */
export type AsyncOutcome = 'fail' | 'succeed'

/**
 * Демо асинхронного действия кнопки (ADR 0055, ADR 0098): нажатие — ожидание, через
 * {@link ASYNC_ACTION_MS} — ответ: отказ со вспышкой ошибки или успех; следующее
 * нажатие — снова по кругу. Во время ожидания кнопка нажатия игнорирует сама.
 */
export const useAsyncAction = (outcome: AsyncOutcome) => {
  const [pending, setPending] = useState(false)
  const [errorFlash, setErrorFlash] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = () => {
    setPending(true)
    timer.current = setTimeout(() => {
      setPending(false)
      if (outcome === 'fail') setErrorFlash(key => key + 1)
    }, ASYNC_ACTION_MS)
  }

  return { pending, errorFlash, onClick, 'data-outcome': outcome }
}

const outcomeButton = (canvas: HTMLElement, outcome: AsyncOutcome) =>
  canvas.querySelector<HTMLButtonElement>(`button[data-outcome="${outcome}"]`)!

/**
 * Сценарий историй «Async action»: отказ — ожидание, вспышка ошибки, покой; успех —
 * ожидание и покой без вспышки. История заканчивается в покое.
 */
export const playAsyncAction = async (canvas: HTMLElement) => {
  const failing = outcomeButton(canvas, 'fail')
  const succeeding = outcomeButton(canvas, 'succeed')
  await userEvent.click(failing)
  await userEvent.click(succeeding)
  for (const button of [failing, succeeding]) {
    await until(() => expect(button).toHaveAttribute('aria-busy', 'true'))
  }
  await until(() => expect(failing).toHaveAttribute('data-error-flash'))
  expect(failing).not.toHaveAttribute('aria-busy')
  await until(() => expect(succeeding).not.toHaveAttribute('aria-busy'))
  expect(succeeding).not.toHaveAttribute('data-error-flash')
  await until(() => expect(failing).not.toHaveAttribute('data-error-flash'))
  await settle()
}
