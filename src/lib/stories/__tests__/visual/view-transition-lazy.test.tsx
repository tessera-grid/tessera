// Ленивые модули грида внутри <ViewTransition> приложения (ADR 0107, RM33). Свой файл: модули
// тултипа и тулбара грузятся заново только на свежей странице набора.
import * as React from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, onTestFinished, test } from 'vitest'

import { composed } from '../stories'

const BODY_ROW = '.data-grid__body-row'
const TOGGLE = '.row-expand-button'

/** `ViewTransition` есть с React 19.3; на React 18 обёртки нет. */
const ViewTransition = (
  React as unknown as {
    ViewTransition?: React.ComponentType<{ children: React.ReactNode }>
  }
).ViewTransition

/** Счётчик вызовов `document.startViewTransition` до конца теста. */
const countViewTransitions = () => {
  const original = document.startViewTransition
  const counter = { calls: 0 }
  if (!original) return counter
  document.startViewTransition = ((...args: Parameters<typeof original>) => {
    counter.calls++
    return original.apply(document, args)
  }) as typeof original
  onTestFinished(() => {
    document.startViewTransition = original
  })
  return counter
}

const frames = (count: number) =>
  new Promise<void>(resolve => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(count)
  })

describe('ленивые модули внутри <ViewTransition> приложения (ADR 0107)', () => {
  test('RM33: при выключенном enableIncrementalRender догрузка ленивого модуля грида не запускает startViewTransition — ни тулбар при монтировании, ни тултип посреди раскрытия строки', async () => {
    const counter = countViewTransitions()
    const story = (
      <composed.RowExpandingPlayground
        enableToolbar
        enableIncrementalRender={false}
      />
    )
    await render(
      ViewTransition ? <ViewTransition>{story}</ViewTransition> : story,
    )
    // Тулбар приходит отдельным модулем после первого кадра грида.
    await expect
      .poll(() => document.querySelector('[data-toolbar-placeholder]'))
      .toBeNull()
    await expect
      .poll(() => document.querySelectorAll(BODY_ROW).length)
      .toBeGreaterThan(3)
    await frames(3)
    expect(counter.calls).toBe(0)

    // Наведение начинает загрузку тултипа, нажатие тут же раскрывает строку: модуль приходит
    // посреди движения строк.
    const toggle = document.querySelector<HTMLElement>(`${BODY_ROW} ${TOGGLE}`)!
    const rows = document.querySelectorAll(BODY_ROW).length
    await userEvent.click(toggle)
    await expect
      .poll(() => document.querySelectorAll(BODY_ROW).length)
      .toBeGreaterThan(rows)
    await new Promise(resolve => setTimeout(resolve, 600))
    expect(counter.calls).toBe(0)
  })
})
