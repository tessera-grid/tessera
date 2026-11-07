import { describe, expect, test } from 'vitest'

import { measureScrollWork, recordPerf } from '../helpers'
import { renderGrid } from './hosts'
import { waitForGrid } from '../visual/core-helpers'
import {
  ALL_PLUGINS,
  ANIMATION_BUDGET_MS,
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

describe('Производительность прокрутки — касания', () => {
  test(
    'TU13: прокрутка 1000×1000 без наведения меряется и пишется в дашборд рядом с базой с мышью',
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
        metrics: (['y', 'x'] as const).map(axis => ({
          axis,
          kind: 'animation' as const,
          metric: 'p95' as const,
          valueMs: result[axis].p95Ms,
          targetMs: ANIMATION_BUDGET_MS,
          ...result[axis],
        })),
      })
    },
    PERF_TIMEOUT * 2,
  )
})
