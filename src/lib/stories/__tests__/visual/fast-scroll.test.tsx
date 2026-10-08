import { commands } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { bodyRows, getScroller, renderGrid } from '../helpers'

// Быстрая прокрутка (ADR 0008, FS6–FS7): скелеты — только у ячеек, смонтированных в
// сессии быстрой прокрутки; пауза главного потока при медленной прокрутке колесом
// режим не включает.

interface Point {
  x: number
  y: number
}

const pointer = commands as unknown as {
  realWheel: (
    at: Point,
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
}

const SKELETON = '[class*="skeleton"]'
const nextFrame = () => new Promise(requestAnimationFrame)
const hasSkeleton = (row: Element) => row.querySelector(SKELETON) !== null

const mount = async () => {
  renderGrid({ columnCount: 10, dataCount: 1000 })
  await expect.poll(() => bodyRows().length).toBeGreaterThan(5)
  return getScroller()
}

describe('Быстрая прокрутка', () => {
  test('FS6: скелеты — только у ячеек, смонтированных в сессии быстрой прокрутки; видимые до входа сохраняют содержимое', async () => {
    const scroller = await mount()
    const before = new Set(bodyRows())
    // 100 px за кадр — выше порога входа по Y.
    for (let i = 0; i < 3; i++) {
      scroller.scrollTop += 100
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }
    const rows = bodyRows()
    const kept = rows.filter(row => before.has(row))
    const mounted = rows.filter(row => !before.has(row))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.filter(hasSkeleton)).toEqual([])
    expect(mounted.some(hasSkeleton)).toBe(true)
  })

  test('FS7: медленная прокрутка настоящим колесом с паузой главного потока не показывает скелетов', async () => {
    const scroller = await mount()
    const box = scroller.getBoundingClientRect()
    let skeletons = 0
    let frames = 0
    let watching = true
    // Хронология событий прокрутки — для сообщения при падении: +интервал/сдвиг.
    const timeline: string[] = []
    let lastAt = performance.now()
    let lastTop = scroller.scrollTop
    scroller.addEventListener('scroll', () => {
      const now = performance.now()
      timeline.push(
        `+${(now - lastAt).toFixed(0)}/${(scroller.scrollTop - lastTop).toFixed(0)}`,
      )
      lastAt = now
      lastTop = scroller.scrollTop
    })
    const watch = () => {
      frames++
      skeletons += document.querySelectorAll(
        `.data-grid__body-row ${SKELETON}`,
      ).length
      if (watching) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
    // Пауза главного потока посреди прокрутки: колесо идёт дальше в потоке композитора.
    setTimeout(() => {
      const until = performance.now() + 400
      while (performance.now() < until) {
        // занятый главный поток
      }
    }, 300)
    // ~600 px/s: щелчок 12 px раз в 20 мс — ниже порога входа (2000 px/s).
    await pointer.realWheel(
      { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      12,
      60,
      20,
    )
    watching = false
    expect(scroller.scrollTop).toBeGreaterThan(300)
    expect(frames).toBeGreaterThan(10)
    expect(skeletons, timeline.join(' ')).toBe(0)
  })
})
