// @vitest-environment happy-dom
/**
 * Адаптер TanStack Virtual для React (ADR 0202, WB4; ADR 0203, WS8): синхронность по
 * уведомлению, переход React и без перерисовки того же окна.
 * Запуск: npx vitest run --config vitest.node.config.ts windowBand.dom
 */
import { Suspense, createElement } from 'react'
import { flushSync } from 'react-dom'
import { type Root, createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type Range,
  useVirtualizer,
} from '../../vendor/tanstack-virtual/react-virtual'

const settle = () => new Promise(resolve => setTimeout(resolve, 20))

let root: Root | undefined
afterEach(() => {
  flushSync(() => root?.unmount())
  root = undefined
})

/** Окно — блоками по 20 строк: прокрутка внутри блока окно не меняет. */
const blocks = (range: Range) => {
  const from = Math.floor(range.startIndex / 20) * 20
  return Array.from({ length: 20 }, (_, k) => from + k)
}

const mount = (flush: (instance: unknown) => boolean) => {
  const element = document.createElement('div')
  let scroll: (offset: number, isScrolling: boolean) => void = () => {}
  const renders = { count: 0 }
  const Host = () => {
    renders.count++
    useVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: 1000,
      estimateSize: () => 10,
      getScrollElement: () => element,
      observeElementRect: (_instance, onRect) => {
        onRect({ width: 100, height: 100 })
        return () => {}
      },
      observeElementOffset: (_instance, onOffset) => {
        scroll = onOffset
        return () => {}
      },
      scrollToFn: () => {},
      overscan: 0,
      rangeExtractor: blocks,
      useFlushSync: flush,
    })
    return null
  }
  root = createRoot(document.createElement('div'))
  flushSync(() => root!.render(createElement(Host)))
  return { renders, scroll: (offset: number) => scroll(offset, true) }
}

describe('Адаптер вендора (ADR 0202)', () => {
  it('WB4: useFlushSync функцией решает на каждое уведомление; уведомление без смены окна, замеров и признака прокрутки не перерисовывает', async () => {
    const flush = vi.fn(() => true)
    const grid = mount(flush)
    await settle()

    // Начало прокрутки меняет признак прокрутки — одна перерисовка.
    grid.scroll(5)
    await settle()
    const started = grid.renders.count
    // Та же двадцатка строк: окно, замеры и признак прежние — перерисовок нет.
    for (const offset of [10, 40, 90, 150]) grid.scroll(offset)
    await settle()
    expect(grid.renders.count).toBe(started)

    // Функция сказала «синхронно» — перерисовка до возврата из уведомления.
    flush.mockClear()
    grid.scroll(250)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(grid.renders.count).toBe(started + 1)

    // Функция сказала «не синхронно» — перерисовка позже, в задаче React.
    flush.mockImplementation(() => false)
    grid.scroll(450)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(grid.renders.count).toBe(started + 1)
    await settle()
    expect(grid.renders.count).toBe(started + 2)
  })
})

/** Строка, что приостанавливается после первой отрисовки: переход оставит прежний вид. */
const never = new Promise(() => {})
const mountSuspending = (flush: () => boolean | 'transition') => {
  const element = document.createElement('div')
  let scroll: (offset: number, isScrolling: boolean) => void = () => {}
  let renders = 0
  const Rows = () => {
    renders++
    useVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: 1000,
      estimateSize: () => 10,
      getScrollElement: () => element,
      observeElementRect: (_instance, onRect) => {
        onRect({ width: 100, height: 100 })
        return () => {}
      },
      observeElementOffset: (_instance, onOffset) => {
        scroll = onOffset
        return () => {}
      },
      scrollToFn: () => {},
      overscan: 0,
      rangeExtractor: blocks,
      useFlushSync: flush,
    })
    if (renders > 2) throw never
    return createElement('span', null, 'rows')
  }
  const host = document.createElement('div')
  root = createRoot(host)
  flushSync(() =>
    root!.render(
      createElement(Suspense, { fallback: 'wait' }, createElement(Rows)),
    ),
  )
  return { host, scroll: (offset: number) => scroll(offset, false) }
}

describe('Адаптер вендора: переход (ADR 0203)', () => {
  it('WS8: ответ transition функции useFlushSync ставит перерисовку переходом React', async () => {
    const grid = mountSuspending(() => 'transition')
    await settle()
    expect(grid.host.textContent).not.toContain('wait')
    // Окно сменилось: перерисовка приостановилась, переход держит прежний вид.
    grid.scroll(450)
    await settle()
    expect(grid.host.textContent).not.toContain('wait')

    flushSync(() => root?.unmount())
    root = undefined
    // Без перехода та же перерисовка показывает заглушку.
    const plain = mountSuspending(() => false)
    await settle()
    plain.scroll(450)
    await settle()
    expect(plain.host.textContent).toContain('wait')
  })
})
