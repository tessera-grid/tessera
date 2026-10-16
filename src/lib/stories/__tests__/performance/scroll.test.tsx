import { cleanup, render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureRenderWork,
  measureScrollWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  againstBase,
  axesCeiling,
  ceilingOver,
  medianAxes,
  medianRun,
} from './baseline'
import {
  ALL_PLUGINS,
  ANIMATION_BUDGET_MS,
  CPU_THROTTLE_RATE,
  LARGE,
  LOAD_BUDGET_MS,
  NO_PLUGINS,
  PERF_TIMEOUT,
  SMALL,
  CONTENT_SCROLL,
  FAST_SCROLL,
  submittedCellsSeed,
  sortAllColumnsSeed,
  actionStatusSeed,
  highlightSeed,
  INLINE_HEADER_ACTIONS,
} from './perf-cases'
import { makeData } from '../../__mocks__/data'
import { argsToPlugins } from '../../__mocks__/utils/argsToPlugins'
import { renderPluginsGrid } from './hosts'
import {
  cellSelectionModel,
  columnFilteringModel,
  columnSortingModel,
  dataExportModel,
  paginationModel,
  quickSearchModel,
  rowExpandingModel,
  rowGroupingModel,
  rowSelectionModel,
} from '../../../plugins'

// Производительность ПРОКРУТКИ: операция × объём × плагины, замер на
// PROD-сборке под ×4 CPU-троттлингом, метрика p95 работы на кадр по обеим осям.
//
// Время матрицу не гейтит (ADR 0099, PF1): p95 идёт в дашборд против цели RAIL
// Animation, регрессии ловит `perf:compare`. Кейс фичи гейтится против базы того же
// теста (`againstBase`, PF22).

interface ScrollCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  /** Спокойная прокрутка той же выборки (CONTENT_SCROLL): ячейки рисуются содержимым. */
  content: { id: string }
  /** «Без плагинов» — `plugins: []` своим хостом, без обвязки историй (ADR 0004). */
  bare?: boolean
}

const CASES: ScrollCase[] = [
  {
    id: 'P2',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL },
    content: { id: 'P10' },
    bare: true,
  },
  {
    id: 'P4',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE },
    content: { id: 'P11' },
    bare: true,
  },
  {
    id: 'P7',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    content: { id: 'P12' },
  },
  {
    id: 'P8',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    content: { id: 'P13' },
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
  speed: typeof CONTENT_SCROLL | typeof FAST_SCROLL,
) => {
  if (c.bare) {
    renderPluginsGrid({
      columnCount: Number(c.args.columnCount),
      dataCount: Number(c.args.dataCount),
    })
  } else {
    renderGrid(c.args)
  }
  await waitForGrid()

  const y = await measureScrollWork('y', speed.y)
  const x = await measureScrollWork('x', speed.x)

  const size = c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'
  await recordPerf({
    id,
    label,
    operation: 'scroll',
    size,
    plugins: c.bare ? 'none' : 'all',
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        axis: 'y',
        kind: 'animation',
        metric: 'p95',
        valueMs: y.p95Ms,
        targetMs: ANIMATION_BUDGET_MS,
        ...y,
      },
      {
        axis: 'x',
        kind: 'animation',
        metric: 'p95',
        valueMs: x.p95Ms,
        targetMs: ANIMATION_BUDGET_MS,
        ...x,
      },
    ],
  })
}

describe('Производительность прокрутки', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      () => runScrollCase(c, c.id, c.label, FAST_SCROLL),
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
      () => runScrollCase(c, c.content.id, label, CONTENT_SCROLL),
      PERF_TIMEOUT,
    )
  }
})

// Цена фичи против базы того же теста (ADR 0099, §1а): во столько раз или на столько мс.
const AS14_COST = { ratio: 3, plusMs: 4 }
const CF12_COST = { ratio: 3, plusMs: 4 }
const MI23_COST = { ratio: 1.3, plusMs: 4 }
const TL8_COST = { ratio: 1.3, plusMs: 4 }
const AI10_COST = { ratio: 1.3, plusMs: 4 }
const RH8_COST = { ratio: 1.3, plusMs: 4 }
const HL19_COST = { ratio: 1.3, plusMs: 4 }
const OT11_COST = { ratio: 1.3, plusMs: 4 }
const OT11_MOUNT_COST = { ratio: 1.3, plusMs: 40 }
const BT14_COST = { ratio: 1.3, plusMs: 4 }
const GL13_COST = { ratio: 1.3, plusMs: 4 }
const FT14_COST = { ratio: 1.1, plusMs: 2 }

// Прокрутка с отправленными ячейками правки (ADR 0041, AS14): 500 строк × 3 колонки
// в ожидании и «ошибке» против той же выборки без них — видна цена новых состояний.
// Скорость ниже порога быстрой прокрутки (CONTENT_SCROLL): иначе ячейки — скелеты.
describe('Производительность прокрутки — ожидание и «ошибка» правки', () => {
  test(
    'AS14: прокрутка небольшой выборки с 1500 отправленными ячейками не дороже той же выборки без них больше чем в 3 раза',
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const seeded = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, AS14_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('AS14-base', 'правка без отправленных ячеек', base, false)
      await record('AS14', '1500 ячеек в ожидании и «ошибке»', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            seeded[axis].p95Ms,
            `${axis.toUpperCase()} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
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
    'CF12: прокрутка с 1500 ячейками в ожидании не дороже той же выборки без них больше чем в 3 раза',
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const seeded = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, CF12_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('CF12-base', 'правка без отправленных ячеек', base, false)
      await record('CF12', '1500 ячеек в ожидании с бликом', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            seeded[axis].p95Ms,
            `${axis.toUpperCase()} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
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
    'MI23: прокрутка 30×500 с ожиданием и отказами на 500 кебабах строк не дороже той же выборки без них',
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const seeded = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, MI23_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('MI23-base', 'кебабы строк без состояний', base, false)
      await record('MI23', '500 кебабов в ожидании и с отказом', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            seeded[axis].p95Ms,
            `${axis.toUpperCase()} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
          )
          .toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Линии дерева (ADR 0102, TL8): раскрытое дерево 50 корней × 3 уровня по 3 ребёнка
// (650 строк) с линиями против того же дерева без них; скорость ниже порога быстрой
// прокрутки — ячейки отступа рисуются, а не заменяются скелетами.
describe('Производительность прокрутки — линии дерева', () => {
  test(
    'TL8: прокрутка раскрытого дерева с линиями не дороже того же дерева без линий',
    async () => {
      const tree = makeData({ shape: 'tree', count: 50, depth: 3, breadth: 3 })
      const measure = async (treeLines: boolean) => {
        const screen = renderGrid({
          ...SMALL,
          dataOverride: tree,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 3,
          enableTreeLines: treeLines,
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const lined = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, TL8_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('TL8-base', 'дерево без линий', base, false)
      await record('TL8', 'дерево с линиями', lined, true)

      for (const axis of ['y', 'x'] as const) {
        expect
          .soft(
            lined[axis].p95Ms,
            `${axis.toUpperCase()} p95=${lined[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
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
    'AI10: горизонтальная прокрутка 1000×1000 со всеми плагинами, где у каждого заголовка активна сортировка, не дороже той же выборки без сортировки',
    async () => {
      const measure = async (sorted: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...ALL_PLUGINS,
          ...INLINE_HEADER_ACTIONS,
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

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const sorted = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, AI10_COST)
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
          metrics: [
            {
              axis: 'x',
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('AI10-base', 'заголовки без сортировки', base, false)
      await record('AI10', 'сортировка по всем колонкам', sorted, true)

      expect(
        sorted.p95Ms,
        `X p95=${sorted.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Высота строки (ADR 0077, RH8): 1000×1000 без плагинов, спокойная прокрутка при
// строках 40px против той же выборки при 50px — в окне больше строк.
describe('Производительность прокрутки — высота строки', () => {
  test(
    'RH8: прокрутка 1000×1000 при rowHeight 40 не дороже той же выборки при 50px',
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

      const runs = await againstBase(compact => measure(compact ? 40 : 50))
      const base = medianAxes(runs.base)
      const compact = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, RH8_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('RH8-base', 'строки 50px', base, false)
      await record('RH8', 'строки 40px', compact, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          compact[axis].p95Ms,
          `${axis} p95=${compact[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Публичная подсветка (ADR 0080, HL19): 1000×1000 без плагинов, спокойная прокрутка со
// 100 залитыми строками и залитой колонкой против той же выборки без них.
describe('Производительность прокрутки — подсветка', () => {
  test(
    'HL19: прокрутка 1000×1000 со 100 подсвеченными строками и подсвеченной колонкой не дороже той же выборки без подсветки',
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
            () => document.querySelector('[data-column-highlight]') !== null,
          )
          .toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const seeded = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, HL19_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('HL19-base', 'без подсветки', base, false)
      await record('HL19', '100 строк и колонка', seeded, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          seeded[axis].p95Ms,
          `${axis} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
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
    'OT11: прокрутка и монтирование с тултипом обрезанного текста не дороже, чем без него',
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

      const runs = await againstBase(measure)
      const pick = (side: typeof runs.base) => ({
        ...medianAxes(side),
        mount: medianRun(
          side.map(run => run.mount),
          r => r.longestMs,
        ),
      })
      const base = pick(runs.base)
      const withTooltip = pick(runs.variant)
      const ceiling = {
        ...axesCeiling(base, OT11_COST),
        mount: ceilingOver(base.mount.longestMs, OT11_MOUNT_COST),
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
          size: '1000×1000',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            ...(['y', 'x'] as const).map(axis => ({
              axis,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r[axis].p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling[axis] : undefined,
              ...r[axis],
            })),
            {
              kind: 'load' as const,
              metric: 'longest' as const,
              valueMs: r.mount.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling.mount : undefined,
              ...r.mount,
            },
          ],
        })
      await record('OT11-base', 'без тултипа', base, false)
      await record('OT11', 'с тултипом обрезанного текста', withTooltip, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          withTooltip[axis].p95Ms,
          `${axis} p95=${withTooltip[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
      expect(
        withTooltip.mount.longestMs,
        `монтирование ${withTooltip.mount.longestMs.toFixed(0)}ms (база ${base.mount.longestMs.toFixed(0)}ms, потолок ${ceiling.mount.toFixed(0)})`,
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
            infiniteScrollHasMore: true,
            infiniteScrollThreshold: 1000,
            onLoadMore: () => new Promise<void>(() => {}),
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const feed = medianAxes(runs.variant)
      // Скелет-строка не дороже строки с данными; шум p95 под троттлингом — до ~30%.
      const ceiling = axesCeiling(base, { ratio: 1.3, plusMs: 4 })
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
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
    'BT14: прокрутка 1000×1000 с кнопкой «наверх» не дороже той же выборки без неё',
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

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const withButton = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, BT14_COST)
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
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('BT14-base', 'нижняя панель без кнопки', base, false)
      await record('BT14', 'нижняя панель с кнопкой «наверх»', withButton, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          withButton[axis].p95Ms,
          `${axis} p95=${withButton[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Кнопка «к первой колонке» (ADR 0105, BT23): 1000×1000 с нижней панелью, спокойная
// горизонтальная прокрутка с обеими кнопками против той же выборки без плагина —
// подписки на прокрутку и размер области.
describe('Производительность прокрутки — кнопка «к первой колонке»', () => {
  test(
    'BT23: горизонтальная прокрутка 1000×1000 с обеими кнопками не дороже той же выборки без них',
    async () => {
      const measure = async (withButtons: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          enableStatusBar: true,
          enableBackToTop: withButtons,
        })
        await waitForGrid()
        await expect
          .poll(() =>
            ['back-to-top', 'back-to-start'].every(
              id => document.querySelector(`[data-testid="${id}"]`) !== null,
            ),
          )
          .toBe(withButtons)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return x
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const withButtons = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, BT14_COST)
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
          metrics: [
            {
              axis: 'x',
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('BT23-base', 'нижняя панель без кнопок', base, false)
      await record(
        'BT23',
        'нижняя панель с кнопками по обеим осям',
        withButtons,
        true,
      )

      expect(
        withButtons.p95Ms,
        `x p95=${withButtons.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Обновление данных (ADR 0094, GL13): 1000×1000, спокойная прокрутка со свечением и
// приглушённым телом против той же выборки без обновления.
describe('Производительность прокрутки — свечение загрузки', () => {
  test(
    'GL13: прокрутка 1000×1000 во время обновления данных не дороже той же выборки без него',
    async () => {
      const measure = async (loading: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          loading: loading ? 'refresh' : false,
        })
        await waitForGrid()
        await expect
          .poll(() => document.querySelector('.data-grid__loader') !== null)
          .toBe(loading)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const loading = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, GL13_COST)
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
          plugins: 'loading',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('GL13-base', 'без обновления', base, false)
      await record('GL13', 'обновление: свечение и приглушение', loading, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          loading[axis].p95Ms,
          `${axis} p95=${loading[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Положение футера (ADR 0118, FT14): 1000×1000, спокойная прокрутка с футером за последней
// строкой против той же выборки с футером у низа области — футер остаётся смонтированным.
describe('Производительность прокрутки — положение футера', () => {
  test(
    "FT14: прокрутка 1000×1000 с футером 'inline' не дороже той же выборки с футером 'pinned'",
    async () => {
      const measure = async (inline: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          enableFooter: true,
          footerPosition: inline ? 'inline' : 'pinned',
        })
        await waitForGrid()
        await expect
          .poll(() =>
            document
              .querySelector('.data-grid__footer')
              ?.getAttribute('data-position'),
          )
          .toBe(inline ? 'inline' : 'pinned')
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const inline = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, FT14_COST)
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
          plugins: 'footer',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('FT14-base', "футер 'pinned'", base, false)
      await record('FT14', "футер 'inline'", inline, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          inline[axis].p95Ms,
          `${axis} p95=${inline[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

/** Цена моделей с пустыми срезами: монтирование — шум до ~30%, прокрутка — как у FT14. */
const MP15_MOUNT_COST = { ratio: 1.3, plusMs: 40 }
const MP15_SCROLL_COST = { ratio: 1.1, plusMs: 2 }

/**
 * Все модели ADR 0120, §2 с пустыми срезами; у страниц — одна страница на все строки,
 * иначе вариант рисовал бы меньше строк, чем база.
 */
const ALL_MODELS = [
  rowExpandingModel(),
  columnSortingModel(),
  paginationModel({ initialPageSize: LARGE.dataCount }),
  columnFilteringModel(),
  quickSearchModel(),
  rowGroupingModel(),
  rowSelectionModel(),
  cellSelectionModel(),
  dataExportModel(),
]

// Плагины модели (ADR 0120, MP15): 1000×1000 со всеми моделями и пустыми срезами против
// того же грида без плагинов — модель без своего состояния почти ничего не стоит.
describe('Производительность — плагины модели с пустыми срезами', () => {
  test(
    'MP15: монтирование и спокойная прокрутка 1000×1000 со всеми моделями не дороже того же грида без плагинов',
    async () => {
      const measure = async (models: boolean) => {
        let screen: ReturnType<typeof render> | undefined
        const mount = await measureRenderWork(
          () => {
            screen = renderPluginsGrid({
              ...LARGE,
              plugins: models ? ALL_MODELS : [],
            })
            return screen
          },
          () => headCells().length > 0,
          { warmup: false },
        )
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen!).unmount()
        await cleanup()
        return { mount, y, x }
      }

      const runs = await againstBase(measure)
      const pick = (side: typeof runs.base) => ({
        mount: medianRun(
          side.map(run => run.mount),
          r => r.longestMs,
        ),
        ...medianAxes(side),
      })
      const base = pick(runs.base)
      const models = pick(runs.variant)
      const ceiling = {
        mount: ceilingOver(base.mount.longestMs, MP15_MOUNT_COST),
        ...axesCeiling(base, MP15_SCROLL_COST),
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
          size: '1000×1000',
          plugins: 'models',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load' as const,
              metric: 'longest' as const,
              valueMs: r.mount.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling.mount : undefined,
              ...r.mount,
            },
            ...(['y', 'x'] as const).map(axis => ({
              axis,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r[axis].p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling[axis] : undefined,
              ...r[axis],
            })),
          ],
        })
      await record('MP15-base', 'без плагинов', base, false)
      await record('MP15', 'все модели с пустыми срезами', models, true)

      expect(
        models.mount.longestMs,
        `монтирование longest=${models.mount.longestMs.toFixed(1)}ms (база ${base.mount.longestMs.toFixed(1)}ms, потолок ${ceiling.mount.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling.mount)
      for (const axis of ['y', 'x'] as const) {
        expect(
          models[axis].p95Ms,
          `${axis} p95=${models[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 3,
  )
})

/** Цена выключенных плагинов на 2026-10-16 с запасом (ADR 0004, P14). */
const P14_MOUNT_COST = { ratio: 1.6, plusMs: 40 }
const P14_SCROLL_COST = { ratio: 1.3, plusMs: 5 }

/** Все встроенные фабрики выключенными — как у приложения, что включает их на лету. */
const ALL_DISABLED = argsToPlugins({ actionsDemo: 'none' }).filter(
  entry => !entry.id.endsWith('Demo'),
)

// Выключенные плагины (ADR 0004, P14): выключенная запись оставляет таблице свои фичи и
// модели строк (ADR 0010) — монтирование и прокрутка с ними против `plugins: []`.
describe('Производительность — выключенные плагины', () => {
  test(
    'P14: монтирование и спокойная прокрутка со всеми плагинами выключенными не дороже потолка над гридом без плагинов',
    async () => {
      for (const size of [SMALL, LARGE]) {
        const label = `${size.columnCount}×${size.dataCount}`
        const measure = async (disabled: boolean) => {
          let screen: ReturnType<typeof render> | undefined
          const mount = await measureRenderWork(
            () => {
              screen = renderPluginsGrid({
                ...size,
                plugins: disabled ? ALL_DISABLED : [],
              })
              return screen
            },
            () => headCells().length > 0,
            { warmup: false },
          )
          const y = await measureScrollWork('y', CONTENT_SCROLL.y)
          const x = await measureScrollWork('x', CONTENT_SCROLL.x)
          ;(await screen!).unmount()
          await cleanup()
          return { mount, y, x }
        }

        // eslint-disable-next-line no-await-in-loop
        const runs = await againstBase(measure)
        const pick = (side: typeof runs.base) => ({
          mount: medianRun(
            side.map(run => run.mount),
            r => r.longestMs,
          ),
          ...medianAxes(side),
        })
        const base = pick(runs.base)
        const disabled = pick(runs.variant)
        const ceiling = {
          mount: ceilingOver(base.mount.longestMs, P14_MOUNT_COST),
          ...axesCeiling(base, P14_SCROLL_COST),
        }
        const record = (
          id: string,
          title: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label: title,
            operation: 'scroll',
            size: size === LARGE ? '1000×1000' : '30×500',
            plugins: 'disabled',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load' as const,
                metric: 'longest' as const,
                valueMs: r.mount.longestMs,
                targetMs: LOAD_BUDGET_MS,
                ceilingMs: gated ? ceiling.mount : undefined,
                ...r.mount,
              },
              ...(['y', 'x'] as const).map(axis => ({
                axis,
                kind: 'animation' as const,
                metric: 'p95' as const,
                valueMs: r[axis].p95Ms,
                targetMs: ANIMATION_BUDGET_MS,
                ceilingMs: gated ? ceiling[axis] : undefined,
                ...r[axis],
              })),
            ],
          })
        const suffix = size === LARGE ? 'large' : 'small'
        // eslint-disable-next-line no-await-in-loop
        await record(
          `P14-${suffix}-base`,
          `${label}, без плагинов`,
          base,
          false,
        )
        // eslint-disable-next-line no-await-in-loop
        await record(
          `P14-${suffix}`,
          `${label}, все плагины выключены`,
          disabled,
          true,
        )

        expect(
          disabled.mount.longestMs,
          `${label}: монтирование longest=${disabled.mount.longestMs.toFixed(1)}ms (база ${base.mount.longestMs.toFixed(1)}ms, потолок ${ceiling.mount.toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling.mount)
        for (const axis of ['y', 'x'] as const) {
          expect(
            disabled[axis].p95Ms,
            `${label}: ${axis} p95=${disabled[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
          ).toBeLessThanOrEqual(ceiling[axis])
        }
      }
    },
    PERF_TIMEOUT * 6,
  )
})
