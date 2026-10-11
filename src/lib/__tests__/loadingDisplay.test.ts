/**
 * Таймер показа обновления данных (ADR 0094, GL14): задержка, минимум, повторное
 * включение и снятие до задержки.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import {
  createLoadingDisplay,
  DEFAULT_LOADING_OPTIONS,
  type LoadingClock,
  resolveLoadingOptions,
} from '../core/loadingDisplay'

/** Часы с ручным ходом времени. */
const manualClock = () => {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; run: () => void }>()
  const clock: LoadingClock = {
    now: () => now,
    setTimeout: (run, ms) => {
      const id = next++
      timers.set(id, { at: now + ms, run })
      return id
    },
    clearTimeout: handle => {
      timers.delete(handle as number)
    },
  }
  const advance = (ms: number) => {
    const until = now + ms
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].run()
    }
    now = until
  }
  return { clock, advance }
}

const setup = (options = { delayMs: 300, minDurationMs: 500 }) => {
  const { clock, advance } = manualClock()
  const shown: boolean[] = []
  const display = createLoadingDisplay(
    () => options,
    value => shown.push(value),
    clock,
  )
  return { display, advance, shown }
}

describe('Показ обновления данных', () => {
  it('GL14: таймер показа — задержка, минимум, повторное включение во время показа и до конца минимума, снятие до задержки', () => {
    expect(resolveLoadingOptions(undefined)).toEqual(DEFAULT_LOADING_OPTIONS)
    expect(DEFAULT_LOADING_OPTIONS).toEqual({
      delayMs: 300,
      minDurationMs: 500,
    })
    expect(resolveLoadingOptions({ delayMs: 0 })).toEqual({
      delayMs: 0,
      minDurationMs: 500,
    })

    // Задержка: до неё ничего, после — показано.
    const delayed = setup()
    delayed.display.set(true)
    delayed.advance(299)
    expect(delayed.shown).toEqual([])
    delayed.advance(1)
    expect(delayed.shown).toEqual([true])

    // Снятие до задержки: показа не было вовсе.
    const quick = setup()
    quick.display.set(true)
    quick.advance(200)
    quick.display.set(false)
    quick.advance(1000)
    expect(quick.shown).toEqual([])

    // Минимум: снятое через 100 мс после показа держится до 500 мс.
    const held = setup()
    held.display.set(true)
    held.advance(300)
    held.advance(100)
    held.display.set(false)
    held.advance(399)
    expect(held.shown).toEqual([true])
    held.advance(1)
    expect(held.shown).toEqual([true, false])

    // Снятое после минимума гаснет сразу.
    const late = setup()
    late.display.set(true)
    late.advance(300 + 600)
    late.display.set(false)
    expect(late.shown).toEqual([true, false])

    // Повторное включение до конца минимума: показ не прерывается и не повторяется.
    const again = setup()
    again.display.set(true)
    again.advance(300)
    again.display.set(false)
    again.advance(200)
    again.display.set(true)
    again.advance(2000)
    expect(again.shown).toEqual([true])
    // Повторное включение во время показа ничего не меняет.
    again.display.set(true)
    again.advance(2000)
    expect(again.shown).toEqual([true])
    again.display.set(false)
    expect(again.shown).toEqual([true, false])

    // dispose гасит ожидающий таймер.
    const disposed = setup()
    disposed.display.set(true)
    disposed.display.dispose()
    disposed.advance(1000)
    expect(disposed.shown).toEqual([])
  })
})
