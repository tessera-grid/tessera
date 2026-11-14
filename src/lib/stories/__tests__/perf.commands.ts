/// <reference types="@vitest/browser-playwright" />
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { BrowserCommand } from 'vitest/node'

import {
  CPU_THROTTLE_RATE,
  FRAME_BUDGET_60FPS,
  LONG_TASK_MS,
} from './perf.constants.ts'

// Измерение плавности скролла через Playwright CDP `Tracing`. Трейс процессный,
// поэтому ловит работу главного потока рендерера в iframe (где Vitest монтирует
// грид) — в отличие от `Performance.getMetrics`. Длительности top-level задач
// (`ThreadControllerImpl::RunTask`) — это фактическое время работы на кадр в
// микросекундах, без привязки к частоте дисплея (в отличие от rAF-каденции).

/** Порог кадра 60fps в мс (RAIL Animation). */
const FRAME_BUDGET_MS = FRAME_BUDGET_60FPS

/**
 * Подмешанная работа (ADR 0099, PF16): `perf:compare` на стороне B растягивает
 * длительности задач на заданный процент — проверка чувствительности сравнения.
 */
const INJECTED_SCALE =
  1 + Number(process.env.TESSERA_PERF_INJECT_PCT ?? 0) / 100

/** Мелкие задачи (mojo/микротаски) — не кадровая работа; отсекаем при перцентилях. */
const SUBSTANTIAL_TASK_MS = 1

const RENDER_TASK_NAME = 'ThreadControllerImpl::RunTask'
const RENDERER_MAIN_THREAD = 'CrRendererMain'

interface TraceEvent {
  name?: string
  ph?: string
  dur?: number
  pid?: number
  tid?: number
  args?: { name?: string }
}

interface CDPSession {
  send: (method: string, params?: unknown) => Promise<unknown>
  on: (event: string, cb: (data: unknown) => void) => void
  once: (event: string, cb: (data: unknown) => void) => void
  detach: () => Promise<void>
}

export interface ScrollWorkResult {
  /** Число «содержательных» задач (≈ кадров): длительность ≥ 1мс. */
  taskCount: number
  /** Самая длинная задача главного потока, мс (худший «фриз»). */
  longestMs: number
  /** Сколько задач превысило бюджет кадра 16.7мс (≈ пропущенные кадры). */
  tasksOverBudget: number
  /** Число длинных задач (> 50мс) — блокирующих главный поток. */
  longTasks: number
  /** Total Blocking Time: сумма превышений длинных задач над 50мс, мс. */
  tbtMs: number
  /** 95-й перцентиль длительности содержательных задач, мс. */
  p95Ms: number
  /** 99-й перцентиль, мс. */
  p99Ms: number
  /** Вся работа главного потока за окно замера, мс: сумма задач (ADR 0121, WV8). */
  totalMs: number
  /**
   * Средний интервал кадра прокрутки по `requestAnimationFrame`, мс (ADR 0149, PS8): работу,
   * разбитую на задачи, p95 задач не видит, интервал кадра — видит.
   */
  frameMs?: number
  /** Кадров прокрутки длиннее двух кадров (34 мс): без vsync в headless — пропуски. */
  longFrames?: number
}

interface Trace {
  session: CDPSession
  events: TraceEvent[]
}

// Состояние по ключу — перф-тесты в разных файлах могут идти параллельно, и
// один Node-процесс команд не должен путать их трейсы.
const traces = new Map<string, Trace>()

export const perfTraceStart: BrowserCommand<[id: string]> = async (
  { context, page },
  id,
) => {
  const session = (await context.newCDPSession(page)) as unknown as CDPSession
  const events: TraceEvent[] = []

  session.on('Tracing.dataCollected', (data: unknown) => {
    const value = (data as { value?: TraceEvent[] })?.value
    if (value) events.push(...value)
  })

  // Троттлинг применяется только на измеряемое окно (сброс — в perfTraceStop).
  await session.send('Emulation.setCPUThrottlingRate', {
    rate: CPU_THROTTLE_RATE,
  })

  await session.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['toplevel', '__metadata'] },
  })

  traces.set(id, { session, events })
}

export const perfTraceStop: BrowserCommand<[id: string]> = async (
  _ctx,
  id,
): Promise<ScrollWorkResult> => {
  const trace = traces.get(id)
  if (!trace) {
    return {
      taskCount: 0,
      longestMs: 0,
      tasksOverBudget: 0,
      longTasks: 0,
      tbtMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      totalMs: 0,
    }
  }

  const { session, events } = trace

  const complete = new Promise<void>(resolve =>
    session.once('Tracing.tracingComplete', () => resolve()),
  )
  await session.send('Tracing.end')
  await complete
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await session.detach()
  traces.delete(id)

  // Главные потоки рендереров (процессов может быть несколько); грид — на самом
  // загруженном из них.
  const rendererMains = new Set(
    events
      .filter(
        e => e.name === 'thread_name' && e.args?.name === RENDERER_MAIN_THREAD,
      )
      .map(e => `${e.pid}:${e.tid}`),
  )

  const byThread = new Map<string, number[]>()
  for (const e of events) {
    if (
      e.name !== RENDER_TASK_NAME ||
      e.ph !== 'X' ||
      typeof e.dur !== 'number'
    ) {
      continue
    }
    const key = `${e.pid}:${e.tid}`
    if (!rendererMains.has(key)) continue
    const list = byThread.get(key) ?? []
    list.push((e.dur / 1000) * INJECTED_SCALE)
    byThread.set(key, list)
  }

  let all: number[] = []
  let busiest = -1
  for (const list of byThread.values()) {
    const sum = list.reduce((a, b) => a + b, 0)
    if (sum > busiest) {
      busiest = sum
      all = list
    }
  }

  const substantial = all
    .filter(d => d >= SUBSTANTIAL_TASK_MS)
    .sort((a, b) => a - b)
  const n = substantial.length
  const percentile = (q: number) =>
    substantial[Math.max(0, Math.ceil(n * q) - 1)] ?? 0

  const longTaskDurations = all.filter(d => d > LONG_TASK_MS)

  return {
    taskCount: n,
    longestMs: all.length ? Math.max(...all) : 0,
    tasksOverBudget: all.filter(d => d > FRAME_BUDGET_MS).length,
    longTasks: longTaskDurations.length,
    tbtMs: longTaskDurations.reduce((sum, d) => sum + (d - LONG_TASK_MS), 0),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    totalMs: all.reduce((sum, d) => sum + d, 0),
  }
}

// --- Запись результатов для дашборда -----------------------------------------
// Перф-тесты складывают итог каждого кейса сюда; генератор (`scripts/perf-report.mjs`)
// рендерит из этого JSON локальный HTML-борд. Хранится только ПОСЛЕДНИЙ прогон:
// первая запись в процессе `vitest run` очищает накопитель, остальные добавляются.

/** Одна измеренная величина кейса (ось для прокрутки; для отрисовки оси нет). */
export interface PerfMetric {
  axis?: 'y' | 'x'
  /** Модель цели: RAIL Animation (кадр 16.7мс) или Load (интерактивность 1000мс). */
  kind: 'animation' | 'load'
  /**
   * Какая величина сверяется: p95 (прокрутка), longest (отрисовка), tbt (пачка задач) или
   * frame — средний интервал кадра прокрутки (ADR 0149, PS8), total — вся работа главного потока
   * (ADR 0223, LM11).
   */
  metric: 'p95' | 'longest' | 'tbt' | 'frame' | 'total'
  /** Значение метрики, мс. */
  valueMs: number
  /** Цель RAIL/CWV, мс: в дашборде — «в цели» или «вне цели», без гейта (ADR 0099). */
  targetMs: number
  /** Потолок против базы того же теста, мс (ADR 0099, §1а) — гейт кейса фичи. */
  ceilingMs?: number
  p95Ms: number
  p99Ms: number
  longestMs: number
  tasksOverBudget: number
  longTasks: number
  tbtMs: number
  taskCount: number
}

/** Результат одного перф-кейса. */
export interface PerfRecord {
  id: string
  label: string
  operation: 'render' | 'scroll' | 'interaction'
  /** Объём данных, напр. '30×500'. */
  size: string
  /** Режим плагинов. */
  /** `all`/`none` — оси матрицы; имя плагина — кейс одного плагина (AS14). */
  plugins:
    | 'none'
    | 'all'
    | 'cellEditing'
    | 'cellEditing, cellSelection'
    | 'cellEditing, cellSelection, editHistory'
    | 'failureLog'
    | 'unsavedChanges'
    | 'cellErrors'
    | 'columnFiltering'
    | 'rowExpanding'
    | 'rowActions'
    | 'columnFiltering, rowGrouping'
    | 'labels'
    | 'rowSelection, rowExpanding, highlight'
    | 'rowDragging, rowExpanding'
    | 'models'
    | 'disabled'
    | 'infiniteScroll'
    | 'serverRowModel'
    | 'headerActionMenu'
    | 'serverRowModel, rowExpanding'
    | 'serverRowModel, rowGrouping, rowExpanding'
    | 'rowGrouping, rowExpanding, rowSelection'
    | 'rowGrouping, rowExpanding, rowDragging'
    | 'serverRowModel, rowGrouping, rowExpanding, rowSelection'
    | 'cellSelection'
    | 'serverRowModel, cellSelection'
    | 'pagination'
    | 'serverRowModel, pagination'
    | 'rowDragging'
    | 'serverRowModel, rowDragging'
    | 'serverRowModel, rowExpanding, rowSelection'
    | 'rowGrouping'
    | 'backToTop'
    | 'loading'
    | 'footer'
    | 'columnSorting'
    | 'columnSizing'
    | 'columnPinning'
    | 'columnSorting, columnFiltering, rowGrouping'
    | 'textWrap'
  /** Кратность CPU-троттлинга во время замера (1 = без троттлинга). */
  cpuThrottle: number
  metrics: PerfMetric[]
  /** Попытка, с которой записан кейс (ставит команда): больше 1 — прошёл с повтора. */
  attempts?: number
}

export interface PerfReport {
  generatedAt: string
  records: PerfRecord[]
}

/** `perf:compare` пишет каждый прогон в свой файл (ADR 0099, PF13). */
const RESULTS_PATH = resolve(
  process.cwd(),
  process.env.TESSERA_PERF_RESULTS ?? 'performance-results/latest.json',
)

// null → в этом процессе `vitest run` ещё не было записей; первая запись начинает
// новый прогон с чистого листа (семантика «только последний прогон»).
let runRecords: PerfRecord[] | null = null

export const perfRecord: BrowserCommand<[record: PerfRecord]> = async (
  _ctx,
  record,
) => {
  if (runRecords === null) runRecords = []
  // Повтор кейса (retry) переписывает запись и считает попытки — выброс виден в дашборде.
  const previous = runRecords.find(r => r.id === record.id)
  const attempts = (previous?.attempts ?? 0) + 1
  runRecords = [
    ...runRecords.filter(r => r.id !== record.id),
    { ...record, attempts },
  ]

  const report: PerfReport = {
    generatedAt: new Date().toISOString(),
    records: runRecords,
  }
  mkdirSync(dirname(RESULTS_PATH), { recursive: true })
  writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`)
}
