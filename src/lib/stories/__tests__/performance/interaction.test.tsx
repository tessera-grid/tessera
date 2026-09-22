import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureInteractionWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'
import { INTERACTION_BUDGET_MS } from '../perf.constants'

// Отзывчивость на ВЗАИМОДЕЙСТВИЕ (INP): выбор ОДНОЙ строки меняет только
// срез rowSelection на одну запись — законной работы минимум (обновить одну строку и
// её чекбокс), поэтому всё остальное во измеренной задаче есть «лишние» ре-рендеры от
// широких подписок компонентов на весь стейт. Метрика — самая длинная задача главного
// потока (синхронный blob обработчик→рендер→коммит→layout), сверяется с бюджетом RAIL
// Response под ×4 CPU-троттлингом.

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const firstRowCheckbox = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row .row-select-checkbox',
  )

interface InteractionCase {
  id: string
  label: string
  args: Record<string, number | boolean>
}

const CASES: InteractionCase[] = [
  {
    id: 'I1',
    label: 'выбор строки, небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
  },
  {
    id: 'I2',
    label: 'выбор строки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
  },
]

describe('Отзывчивость взаимодействий (INP)', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args)
        await waitForGrid()

        // Нативный .click() (а не userEvent) — чтобы НЕ мерить тяжёлые проверки
        // видимости userEvent (getComputedStyle/checkVisibility), а только работу
        // приложения: обработчик → обновление стейта → ре-рендер → коммит.
        const result = await measureInteractionWork(async () => {
          firstRowCheckbox()?.click()
        })

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'interaction',
          size:
            c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500',
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

        // Переключение выбора не переставляет строки/колонки — синхронная работа не
        // должна порождать длинную задачу. Превышение = лишние ре-рендеры (широкие
        // подписки компонентов на весь стейт).
        expect(
          result.longestMs,
          `longest=${result.longestMs.toFixed(1)}ms tasks=${result.taskCount}`,
        ).toBeLessThanOrEqual(INTERACTION_BUDGET_MS)
      },
      PERF_TIMEOUT,
    )
  }
})
