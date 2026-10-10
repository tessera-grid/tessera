import { userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { humanClick, renderGrid, revealCellButtons } from '../helpers'
import { composed } from '../stories'
import { waitForGrid } from './core-helpers'

// Кольцо фокуса после перехода с мыши на клавиатуру (ADR 0084, CB5). Firefox не даёт
// `:focus-visible` фокусу от скрипта после ввода мышью — набор идёт и в
// `npm run test:browsers`.

const ringOf = (el: Element) => {
  const style = getComputedStyle(el)
  return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
}

describe('Кольцо фокуса — после мыши', () => {
  test('CB5: после клика мышью стрелки показывают кольцо фокуса на активной ячейке и на дне календаря', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableKeyboardNavigation: true,
    })
    await waitForGrid()
    const cells = document.querySelectorAll<HTMLElement>(
      '[role="grid"] .data-grid__body-cell',
    )
    await humanClick(cells[1]!)
    // По клику кольца нет.
    expect(getComputedStyle(cells[1]!).outlineStyle).toBe('none')
    await userEvent.keyboard('{ArrowRight}')
    const active = () => document.activeElement as HTMLElement
    await expect.poll(() => active()).not.toBe(cells[1])
    await expect
      .poll(() => getComputedStyle(active()).outlineStyle)
      .toBe('solid')
    await cleanup()

    await render(<composed.FilteringDates timeZone="UTC" />)
    await waitForGrid()
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="createdAt"]',
    )!
    await revealCellButtons(head)
    await humanClick(head.querySelector('.column-filter__button')!)
    const dayButtons = () => [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[data-testid="filter-calendar"] [data-day] button',
      ),
    ]
    await expect.poll(() => dayButtons().length).toBeGreaterThan(10)
    const start = dayButtons()[10]!
    await humanClick(start)
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => document.activeElement).not.toBe(start)
    const focusedDay = document.activeElement as HTMLElement
    expect(focusedDay.closest('[data-day]')).not.toBeNull()
    await expect.poll(() => ringOf(focusedDay)).toBe(true)
  })
})
