import { describe, expect, test } from 'vitest'

import { measureInteractionWork, recordPerf, renderGrid } from '../helpers'
import { INTERACTION_BUDGET_MS } from '../perf.constants'
import { againstBase, ceilingOver, medianRun } from './baseline'
import { waitForGrid } from '../visual/core-helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  NO_PLUGINS,
  PERF_TIMEOUT,
} from './perf-cases'

// Смена темы (ADR 0090, TM11): `.dark` на `<html>` у грида 1000×1000 со всеми
// плагинами — наблюдатель предков, гашение переходов на кадр смены и перерисовка
// порталов — против той же смены у грида без плагинов (ADR 0099, §1а).

/** Цена плагинов при смене темы против грида без них. */
const TM11_COST = { ratio: 1.3, plusMs: 40 }

const isDark = () =>
  getComputedStyle(
    document.querySelector('.data-grid-theme[class*="theme-wrapper"]')!,
  ).colorScheme === 'dark'

describe('Отзывчивость — смена темы', () => {
  test(
    'TM11: смена темы классом .dark на <html> у грида 1000×1000 со всеми плагинами не дороже смены у грида без плагинов',
    async () => {
      const root = document.documentElement
      const measure = async (plugins: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...(plugins ? ALL_PLUGINS : NO_PLUGINS),
        })
        await waitForGrid()
        try {
          const result = await measureInteractionWork(
            async () => {
              root.classList.add('dark')
            },
            {
              afterWarmup: () => {
                expect(isDark()).toBe(true)
                root.classList.remove('dark')
              },
            },
          )
          expect(isDark()).toBe(true)
          return result
        } finally {
          root.classList.remove('dark')
          ;(await screen).unmount()
        }
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const plugins = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, TM11_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1000×1000',
          plugins: gated ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('TM11-base', 'смена темы, без плагинов', base, false)
      await record('TM11', 'смена темы, все плагины', plugins, true)
      expect(
        plugins.longestMs,
        `TM11 longest=${plugins.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})
