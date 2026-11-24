import { commands } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { getSkeletonBarWidth } from '../../../core/skeletonOptions'
import { bodyRows, getScroller, renderGrid } from '../helpers'
import { PIN_BUTTON } from './column-pinning-helpers'

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

const SKELETON = '[data-skeleton]'
const nextFrame = () => new Promise(requestAnimationFrame)
const hasSkeleton = (row: Element) => row.querySelector(SKELETON) !== null
/** Кадров рывка: дальше полосы окна, что смонтирована до входа (ADR 0202). */
const FAST_STEPS = 8

const mount = async () => {
  renderGrid({ columnCount: 10, dataCount: 1000 })
  await expect.poll(() => bodyRows().length).toBeGreaterThan(5)
  return getScroller()
}

/** Рывок выше порога входа: строки, смонтированные в сессии быстрой прокрутки. */
const fastScroll = async () => {
  const scroller = getScroller()
  const before = new Set(bodyRows())
  // 100 px за кадр — выше порога входа по Y.
  for (let i = 0; i < FAST_STEPS; i++) {
    scroller.scrollTop += 100
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }
  return bodyRows().filter(row => !before.has(row))
}

describe('Быстрая прокрутка', () => {
  test('FS6: скелеты — только у ячеек, смонтированных в сессии быстрой прокрутки; видимые до входа сохраняют содержимое', async () => {
    const scroller = await mount()
    const before = new Set(bodyRows())
    // 100 px за кадр — выше порога входа по Y.
    for (let i = 0; i < FAST_STEPS; i++) {
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

  test('WB6: скелеты — у ячеек, смонтированных в сессии, включая пополнения полосы; строки, смонтированные полосой до входа, — с содержимым', async () => {
    const scroller = await mount()
    const box = scroller.getBoundingClientRect()
    // Полоса окна (ADR 0202) смонтировала строки ниже видимой части до входа.
    const ahead = bodyRows().filter(
      row => row.getBoundingClientRect().top >= box.bottom,
    )
    expect(ahead.length).toBeGreaterThan(0)
    const before = new Set(bodyRows())
    // Первый рывок включает режим. Следующий сдвиг пополняет полосу уже в сессии.
    scroller.scrollTop += 100
    await expect
      .poll(() => scroller.hasAttribute('data-fast-scrolling'))
      .toBe(true)
    scroller.scrollTop += scroller.clientHeight
    await expect
      .poll(
        () => bodyRows().some(row => !before.has(row) && hasSkeleton(row)),
        {
          interval: 10,
        },
      )
      .toBe(true)
    const rows = bodyRows()
    const shown = ahead.filter(row => rows.includes(row))
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.filter(hasSkeleton)).toEqual([])
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

  test('FS10: скелет — в ячейках тела, смонтированных в сессии, по виду skeletonCell: полоска у колонок данных и закреплённых, квадрат у выбора, пусто у ручки; шапка и футер — с содержимым', async () => {
    renderGrid({
      columnCount: 10,
      dataCount: 1000,
      enableColumnPinning: true,
      enableRowSelection: true,
      enableRowDragging: true,
      enableFooter: true,
    })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(5)
    const countryHead = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="country"]',
      )!
    countryHead().querySelector<HTMLElement>(PIN_BUTTON)!.click()
    await expect.poll(() => countryHead().dataset.cellPinned).toBe('left')
    const mounted = await fastScroll()

    expect(mounted.length).toBeGreaterThan(0)
    const control = Number.parseFloat(
      getComputedStyle(getScroller()).getPropertyValue(
        '--tsr-comp-skeleton-control-size',
      ),
    )
    const kindOf = (cell: HTMLElement) => {
      const shape = cell.querySelector<HTMLElement>(SKELETON)
      if (!shape) return cell.textContent?.trim() ? 'content' : 'none'
      const r = shape.getBoundingClientRect()
      return Math.round(r.width) === control && Math.round(r.height) === control
        ? 'control'
        : 'bar'
    }
    // Строки первого кадра рывка смонтированы до входа в режим — с содержимым (FS6).
    const inSession = mounted.filter(row => row.querySelector(SKELETON))
    expect(inSession.length).toBeGreaterThan(0)
    for (const row of inSession) {
      const cells = [
        ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
      ]
      const of = (part: string) =>
        kindOf(cells.find(cell => cell.dataset.columnId!.includes(part))!)
      expect(of('country'), 'закреплённая').toBe('bar')
      expect(of('firstName')).toBe('bar')
      expect(of('rowSelection')).toBe('control')
      expect(of('rowDragging')).toBe('none')
    }
    expect(
      [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-row:not(:has([data-skeleton]))',
        ),
      ].length,
      'строки до входа — с содержимым',
    ).toBeGreaterThan(0)
    expect(document.querySelector(`.data-grid__head ${SKELETON}`)).toBeNull()
    expect(
      document.querySelector(`.data-grid__footer-cell ${SKELETON}`),
    ).toBeNull()
  })

  test('FS11: скелет ячейки — полоска длиной по колонке и высотой токена ячейки скелета, без волны', async () => {
    renderGrid({ columnCount: 10, dataCount: 1000 })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(5)
    const mounted = await fastScroll()
    const height = Number.parseFloat(
      getComputedStyle(getScroller()).getPropertyValue(
        '--tsr-comp-skeleton-cell-height',
      ),
    )
    const byColumn = new Map<string, number[]>()
    for (const row of mounted) {
      for (const cell of row.querySelectorAll<HTMLElement>(
        '.data-grid__body-cell',
      )) {
        const bar = cell.querySelector<HTMLElement>(SKELETON)
        if (!bar) continue
        const wrapper = cell.firstElementChild as HTMLElement
        const style = getComputedStyle(wrapper)
        const content =
          wrapper.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight)
        const ratio = Math.round(
          (bar.getBoundingClientRect().width / content) * 100,
        )
        const id = cell.dataset.columnId!
        byColumn.set(id, [...(byColumn.get(id) ?? []), ratio])
        expect(Math.round(bar.getBoundingClientRect().height)).toBe(height)
        expect(getComputedStyle(bar, '::after').animationName).toBe('none')
      }
    }
    expect(byColumn.size).toBeGreaterThan(2)
    for (const [id, ratios] of byColumn) {
      const expected = getSkeletonBarWidth(id)
      for (const ratio of ratios) {
        expect(Math.abs(ratio - expected), id).toBeLessThanOrEqual(1)
      }
    }
    // Длина своя у колонки, а не одна на все.
    expect(
      new Set([...byColumn.keys()].map(getSkeletonBarWidth)).size,
    ).toBeGreaterThan(1)
  })
})
