import { cleanup } from 'vitest-browser-react'
import { beforeAll, describe, expect, test } from 'vitest'

import { againstBase, ceilingOver, medianRun } from './baseline'

import {
  headCells,
  measureRenderWork,
  measureTransitionWork,
  recordPerf,
} from '../helpers'
import { makeData } from '../../__mocks__/data'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  LOAD_BUDGET_MS,
  NO_PLUGINS,
  PAGED,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'
import { renderPluginsGrid, renderGrid } from './hosts'
import {
  __resetScrollLimits,
  measureStickyScrollLimit,
} from '../../../core/scrollHeightLimit'
import { RU_LABELS } from '../../__mocks__/localization.ru'
import { windowPortions } from '../../../core/virtualization/windowPortions'
import {
  columnFiltering,
  columnVisibility,
  pagination,
  quickSearch,
  rowSelection,
} from '../../../plugins'

// Производительность ПЕРВОЙ ОТРИСОВКИ (mount → первый кадр). Половина перф-матрицы:
// операция «отрисовка» × объём (небольшой/большой) × плагины (без/все).
// Метрика — самая длинная задача монтирования (CDP-трейс), под ×4 CPU-троттлингом.
// Дополнительно фиксируются long tasks (> 50мс) и TBT — сигнал готовности к INP.
//
// Время матрицу не гейтит (ADR 0099, PF1): значение идёт в дашборд против цели RAIL
// Load, регрессии ловит `perf:compare`. Кейс фичи гейтится против базы того же теста.

interface RenderCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  /** Данные генерируются до замера: меряется монтирование, а не faker. */
  pregenerated?: boolean
  /** «Без плагинов» — `plugins: []` своим хостом, без обвязки историй (ADR 0004). */
  bare?: boolean
}

const CASES: RenderCase[] = [
  {
    id: 'P1',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL },
    bare: true,
  },
  {
    id: 'P3',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE },
    bare: true,
  },
  {
    id: 'P5',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
  },
  {
    id: 'P6',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
  },
  {
    // Колонка раскрытия по условию (ADR 0050): проход по корням и одна повторная
    // отрисовка после монтирования — та же цена, что у P6.
    id: 'SC10',
    label: 'большая выборка, все плагины, колонка раскрытия по условию',
    args: { ...LARGE, ...ALL_PLUGINS, enableRowExpanding: true },
  },
  {
    id: 'P9',
    label: 'много строк, без плагинов',
    args: { ...PAGED },
    pregenerated: true,
    bare: true,
  },
]

describe('Производительность первой отрисовки', () => {
  // Прогрев JIT один раз лёгким монтированием (без троттлинга): без него первый
  // измеряемый кейс платил бы разовую стоимость компиляции. Пер-тестовый прогрев
  // отключён (`warmup: false`), чтобы не монтировать экстремальный грид дважды.
  beforeAll(async () => {
    renderGrid({ ...SMALL, ...NO_PLUGINS })
    for (let i = 0; i < 600 && headCells().length === 0; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    cleanup()
  })

  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        const dataOverride = c.pregenerated
          ? makeData({ shape: 'flat', count: Number(c.args.dataCount) })
          : undefined
        const result = await measureRenderWork(
          () =>
            c.bare
              ? renderPluginsGrid({
                  columnCount: Number(c.args.columnCount),
                  dataCount: Number(c.args.dataCount),
                  dataOverride,
                })
              : renderGrid({ ...c.args, dataOverride }),
          () => headCells().length > 0,
          { warmup: false },
        )
        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'render',
          size:
            c.args.columnCount === LARGE.columnCount
              ? '1000×1000'
              : c.args.dataCount === PAGED.dataCount
                ? '30×100 000'
                : '30×500',
          plugins: c.bare ? 'none' : 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ...result,
            },
          ],
        })
      },
      PERF_TIMEOUT,
    )
  }
})

// Ленивые дети (ADR 0054, RE39): монтирование 100 000 корней с `hasChildren` против
// той же выборки без него. Худший случай условия колонки: помечена только последняя
// строка — проверка «есть ли раскрываемые» проходит все корни.
describe('Производительность первой отрисовки — ленивые дети', () => {
  test(
    'RE39: монтирование 100 000 строк с hasChildren не хуже базы без него',
    async () => {
      const dataOverride = makeData({
        shape: 'flat',
        count: PAGED.dataCount,
      })
      const last = PAGED.dataCount - 1
      const measure = async (lazy: boolean) => {
        const result = await measureRenderWork(
          () =>
            renderGrid({
              ...PAGED,
              ...NO_PLUGINS,
              enableRowExpanding: true,
              dataOverride,
              ...(lazy
                ? {
                    rowExpandingHasChildren: (row: { index: number }) =>
                      row.index === last,
                    rowExpandingLoadChildren: () => [],
                  }
                : {}),
            }),
          () => headCells().length > 0,
          { warmup: false },
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const lazy = medianRun(runs.variant, r => r.longestMs)
      // Шум замера монтирования — до ~30% между прогонами; больше — регрессия.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 40 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'render',
          size: '30×100 000',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RE39-base', 'раскрытие без hasChildren', base, false)
      await record(
        'RE39',
        'раскрытие с hasChildren (помечена последняя)',
        lazy,
        true,
      )

      expect(
        lazy.longestMs,
        `с hasChildren longest=${lazy.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Раскрытые ленивые строки (ADR 0054, RE79): монтирование 100 000 строк со срезом `expanded: true`
// против той же выборки без него. Сужение обходит все строки, запросы делает только окно.
describe('Производительность первой отрисовки — раскрытые ленивые строки', () => {
  test(
    'RE79: монтирование 100 000 ленивых строк с expanded: true не хуже той же выборки без него',
    async () => {
      const dataOverride = makeData({
        shape: 'flat',
        count: PAGED.dataCount,
      })
      const measure = async (expanded: boolean) => {
        const result = await measureRenderWork(
          () =>
            renderGrid({
              ...PAGED,
              ...NO_PLUGINS,
              enableRowExpanding: true,
              dataOverride,
              rowExpandingHasChildren: () => true,
              rowExpandingLoadChildren: () => new Promise(() => {}),
              ...(expanded ? { initialExpanded: true } : {}),
            }),
          () => headCells().length > 0,
          { warmup: false },
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const lazy = medianRun(runs.variant, r => r.longestMs)
      // Цена фичи — один проход модели строк при начале загрузки, как приход детей в RE38.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 250 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'render',
          size: '30×100 000',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RE79-base', 'ленивые строки свёрнуты', base, false)
      await record('RE79', 'ленивые строки раскрыты в срезе', lazy, true)

      expect(
        lazy.longestMs,
        `с expanded: true longest=${lazy.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Скелет первой загрузки (ADR 0060, SL14): монтирование со скелетом против того же
// грида, смонтированного сразу с данными, — скелет не дороже строк.
describe('Производительность первой отрисовки — скелет', () => {
  test(
    'SL14: монтирование со скелетом на 30×500 и 1000×1000 колонок не дольше монтирования с данными',
    async () => {
      const sizes = [
        { key: 'small', size: SMALL, label: '30×500' },
        { key: 'large', size: LARGE, label: '1000×1000' },
      ] as const
      for (const { key, size, label } of sizes) {
        const measure = async (skeleton: boolean) => {
          const result = await measureRenderWork(
            () =>
              renderGrid({
                ...size,
                ...ALL_PLUGINS,
                loading: skeleton ? 'initial' : false,
              }),
            () =>
              !!document.querySelector(
                skeleton
                  ? '.data-grid__body--skeleton'
                  : '.data-grid__body-row',
              ),
            { warmup: true },
          )
          await cleanup()
          return result
        }
        // eslint-disable-next-line no-await-in-loop
        const runs = await againstBase(measure)
        const base = medianRun(runs.base, r => r.longestMs)
        const skeleton = medianRun(runs.variant, r => r.longestMs)
        const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 40 })
        const record = (
          id: string,
          title: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label: `${title}, ${label}, все плагины`,
            operation: 'render',
            size: label,
            plugins: 'all',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: LOAD_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        // eslint-disable-next-line no-await-in-loop
        await record(`SL14-${key}-base`, 'монтирование с данными', base, false)
        // eslint-disable-next-line no-await-in-loop
        await record(`SL14-${key}`, 'монтирование со скелетом', skeleton, true)
        expect(
          skeleton.longestMs,
          `${label}: со скелетом ${skeleton.longestMs.toFixed(1)}ms, с данными ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(0)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Словарь подписей (ADR 0132, LC11): монтирование 1000×1000 с русским словарём-шаблонами
// и языком `ru-RU` против английских умолчаний. Плагины — те, чьи подписи видны сразу:
// тулбар, нижняя панель, пагинация.
describe('Производительность первой отрисовки — словарь подписей', () => {
  test(
    'LC11: монтирование 1000×1000 с русским словарём-шаблонами не дороже базы с английскими умолчаниями',
    async () => {
      const dataOverride = makeData({ shape: 'flat', count: LARGE.dataCount })
      const plugins = [
        pagination(),
        rowSelection({ selectedCount: true }),
        quickSearch(),
        columnFiltering(),
        columnVisibility(),
      ]
      const measure = async (russian: boolean) => {
        const result = await measureRenderWork(
          () =>
            renderPluginsGrid({
              ...LARGE,
              plugins,
              dataOverride,
              ...(russian ? { localization: RU_LABELS, locale: 'ru-RU' } : {}),
            }),
          () => headCells().length > 0,
          { warmup: false },
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const russian = medianRun(runs.variant, r => r.longestMs)
      // Шум замера монтирования — до ~30% между прогонами; больше — регрессия.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 40 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'render',
          size: '1000×1000',
          plugins: 'labels',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('LC11-base', 'английские умолчания', base, false)
      await record('LC11', 'русский словарь-шаблоны, ru-RU', russian, true)

      expect(
        russian.longestMs,
        `русский словарь longest=${russian.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Пределы браузера (ADR 0141, BH7): монтирование серверной модели на 1 000 000 строк с
// замером пределов высоты и липкости против того же монтирования с уже измеренными.
describe('Производительность первой отрисовки — пределы браузера', () => {
  test(
    'BH7: монтирование 1 000 000 строк с замером обоих пределов не дороже монтирования с измеренными пределами',
    async () => {
      const getRows = ({ start, end }: { start: number; end: number }) => ({
        rows: Array.from({ length: end - start }, (_, k) => ({
          id: `bh-${start + k}`,
        })),
      })
      const measure = async (cold: boolean) => {
        const result = await measureRenderWork(
          () => {
            if (cold) __resetScrollLimits()
            // В перф-сборке предупреждения не печатаются: замер липкости режима
            // разработки — здесь же, в задаче монтирования.
            measureStickyScrollLimit()
            renderGrid({
              ...SMALL,
              ...NO_PLUGINS,
              enableServerRowModel: true,
              rowCount: 1_000_000,
              serverRowModelGetRows: getRows,
            })
          },
          () => !!document.querySelector('.data-grid__body-row[data-row-id]'),
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const cold = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'render',
          size: '1 000 000×30',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: LOAD_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('BH7-base', 'пределы уже измерены', base, false)
      await record('BH7', 'замер пределов высоты и липкости', cold, true)

      expect(
        cold.longestMs,
        `с замером ${cold.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Смена всего окна порциями строк (ADR 0203, WS6): монтирование 1000×1000 — самая длинная
// задача, стена до первой строки и вся работа против того же монтирования одним проходом.
/** Самая длинная задача — доля базы; 60 мс — цель RAIL в дашборде. */
const WS6_LONGEST = 0.3
const WS6_TARGET_MS = 60
const WS6_WORK = 1.1

/** Данные — заранее: генерация мока в рендере истории — не цена грида. */
let ws6Data: ReturnType<typeof makeData> | undefined
/** Монтирование до конца нарезки: строк тела столько же три кадра подряд. */
const measurePortions = async (all: boolean, sliced: boolean) => {
  ws6Data ??= makeData({ shape: 'flat', count: LARGE.dataCount })
  const dataOverride = ws6Data
  windowPortions.enabled = sliced
  try {
    let started = 0
    let firstRowMs = 0
    let last = -1
    let stable = 0
    const result = await measureRenderWork(
      () => {
        started = performance.now()
        if (all) renderGrid({ ...LARGE, ...ALL_PLUGINS, dataOverride })
        else renderPluginsGrid({ ...LARGE, dataOverride })
      },
      () => {
        const count = document.querySelectorAll('.data-grid__body-row').length
        if (count > 0 && !firstRowMs) firstRowMs = performance.now() - started
        stable = count > 0 && count === last ? stable + 1 : 0
        last = count
        return stable >= 3
      },
      { warmup: false },
    )
    await cleanup()
    return { ...result, firstRowMs }
  } finally {
    windowPortions.enabled = true
  }
}

describe('Производительность первой отрисовки — порции строк', () => {
  test(
    'WS6: монтирование 1000×1000 без плагинов и со всеми — самая длинная задача не длиннее 0,3 базы, первая строка — не позже базы, работа — не больше базы на 10 %; база — монтирование одним проходом; цель RAIL 60 мс — в дашборде',
    async () => {
      const failures: string[] = []
      for (const [plugins, all] of [
        ['none', false],
        ['all', true],
      ] as const) {
        const runs = await againstBase(sliced => measurePortions(all, sliced))
        const base = medianRun(runs.base, r => r.longestMs)
        const sliced = medianRun(runs.variant, r => r.longestMs)
        const wall = (list: typeof runs.base) =>
          medianRun(list, r => r.firstRowMs).firstRowMs
        for (const [id, r, gated] of [
          [`WS6-base-${plugins}`, base, false],
          [`WS6-${plugins}`, sliced, true],
        ] as const) {
          await recordPerf({
            id,
            label: gated
              ? 'монтирование порциями строк'
              : 'монтирование одним проходом',
            operation: 'render',
            size: '1000×1000',
            plugins,
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: WS6_TARGET_MS,
                ceilingMs: gated ? base.longestMs * WS6_LONGEST : undefined,
                ...r,
              },
            ],
          })
        }
        if (sliced.longestMs > base.longestMs * WS6_LONGEST) {
          failures.push(
            `${plugins}: самая длинная задача ${sliced.longestMs.toFixed(1)} мс (база ${base.longestMs.toFixed(1)} мс)`,
          )
        }
        if (wall(runs.variant) > wall(runs.base)) {
          failures.push(
            `${plugins}: первая строка через ${wall(runs.variant).toFixed(0)} мс, база ${wall(runs.base).toFixed(0)} мс`,
          )
        }
        if (sliced.totalMs > base.totalMs * WS6_WORK) {
          failures.push(
            `${plugins}: работа ${sliced.totalMs.toFixed(0)} мс, база ${base.totalMs.toFixed(0)} мс`,
          )
        }
      }
      expect(failures).toEqual([])
    },
    PERF_TIMEOUT * 8,
  )
})

// Прыжок за полосу окна (ADR 0203, WS7): видимые строки — в событии, запас — порциями; против
// того же прыжка одним проходом.
const WS7_WORK = 1.1

const measureJump = async (sliced: boolean) => {
  windowPortions.enabled = sliced
  try {
    ws6Data ??= makeData({ shape: 'flat', count: LARGE.dataCount })
    const screen = renderGrid({
      ...LARGE,
      ...ALL_PLUGINS,
      dataOverride: ws6Data,
    })
    await screen
    const rows = () => document.querySelectorAll('.data-grid__body-row').length
    let last = -1
    let stable = 0
    const settled = () => {
      const count = rows()
      stable = count > 0 && count === last ? stable + 1 : 0
      last = count
      return stable >= 10
    }
    for (let i = 0; i < 600 && !settled(); i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(requestAnimationFrame)
    }
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    stable = 0
    const result = await measureTransitionWork(async () => {
      scroller.scrollTop = scroller.scrollHeight / 2
    }, settled)
    await cleanup()
    return result
  } finally {
    windowPortions.enabled = true
  }
}

describe('Производительность прыжка — порции строк', () => {
  test(
    'WS7: прыжок прокрутки 1000×1000 со всеми плагинами в середину — самая длинная задача не длиннее базы, работа — не больше базы на 10 %',
    async () => {
      const runs = await againstBase(measureJump)
      const base = medianRun(runs.base, r => r.longestMs)
      const sliced = medianRun(runs.variant, r => r.longestMs)
      const ceiling = {
        longest: base.longestMs,
        work: base.totalMs * WS7_WORK,
      }
      for (const [id, r, gated] of [
        ['WS7-base', base, false],
        ['WS7', sliced, true],
      ] as const) {
        await recordPerf({
          id,
          label: gated
            ? 'прыжок: видимые сразу, запас порциями'
            : 'прыжок одним проходом',
          operation: 'interaction',
          size: '1000×1000',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: WS6_TARGET_MS,
              ceilingMs: gated ? ceiling.longest : undefined,
              ...r,
            },
          ],
        })
      }
      expect(
        sliced.longestMs,
        `самая длинная задача ${sliced.longestMs.toFixed(1)} мс, база ${base.longestMs.toFixed(1)} мс`,
      ).toBeLessThanOrEqual(ceiling.longest)
      expect(
        sliced.totalMs,
        `работа ${sliced.totalMs.toFixed(0)} мс, база ${base.totalMs.toFixed(0)} мс`,
      ).toBeLessThanOrEqual(ceiling.work)
    },
    PERF_TIMEOUT * 6,
  )
})
