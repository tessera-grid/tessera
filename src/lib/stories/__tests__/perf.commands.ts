/// <reference types="@vitest/browser-playwright" />
import type { BrowserCommand } from 'vitest/node'

// Измерение плавности скролла через Playwright CDP `Tracing`. Трейс процессный,
// поэтому ловит работу главного потока рендерера в iframe (где Vitest монтирует
// грид) — в отличие от `Performance.getMetrics`. Длительности top-level задач
// (`ThreadControllerImpl::RunTask`) — это фактическое время работы на кадр в
// микросекундах, без привязки к частоте дисплея (в отличие от rAF-каденции).

/** Порог кадра 60fps в мс. */
const FRAME_BUDGET_MS = 1000 / 60

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
  /** 95-й перцентиль длительности содержательных задач, мс. */
  p95Ms: number
  /** 99-й перцентиль, мс. */
  p99Ms: number
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
    return { taskCount: 0, longestMs: 0, tasksOverBudget: 0, p95Ms: 0, p99Ms: 0 }
  }

  const { session, events } = trace

  const complete = new Promise<void>(resolve =>
    session.once('Tracing.tracingComplete', () => resolve()),
  )
  await session.send('Tracing.end')
  await complete
  await session.detach()
  traces.delete(id)

  // Главные потоки рендереров (процессов может быть несколько); грид — на самом
  // загруженном из них.
  const rendererMains = new Set(
    events
      .filter(e => e.name === 'thread_name' && e.args?.name === RENDERER_MAIN_THREAD)
      .map(e => `${e.pid}:${e.tid}`),
  )

  const byThread = new Map<string, number[]>()
  for (const e of events) {
    if (e.name !== RENDER_TASK_NAME || e.ph !== 'X' || typeof e.dur !== 'number') {
      continue
    }
    const key = `${e.pid}:${e.tid}`
    if (!rendererMains.has(key)) continue
    const list = byThread.get(key) ?? []
    list.push(e.dur / 1000)
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

  const substantial = all.filter(d => d >= SUBSTANTIAL_TASK_MS).sort((a, b) => a - b)
  const n = substantial.length
  const percentile = (q: number) =>
    substantial[Math.max(0, Math.ceil(n * q) - 1)] ?? 0

  return {
    taskCount: n,
    longestMs: all.length ? Math.max(...all) : 0,
    tasksOverBudget: all.filter(d => d > FRAME_BUDGET_MS).length,
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  }
}
