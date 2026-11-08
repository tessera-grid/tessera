/// <reference types="@vitest/browser-playwright" />
import type { BrowserCommand } from 'vitest/node'

// Раскладки и пересчёты стилей действия через трейс CDP (ADR 0099, PF2): события `Layout`
// и `UpdateLayoutTree` главного потока рендерера. `Performance.getMetrics` кадр теста —
// iframe оркестратора — не видит. Только Chromium: в Firefox и WebKit раскладки и стили —
// `NaN`, утверждение о них падает, а счёт React от движка не зависит (ADR 0084).

interface CDPSession {
  send: (method: string, params?: unknown) => Promise<unknown>
  on: (event: string, handler: (payload: never) => void) => void
  once: (event: string, handler: (payload: never) => void) => void
  detach: () => Promise<void>
}

interface TraceEvent {
  name?: string
  ph?: string
}

export interface RenderMetrics {
  layouts: number
  styleRecalcs: number
}

const sessions = new Map<
  string,
  { session: CDPSession; events: TraceEvent[] }
>()

export const renderTraceStart: BrowserCommand<[id: string]> = async (
  { context, page, provider },
  id,
) => {
  if ((provider as { browserName?: string }).browserName !== 'chromium') return
  const session = (await context.newCDPSession(page)) as unknown as CDPSession
  const events: TraceEvent[] = []
  session.on('Tracing.dataCollected', ({ value }: { value: TraceEvent[] }) =>
    events.push(...value),
  )
  await session.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline'] },
  })
  sessions.set(id, { session, events })
}

export const renderTraceStop: BrowserCommand<[id: string]> = async (
  _context,
  id,
): Promise<RenderMetrics> => {
  const trace = sessions.get(id)
  if (!trace) return { layouts: Number.NaN, styleRecalcs: Number.NaN }
  sessions.delete(id)
  const { session, events } = trace
  const complete = new Promise<void>(resolve =>
    session.once('Tracing.tracingComplete', () => resolve()),
  )
  await session.send('Tracing.end')
  await complete
  await session.detach()
  // Полные события (`X`) и пары начала (`B`) — по одному на раскладку или пересчёт.
  const count = (name: string) =>
    events.filter(
      event => event.name === name && (event.ph === 'X' || event.ph === 'B'),
    ).length
  return { layouts: count('Layout'), styleRecalcs: count('UpdateLayoutTree') }
}
