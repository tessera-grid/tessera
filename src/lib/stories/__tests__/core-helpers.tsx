import { page } from 'vitest/browser'
import { expect } from 'vitest'

import { SEL, bodyRows, getScroller, headCells } from './helpers'

// Общие хелперы для набора тестов ядра (core-*.test.tsx). Разбиты по требованиям
// ADR 0004: структура, размеры, роли, визуальные состояния и раскладка при
// прокрутке лежат в отдельных файлах, а всё, что переиспользуется между ними, —
// здесь.

export const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/** Дождаться, пока грид смонтируется и отрисует заголовки и строки. */
export const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

export const bodyCellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(SEL.bodyCell))

export const textOf = (el: Element) => el.textContent?.trim() ?? ''

/** Строки в визуальном (сверху вниз) порядке. */
export const rowsTopDown = () =>
  bodyRows().sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  )

/** Заголовки в визуальном (слева направо) порядке. */
export const headCellsLeftRight = () =>
  headCells().sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  )

/**
 * Разрешить цвет CSS-переменной грида в конкретный rgb: пробник наследует
 * `--data-grid-*` от обёртки темы, поэтому `var(--token)` вычисляется так же, как
 * на реальной ячейке. Позволяет сравнивать фактический цвет с обещанным токеном
 * без хрупких хардкод-rgb.
 */
export const resolveVarColor = (expr: string): string => {
  const host = getScroller()
  const probe = document.createElement('span')
  probe.style.color = `var(${expr})`
  host.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  return rgb
}

export const HEAD_HEIGHT_VAR = '--data-grid-head-height'
export const ROW_HEIGHT_VAR = '--data-grid-row-height'

/** Значение CSS-переменной, вычисленное на реальном узле грида. */
export const cssVar = (name: string) =>
  getComputedStyle(getScroller()).getPropertyValue(name).trim()
