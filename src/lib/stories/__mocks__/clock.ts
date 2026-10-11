/**
 * Закреплённое «сейчас» историй и тестов: 2026-06-15 12:00 UTC (ADR 0093, VR3). Дальше
 * 25 дней от 15 марта — дня первых строк мока дат: строки «назад от сейчас» на него не
 * попадают.
 */
export const STORY_NOW = Date.UTC(2026, 5, 15, 12)

type Pinned = DateConstructor & { pinned?: true }

/**
 * Закрепляет дату страницы: `Date.now()` и `new Date()` отсчитываются от `now`, но
 * время идёт — задержки и троттлинг, которые считают по `Date.now()`, работают. Даты,
 * созданные до вызова, остаются `instanceof Date`: прототип общий.
 */
export const pinClock = (now = STORY_NOW) => {
  const Real = globalThis.Date as Pinned
  if (Real.pinned) {
    return
  }
  const offset = now - Real.now()
  const current = () => Real.now() + offset
  function PinnedDate(this: unknown, ...args: unknown[]) {
    if (!new.target) {
      return new Real(current()).toString()
    }
    return args.length === 0
      ? new Real(current())
      : new (Real as unknown as new (...values: unknown[]) => Date)(...args)
  }
  PinnedDate.prototype = Real.prototype
  Object.assign(PinnedDate, {
    now: current,
    parse: Real.parse,
    UTC: Real.UTC,
    pinned: true,
  })
  globalThis.Date = PinnedDate as unknown as DateConstructor
}
