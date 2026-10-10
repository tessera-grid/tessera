import type { BrowserCommand } from 'vitest/node'
import type { Page, Route } from 'playwright'

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

// Свой список на страницу: движки идут параллельно, и общий список отдал бы перехват
// одного движка другому.
const pages = new WeakMap<Page, Map<string, Interception>>()
const interceptedOn = (page: Page) => {
  let intercepted = pages.get(page)
  if (!intercepted) pages.set(page, (intercepted = new Map()))
  return intercepted
}

export const routeModule: BrowserCommand<
  [pattern: string, mode: Mode]
> = async ({ page }, pattern, mode) => {
  const intercepted = interceptedOn(page)
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
  const intercepted = interceptedOn(page)
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
  { page },
  pattern,
) => interceptedOn(page).get(pattern)?.held.length ?? 0
