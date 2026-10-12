// Кейс фичи против базы внутри прогона (ADR 0099, PF22): база и вариант по три раза
// вперемешку — дрейф машины за время теста ложится на обе стороны поровну.

export const BASELINE_ROUNDS = 3

/** Порядок замеров: в чётном раунде база первой, в нечётном — вариант (B, V, V, B, B, V). */
export const interleavedOrder = (rounds = BASELINE_ROUNDS): boolean[] =>
  Array.from({ length: rounds }, (_, round) =>
    round % 2 === 0 ? [false, true] : [true, false],
  ).flat()

/** Замеры базы (`variant = false`) и варианта вперемешку. */
export async function againstBase<T>(
  measure: (variant: boolean) => Promise<T>,
  rounds = BASELINE_ROUNDS,
): Promise<{ base: T[]; variant: T[] }> {
  const base: T[] = []
  const variant: T[] = []
  for (const isVariant of interleavedOrder(rounds)) {
    // eslint-disable-next-line no-await-in-loop
    const run = await measure(isVariant)
    ;(isVariant ? variant : base).push(run)
  }
  return { base, variant }
}

/** Замер с медианным значением: в отчёт идёт настоящий замер, а не среднее. */
export const medianRun = <T>(runs: T[], value: (run: T) => number): T => {
  if (runs.length === 0) throw new Error('medianRun: нет замеров')
  const sorted = [...runs].sort((a, b) => value(a) - value(b))
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

/** Медианный замер по каждой оси прокрутки отдельно. */
export const medianAxes = <R extends { p95Ms: number }>(
  runs: { y: R; x: R }[],
): { y: R; x: R } => ({
  y: medianRun(
    runs.map(run => run.y),
    r => r.p95Ms,
  ),
  x: medianRun(
    runs.map(run => run.x),
    r => r.p95Ms,
  ),
})

/** Цена фичи против базы: во столько раз или на столько мс — что больше. */
export interface Cost {
  ratio: number
  plusMs: number
}

/** Потолок варианта: база с ценой фичи. */
export const ceilingOver = (base: number, { ratio, plusMs }: Cost) =>
  Math.max(base * ratio, base + plusMs)

/** Потолок p95 прокрутки по каждой оси. */
export const axesCeiling = (
  base: { y: { p95Ms: number }; x: { p95Ms: number } },
  cost: Cost,
) => ({
  y: ceilingOver(base.y.p95Ms, cost),
  x: ceilingOver(base.x.p95Ms, cost),
})
