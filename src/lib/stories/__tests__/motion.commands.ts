import type { BrowserCommand } from 'vitest/node'

type CommandContext = Parameters<BrowserCommand<[]>>[0]

/**
 * Ждёт, пока медиа-запрос дойдёт до стилей во фрейме теста. Firefox после первой
 * эмуляции в документе уже отвечает `matchMedia`, но правила `@media` применяет кадр-другой
 * спустя.
 */
const settleMedia = async (
  context: CommandContext,
  query: string,
  active: boolean,
) => {
  const frame = await (
    context as unknown as {
      frame: () => Promise<{
        evaluate: <A>(fn: (arg: A) => unknown, arg: A) => Promise<unknown>
      }>
    }
  ).frame()
  await frame.evaluate(
    async ({ query, active }) => {
      const style = document.createElement('style')
      style.textContent = `@media ${query} { [data-tsr-media-probe] { --tsr-media-probe: on } }`
      const probe = document.createElement('i')
      probe.setAttribute('data-tsr-media-probe', '')
      document.head.append(style)
      document.body.append(probe)
      const applied = () =>
        getComputedStyle(probe).getPropertyValue('--tsr-media-probe').trim() ===
        (active ? 'on' : '')
      const started = performance.now()
      while (!applied() && performance.now() - started < 2000) {
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      style.remove()
      probe.remove()
    },
    { query, active },
  )
}

// Эмуляция системной настройки «меньше движения» (`prefers-reduced-motion`) в
// реальном Chromium: нужна контракту движения (ADR 0017, MO3).
export const reducedMotion: BrowserCommand<[reduce: boolean]> = async (
  context,
  reduce,
) => {
  await context.page.emulateMedia({
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  })
  await settleMedia(context, '(prefers-reduced-motion: reduce)', reduce)
}

// Эмуляция высокой контрастности Windows (`forced-colors: active`, ADR 0087).
export const forcedColors: BrowserCommand<[active: boolean]> = async (
  context,
  active,
) => {
  await context.page.emulateMedia({ forcedColors: active ? 'active' : 'none' })
  await settleMedia(context, '(forced-colors: active)', active)
}

// Эмуляция системной просьбы о контрасте (`prefers-contrast: more`, ADR 0088).
export const moreContrast: BrowserCommand<[active: boolean]> = async (
  context,
  active,
) => {
  await context.page.emulateMedia({
    contrast: active ? 'more' : 'no-preference',
  })
  await settleMedia(context, '(prefers-contrast: more)', active)
}
