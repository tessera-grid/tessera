import { describe, expect, test } from 'vitest'

import { measureInteractionWork, recordPerf, renderGrid } from '../helpers'
import { INTERACTION_BUDGET_MS } from '../perf.constants'
import { waitForGrid } from '../visual/core-helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
} from './perf-cases'

// Смена темы (ADR 0090, TM11): `.dark` на `<html>` у грида 1000×1000 со всеми
// плагинами — наблюдатель предков, гашение переходов на кадр смены и перерисовка
// порталов. Бюджет — INP.

const isDark = () =>
  getComputedStyle(
    document.querySelector('.data-grid-theme[class*="theme-wrapper"]')!,
  ).colorScheme === 'dark'

describe('Отзывчивость — смена темы', () => {
  test(
    'TM11: смена темы классом .dark на <html> у грида 1000×1000 со всеми плагинами — в бюджете INP',
    async () => {
      const screen = renderGrid({ ...LARGE, ...ALL_PLUGINS })
      await waitForGrid()
      const root = document.documentElement
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
        await recordPerf({
          id: 'TM11',
          label: 'смена темы .dark на <html>',
          operation: 'interaction',
          size: '1000×1000',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              budgetMs: INTERACTION_BUDGET_MS,
              pass: result.longestMs <= INTERACTION_BUDGET_MS,
              ...result,
            },
          ],
        })
        expect(result.longestMs, 'TM11 longest').toBeLessThanOrEqual(
          INTERACTION_BUDGET_MS,
        )
      } finally {
        root.classList.remove('dark')
        ;(await screen).unmount()
      }
    },
    PERF_TIMEOUT,
  )
})
