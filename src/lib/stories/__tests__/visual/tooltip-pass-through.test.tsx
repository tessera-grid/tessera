import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'

// TP1–TP2: подсказка без обрезки пропускает указатель насквозь (ADR 0100).

interface Point {
  x: number
  y: number
}

const pointer = commands as unknown as {
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
}

const tooltip = () =>
  document.querySelector<HTMLElement>(
    '[data-side][data-open]:not([data-starting-style])',
  )

const center = (element: Element): Point => {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** Наведение на триггер открывает подсказку; возвращает её центр. */
const openTooltip = async (trigger: HTMLElement) => {
  await userEvent.hover(trigger)
  await expect.poll(tooltip, { timeout: 3000 }).toBeTruthy()
  return center(tooltip()!)
}

/** Кнопка раскрытия второй раскрываемой строки: её подсказка встаёт над строкой выше. */
const expandToggle = async () => {
  await render(<composed.RowExpanding enableColumnSorting />)
  const toggles = () => [
    ...document.querySelectorAll<HTMLElement>('.row-expand-button'),
  ]
  await expect.poll(() => toggles().length).toBeGreaterThan(1)
  return toggles()[1]!
}

describe('Подсказки насквозь', () => {
  test('TP1: открытая подсказка без overflowOnly (кнопка раскрытия строки, кнопка заголовка) не перехватывает указатель — в её точке элемент под ней', async () => {
    const toggle = await expandToggle()
    let at = await openTooltip(toggle)
    let hit = document.elementFromPoint(at.x, at.y)
    expect(hit).not.toBeNull()
    expect(tooltip()!.contains(hit)).toBe(false)
    expect(hit!.closest('.data-grid__body-row')).not.toBeNull()
    await userEvent.hover(document.body)
    await expect.poll(tooltip).toBeNull()

    const sort = document.querySelector<HTMLElement>(
      '.data-grid__head-cell button',
    )!
    at = await openTooltip(sort)
    hit = document.elementFromPoint(at.x, at.y)
    expect(hit).not.toBeNull()
    expect(tooltip()!.contains(hit)).toBe(false)
    await userEvent.hover(document.body)
    await expect.poll(tooltip).toBeNull()
  })

  test('TP2: указатель, перешедший с триггера на подсказку без overflowOnly, её закрывает, наведение достаётся элементу под ней', async () => {
    const toggle = await expandToggle()
    const at = await openTooltip(toggle)
    await pointer.realMouseMove(center(toggle), at, 4)
    const under = document.elementFromPoint(at.x, at.y)!
    expect(under.matches(':hover')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(tooltip()).toBeNull()
    await userEvent.hover(document.body)
  })
})
