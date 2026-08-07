import { describe, expect, test } from 'vitest'

import {
  getScroller,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// R17–R18 из docs/decisions/0004-core-on-tanstack-table.md: раскладка при
// прокрутке. Каждое требование — отдельный именованный тест `R<n>`.

describe('Ядро на TanStack — раскладка при прокрутке', () => {
  test('R17: заголовок липкий (sticky, top 0) и остаётся видимым при прокрутке', async () => {
    renderGrid({ columnCount: 10, dataCount: 200 })
    await waitForGrid()

    const head = document.querySelector<HTMLElement>('.data-grid__head')!
    const style = getComputedStyle(head)
    expect(style.position).toBe('sticky')
    expect(style.top).toBe('0px')

    const scroller = getScroller()
    await scrollToEnd('y')

    // После прокрутки тела вниз шапка приклеена к верхнему краю скроллера.
    const headTop = head.getBoundingClientRect().top
    const scrollerTop = scroller.getBoundingClientRect().top
    expect(Math.abs(headTop - scrollerTop)).toBeLessThan(2)
  })

  test('R18: прокрутка доводит до средней и последней строки/колонки, и они рендерятся', async () => {
    const columnCount = 30
    const dataCount = 200
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    const scroller = getScroller()

    // Средняя строка достижима вертикальной прокруткой.
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedRowIndexes().some(i => i > dataCount * 0.4 && i < dataCount * 0.6),
      )
      .toBe(true)

    // Последняя строка достижима до самого низа.
    await scrollToEnd('y')
    expect(Math.max(...renderedRowIndexes())).toBe(dataCount - 1)

    // Средняя колонка достижима горизонтальной прокруткой.
    scroller.scrollTop = 0
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedColumnIndexes().some(
          i => i > columnCount * 0.4 && i < columnCount * 0.6,
        ),
      )
      .toBe(true)

    // Последняя колонка достижима до самого края.
    await scrollToEnd('x')
    expect(Math.max(...renderedColumnIndexes())).toBe(columnCount - 1)
  })
})
