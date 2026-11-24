// Перф-инструменты (ADR 0099): сравнение с базой вперемешку (PF12–PF18) — рабочее
// дерево ревизии, раунды A/B с чередованием порядка, бутстреп-интервал отношения
// медиан; дашборд (PF17, PF19) — цели RAIL, гейт против базы, тренд по истории.

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// --- Статистика (PF14) -------------------------------------------------------------

/** Порог вердикта: отношение медиан B/A за пределами 1 ± 10 %. */
export const VERDICT_THRESHOLD = 0.1
export const BOOTSTRAP_RESAMPLES = 10_000
export const BOOTSTRAP_SEED = 20261012

export type Verdict =
  'regression' | 'improvement' | 'unchanged' | 'undetermined'

export const VERDICT_LABEL: Record<Verdict, string> = {
  regression: 'регрессия',
  improvement: 'улучшение',
  unchanged: 'без изменений',
  undetermined: 'не определено',
}

/** Генератор с зерном: одинаковые выборки дают одинаковый интервал. */
export const seededRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const median = (values: number[]) => {
  if (values.length === 0) throw new Error('median: нет значений')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export interface RatioInterval {
  ratio: number
  low: number
  high: number
}

/** Отношение медиан B/A и его 95 %-интервал бутстрепом (выборки сторон независимо). */
export const bootstrapRatio = (
  a: number[],
  b: number[],
  { resamples = BOOTSTRAP_RESAMPLES, seed = BOOTSTRAP_SEED } = {},
): RatioInterval => {
  const random = seededRandom(seed)
  const resample = (values: number[]) =>
    median(values.map(() => values[Math.floor(random() * values.length)]!))
  const ratios: number[] = []
  for (let i = 0; i < resamples; i++) ratios.push(resample(b) / resample(a))
  ratios.sort((x, y) => x - y)
  const at = (q: number) =>
    ratios[Math.min(ratios.length - 1, Math.floor(q * ratios.length))]!
  return { ratio: median(b) / median(a), low: at(0.025), high: at(0.975) }
}

export const verdictOf = (
  { low, high }: Pick<RatioInterval, 'low' | 'high'>,
  threshold = VERDICT_THRESHOLD,
): Verdict => {
  if (low > 1 + threshold) return 'regression'
  if (high < 1 - threshold) return 'improvement'
  if (low >= 1 - threshold && high <= 1 + threshold) return 'unchanged'
  return 'undetermined'
}

/** Ненулевой код выхода — только на регрессии. */
export const exitCodeOf = (verdicts: Verdict[]) =>
  verdicts.includes('regression') ? 1 : 0

// --- Замеры (PF18) -----------------------------------------------------------------

export interface RecordedMetric {
  axis?: 'y' | 'x'
  metric: 'p95' | 'longest' | 'tbt' | 'frame' | 'total'
  valueMs: number
}

export interface RecordedCase {
  id: string
  metrics: RecordedMetric[]
}

/** Ключ метрики: запись, ось и вид — `P2/y/p95`, `RE50-base/-/longest`. */
export const metricKey = (recordId: string, m: RecordedMetric) =>
  `${recordId}/${m.axis ?? '-'}/${m.metric}`

/** Записи кейса — сам кейс и его база внутри прогона (`GL13`, `GL13-base`). */
export const belongsTo = (caseId: string, recordId: string) =>
  recordId === caseId || recordId.startsWith(`${caseId}-`)

/**
 * Значения метрик запрошенных кейсов из отчёта прогона. Кейс без записи — невалидный
 * замер (прогрев, режим прокрутки, `verify`): ошибка, а не вердикт.
 */
export const samplesOf = (
  records: RecordedCase[],
  cases: string[],
): Map<string, number> => {
  const values = new Map<string, number>()
  for (const caseId of cases) {
    const own = records.filter(r => belongsTo(caseId, r.id))
    if (own.length === 0) {
      throw new Error(
        `perf:compare: кейс ${caseId} не записал замер — замер невалиден, см. вывод vitest`,
      )
    }
    for (const r of own) {
      for (const m of r.metrics) values.set(metricKey(r.id, m), m.valueMs)
    }
  }
  return values
}

// --- Раунды (PF13) -----------------------------------------------------------------

export type Side = 'A' | 'B'

export const MIN_ROUNDS = 5
export const MAX_ROUNDS = 15

/** Порядок сторон в раунде: в нечётном (с 1) A первой, в чётном — B. */
export const roundOrder = (round: number): Side[] =>
  round % 2 === 1 ? ['A', 'B'] : ['B', 'A']

export interface MetricComparison extends RatioInterval {
  caseId: string
  key: string
  medianA: number
  medianB: number
  samplesA: number[]
  samplesB: number[]
  verdict: Verdict
}

export interface CompareRun {
  rounds: number
  results: MetricComparison[]
}

/**
 * Раунды вперемешку: минимум `min`, затем добор для кейсов с неопределённым вердиктом,
 * не больше `max`. `runSide` прогоняет кейсы на стороне и отдаёт значения метрик.
 */
export const runRounds = async ({
  cases,
  runSide,
  min = MIN_ROUNDS,
  max = MAX_ROUNDS,
  threshold = VERDICT_THRESHOLD,
}: {
  cases: string[]
  runSide: (
    side: Side,
    cases: string[],
    round: number,
  ) => Promise<Map<string, number>>
  min?: number
  max?: number
  threshold?: number
}): Promise<CompareRun> => {
  const samples = new Map<
    string,
    { caseId: string; A: number[]; B: number[] }
  >()
  const caseOf = (key: string) =>
    cases.find(c => belongsTo(c, key.split('/')[0]!))!
  const compare = (): MetricComparison[] =>
    [...samples].map(([key, { caseId, A, B }]) => {
      const interval = bootstrapRatio(A, B)
      return {
        caseId,
        key,
        medianA: median(A),
        medianB: median(B),
        samplesA: A,
        samplesB: B,
        ...interval,
        verdict: verdictOf(interval, threshold),
      }
    })
  let pending = cases
  let round = 0
  while (pending.length > 0 && round < max) {
    round++
    for (const side of roundOrder(round)) {
      // eslint-disable-next-line no-await-in-loop
      const values = await runSide(side, pending, round)
      for (const [key, value] of values) {
        const entry = samples.get(key) ?? { caseId: caseOf(key), A: [], B: [] }
        entry[side].push(value)
        samples.set(key, entry)
      }
    }
    for (const [key, { caseId, A, B }] of samples) {
      if (!pending.includes(caseId)) continue
      const missing =
        A.length < round ? 'A' : B.length < round ? 'B' : undefined
      if (missing)
        throw new Error(
          `perf:compare: нет сопоставимого замера ${key} на стороне ${missing} (раунд ${round})`,
        )
    }
    if (round >= min) {
      const undetermined = new Set(
        compare()
          .filter(r => r.verdict === 'undetermined')
          .map(r => r.caseId),
      )
      pending = pending.filter(c => undetermined.has(c))
    }
  }
  return { rounds: round, results: compare() }
}

// --- Рабочее дерево (PF12) ----------------------------------------------------------

const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

export interface Worktree {
  dir: string
  sha: string
  linked: boolean
}

/**
 * Рабочее дерево `ref` во временном каталоге. Зависимости — ссылкой на `node_modules`
 * проекта при совпадающем lockfile; иначе остановка или `npm ci` по `install`.
 */
export const prepareWorktree = (
  repo: string,
  ref: string,
  {
    install = false,
    npmCi = (dir: string) =>
      execFileSync('npm', ['ci'], { cwd: dir, stdio: 'inherit', shell: true }),
  }: {
    install?: boolean
    npmCi?: (dir: string) => unknown
  } = {},
): Worktree => {
  const sha = git(repo, ['rev-parse', '--verify', `${ref}^{commit}`])
  const ownLock = readFileSync(resolve(repo, 'package-lock.json'), 'utf8')
  const refLock = git(repo, ['show', `${sha}:package-lock.json`])
  const sameLock = ownLock.trim() === refLock.trim()
  if (!sameLock && !install) {
    throw new Error(
      `perf:compare: package-lock.json у ${ref} отличается — добавьте --install, чтобы поставить зависимости в рабочем дереве (npm ci)`,
    )
  }
  const dir = mkdtempSync(join(tmpdir(), `tessera-compare-${sha.slice(0, 8)}-`))
  rmSync(dir, { recursive: true })
  git(repo, ['worktree', 'add', '--detach', dir, sha])
  const tree: Worktree = { dir, sha, linked: sameLock }
  try {
    if (sameLock) {
      symlinkSync(
        resolve(repo, 'node_modules'),
        join(dir, 'node_modules'),
        'junction',
      )
    } else {
      npmCi(dir)
    }
  } catch (error) {
    removeWorktree(repo, tree)
    throw error
  }
  return tree
}

/** Удаление дерева: ссылка на `node_modules` снимается первой — содержимое проекта цело. */
export const removeWorktree = (repo: string, { dir, linked }: Worktree) => {
  const link = join(dir, 'node_modules')
  if (linked && existsSync(link) && lstatSync(link).isSymbolicLink()) {
    rmSync(link)
  }
  try {
    git(repo, ['worktree', 'remove', '--force', dir])
  } catch {
    // Снимки упавших тестов с длинными именами git на Windows не удаляет, Node — удаляет.
    rmSync(dir, { recursive: true, force: true })
  } finally {
    git(repo, ['worktree', 'prune'])
  }
}

// --- Дашборд (PF17, PF19) ----------------------------------------------------------

export interface ReportMetric {
  axis?: 'y' | 'x'
  kind: 'animation' | 'load'
  metric: 'p95' | 'longest' | 'tbt' | 'frame' | 'total'
  valueMs: number
  targetMs: number
  ceilingMs?: number
  p95Ms: number
  p99Ms: number
  longestMs: number
  longTasks: number
  tbtMs: number
}

export interface ReportRecord {
  id: string
  label: string
  operation: 'render' | 'scroll' | 'interaction'
  size: string
  plugins: string
  cpuThrottle: number
  metrics: ReportMetric[]
  attempts?: number
}

export interface PerfReport {
  generatedAt: string
  records: ReportRecord[]
}

// --- Статус (PF19) -----------------------------------------------------------------

/** Цель RAIL — информация; гейт — только потолок против базы того же теста. */
export const metricStatus = (m: ReportMetric) => ({
  target: m.valueMs <= m.targetMs ? ('in' as const) : ('out' as const),
  gate:
    m.ceilingMs === undefined
      ? undefined
      : m.valueMs <= m.ceilingMs
        ? ('ok' as const)
        : ('fail' as const),
})

// --- История (PF19) ----------------------------------------------------------------

export const HISTORY_LIMIT = 50

export interface HistoryEntry {
  generatedAt: string
  values: Record<string, number>
}

/** Прогон в историю: повтор того же прогона не дублируется, хранятся последние 50. */
export const appendHistory = (
  history: HistoryEntry[],
  report: PerfReport,
  limit = HISTORY_LIMIT,
): HistoryEntry[] => {
  if (history.at(-1)?.generatedAt === report.generatedAt) return history
  const values: Record<string, number> = {}
  for (const r of report.records) {
    for (const m of r.metrics) values[metricKey(r.id, m)] = m.valueMs
  }
  return [...history, { generatedAt: report.generatedAt, values }].slice(-limit)
}

/** Значения метрики по прогонам истории, от старых к новым. */
export const trendOf = (history: HistoryEntry[], key: string) =>
  history.flatMap(entry => (key in entry.values ? [entry.values[key]!] : []))

// --- Отчёт сравнения (PF17) --------------------------------------------------------

export interface CompareReport {
  generatedAt: string
  ref: string
  sha: string
  sameRevision?: boolean
  rounds: number
  threshold: number
  results: MetricComparison[]
}

export const compareReport = (
  run: CompareRun,
  {
    ref,
    sha,
    sameRevision,
    generatedAt = new Date().toISOString(),
  }: {
    ref: string
    sha: string
    sameRevision?: boolean
    generatedAt?: string
  },
): CompareReport => ({
  generatedAt,
  ref,
  sha,
  ...(sameRevision ? { sameRevision } : {}),
  rounds: run.rounds,
  threshold: VERDICT_THRESHOLD,
  results: run.results,
})

const fixed = (v: number, digits = 1) => v.toFixed(digits)

/** Таблица для консоли: кейс, метрика, медианы, отношение, интервал, вердикт. */
export const formatCompareTable = (report: CompareReport) => {
  const header = ['метрика', 'A, мс', 'B, мс', 'B/A', '95 %', 'вердикт']
  const rows = report.results.map(r => [
    r.key,
    fixed(r.medianA),
    fixed(r.medianB),
    fixed(r.ratio, 3),
    `${fixed(r.low, 3)}–${fixed(r.high, 3)}`,
    VERDICT_LABEL[r.verdict],
  ])
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map(row => row[i]!.length)),
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join('  ')
  const variant = report.sameRevision ? 'та же ревизия' : 'рабочая копия'
  return [
    `perf:compare: A = ${report.ref} (${report.sha.slice(0, 8)}), B = ${variant}; раундов ${report.rounds}, порог ±${report.threshold * 100} %`,
    line(header),
    ...rows.map(line),
  ].join('\n')
}

// --- HTML (PF17, PF19) -------------------------------------------------------------

const ms = (v: number) => `${v.toFixed(1)} мс`
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
const KIND_LABEL = { animation: 'RAIL Animation', load: 'RAIL Load' }

/** Тренд метрики — линия по последним прогонам. */
const sparkline = (values: number[]) => {
  if (values.length < 2) return ''
  const w = 120
  const h = 24
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`,
    )
    .join(' ')
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="тренд за ${values.length} прогонов"><polyline points="${points}"/></svg>`
}

const metricRow = (
  record: ReportRecord,
  m: ReportMetric,
  history: HistoryEntry[],
) => {
  const { target, gate } = metricStatus(m)
  const name = m.axis
    ? `${m.axis.toUpperCase()} · ${KIND_LABEL[m.kind]}`
    : KIND_LABEL[m.kind]
  return `
    <div class="metric ${gate === 'fail' ? 'fail' : target}">
      <div class="metric__head">
        <span class="metric__name">${esc(name)}</span>
        <span class="metric__val">${ms(m.valueMs)} <span class="muted">/ цель ${ms(m.targetMs)}</span></span>
        <span class="badge badge--${target}">${target === 'in' ? 'В ЦЕЛИ' : 'ВНЕ ЦЕЛИ'}</span>
        ${gate ? `<span class="badge badge--${gate}">${gate === 'ok' ? 'НЕ ХУЖЕ БАЗЫ' : 'ХУЖЕ БАЗЫ'} · потолок ${ms(m.ceilingMs!)}</span>` : ''}
      </div>
      ${sparkline(trendOf(history, metricKey(record.id, m)))}
      <div class="stats">
        <span>p95 <b>${ms(m.p95Ms)}</b></span>
        <span>p99 <b>${ms(m.p99Ms)}</b></span>
        <span>longest <b>${ms(m.longestMs)}</b></span>
        <span>long&nbsp;tasks <b>${m.longTasks}</b></span>
        <span>TBT <b>${ms(m.tbtMs)}</b></span>
      </div>
    </div>`
}

const card = (r: ReportRecord, history: HistoryEntry[]) => {
  const failed = r.metrics.some(m => metricStatus(m).gate === 'fail')
  const plugins =
    r.plugins === 'all'
      ? 'все плагины'
      : r.plugins === 'none'
        ? 'без плагинов'
        : r.plugins
  return `
    <article class="card${failed ? ' card--fail' : ''}">
      <header class="card__head">
        <span class="card__id">${esc(r.id)}</span>
        <span class="card__label">${esc(r.label)}</span>
        ${(r.attempts ?? 1) > 1 ? `<span class="tag">попытка ${r.attempts}</span>` : ''}
        <span class="card__meta">${esc(r.size)} · ${esc(plugins)}</span>
      </header>
      ${r.metrics.map(m => metricRow(r, m, history)).join('')}
    </article>`
}

const VERDICT_CLASS: Record<Verdict, string> = {
  regression: 'fail',
  improvement: 'in',
  unchanged: 'ok',
  undetermined: 'out',
}

const compareSection = (compare: CompareReport | undefined) => {
  if (!compare) return ''
  const rows = compare.results
    .map(
      r =>
        `<tr><td>${esc(r.key)}</td><td>${ms(r.medianA)}</td><td>${ms(r.medianB)}</td><td>${r.ratio.toFixed(3)}</td><td>${r.low.toFixed(3)}–${r.high.toFixed(3)}</td><td><span class="badge badge--${VERDICT_CLASS[r.verdict]}">${esc(VERDICT_LABEL[r.verdict])}</span></td></tr>`,
    )
    .join('')
  return `<section id="compare"><h2>Сравнение с ${esc(compare.ref)} (${esc(compare.sha.slice(0, 8))})</h2>
    <p class="sub">Раундов ${compare.rounds}, вперемешку; отношение медиан B/A с 95 %-интервалом, порог ±${compare.threshold * 100} %.</p>
    <table><thead><tr><th>Метрика</th><th>A</th><th>B</th><th>B/A</th><th>95 %</th><th>Вердикт</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

export const renderDashboard = (
  report: PerfReport,
  history: HistoryEntry[],
  compare?: CompareReport,
) => {
  const records = [...report.records].sort((a, b) =>
    a.id.localeCompare(b.id, 'en', { numeric: true }),
  )
  const metrics = records.flatMap(r => r.metrics)
  const inTarget = metrics.filter(m => metricStatus(m).target === 'in').length
  const failed = metrics.filter(m => metricStatus(m).gate === 'fail').length
  const section = (title: string, op: ReportRecord['operation']) => {
    const rows = records.filter(r => r.operation === op)
    return rows.length
      ? `<section><h2>${title}</h2><div class="grid">${rows.map(r => card(r, history)).join('')}</div></section>`
      : ''
  }
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tessera — производительность</title>
<style>
  :root { --bg: #f6f7f9; --card: #fff; --fg: #1a1d21; --muted: #6b7280; --line: #e5e7eb;
    --in: #16a34a; --in-bg: #dcfce7; --out: #d97706; --out-bg: #fef3c7;
    --fail: #dc2626; --fail-bg: #fee2e2; --ok: #2563eb; --ok-bg: #dbeafe; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f1115; --card: #171a1f; --fg: #e6e8eb;
    --muted: #9aa1ab; --line: #262b33; --in: #4ade80; --in-bg: #10281a; --out: #fbbf24;
    --out-bg: #2a2110; --fail: #f87171; --fail-bg: #2a1416; --ok: #60a5fa; --ok-bg: #132036; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  .sub, .muted { color: var(--muted); }
  .sub { font-size: 13px; max-width: 80ch; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); border-bottom: 1px solid var(--line); padding-bottom: 8px; margin: 32px 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 16px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
  .card--fail { border-left: 4px solid var(--fail); }
  .card__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 8px; margin-bottom: 8px; }
  .card__id { font-weight: 800; } .card__label { font-weight: 600; }
  .card__meta { color: var(--muted); font-size: 12px; margin-left: auto; }
  .tag { font-size: 11px; color: var(--out); background: var(--out-bg); padding: 1px 7px; border-radius: 999px; }
  .metric { margin-top: 12px; }
  .metric__head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 13px; }
  .metric__name { font-weight: 600; min-width: 120px; }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .badge--in { color: var(--in); background: var(--in-bg); } .badge--out { color: var(--out); background: var(--out-bg); }
  .badge--ok { color: var(--ok); background: var(--ok-bg); } .badge--fail { color: var(--fail); background: var(--fail-bg); }
  .spark { display: block; margin-top: 4px; } .spark polyline { fill: none; stroke: var(--muted); stroke-width: 1.5; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--muted); font-size: 12px; margin-top: 4px; }
  .stats b { color: var(--fg); font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; display: block; overflow-x: auto; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  footer { color: var(--muted); font-size: 12px; margin-top: 40px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Tessera — производительность</h1>
    <p class="sub">Прогон ${esc(new Date(report.generatedAt).toLocaleString('ru-RU'))}, CPU ×${records[0]?.cpuThrottle ?? 1}.
      ${inTarget}/${metrics.length} метрик в цели RAIL${failed ? ` · ${failed} хуже базы` : ''}.
      Цель RAIL — ориентир, не гейт: прокрутка — p95 ≤ 16,7 мс на кадр, отрисовка — ≤ 1000 мс,
      взаимодействие — ≤ 100 мс. Гейт — только «не хуже базы» у кейсов фич (ADR 0099);
      регрессию между ревизиями показывает <code>npm run perf:compare</code>. Линия — тренд за
      последние ${HISTORY_LIMIT} прогонов этой машины.</p>
    ${compareSection(compare)}
    ${section('Первая отрисовка', 'render')}
    ${section('Прокрутка', 'scroll')}
    ${section('Взаимодействие', 'interaction')}
    <footer>scripts/perf-report.mjs · performance-results/latest.json, history.json, compare.json</footer>
  </div>
</body>
</html>
`
}
