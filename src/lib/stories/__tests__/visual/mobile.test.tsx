import { commands, server } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'

// Мобильная эмуляция с касаниями (ADR 0084, CB4): только проект `mobile` в
// `npm run test:engines` — iPhone (WebKit) и Pixel (Chromium).

interface Point {
  x: number
  y: number
}

const touch = commands as unknown as {
  realTap: (at: Point) => Promise<void>
  realSwipe: (from: Point, to: Point) => Promise<void>
}

const center = (el: Element): Point => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

describe('Мобильные — касания', () => {
  test('CB4: в эмуляции iPhone и Pixel грид рисуется, прокручивается касанием, касание выбирает строку', async () => {
    await render(
      <composed.AllFeatures
        containerHeight={600}
        height={500}
        dataCount={200}
        columnCount={6}
        enableRowSelection
      />,
    )
    const rows = () => document.querySelectorAll('.data-grid__body-row')
    await expect.poll(() => rows().length).toBeGreaterThan(3)
    expect(matchMedia('(pointer: coarse)').matches).toBe(true)

    const checkbox = document.querySelector<HTMLElement>(
      '.data-grid__body-row .row-select-checkbox',
    )!
    await touch.realTap(center(checkbox))
    await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true')

    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    // Панорамирование не заблокировано ни контейнером, ни ячейками.
    for (const el of [scroller, rows()[2]!.querySelector('[role="cell"]')!]) {
      expect(getComputedStyle(el).touchAction).toMatch(/^(auto|pan-y|pan-x)/)
    }
    if (server.browser === 'chromium') {
      // Жест пальцем Playwright умеет только через CDP — в эмуляции Pixel.
      // Точка внутри видимой части контейнера: строка шире окна.
      const box = scroller.getBoundingClientRect()
      const from = { x: box.left + 40, y: center(rows()[3]!).y }
      await touch.realSwipe(from, { x: from.x, y: from.y - 250 })
      await expect.poll(() => scroller.scrollTop).toBeGreaterThan(100)
    }
  })
})
