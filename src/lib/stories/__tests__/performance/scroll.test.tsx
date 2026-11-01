import { cleanup, render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureIdleWork,
  measureRenderWork,
  measureScrollWork,
  recordPerf,
  renderGrid,
  type ScrollWorkResult,
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
  outcomeFlashSeed,
  pendingWaveSeed,
  rangeFlashSeed,
  INLINE_HEADER_ACTIONS,
  inlineHeaderActions,
} from './perf-cases'
import { makeColumns } from '../../__mocks__/columns'
import { getData, makeData } from '../../__mocks__/data'
import { argsToPlugins } from '../../__mocks__/utils/argsToPlugins'
import { renderPluginsGrid } from './hosts'
import { scrollLayer } from '../../../core/scrollStretch'
import type { CellComponentProps } from '../../../core/createSlots'
import type { TesseraFeatureEntry } from '../../../core/features'
import { CellButton } from '../../../ui/CellButton/CellButton'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
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
  rowExpanding,
  rowSelection,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  treeLines,
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

// Цена плагинов при спокойной прокрутке (ADR 0149, PS8): средний интервал кадра со всеми
// плагинами против той же выборки без них. Интервал кадра, а не p95 задач: работу кадра,
// разбитую на задачи, p95 задач не видит. По X дороже: новые колонки монтируют ячейки со
// всеми плагинами (ADR 0149, «Известные проблемы»).
const PS8_COST = { y: { ratio: 2, plusMs: 0 }, x: { ratio: 3, plusMs: 0 } }

describe('Цена плагинов при спокойной прокрутке', () => {
  test(
    'PS8: спокойная прокрутка со всеми плагинами по среднему интервалу кадра не дороже прокрутки без плагинов вдвое по Y и втрое по X: P12 против P10 и P13 против P11',
    async () => {
      const failures: string[] = []
      for (const [size, args] of [
        ['30×500', SMALL],
        ['1000×1000', LARGE],
      ] as const) {
        const measure = async (all: boolean) => {
          const screen = all
            ? renderGrid({ ...args, ...ALL_PLUGINS })
            : renderPluginsGrid(args)
          await waitForGrid()
          const y = await measureScrollWork('y', CONTENT_SCROLL.y)
          const x = await measureScrollWork('x', CONTENT_SCROLL.x)
          ;(await screen).unmount()
          return { y, x }
        }
        const runs = await againstBase(measure)
        const frame = (run: { frameMs?: number }) => run.frameMs ?? 0
        const median = (list: typeof runs.base) => ({
          y: medianRun(
            list.map(run => run.y),
            frame,
          ),
          x: medianRun(
            list.map(run => run.x),
            frame,
          ),
        })
        const base = median(runs.base)
        const all = median(runs.variant)
        const ceiling = {
          y: ceilingOver(frame(base.y), PS8_COST.y),
          x: ceilingOver(frame(base.x), PS8_COST.x),
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
            size,
            plugins: gated ? 'all' : 'none',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: (['y', 'x'] as const).map(axis => ({
              axis,
              kind: 'animation' as const,
              metric: 'frame' as const,
              valueMs: frame(r[axis]),
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling[axis] : undefined,
              ...r[axis],
            })),
          })
        await record(
          `PS8-base-${size}`,
          `кадр спокойной прокрутки ${size} без плагинов`,
          base,
          false,
        )
        await record(
          `PS8-${size}`,
          `кадр спокойной прокрутки ${size} со всеми плагинами`,
          all,
          true,
        )
        for (const axis of ['y', 'x'] as const) {
          if (frame(all[axis]) > ceiling[axis]) {
            failures.push(
              `${size} ${axis}: кадр ${frame(all[axis]).toFixed(1)} мс, без плагинов ${frame(base[axis]).toFixed(1)} мс, потолок ${ceiling[axis].toFixed(1)} мс`,
            )
          }
        }
      }
      expect(failures).toEqual([])
    },
    PERF_TIMEOUT * 12,
  )
})

// Цена фичи против базы того же теста (ADR 0099, §1а): во столько раз или на столько мс.
const AS14_COST = { ratio: 3, plusMs: 4 }
const CF12_COST = { ratio: 3, plusMs: 4 }
const MI23_COST = { ratio: 1.3, plusMs: 4 }
const TL8_COST = { ratio: 1.3, plusMs: 4 }
const EA10_COST = { ratio: 1.3, plusMs: 4 }
const AI10_COST = { ratio: 1.3, plusMs: 4 }
const KA7_COST = { ratio: 1.3, plusMs: 4 }
const RH8_COST = { ratio: 1.3, plusMs: 4 }
const HL19_COST = { ratio: 1.3, plusMs: 4 }
const OF20_COST = { ratio: 1.3, plusMs: 4 }
const TG11_COST = { ratio: 1.3, plusMs: 4 }
const TG18_COST = { ratio: 1.3, plusMs: 4 }
const OT11_COST = { ratio: 1.3, plusMs: 4 }
const AV11_COST = { ratio: 1.3, plusMs: 4 }
const OT11_MOUNT_COST = { ratio: 1.3, plusMs: 40 }
const BT14_COST = { ratio: 1.3, plusMs: 4 }
const GL13_COST = { ratio: 1.3, plusMs: 4 }
const FT14_COST = { ratio: 1.1, plusMs: 2 }
const GZ12_COST = { ratio: 1.1, plusMs: 2 }
const WV8_COST = { ratio: 1.3, plusMs: 40 }
const WV9_COST = { ratio: 1.3, plusMs: 4 }

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
describe('Производительность прокрутки — правка в ожидании', () => {
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
            .poll(() =>
              document.querySelector('.cell__button [aria-busy="true"]'),
            )
            .not.toBeNull()
        }
        // Медленно, без быстрой прокрутки: ячейки (и кнопки правки с дугой) рисуются, а не
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

// Липкие строки групп (ADR 0160, EA10): 1000×1000, строки сгруппированы и раскрыты; с
// липкими строками против той же выборки без них. Скорость ниже порога быстрой прокрутки:
// копии и строки рисуются, а не заменяются скелетами.
describe('Производительность прокрутки — липкие строки групп', () => {
  test(
    'EA10: прокрутка 1000×1000 с раскрытыми группами и липкими строками не дороже той же прокрутки без них',
    async () => {
      const measure = async (sticky: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          enableRowGrouping: true,
          initialGrouping: ['gender'],
          enableRowExpanding: true,
          initialExpanded: true,
          rowGroupingStickyRows: sticky,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        // После прокрутки строка группы ушла вверх: копия под шапкой ровно тогда, когда
        // липкие строки включены.
        await expect
          .poll(
            () =>
              document.querySelector('[data-sticky-rows] [data-row-id]') !==
              null,
          )
          .toBe(sticky)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const sticky = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, EA10_COST)
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
          plugins: 'rowGrouping',
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
      await record('EA10-base', 'группы без липких строк', base, false)
      await record('EA10', 'липкие строки групп', sticky, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          sticky[axis].p95Ms,
          `${axis} p95=${sticky[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
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
          // Колонки под все кнопки: иначе сортировка уходит в кебаб, а у него номера нет.
          ...inlineHeaderActions(makeColumns(LARGE.columnCount)),
          extraPlugins: sorted ? [sortAllColumnsSeed()] : [],
        })
        await waitForGrid()
        await expect
          .poll(
            () =>
              document.querySelector('[data-active-indicator][data-count]') !==
              null,
          )
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

// Включённые действия в ряду (ADR 0156, KA7): 1000×1000 со всеми плагинами, колонки
// узкие — в ряду одна кнопка и кебаб, у каждого заголовка включена сортировка и держится в
// ряду, против той же выборки без сортировки.
describe('Производительность прокрутки — включённые действия в ряду', () => {
  test(
    'KA7: горизонтальная прокрутка 1000×1000 узких колонок, где у каждого заголовка включена сортировка, не дороже той же прокрутки без включённых',
    async () => {
      const measure = async (sorted: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...ALL_PLUGINS,
          ...INLINE_HEADER_ACTIONS,
          // Узкие колонки: ширина уводит кнопки в кебаб (ADR 0111).
          columnsOverride: makeColumns(LARGE.columnCount).map(column => ({
            ...column,
            size: 170,
          })),
          extraPlugins: sorted ? [sortAllColumnsSeed()] : [],
        })
        await waitForGrid()
        await expect
          .poll(() => !!document.querySelector('[data-action-menu]'))
          .toBe(true)
        await expect
          .poll(
            () =>
              document.querySelector(
                '.data-grid__head-cell .column-sort__button [data-active-indicator][data-count]',
              ) !== null,
          )
          .toBe(sorted)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return x
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const sorted = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, KA7_COST)
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
      await record('KA7-base', 'узкие колонки без включённых', base, false)
      await record('KA7', 'узкие колонки, сортировка в ряду', sorted, true)

      expect(
        sorted.p95Ms,
        `X p95=${sorted.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Кнопки грида 28px (ADR 0135, GZ12): 1000×1000 со всеми плагинами, спокойная прокрутка
// с кнопками 28px против той же выборки с 32px — токеном темы.
describe('Производительность прокрутки — кнопки грида 28px', () => {
  test(
    'GZ12: прокрутка 1000×1000 со всеми плагинами с кнопками грида 28px — без регрессии против той же выборки с 32px',
    async () => {
      const measure = async (compact: boolean) => {
        const style = document.createElement('style')
        if (!compact) {
          style.textContent =
            '.data-grid-theme.data-grid-theme { --tsr-comp-grid-button-size: 32px; }'
          document.head.append(style)
        }
        const screen = renderGrid({ ...LARGE, ...ALL_PLUGINS })
        await waitForGrid()
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        style.remove()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const compact = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, GZ12_COST)
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
      await record('GZ12-base', 'кнопки грида 32px', base, false)
      await record('GZ12', 'кнопки грида 28px', compact, true)

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

// Вспышка итога на цели (ADR 0134, OF20): 1000×1000 без плагинов, спокойная прокрутка с
// 1500 ячейками во вспышке (по 500 строк каждого итога) против той же выборки без них.
// Удержание продлено токеном темы: вспышка держится весь замер.
describe('Производительность прокрутки — вспышка итога', () => {
  test(
    'OF20: спокойная прокрутка 1000×1000 с 1500 ячейками во вспышке не дороже той же выборки без них больше чем на 30 % (или 4 мс)',
    async () => {
      const hold = document.createElement('style')
      hold.textContent =
        '.data-grid-theme { --tsr-comp-flash-duration: 600s; --tsr-comp-error-flash-duration: 600s; }'
      document.head.append(hold)
      const measure = async (seeded: boolean) => {
        const seed = outcomeFlashSeed(LARGE.dataCount)
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          extraPlugins: [seed.entry],
        })
        await waitForGrid()
        if (seeded) {
          seed.flash()
        }
        await expect
          .poll(() => document.querySelector('[data-flash]') !== null)
          .toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      try {
        const runs = await againstBase(measure)
        const base = medianAxes(runs.base)
        const seeded = medianAxes(runs.variant)
        const ceiling = axesCeiling(base, OF20_COST)
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
        await record('OF20-base', 'без вспышек', base, false)
        await record('OF20', '1500 ячеек во вспышке', seeded, true)

        for (const axis of ['y', 'x'] as const) {
          expect(
            seeded[axis].p95Ms,
            `${axis} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
          ).toBeLessThanOrEqual(ceiling[axis])
        }
      } finally {
        hold.remove()
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Вспышка диапазона (ADR 0152, TG11): 1000×1000 без плагинов, спокойная прокрутка со
// вспышкой одного диапазона на всё тело против той же выборки без неё. Каждая ячейка окна
// проверяет, попадает ли она в диапазон.
describe('Производительность прокрутки — вспышка диапазона', () => {
  test(
    'TG11: спокойная прокрутка 1000×1000 со вспышкой диапазона на всё тело не дороже той же выборки без неё больше чем на 30 % (или 4 мс)',
    async () => {
      const hold = document.createElement('style')
      hold.textContent = '.data-grid-theme { --tsr-comp-flash-duration: 600s; }'
      document.head.append(hold)
      const measure = async (seeded: boolean) => {
        const seed = rangeFlashSeed(LARGE.dataCount)
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          extraPlugins: [seed.entry],
        })
        await waitForGrid()
        if (seeded) {
          seed.flash()
        }
        await expect
          .poll(() => document.querySelector('[data-flash]') !== null)
          .toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      try {
        const runs = await againstBase(measure)
        const base = medianAxes(runs.base)
        const seeded = medianAxes(runs.variant)
        const ceiling = axesCeiling(base, TG11_COST)
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
        await record('TG11-base', 'без вспышки', base, false)
        await record('TG11', 'вспышка диапазона на всё тело', seeded, true)

        for (const axis of ['y', 'x'] as const) {
          expect(
            seeded[axis].p95Ms,
            `${axis} p95=${seeded[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
          ).toBeLessThanOrEqual(ceiling[axis])
        }
      } finally {
        hold.remove()
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Волна ожидания на цели (ADR 0152, TG18): 1000×1000 без плагинов, спокойная прокрутка, пока
// действие меню ждёт с целью на всё тело, — у каждой ячейки окна своя анимация волны.
describe('Производительность прокрутки — волна ожидания', () => {
  test(
    'TG18: спокойная прокрутка 1000×1000 с ожиданием на всём теле не дороже той же выборки без него больше чем на 30 % (или 4 мс)',
    async () => {
      const measure = async (seeded: boolean) => {
        const seed = pendingWaveSeed(LARGE.dataCount)
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          extraPlugins: [seed.entry],
        })
        await waitForGrid()
        if (seeded) {
          seed.pend()
        }
        await expect
          .poll(() => document.querySelector('[aria-busy="true"]') !== null)
          .toBe(seeded)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const seeded = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, TG18_COST)
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
      await record('TG18-base', 'без ожидания', base, false)
      await record('TG18', 'ожидание на всём теле', seeded, true)

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

// Общая волна скелетов (ADR 0121, WV8–WV9): 1000×1000 со всеми плагинами во время
// первой загрузки против той же таблицы с данными — скелет не дороже содержимого.
describe('Производительность — общая волна скелетов', () => {
  const mount = async (loading: boolean) => {
    const screen = renderGrid({
      ...LARGE,
      ...ALL_PLUGINS,
      loading: loading ? 'initial' : false,
    })
    await waitForGrid()
    await expect
      .poll(() => document.querySelector('[data-skeleton-wave]') !== null)
      .toBe(loading)
    return screen
  }
  const record = (
    id: string,
    label: string,
    r: ScrollWorkResult,
    metric: 'p95' | 'tbt',
    valueMs: number,
    ceilingMs?: number,
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
          kind: 'animation',
          metric,
          valueMs,
          targetMs: ANIMATION_BUDGET_MS,
          ceilingMs,
          ...r,
        },
      ],
    })

  test(
    'WV8: 3 с покоя во время первой загрузки 1000×1000 со всеми плагинами — вся работа главного потока не больше той же таблицы с данными',
    async () => {
      const measure = async (loading: boolean) => {
        const screen = await mount(loading)
        // Волна идёт: задержка до первого прохода позади.
        await new Promise(resolve => setTimeout(resolve, 1500))
        const idle = await measureIdleWork(3000)
        ;(await screen).unmount()
        return idle
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.totalMs)
      const wave = medianRun(runs.variant, r => r.totalMs)
      const ceiling = ceilingOver(base.totalMs, WV8_COST)
      await record('WV8-base', 'покой с данными', base, 'tbt', base.totalMs)
      await record(
        'WV8',
        'покой во время загрузки: общая волна',
        wave,
        'tbt',
        wave.totalMs,
        ceiling,
      )
      expect(
        wave.totalMs,
        `работа ${wave.totalMs.toFixed(1)}ms (база ${base.totalMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )

  test(
    'WV9: медленная горизонтальная прокрутка во время первой загрузки 1000×1000 со всеми плагинами не дороже прокрутки той же таблицы с данными',
    async () => {
      const measure = async (loading: boolean) => {
        const screen = await mount(loading)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return x
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const wave = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, WV9_COST)
      await record('WV9-base', 'прокрутка с данными', base, 'p95', base.p95Ms)
      await record(
        'WV9',
        'прокрутка во время загрузки: общая волна',
        wave,
        'p95',
        wave.p95Ms,
        ceiling,
      )
      expect(
        wave.p95Ms,
        `x p95=${wave.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Включённое состояние кнопок (ADR 0129, AV11): 1000×1000 без плагинов, кнопка ячейки в
// каждой ячейке; спокойная прокрутка с включёнными кнопками (бабл виден) против тех же
// кнопок без `active` (узла бабла нет).
const cellButtonsSeed = (active: boolean): TesseraFeatureEntry => {
  const Button = () => (
    <CellButton
      label={active ? 'Note, set' : 'Note'}
      icon={<svg />}
      active={active || undefined}
      revealOnHover={false}
    />
  )
  return {
    id: 'perfCellButtons',
    slots: [
      { id: 'perfCellButtons', slot: 'rightCellSlot', component: Button },
    ],
  }
}

describe('Производительность прокрутки — включённые кнопки', () => {
  test(
    'AV11: спокойная прокрутка 1000×1000 с включёнными кнопками во всех строках — в пределах цены против той же выборки без них',
    async () => {
      const measure = async (active: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          extraPlugins: [cellButtonsSeed(active)],
        })
        await waitForGrid()
        await expect
          .poll(
            () =>
              document.querySelector(
                '[data-active-indicator][data-shown="true"]',
              ) !== null,
          )
          .toBe(active)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const active = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, AV11_COST)
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
      await record('AV11-base', 'кнопки без active', base, false)
      await record('AV11', 'включённые кнопки', active, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          active[axis].p95Ms,
          `${axis} p95=${active[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Ошибки ячеек (ADR 0150, ER9): вторая колонка каждой строки и третья — каждой чётной, 1500
// ячеек с точкой: каждая новая строка окна приносит точки. Против той же выборки и того же
// плагина без ошибок.
const ER9_COST = { ratio: 1.3, plusMs: 4 }
const someCellErrors = (ctx: CellComponentProps) =>
  ctx.column.getIndex() === 1 ||
  (ctx.column.getIndex() === 2 && ctx.row.index % 2 === 0)
    ? 'Invalid value'
    : undefined
const noCellErrors = () => undefined

describe('Производительность прокрутки — ошибки ячеек', () => {
  test(
    'ER9: спокойная прокрутка 1000×1000 с ошибками в 1500 ячейках не дороже той же выборки без них больше чем в 1,3 раза или на 4 мс',
    async () => {
      const measure = async (errors: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          enableCellErrors: true,
          cellErrorsGetCellError: errors ? someCellErrors : noCellErrors,
        })
        await waitForGrid()
        await expect
          .poll(
            () => document.querySelector('[data-failure-indicator]') !== null,
          )
          .toBe(errors)
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const errors = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, ER9_COST)
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
          plugins: 'cellErrors',
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
      await record('ER9-base', 'ошибок нет', base, false)
      await record('ER9', '1500 ячеек с ошибкой', errors, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          errors[axis].p95Ms,
          `${axis} p95=${errors[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Серверная модель строк (ADR 0138, SD31): 1 000 000 строк × 1000 колонок, блоки приходят
// по окну прокрутки сразу (синхронный ответ) — против тех же 1000×1000 на клиенте.
const SD31_COST = { ratio: 1.3, plusMs: 4 }
describe('Производительность прокрутки — серверная модель строк', () => {
  test(
    'SD31: спокойная прокрутка 1 000 000 × 1000 с загруженным окном не дороже 1000×1000 на клиенте',
    async () => {
      const pool = getData(LARGE.dataCount)
      const getRows = ({ start, end }: { start: number; end: number }) => ({
        rows: Array.from({ length: end - start }, (_, k) => ({
          ...pool[(start + k) % pool.length],
          id: `ssrm-${start + k}`,
        })),
      })
      const measure = async (server: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          ...(server && {
            enableServerRowModel: true,
            rowCount: 1_000_000,
            serverRowModelGetRows: getRows,
          }),
        })
        await expect
          .poll(() =>
            document.querySelector('.data-grid__body-row[data-row-id]'),
          )
          .not.toBeNull()
        if (server) {
          expect(
            document
              .querySelector('.data-grid__body-row[data-row-id]')!
              .getAttribute('data-row-id'),
          ).toMatch(/^ssrm-/)
        }
        // Миллион строк — растянутая область: колесо идёт 1:1, ползунок — на долю итога.
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          wheel: server,
        })
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const server = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, SD31_COST)
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
          size: gated ? '1 000 000×1000' : '1000×1000',
          plugins: gated ? 'serverRowModel' : 'none',
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
      await record('SD31-base', '1000×1000 на клиенте', base, false)
      await record('SD31', 'серверная модель строк', server, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          server[axis].p95Ms,
          `${axis} p95=${server[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})

// Растяжка высоты (ADR 0142, XS11): спокойная прокрутка колесом 1 000 000 строк в растянутой
// области против той же прокрутки 150 000 строк без растяжки (тело 7,5 млн px).
const XS11_COST = { ratio: 1.3, plusMs: 4 }
describe('Производительность прокрутки — растяжка высоты', () => {
  test(
    'XS11: спокойная прокрутка колесом 1 000 000 строк в растянутом режиме не дороже той же прокрутки 150 000 строк без растяжки',
    async () => {
      const pool = getData(SMALL.dataCount)
      const getRows = ({ start, end }: { start: number; end: number }) => ({
        rows: Array.from({ length: end - start }, (_, k) => ({
          ...pool[(start + k) % pool.length],
          id: `xs-${start + k}`,
        })),
      })
      const measure = async (stretched: boolean) => {
        const screen = renderGrid({
          ...SMALL,
          ...NO_PLUGINS,
          enableServerRowModel: true,
          rowCount: stretched ? 1_000_000 : 150_000,
          serverRowModelGetRows: getRows,
        })
        await expect
          .poll(() =>
            document.querySelector('.data-grid__body-row[data-row-id]'),
          )
          .not.toBeNull()
        const scroller = document.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        expect(scrollLayer(scroller).stretched).toBe(stretched)
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: stretched,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const stretched = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, XS11_COST)
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
          size: gated ? '1 000 000×30' : '150 000×30',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y',
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XS11-base', 'без растяжки, ползунком', base, false)
      await record('XS11', 'растянутая область, колесом', stretched, true)

      expect(
        stretched.p95Ms,
        `p95=${stretched.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Серверная группировка (ADR 0144, GS13): раскрытый сгруппированный список из 1 000 000
// строк — десять групп по сто тысяч — против плоского списка той же длины. Ответы
// «сервера» синхронные: меряется прокрутка, а не ожидание блоков.
const GS13_COST = { ratio: 1.15, plusMs: 0 }
const GS13_GROUPS = 10
const GS13_GROUP_SIZE = 100_000
interface GroupedRow {
  id: string
  name: string
  city: string
  amount: number
  count?: number
}
const GROUPED_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    size: 120,
    aggregationFn: 'sum',
  },
]
const GS13_EXPANDED = Object.fromEntries(
  Array.from({ length: GS13_GROUPS }, (_, g) => [
    `group:${JSON.stringify([`g${g}`])}`,
    true,
  ]),
)
const groupedRowsOf = ({
  start,
  end,
  grouping,
  groupKeys,
}: ServerRowsRequest) => {
  if (grouping.length > groupKeys.length) {
    return {
      rows: Array.from(
        { length: Math.max(0, Math.min(end, GS13_GROUPS) - start) },
        (_, k): GroupedRow => ({
          id: '',
          name: '',
          city: `g${start + k}`,
          amount: 0,
          count: GS13_GROUP_SIZE,
        }),
      ),
      rowCount: GS13_GROUPS,
    }
  }
  const city = (groupKeys[0] as string | undefined) ?? 'flat'
  return {
    rows: Array.from({ length: end - start }, (_, k): GroupedRow => ({
      id: `${city}-${start + k}`,
      name: `Name ${start + k}`,
      city,
      amount: (start + k) % 10,
    })),
  }
}
const GroupedServerGrid = ({ grouped }: { grouped: boolean }) => {
  const table = useCreateTable({
    rowCount: grouped ? undefined : GS13_GROUPS * (GS13_GROUP_SIZE + 1),
    columns: GROUPED_COLUMNS as never,
    data: NO_GROUPED_ROWS,
    getRowId: (row: GroupedRow) => row.id,
    plugins: [
      serverRowModel({
        getRows: groupedRowsOf,
        getGroupChildCount: (row: GroupedRow) => row.count,
      }),
      // Модель дерева задаёт первый несущий её интерфейс (ADR 0120): раскрытие — первым.
      rowExpanding({ initialExpanded: grouped ? GS13_EXPANDED : {} }),
      rowGrouping({ initialGrouping: grouped ? ['city'] : [] }),
    ] as never,
  })
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}
const NO_GROUPED_ROWS: GroupedRow[] = []

describe('Производительность прокрутки — серверная группировка', () => {
  test(
    'GS13: прокрутка раскрытого сгруппированного списка из 1 000 000 строк не дороже плоского списка той же длины больше чем на 15 %',
    async () => {
      const measure = async (grouped: boolean) => {
        const screen = render(<GroupedServerGrid grouped={grouped} />)
        await expect
          .poll(() =>
            document.querySelector(
              grouped
                ? '.data-grid__body-row[data-row-id="g0-0"]'
                : '.data-grid__body-row[data-row-id="flat-0"]',
            ),
          )
          .not.toBeNull()
        const rows = Number(
          document
            .querySelector('[aria-rowcount]')
            ?.getAttribute('aria-rowcount'),
        )
        expect(rows - 1).toBe(GS13_GROUPS * (GS13_GROUP_SIZE + 1))
        // Миллион строк — растянутая область (ADR 0142): прокрутка колесом, 1:1.
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: true,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const grouped = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, GS13_COST)
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
          size: '1 000 010×3',
          plugins: 'serverRowModel, rowGrouping, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y' as const,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('GS13-base', 'плоский список', base, false)
      await record('GS13', 'раскрытые группы', grouped, true)
      expect(
        grouped.p95Ms,
        `p95=${grouped.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Линии дерева в серверной модели (ADR 0161, TL15): 1 000 000 корней, раскрыты все, у
// каждого — три ребёнка; с линиями против того же дерева без них. Ответы синхронные:
// меряется прокрутка, а не ожидание блоков.
const TL15_COST = { ratio: 1.3, plusMs: 4 }
const TL15_ROOTS = 1_000_000
const TL15_CHILDREN = 3
const treeRowsOf = ({ start, end, parentId }: ServerRowsRequest) => {
  const total = parentId ? TL15_CHILDREN : TL15_ROOTS
  return {
    rows: Array.from(
      { length: Math.max(0, Math.min(end, total) - start) },
      (_, k): GroupedRow => {
        const id = parentId ? `${parentId}.${start + k}` : `r${start + k}`
        return { id, name: id, city: '', amount: k }
      },
    ),
    rowCount: total,
  }
}
const TreeServerGrid = ({ lines }: { lines: boolean }) => {
  const table = useCreateTable({
    rowCount: TL15_ROOTS,
    columns: GROUPED_COLUMNS as never,
    data: NO_GROUPED_ROWS,
    getRowId: (row: GroupedRow) => row.id,
    plugins: [
      serverRowModel({ getRows: treeRowsOf }),
      rowExpanding({
        hasChildren: (row: { depth: number }) => row.depth === 0,
        initialExpanded: true,
      } as never),
      ...(lines ? [treeLines()] : []),
    ] as never,
  })
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Производительность прокрутки — линии дерева в серверной модели', () => {
  test(
    'TL15: прокрутка дерева серверной модели с 1 000 000 корней и раскрытыми ветками с линиями не дороже той же прокрутки без линий',
    async () => {
      const measure = async (lines: boolean) => {
        const screen = render(<TreeServerGrid lines={lines} />)
        await expect
          .poll(() =>
            document.querySelector('.data-grid__body-row[data-row-id="r0.2"]'),
          )
          .not.toBeNull()
        // Ветки раскрыты, и линии есть ровно тогда, когда включены.
        expect(document.querySelector('[data-tree-depth]') !== null).toBe(lines)
        // Миллион строк — растянутая область (ADR 0142): прокрутка колесом, 1:1.
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: true,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const lined = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, TL15_COST)
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
          size: '1 000 000 корней',
          plugins: 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y' as const,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('TL15-base', 'дерево без линий', base, false)
      await record('TL15', 'дерево с линиями', lined, true)
      expect(
        lined.p95Ms,
        `p95=${lined.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Выбор вложенных строк (ADR 0162, NS11): то же дерево TL15 с каскадом; тысяча веток выбрана
// узлами с исключением против того же дерева, выбранного целиком без узлов: заливка выбранных
// строк одна, разница — поиск узла по пути предков.
const NS11_COST = { ratio: 1.15, plusMs: 2 }
const NS11_BRANCHES = 1000
const NS11_SELECTION = {
  all: false,
  except: Array.from({ length: NS11_BRANCHES }, (_, i) => `r${i}`),
  branches: Array.from({ length: NS11_BRANCHES }, (_, i) => ({
    id: `r${i}`,
    all: true,
    except: [`r${i}.1`],
  })),
}
const NS11_EVERYTHING = { all: true, except: [] }
const SelectedTreeServerGrid = ({ selected }: { selected: boolean }) => {
  const table = useCreateTable({
    rowCount: TL15_ROOTS,
    columns: GROUPED_COLUMNS as never,
    data: NO_GROUPED_ROWS,
    getRowId: (row: GroupedRow) => row.id,
    plugins: [
      serverRowModel({ getRows: treeRowsOf }),
      rowExpanding({
        hasChildren: (row: { depth: number }) => row.depth === 0,
        initialExpanded: true,
      } as never),
      rowSelection({
        subRows: true,
        rowSelection: selected ? NS11_SELECTION : NS11_EVERYTHING,
      }),
    ] as never,
  })
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Производительность прокрутки — выбор вложенных строк в серверной модели', () => {
  test(
    'NS11: прокрутка дерева серверной модели с 1 000 000 корней и тысячей веток, выбранных узлами, не дороже того же дерева, выбранного целиком, больше чем на 15 % (+2 мс)',
    async () => {
      const rowOf = (id: string) =>
        document.querySelector(`.data-grid__body-row[data-row-id="${id}"]`)
      const measure = async (selected: boolean) => {
        const screen = render(<SelectedTreeServerGrid selected={selected} />)
        await expect.poll(() => rowOf('r0.2')).not.toBeNull()
        // Выбор и правда применён: строка ветки выбрана, исключение узла — нет.
        await expect
          .poll(() => rowOf('r0.0')!.getAttribute('data-selected'))
          .toBe('true')
        expect(rowOf('r0.1')!.getAttribute('data-selected')).toBe(
          String(!selected),
        )
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: true,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const selected = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, NS11_COST)
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
          size: '1 000 000 корней',
          plugins: 'serverRowModel, rowExpanding, rowSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y' as const,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('NS11-base', 'выбрано всё без узлов', base, false)
      await record('NS11', 'тысяча выбранных веток', selected, true)
      expect(
        selected.p95Ms,
        `p95=${selected.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Выбор группы целиком (ADR 0148, GX12): спокойная прокрутка 1 000 000 строк в ста
// раскрытых группах, каждая выбрана узлом с исключениями, против той же выборки, выбранной
// целиком без узлов: заливка выбранных строк одна, разница — поиск узла по пути групп.
const GX12_COST = { ratio: 1.15, plusMs: 2 }
const GX12_GROUPS = 100
const GX12_GROUP_SIZE = 10_000
const GX12_EXPANDED = Object.fromEntries(
  Array.from({ length: GX12_GROUPS }, (_, g) => [
    `group:${JSON.stringify([`g${g}`])}`,
    true,
  ]),
)
const GX12_SELECTION = {
  all: false,
  except: [],
  groups: Array.from({ length: GX12_GROUPS }, (_, g) => ({
    keys: [`g${g}`],
    all: true,
    except: [`g${g}-1`, `g${g}-3`],
  })),
}
const GX12_EVERYTHING = { all: true, except: [] }
const selectionRowsOf = ({
  start,
  end,
  grouping,
  groupKeys,
}: ServerRowsRequest) => {
  if (grouping.length > groupKeys.length) {
    return {
      rows: Array.from(
        { length: Math.max(0, Math.min(end, GX12_GROUPS) - start) },
        (_, k): GroupedRow => ({
          id: '',
          name: '',
          city: `g${start + k}`,
          amount: 0,
          count: GX12_GROUP_SIZE,
        }),
      ),
      rowCount: GX12_GROUPS,
    }
  }
  const city = groupKeys[0] as string
  return {
    rows: Array.from({ length: end - start }, (_, k): GroupedRow => ({
      id: `${city}-${start + k}`,
      name: `Name ${start + k}`,
      city,
      amount: (start + k) % 10,
    })),
  }
}
const GroupSelectionGrid = ({ selected }: { selected: boolean }) => {
  const table = useCreateTable({
    columns: GROUPED_COLUMNS as never,
    data: NO_GROUPED_ROWS,
    getRowId: (row: GroupedRow) => row.id,
    plugins: [
      serverRowModel({
        getRows: selectionRowsOf,
        getGroupChildCount: (row: GroupedRow) => row.count,
      }),
      rowExpanding({ initialExpanded: GX12_EXPANDED }),
      rowGrouping({ initialGrouping: ['city'] }),
      rowSelection({
        rowSelection: selected ? GX12_SELECTION : GX12_EVERYTHING,
      }),
    ] as never,
  })
  return (
    <div style={{ padding: 16, height: 600 }}>
      <DataGrid table={table as never} height={500} />
    </div>
  )
}

describe('Производительность прокрутки — выбор групп в серверной модели строк', () => {
  test(
    'GX12: прокрутка 1 000 000 строк при группировке со 100 выбранными группами не дороже той же выборки, выбранной целиком, больше чем на 15 % (+2 мс)',
    async () => {
      const measure = async (selected: boolean) => {
        const screen = render(<GroupSelectionGrid selected={selected} />)
        const first = () =>
          document.querySelector('.data-grid__body-row[data-row-id="g0-0"]')
        await expect.poll(first).not.toBeNull()
        // Выбор и правда применён: строка группы выбрана, исключение узла — нет.
        await expect
          .poll(() => first()!.getAttribute('data-selected'))
          .toBe('true')
        expect(
          document
            .querySelector('.data-grid__body-row[data-row-id="g0-1"]')
            ?.getAttribute('data-selected'),
        ).toBe(String(!selected))
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: true,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const selected = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, GX12_COST)
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
          size: '1 000 100×3',
          plugins: 'serverRowModel, rowGrouping, rowExpanding, rowSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y' as const,
              kind: 'animation' as const,
              metric: 'p95' as const,
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('GX12-base', 'выбрано всё без узлов', base, false)
      await record('GX12', '100 выбранных групп', selected, true)
      expect(
        selected.p95Ms,
        `p95=${selected.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Выделение в серверной модели строк (ADR 0146, XC14): спокойная прокрутка колесом
// 1 000 000 строк с колонкой, выделенной целиком, против той же прокрутки без выделения.
const XC14_COST = { ratio: 1.3, plusMs: 4 }
describe('Производительность прокрутки — выделение в серверной модели строк', () => {
  test(
    'XC14: колонка, выделенная целиком на 1 000 000 строк, прокручивается не дороже той же прокрутки без выделения',
    async () => {
      const pool = getData(SMALL.dataCount)
      const first = makeColumns(SMALL.columnCount)[0] as {
        id?: string
        accessorKey?: string
      }
      const columnId = first.id ?? first.accessorKey!
      const getRows = ({ start, end }: { start: number; end: number }) => ({
        rows: Array.from({ length: end - start }, (_, k) => ({
          ...pool[(start + k) % pool.length],
          id: `xc-${start + k}`,
        })),
      })
      const measure = async (selected: boolean) => {
        const screen = renderGrid({
          ...SMALL,
          ...NO_PLUGINS,
          enableServerRowModel: true,
          rowCount: 1_000_000,
          serverRowModelGetRows: getRows,
          enableCellSelection: true,
          cellSelectionInitialCellSelection: selected
            ? [
                {
                  anchorRowIndex: 0,
                  focusRowIndex: 999_999,
                  anchorColumnId: columnId,
                  focusColumnId: columnId,
                },
              ]
            : [],
        })
        await expect
          .poll(() =>
            document.querySelector('.data-grid__body-row[data-row-id]'),
          )
          .not.toBeNull()
        // Вариант мерит выделенную колонку, база — ту же без выделения.
        expect(
          document.querySelectorAll('[data-cell-selected="true"]').length > 0,
        ).toBe(selected)
        const y = await measureScrollWork('y', {
          ...CONTENT_SCROLL.y,
          fast: false,
          wheel: true,
        })
        ;(await screen).unmount()
        return y
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.p95Ms)
      const selected = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, XC14_COST)
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
          size: '1 000 000×30',
          plugins: 'serverRowModel, cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              axis: 'y',
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XC14-base', 'без выделения', base, false)
      await record('XC14', 'колонка выделена целиком', selected, true)
      expect(
        selected.p95Ms,
        `p95=${selected.p95Ms.toFixed(1)}ms (база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Тип данных колонки (ADR 0172, DT20): 1000×1000 без плагинов, у каждой колонки числовое
// значение; вариант — тип «деньги» с форматом валюты, база — те же колонки без типа.
const DT20_COST = { ratio: 1.3, plusMs: 4 }

describe('Производительность прокрутки — тип данных колонки', () => {
  test(
    'DT20: спокойная прокрутка 1000×1000 со всеми колонками с типом и форматом не дороже тех же без типа больше чем на 30 % (или 4 мс); форматтеры Intl создаются один раз на язык и опции',
    async () => {
      const numeric = (typed: boolean) =>
        makeColumns(LARGE.columnCount).map((column, index) => ({
          id: column.id!,
          header: column.header,
          size: 150,
          accessorFn: (_row: unknown, rowIndex: number) =>
            rowIndex * 1.25 + index,
          ...(typed && { dataType: 'money' }),
        }))
      const dataTypes = {
        money: {
          extends: 'number',
          format: { style: 'currency', currency: 'EUR' },
        },
      } as const
      const Original = Intl.NumberFormat
      let made = 0
      Intl.NumberFormat = new Proxy(Original, {
        construct(target, args: [string?, Intl.NumberFormatOptions?]) {
          if (args[1]?.currency === 'EUR') made++
          return Reflect.construct(target, args)
        },
      })
      const measure = async (typed: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          ...NO_PLUGINS,
          columnsOverride: numeric(typed) as never,
          dataTypes: typed ? dataTypes : undefined,
        })
        await waitForGrid()
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      try {
        const runs = await againstBase(measure)
        const base = medianAxes(runs.base)
        const typed = medianAxes(runs.variant)
        const ceiling = axesCeiling(base, DT20_COST)
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
        await record('DT20-base', 'колонки без типа', base, false)
        await record('DT20', 'колонки с типом и форматом', typed, true)

        for (const axis of ['y', 'x'] as const) {
          expect(
            typed[axis].p95Ms,
            `${axis} p95=${typed[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
          ).toBeLessThanOrEqual(ceiling[axis])
        }
        // Один язык и одни опции — один форматтер на все ячейки и прогоны.
        expect(made).toBe(1)
      } finally {
        Intl.NumberFormat = Original
      }
    },
    PERF_TIMEOUT * 2,
  )
})
