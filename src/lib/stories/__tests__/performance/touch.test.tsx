import { describe, expect, test } from 'vitest'

import { measureScrollWork, recordPerf, renderGrid } from '../helpers'
import { waitForGrid } from '../visual/core-helpers'
import {
  ALL_PLUGINS,
  CONTENT_SCROLL,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
} from './perf-cases'

// Касания (ADR 0086, TU13): спокойная прокрутка 1000×1000 со всеми плагинами без
// наведения и с грубым указателем — кнопки шапки видны всегда, у каждой цели зона во
// всю высоту ячейки. Файл идёт в двух проектах перф-конфига: в обычном Chromium пишет
// базу `TU13-base`, в проекте касаний — `TU13`; медиа-признаки во время работы не
// переключаются.
/** Регресс-потолок P13 — та же выборка со всеми плагинами, вне бюджета RAIL. */
const CEILING = { y: 50, x: 75 }

describe('Производительность прокрутки — касания', () => {
  test(
    'TU13: прокрутка 1000×1000 без наведения — в пределах потолков P13; база с мышью в дашборде',
    async () => {
      const touch = matchMedia('(hover: none) and (pointer: coarse)').matches
      const screen = renderGrid({ ...LARGE, ...ALL_PLUGINS })
      await waitForGrid()
      const result = {
        y: await measureScrollWork('y', CONTENT_SCROLL.y),
        x: await measureScrollWork('x', CONTENT_SCROLL.x),
      }
      ;(await screen).unmount()
      await recordPerf({
        id: touch ? 'TU13' : 'TU13-base',
        label: touch ? 'без наведения, грубый указатель' : 'мышь',
        operation: 'scroll',
        size: '1000×1000',
        plugins: 'all',
        cpuThrottle: CPU_THROTTLE_RATE,
        knownShortfall: true,
        metrics: (['y', 'x'] as const).map(axis => ({
          axis,
          kind: 'animation' as const,
          metric: 'p95' as const,
          valueMs: result[axis].p95Ms,
          budgetMs: CEILING[axis],
          pass: result[axis].p95Ms <= CEILING[axis],
          ...result[axis],
        })),
      })
      for (const axis of ['y', 'x'] as const) {
        expect(
          result[axis].p95Ms,
          `${axis} p95=${result[axis].p95Ms.toFixed(1)}ms, потолок ${CEILING[axis]}`,
        ).toBeLessThanOrEqual(CEILING[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
