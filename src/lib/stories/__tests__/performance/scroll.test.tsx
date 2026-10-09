import { cleanup } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureRenderWork,
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
  FAST_SCROLL,
  submittedCellsSeed,
  sortAllColumnsSeed,
  actionStatusSeed,
  highlightSeed,
} from './perf-cases'
import { makeData } from '../../__mocks__/data'

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
  // Спокойная прокрутка той же выборки (CONTENT_SCROLL): ячейки рисуются содержимым.
  content: { id: string; regressionCeiling: { y: number; x: number } }
}

const CASES: ScrollCase[] = [
  {
    id: 'P2',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
    // база быстрой прокрутки (FAST_SCROLL) ~11/20мс; под ×4 троттлингом одиночные
    // спайки — жёсткий 60fps флапал. Регресс-гейт с запасом ≈2×.
    regressionCeiling: { y: 24, x: 40 },
    content: {
      id: 'P10',
      // база ~10/19мс
      regressionCeiling: { y: 20, x: 38 },
    },
  },
  {
    id: 'P4',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
    // база ~14/24мс: 1000 колонок под ×4 троттлингом — у границы 60fps; регресс-гейт
    // с запасом.
    regressionCeiling: { y: 28, x: 44 },
    content: {
      id: 'P11',
      // база ~13/20мс
      regressionCeiling: { y: 26, x: 40 },
    },
  },
  {
    id: 'P7',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    // база с клавиатурной навигацией ~25/51мс
    regressionCeiling: { y: 40, x: 80 },
    content: {
      id: 'P12',
      // база ~21/35мс
      regressionCeiling: { y: 40, x: 68 },
    },
  },
  {
    id: 'P8',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    // база с клавиатурной навигацией ~32/52мс
    regressionCeiling: { y: 50, x: 85 },
    content: {
      id: 'P13',
      // база ~26/38мс
      regressionCeiling: { y: 50, x: 75 },
    },
  },
]

// Готовность — по контракту селекторов (`.data-grid__head-cell`), а не по тексту
// мока.
const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const runScrollCase = async (
  c: ScrollCase,
  id: string,
  label: string,
  ceiling: { y: number; x: number },
  speed: typeof CONTENT_SCROLL | typeof FAST_SCROLL,
) => {
  renderGrid(c.args)
  await waitForGrid()

  const y = await measureScrollWork('y', speed.y)
  const x = await measureScrollWork('x', speed.x)

  const size = c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'
  await recordPerf({
    id,
    label,
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
        budgetMs: ceiling.y,
        pass: y.p95Ms <= ceiling.y,
        ...y,
      },
      {
        axis: 'x',
        kind: 'animation',
        metric: 'p95',
        valueMs: x.p95Ms,
        budgetMs: ceiling.x,
        pass: x.p95Ms <= ceiling.x,
        ...x,
      },
    ],
  })

  // soft — обе оси репортятся независимо; сверяем с регресс-потолком кейса
  // (жёсткого 60fps-гейта нет, см. политику в шапке файла).
  expect
    .soft(
      y.p95Ms,
      `Y p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms over-budget=${y.tasksOverBudget}/${y.taskCount} (limit ${ceiling.y})`,
    )
    .toBeLessThanOrEqual(ceiling.y)
  expect
    .soft(
      x.p95Ms,
      `X p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms over-budget=${x.tasksOverBudget}/${x.taskCount} (limit ${ceiling.x})`,
    )
    .toBeLessThanOrEqual(ceiling.x)
}

describe('Производительность прокрутки', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      () => runScrollCase(c, c.id, c.label, c.regressionCeiling, FAST_SCROLL),
      PERF_TIMEOUT,
    )
  }
})

// Спокойная прокрутка (P10–P13, ADR 0004): скорость ниже порога быстрой прокрутки —
// ячейки рисуются содержимым, замер видит цену ячеек и плагинов, а не скелетов.
describe('Производительность прокрутки — спокойная скорость', () => {
  for (const c of CASES) {
    const label = `${c.label}, спокойная прокрутка`
    test(
      `${c.content.id}: ${label}`,
      () =>
        runScrollCase(
          c,
          c.content.id,
          label,
          c.content.regressionCeiling,
          CONTENT_SCROLL,
        ),
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

// Ожидание и отказ действий в кебабах строк (ADR 0078, MI23): у всех 500 строк
// «Delete» через строку ждёт (бесконечный блик) или упало (отметка ошибки) — против
// той же выборки без состояний. Скорость ниже порога быстрой прокрутки.
describe('Производительность прокрутки — ожидание и отказ действий меню', () => {
  test(
    'MI23: прокрутка 30×500 с ожиданием и отказами на 500 кебабах строк — в пределах регресс-потолка; база без них в дашборде',
    async () => {
      const args = {
        ...SMALL,
        enableRowActions: true,
        enableRowActionMenu: true,
      }
      const errorMark = () =>
        document.querySelector('[data-error-indicator][data-shown="true"]')
      const measure = async (seeded: boolean) => {
        const screen = renderGrid({
          ...args,
          extraPlugins: seeded ? [actionStatusSeed(SMALL.dataCount)] : [],
        })
        await waitForGrid()
        await expect.poll(() => errorMark() !== null).toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const seeded = await measure(true)
      // Потолок — как у RH8 при той же базе (y ~17мс, x ~26мс).
      const ceiling = { y: 26, x: 40 }
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
          plugins: 'rowActions',
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
      await record('MI23-base', 'кебабы строк без состояний', base, false)
      await record('MI23', '500 кебабов в ожидании и с отказом', seeded, true)

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

// Линии дерева (ADR 0058, RE60): раскрытое дерево 50 корней × 3 уровня по 3 ребёнка
// (650 строк) с линиями против того же дерева без них; скорость ниже порога быстрой
// прокрутки — ячейки отступа рисуются, а не заменяются скелетами.
describe('Производительность прокрутки — линии дерева', () => {
  test(
    'RE60: прокрутка раскрытого дерева с линиями — в пределах регресс-потолка; база без линий в дашборде',
    async () => {
      const tree = makeData({ shape: 'tree', count: 50, depth: 3, breadth: 3 })
      const measure = async (treeLines: boolean) => {
        const screen = renderGrid({
          ...SMALL,
          dataOverride: tree,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 3,
          rowExpandingTreeLines: treeLines,
          initialExpanded: true,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        // Дерево раскрыто, и линии есть ровно тогда, когда включены.
        await expect
          .poll(() => document.querySelector('[data-tree-depth]') !== null)
          .toBe(treeLines)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const lined = await measure(true)
      // Потолок ≈2× замера базы (y ~10мс, x ~15мс).
      const ceiling = { y: 20, x: 31 }
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
          size: '650 строк дерева',
          plugins: 'rowExpanding',
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
      await record('RE60-base', 'дерево без линий', base, false)
      await record('RE60', 'дерево с линиями', lined, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            lined[axis].p95Ms,
            `${axis.toUpperCase()} p95=${lined[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
          )
          .toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Индикатор активного действия (ADR 0062, AI10): 1000×1000 со всеми плагинами, у
// каждого заголовка активна сортировка (номер приоритета), против той же выборки без
// сортировки. Горизонтальная прокрутка монтирует заголовки с индикаторами.
describe('Производительность прокрутки — индикатор активного действия', () => {
  test(
    'AI10: горизонтальная прокрутка 1000×1000 со всеми плагинами, где у каждого заголовка активна сортировка, — в пределах регресс-потолка; база без сортировки в дашборде',
    async () => {
      const measure = async (sorted: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...ALL_PLUGINS,
          extraPlugins: sorted ? [sortAllColumnsSeed()] : [],
        })
        await waitForGrid()
        await expect
          .poll(() => document.querySelector('[data-sort-priority]') !== null)
          .toBe(sorted)
        // Медленно, без быстрой прокрутки: заголовки рисуются с кнопками, а не скелетами.
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return x
      }

      const base = await measure(false)
      const sorted = await measure(true)
      // Потолок — около P13 по X: спокойная прокрутка того же грида.
      const ceiling = 70
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
          size: '1000×1000',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              axis: 'x',
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              budgetMs: ceiling,
              pass: !gated || r.p95Ms <= ceiling,
              ...r,
            },
          ],
        })
      await record('AI10-base', 'заголовки без сортировки', base, false)
      await record('AI10', 'сортировка по всем колонкам', sorted, true)

      expect(
        sorted.p95Ms,
        `X p95=${sorted.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Высота строки (ADR 0077, RH8): 1000×1000 без плагинов, спокойная прокрутка при
// строках 40px против той же выборки при 50px — в окне больше строк.
describe('Производительность прокрутки — высота строки', () => {
  test(
    'RH8: прокрутка 1000×1000 при rowHeight 40 — в пределах потолков P11; база при 50px в дашборде',
    async () => {
      const measure = async (rowHeight: number) => {
        const screen = renderGrid({ ...LARGE, ...NO_PLUGINS, rowHeight })
        await waitForGrid()
        await expect
          .poll(() =>
            Math.round(
              document
                .querySelector('.data-grid__body-row')!
                .getBoundingClientRect().height,
            ),
          )
          .toBe(rowHeight)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(50)
      const compact = await measure(40)
      const ceiling = { y: 26, x: 40 }
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
          size: '1000×1000',
          plugins: 'none',
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
      await record('RH8-base', 'строки 50px', base, false)
      await record('RH8', 'строки 40px', compact, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          compact[axis].p95Ms,
          `${axis} p95=${compact[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Публичная подсветка (ADR 0080, HL19): 1000×1000 без плагинов, спокойная прокрутка со
// 100 залитыми строками и колонкой с бесконечным бликом против той же выборки без них.
describe('Производительность прокрутки — подсветка', () => {
  test(
    'HL19: прокрутка 1000×1000 со 100 подсвеченными строками и колонкой с бликом — в пределах потолков P11; база без подсветки в дашборде',
    async () => {
      const measure = async (seeded: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          extraPlugins: seeded ? [highlightSeed(LARGE.dataCount)] : [],
        })
        await waitForGrid()
        await expect
          .poll(
            () => document.querySelector('[data-highlight-shimmer]') !== null,
          )
          .toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const seeded = await measure(true)
      const ceiling = { y: 26, x: 40 }
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
          size: '1000×1000',
          plugins: 'none',
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
      await record('HL19-base', 'без подсветки', base, false)
      await record('HL19', '100 строк и колонка с бликом', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          seeded[axis].p95Ms,
          `${axis} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Тултип обрезанного текста (ADR 0075, OT11): 1000×1000 без плагинов, монтирование и
// спокойная прокрутка с тултипом против той же выборки без него.
describe('Производительность — тултип обрезанного текста', () => {
  test(
    'OT11: прокрутка и монтирование с тултипом обрезанного текста — в пределах потолков P11 и P3; база без тултипа в дашборде',
    async () => {
      const measure = async (enableOverflowTooltip: boolean) => {
        const args = { ...LARGE, ...NO_PLUGINS, enableOverflowTooltip }
        const mount = await measureRenderWork(
          () => renderGrid(args),
          () => headCells().length > 0,
        )
        await cleanup()
        const screen = renderGrid(args)
        await waitForGrid()
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { mount, y, x }
      }

      const base = await measure(false)
      const withTooltip = await measure(true)
      // Потолки — у P11 (спокойная прокрутка той же выборки) и P3 (её монтирование).
      const ceiling = { y: 26, x: 40, mount: 350 }
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
          size: '1000×1000',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            ...(['y', 'x'] as const).map(axis => ({
              axis,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r[axis].p95Ms,
              budgetMs: ceiling[axis],
              pass: !gated || r[axis].p95Ms <= ceiling[axis],
              ...r[axis],
            })),
            {
              kind: 'load' as const,
              metric: 'longest' as const,
              valueMs: r.mount.longestMs,
              budgetMs: ceiling.mount,
              pass: !gated || r.mount.longestMs <= ceiling.mount,
              ...r.mount,
            },
          ],
        })
      await record('OT11-base', 'без тултипа', base, false)
      await record('OT11', 'с тултипом обрезанного текста', withTooltip, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          withTooltip[axis].p95Ms,
          `${axis} p95=${withTooltip[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
      expect(
        withTooltip.mount.longestMs,
        `монтирование ${withTooltip.mount.longestMs.toFixed(0)}ms (база ${base.mount.longestMs.toFixed(0)}ms, потолок ${ceiling.mount})`,
      ).toBeLessThanOrEqual(ceiling.mount)
    },
    PERF_TIMEOUT * 2,
  )
})

// Лента (ADR 0081, IS17): 1000 колонок без плагинов, 8 строк и скелет-хвост ожидания в
// окне с первого кадра (ответ не приходит) — против окна, полного строк, без ленты.
// Хвост вне окна держит только высоту, поэтому замер ставит его в окно.
describe('Производительность прокрутки — лента', () => {
  test(
    'IS17: спокойная прокрутка со скелет-хвостом в окне не хуже окна, полного строк, без ленты',
    async () => {
      const measure = async (feed: boolean) => {
        const screen = renderGrid({
          columnCount: 1000,
          dataCount: feed ? 8 : 30,
          ...NO_PLUGINS,
          ...(feed && {
            enableInfiniteScroll: true,
            infiniteScrollOptions: {
              hasMore: true,
              threshold: 1000,
              onLoadMore: () => new Promise<void>(() => {}),
            },
          }),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect
          .poll(
            () =>
              document.querySelector(
                '.data-grid__body--infinite-tail .data-grid__body-row--skeleton',
              ) !== null,
          )
          .toBe(feed)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const feed = await measure(true)
      // Скелет-строка не дороже строки с данными; шум p95 под троттлингом — до ~30%.
      const ceiling = {
        y: Math.max(base.y.p95Ms * 1.3, base.y.p95Ms + 4),
        x: Math.max(base.x.p95Ms * 1.3, base.x.p95Ms + 4),
      }
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
          size: '8–30×1000',
          plugins: 'none',
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
      await record('IS17-base', 'окно строк без ленты', base, false)
      await record('IS17', 'скелет-хвост ленты в окне', feed, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          feed[axis].p95Ms,
          `${axis} p95=${feed[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Кнопка «наверх» (ADR 0082, BT14): 1000×1000 с нижней панелью, спокойная прокрутка
// с кнопкой против той же выборки без неё — подписка на прокрутку и пересечение порога.
describe('Производительность прокрутки — кнопка «наверх»', () => {
  test(
    'BT14: прокрутка 1000×1000 с кнопкой «наверх» — в пределах потолков P11; база без кнопки в дашборде',
    async () => {
      const measure = async (withButton: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          enableStatusBar: true,
          enableBackToTop: withButton,
        })
        await waitForGrid()
        await expect
          .poll(
            () =>
              document.querySelector('[data-testid="back-to-top"]') !== null,
          )
          .toBe(withButton)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const base = await measure(false)
      const withButton = await measure(true)
      const ceiling = { y: 26, x: 40 }
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
          size: '1000×1000',
          plugins: 'backToTop',
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
      await record('BT14-base', 'нижняя панель без кнопки', base, false)
      await record('BT14', 'нижняя панель с кнопкой «наверх»', withButton, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          withButton[axis].p95Ms,
          `${axis} p95=${withButton[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis]})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
