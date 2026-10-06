import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureScrollWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  NO_PLUGINS,
  PERF_TIMEOUT,
  SMALL,
  CONTENT_SCROLL,
  submittedCellsSeed,
} from './perf-cases'

// Производительность ПРОКРУТКИ: операция × объём × плагины, замер на
// PROD-сборке под ×4 CPU-троттлингом, метрика p95 работы на кадр по обеим осям.
//
// ПОЛИТИКА ПОРОГОВ (см. память perf-methodology):
//  - Жёсткого гейта 60fps НЕТ ни у одного кейса. Под ×4 троттлингом p95 шумит, и
//    требование p95 ≤ 16.67мс флапало даже на небольшом гриде (P2: baseline ~13мс,
//    но одиночные спайки до ~17мс — это дисперсия замера, а не регресс).
//  - Вместо этого у КАЖДОГО кейса РЕГРЕСС-ГЕЙТ: потолок заметно выше текущего p95
//    (≈2× baseline). Тест падает только на реальной деградации, а не на разбросе.
//    Реальные p95 пишутся в дашборд — тренд к эталону 60fps виден и без гейта.
//  - Почему 60fps на масштабе недостижим в принципе: под ×4 троттлингом даже
//    1000-колоночный грид (без плагинов!) на горизонтальном скролле у самой границы
//    60fps, а «широкий × все плагины» — за пределами DOM-архитектуры (ведущие
//    DOM-гриды дают ~27–38fps на скролле даже без троттлинга на быстром M4; 60fps на
//    масштабе — только canvas).

interface ScrollCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  // Потолок регресс-гейта (p95 по осям, ≈2× baseline). Тест падает только при
  // превышении — это регистрация регресса, а не требование 60fps. Есть у всех кейсов.
  regressionCeiling: { y: number; x: number }
}

const CASES: ScrollCase[] = [
  {
    id: 'P2',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
    // baseline ~13/13мс (в бюджете 60fps), но под ×4 троттлингом одиночные спайки до
    // ~17мс на дисперсии — жёсткий 60fps флапал. Регресс-гейт с запасом ≈2×.
    regressionCeiling: { y: 24, x: 24 },
  },
  {
    id: 'P4',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
    // 1000 колонок под ×4 троттлингом — у самой границы 60fps (шумит 16–24мс);
    // регресс-гейт с запасом.
    regressionCeiling: { y: 26, x: 30 },
  },
  {
    id: 'P7',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    regressionCeiling: { y: 28, x: 45 },
  },
  {
    id: 'P8',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    regressionCeiling: { y: 34, x: 70 },
  },
]

// Готовность — по контракту селекторов (`.data-grid__head-cell`), а не по тексту
// мока.
const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

describe('Производительность прокрутки', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args)
        await waitForGrid()

        const y = await measureScrollWork('y')
        const x = await measureScrollWork('x')

        const budgetY = c.regressionCeiling.y
        const budgetX = c.regressionCeiling.x
        const size =
          c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'
        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'scroll',
          size,
          plugins: c.args.enableColumnSorting ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          // Гейта 60fps нет: пробой потолка — это регресс (в дашборде 'regr', не
          // 'xfail'), а не «ожидаемый недостиг».
          knownShortfall: false,
          metrics: [
            {
              axis: 'y',
              kind: 'animation',
              metric: 'p95',
              valueMs: y.p95Ms,
              budgetMs: budgetY,
              pass: y.p95Ms <= budgetY,
              ...y,
            },
            {
              axis: 'x',
              kind: 'animation',
              metric: 'p95',
              valueMs: x.p95Ms,
              budgetMs: budgetX,
              pass: x.p95Ms <= budgetX,
              ...x,
            },
          ],
        })

        // soft — обе оси репортятся независимо; сверяем с регресс-потолком кейса
        // (жёсткого 60fps-гейта нет, см. политику в шапке файла).
        expect
          .soft(
            y.p95Ms,
            `Y p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms over-budget=${y.tasksOverBudget}/${y.taskCount} (limit ${budgetY})`,
          )
          .toBeLessThanOrEqual(budgetY)
        expect
          .soft(
            x.p95Ms,
            `X p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms over-budget=${x.tasksOverBudget}/${x.taskCount} (limit ${budgetX})`,
          )
          .toBeLessThanOrEqual(budgetX)
      },
      PERF_TIMEOUT,
    )
  }
})

// Прокрутка с отправленными ячейками правки (ADR 0041, AS14): 500 строк × 3 колонки
// в ожидании и «ошибке» против той же выборки без них — видна цена новых состояний.
// Скорость ниже порога быстрой прокрутки (CONTENT_SCROLL): иначе ячейки — скелеты.
describe('Производительность прокрутки — ожидание и «ошибка» правки', () => {
  test(
    'AS14: прокрутка небольшой выборки с 1500 отправленными ячейками — в пределах регресс-потолка; база без них в дашборде',
    async () => {
      const args = { ...SMALL, enableCellEditing: true }
      const measure = async (seeded: boolean) => {
        const screen = renderGrid({
          ...args,
          extraPlugins: seeded ? [submittedCellsSeed(SMALL.dataCount)] : [],
        })
        await waitForGrid()
        if (seeded) {
          await expect
            .poll(() => document.querySelector('[aria-busy="true"]'))
            .not.toBeNull()
        }
        // Медленно, без быстрой прокрутки: ячейки рисуются, а не заменяются скелетами.
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const seeded = await measure(true)
      // Регресс-потолок ≈2× замера базы (y ~12мс, x ~19–21мс), как у P2/P7.
      const ceiling = { y: 24, x: 35 }
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '30×500',
          plugins: 'cellEditing',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            budgetMs: ceiling[axis],
            pass: !gated || r[axis].p95Ms <= ceiling[axis],
            ...r[axis],
          })),
        })
      await record('AS14-base', 'правка без отправленных ячеек', base, false)
      await record('AS14', '1500 ячеек в ожидании и «ошибке»', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            seeded[axis].p95Ms,
            `${axis.toUpperCase()} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
          )
          .toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Блик ожидания правки (ADR 0057, CF12): 500 строк × 3 колонки, все в ожидании —
// бесконечная анимация контура на каждой смонтированной ячейке — против той же
// выборки без отправленных ячеек.
describe('Производительность прокрутки — блик ожидания правки', () => {
  test(
    'CF12: прокрутка с 1500 ячейками в ожидании (блик) — в пределах регресс-потолка; база без них в дашборде',
    async () => {
      const args = { ...SMALL, enableCellEditing: true }
      const measure = async (seeded: boolean) => {
        const screen = renderGrid({
          ...args,
          extraPlugins: seeded
            ? [submittedCellsSeed(SMALL.dataCount, 'pending')]
            : [],
        })
        await waitForGrid()
        if (seeded) {
          await expect
            .poll(() => document.querySelector('[data-pending]'))
            .not.toBeNull()
        }
        // Медленно, без быстрой прокрутки: ячейки (и блики) рисуются, а не
        // заменяются скелетами.
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const seeded = await measure(true)
      // Потолок — как у AS14 (≈2× замера базы).
      const ceiling = { y: 24, x: 35 }
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '30×500',
          plugins: 'cellEditing',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            budgetMs: ceiling[axis],
            pass: !gated || r[axis].p95Ms <= ceiling[axis],
            ...r[axis],
          })),
        })
      await record('CF12-base', 'правка без отправленных ячеек', base, false)
      await record('CF12', '1500 ячеек в ожидании с бликом', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            seeded[axis].p95Ms,
            `${axis.toUpperCase()} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
          )
          .toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
