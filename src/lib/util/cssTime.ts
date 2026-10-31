/** Время из CSS (ADR 0166): длительности и задержки переходов в мс. */

/** Первая длительность из CSS-значения (`600ms`, `0.6s`, `0.15s, 0.15s`) в мс. */
export const parseDuration = (value: string): number => {
  const first = value.split(',')[0].trim()
  const parsed = parseFloat(first)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return first.endsWith('ms') ? parsed : parsed * 1000
}

/** Время до конца самого долгого перехода стиля, мс: длительность плюс задержка. */
export const longestTransition = (style: CSSStyleDeclaration): number => {
  const durations = style.transitionDuration.split(',')
  const delays = style.transitionDelay.split(',')
  return durations.reduce(
    (max, duration, i) =>
      Math.max(
        max,
        parseDuration(duration) +
          parseDuration(delays[i % delays.length] ?? '0s'),
      ),
    0,
  )
}
