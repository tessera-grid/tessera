import { describe, expect, test } from 'vitest'

import {
  getScroller,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// R17–R18, R21 из docs/decisions/0004-core-on-tanstack-table.md: раскладка при
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
        renderedRowIndexes().some(
          i => i > dataCount * 0.4 && i < dataCount * 0.6,
        ),
      )
      .toBe(true)

    // Последняя строка достижима до самого низа.
    await scrollToEnd('y')
    await expect
      .poll(() => Math.max(...renderedRowIndexes()))
      .toBe(dataCount - 1)

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
    await expect
      .poll(() => Math.max(...renderedColumnIndexes()))
      .toBe(columnCount - 1)
  })

  test('R21: грид не выходит за свою рамку — тулбар, шапка, тело и футер внутри рамки, лишняя ширина колонок прокручивается контейнером, а не страницей', async () => {
    renderGrid({
      columnCount: 30,
      dataCount: 40,
      enableToolbar: true,
      enableColumnVisibility: true,
      enableFooter: true,
    })
    await waitForGrid()
    await expect
      .poll(() => document.querySelector('[role="toolbar"]'))
      .not.toBeNull()

    const scroller = getScroller()
    // Рамка грида — обёртка темы вокруг тулбара, контейнера и нижней панели.
    const frame = scroller.parentElement!.getBoundingClientRect()
    expect(getComputedStyle(scroller).overflowX).toBe('auto')
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    // Страница не прокручивается вбок — лишнюю ширину держит контейнер.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )

    const inside = (el: Element | null, name: string) => {
      expect(el, name).not.toBeNull()
      const rect = el!.getBoundingClientRect()
      expect(rect.left, name).toBeGreaterThanOrEqual(frame.left - 1)
      expect(rect.right, name).toBeLessThanOrEqual(frame.right + 1)
      expect(rect.top, name).toBeGreaterThanOrEqual(frame.top - 1)
      expect(rect.bottom, name).toBeLessThanOrEqual(frame.bottom + 1)
    }
    inside(scroller, 'контейнер')
    inside(document.querySelector('[role="toolbar"]'), 'тулбар')
    // Шапка, тело и футер шире рамки и видны через контейнер прокрутки.
    for (const name of [
      '.data-grid__head',
      '.data-grid__body-row',
      '.data-grid__footer',
    ]) {
      const el = document.querySelector(name)
      expect(el, name).not.toBeNull()
      expect(scroller.contains(el), name).toBe(true)
    }
  })
})
