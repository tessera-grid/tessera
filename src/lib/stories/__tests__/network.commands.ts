import type { BrowserCommand } from 'vitest/node'
import type { Route } from 'playwright'

// Задержка и отказ загрузки модуля (ADR 0061, §6): перехват запроса Playwright по
// части адреса. `hold` держит запрос до `releaseModule`, `fail` обрывает каждый,
// в том числе удержанные.

type Mode = 'hold' | 'fail'

interface Held {
  route: Route
  done: () => void
}

interface Interception {
  mode: Mode
  held: Held[]
  matches: (url: URL) => boolean
  handler: (route: Route) => Promise<void> | void
}

const intercepted = new Map<string, Interception>()

export const routeModule: BrowserCommand<
  [pattern: string, mode: Mode]
> = async ({ page }, pattern, mode) => {
  const current = intercepted.get(pattern)
  if (current) {
    current.mode = mode
    // Переключение в `fail` обрывает и уже удержанные запросы.
    if (mode === 'fail') {
      for (const { route, done } of current.held.splice(0)) {
        await route.abort()
        done()
      }
    }
    return
  }
  const interception: Interception = {
    mode,
    held: [],
    matches: url => url.pathname.includes(pattern),
    // Запрос держится, пока обработчик не завершён: Playwright не отдаёт его другим.
    handler: route =>
      interception.mode === 'fail'
        ? route.abort()
        : new Promise<void>(done => interception.held.push({ route, done })),
  }
  intercepted.set(pattern, interception)
  await page.route(interception.matches, interception.handler)
}

/** Пропустить удержанные и будущие запросы модуля. */
export const releaseModule: BrowserCommand<[pattern: string]> = async (
  { page },
  pattern,
) => {
  const interception = intercepted.get(pattern)
  if (!interception) return
  intercepted.delete(pattern)
  await page.unroute(interception.matches, interception.handler)
  for (const { route, done } of interception.held) {
    await route.fallback()
    done()
  }
}

/** Сколько запросов модуля сейчас удержано. */
export const heldModuleRequests: BrowserCommand<[pattern: string]> = async (
  _context,
  pattern,
) => intercepted.get(pattern)?.held.length ?? 0
