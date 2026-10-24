import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'

// Раскрытие кнопок ячейки одинаково во всех движках (ADR 0084, CB6): без
// возможностей только Chromium (`interpolate-size`). Набор идёт и в
// `npm run test:browsers`.

interface Point {
  x: number
  y: number
}

const pointer = commands as unknown as {
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
}

const HIDDEN = ".cell__button--hidden:not([data-button-active='true'])"

/** Ширина кнопки с её полями: кнопка на краю заходит в отступ ячейки (ADR 0135). */
const outerWidth = (button: Element) => {
  const style = getComputedStyle(button)
  return (
    button.getBoundingClientRect().width +
    parseFloat(style.marginLeft) +
    parseFloat(style.marginRight)
  )
}

describe('Раскрытие кнопок ячейки в движках', () => {
  test('CB6: кнопка ячейки раскрывается через промежуточные ширины в Chromium, Firefox и WebKit; во время прокрутки — сразу', async () => {
    await render(
      <composed.DataGridPlayground
        containerHeight={500}
        height={400}
        dataCount={20}
        columnCount={5}
        enableToolbar
        enableColumnVisibility
        enableRowSelection
        enableRowActions
        enableRowActionMenu
        enableCellEditing
        enableColumnSorting
      />,
    )
    const theme = document.querySelector<HTMLElement>('.data-grid-theme')!
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    // Длинный переход: замер попадает в середину независимо от задержек.
    theme.style.setProperty('--tsr-comp-motion-duration', '10s')
    const wrappers = () => [
      ...document.querySelectorAll<HTMLElement>(
        `.data-grid__body-cell ${HIDDEN}`,
      ),
    ]
    await expect.poll(() => wrappers().length).toBeGreaterThan(2)

    const first = wrappers()[0]!
    const full = outerWidth(first.querySelector('button')!)
    expect(first.getBoundingClientRect().width).toBe(0)
    const target = first.closest('.data-grid__body-cell')!
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    // Событие прокрутки приходит кадром позже самой прокрутки.
    for (let i = 0; i < 2; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    await expect
      .poll(() => scroller.hasAttribute('data-scrolling'), { timeout: 2000 })
      .toBe(false)
    const cell = target.getBoundingClientRect()
    await pointer.realMouseMove(
      { x: 1, y: 1 },
      { x: cell.left + cell.width / 2, y: cell.top + cell.height / 2 },
      4,
    )
    await expect
      .poll(() => first.getBoundingClientRect().width)
      .toBeGreaterThan(0)
    expect(first.getBoundingClientRect().width).toBeLessThan(full)
    await userEvent.hover(document.body)

    // Во время прокрутки ширина — сразу полная.
    let step = 1
    const scrolling = setInterval(() => {
      scroller.scrollTop += step
      step = -step
    }, 30)
    try {
      await expect
        .poll(() => scroller.hasAttribute('data-scrolling'))
        .toBe(true)
      const second = wrappers()[2]!
      await userEvent.hover(second.closest('.data-grid__body-cell')!, {
        force: true,
      })
      expect(scroller.hasAttribute('data-scrolling')).toBe(true)
      expect(second.getBoundingClientRect().width).toBe(
        outerWidth(second.querySelector('button')!),
      )
    } finally {
      clearInterval(scrolling)
      theme.style.removeProperty('--tsr-comp-motion-duration')
    }
  })
})
