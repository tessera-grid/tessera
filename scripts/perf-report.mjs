// Генератор локального перф-дашборда. Читает performance-results/latest.json
// (пишется командой perfRecord во время `vitest run`) и рендерит самодостаточный
// performance-results/index.html. Запуск: `npm run perf:report` (или `npm run perf`,
// который сперва прогоняет перф-тесты).

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(process.cwd(), 'performance-results')
const jsonPath = resolve(dir, 'latest.json')
const htmlPath = resolve(dir, 'index.html')

let report
try {
  report = JSON.parse(readFileSync(jsonPath, 'utf8'))
} catch {
  console.error(
    'Нет performance-results/latest.json. Сначала прогоните перф-тесты: npm run perf',
  )
  process.exit(1)
}

const records = [...report.records].sort((a, b) => {
  const n = s => Number(String(s.id).replace(/\D/g, '')) || 0
  return n(a) - n(b)
})

const ms = v => `${v.toFixed(1)} мс`
const pct = (v, budget) => Math.max(2, Math.min(100, (v / budget) * 100))
const esc = s =>
  String(s).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

// Статус метрики: met (в бюджете) / xfail (недобор ожидаем) / regr (регрессия).
const statusOf = (metric, record) =>
  metric.pass ? 'met' : record.knownShortfall ? 'xfail' : 'regr'

const STATUS_LABEL = { met: 'В БЮДЖЕТЕ', xfail: 'XFAIL', regr: 'РЕГРЕССИЯ' }
const KIND_LABEL = { animation: 'RAIL Animation', load: 'RAIL Load' }

const allStatuses = records.flatMap(r => r.metrics.map(m => statusOf(m, r)))
const count = s => allStatuses.filter(x => x === s).length
const met = count('met')
const regr = count('regr')
const xfail = count('xfail')
const throttle = records[0]?.cpuThrottle ?? 1

const summaryCls = regr > 0 ? 'regr' : xfail > 0 ? 'xfail' : 'met'
const summaryText =
  `${met}/${allStatuses.length} в бюджете` +
  (xfail ? ` · ${xfail} xfail` : '') +
  (regr ? ` · ${regr} регрессий` : '')

const metricRow = (m, record) => {
  const st = statusOf(m, record)
  const name = m.axis
    ? `${m.axis.toUpperCase()} · ${KIND_LABEL[m.kind]}`
    : KIND_LABEL[m.kind]
  return `
    <div class="metric ${st}">
      <div class="metric__head">
        <span class="metric__name">${esc(name)}</span>
        <span class="metric__val">${ms(m.valueMs)} <span class="metric__budget">/ порог ${ms(m.budgetMs)}</span></span>
        <span class="badge badge--${st}">${STATUS_LABEL[st]}</span>
      </div>
      <div class="bar"><div class="bar__fill" style="width:${pct(m.valueMs, m.budgetMs)}%"></div></div>
      <div class="stats">
        <span>p95 <b>${ms(m.p95Ms)}</b></span>
        <span>p99 <b>${ms(m.p99Ms)}</b></span>
        <span>longest <b>${ms(m.longestMs)}</b></span>
        <span>long&nbsp;tasks <b>${m.longTasks}</b></span>
        <span>TBT <b>${ms(m.tbtMs)}</b></span>
      </div>
    </div>`
}

const worstOf = r =>
  r.metrics.some(m => statusOf(m, r) === 'regr')
    ? 'regr'
    : r.metrics.some(m => statusOf(m, r) === 'xfail')
      ? 'xfail'
      : 'met'

const card = r => `
    <article class="card card--${worstOf(r)}">
      <header class="card__head">
        <span class="card__id">${esc(r.id)}</span>
        <span class="card__label">${esc(r.label)}</span>
        ${r.knownShortfall ? '<span class="tag">известный недостиг</span>' : ''}
        <span class="card__meta">${esc(r.size)} · ${r.plugins === 'all' ? 'все плагины' : 'без плагинов'}</span>
      </header>
      ${r.metrics.map(m => metricRow(m, r)).join('')}
    </article>`

const section = (title, op) => {
  const rows = records.filter(r => r.operation === op)
  if (!rows.length) return ''
  return `<section><h2>${title}</h2><div class="grid">${rows.map(card).join('')}</div></section>`
}

const generatedAt = new Date(report.generatedAt).toLocaleString('ru-RU')

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tessera — производительность</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #fff; --fg: #1a1d21; --muted: #6b7280; --line: #e5e7eb;
    --met: #16a34a; --met-bg: #dcfce7; --xf: #d97706; --xf-bg: #fef3c7;
    --regr: #dc2626; --regr-bg: #fee2e2; --track: #eceef1;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --card: #171a1f; --fg: #e6e8eb; --muted: #9aa1ab; --line: #262b33;
      --met: #4ade80; --met-bg: #10281a; --xf: #fbbf24; --xf-bg: #2a2110;
      --regr: #f87171; --regr-bg: #2a1416; --track: #232830;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 15px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
  header.top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px 20px; margin-bottom: 8px; }
  h1 { font-size: 24px; margin: 0; }
  .summary { font-weight: 700; padding: 4px 12px; border-radius: 999px; }
  .summary.met { color: var(--met); background: var(--met-bg); }
  .summary.xfail { color: var(--xf); background: var(--xf-bg); }
  .summary.regr { color: var(--regr); background: var(--regr-bg); }
  .sub { color: var(--muted); font-size: 13px; margin: 0 0 28px; max-width: 80ch; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
    border-bottom: 1px solid var(--line); padding-bottom: 8px; margin: 32px 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .card { background: var(--card); border: 1px solid var(--line); border-left-width: 4px;
    border-radius: 12px; padding: 16px; }
  .card--met { border-left-color: var(--met); }
  .card--xfail { border-left-color: var(--xf); }
  .card--regr { border-left-color: var(--regr); }
  .card__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 8px; margin-bottom: 12px; }
  .card__id { font-weight: 800; font-variant-numeric: tabular-nums; }
  .card__label { font-weight: 600; }
  .tag { font-size: 11px; color: var(--xf); background: var(--xf-bg); padding: 1px 7px; border-radius: 999px; }
  .card__meta { color: var(--muted); font-size: 12px; margin-left: auto; }
  .metric { margin-top: 12px; }
  .metric__head { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 5px; }
  .metric__name { font-weight: 600; min-width: 120px; }
  .metric__val { font-variant-numeric: tabular-nums; }
  .metric__budget { color: var(--muted); }
  .badge { margin-left: auto; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .badge--met { color: var(--met); background: var(--met-bg); }
  .badge--xfail { color: var(--xf); background: var(--xf-bg); }
  .badge--regr { color: var(--regr); background: var(--regr-bg); }
  .bar { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .bar__fill { height: 100%; border-radius: 999px; }
  .met .bar__fill { background: var(--met); }
  .xfail .bar__fill { background: var(--xf); }
  .regr .bar__fill { background: var(--regr); }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--muted);
    font-size: 12px; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .stats b { color: var(--fg); font-weight: 600; }
  footer { color: var(--muted); font-size: 12px; margin-top: 40px; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <h1>Tessera — производительность</h1>
      <span class="summary ${summaryCls}">${esc(summaryText)}</span>
    </header>
    <p class="sub">Последний прогон: ${esc(generatedAt)}, CPU-троттлинг ×${throttle}
      (референс-девайс). Пороги — абсолютные из RAIL/CWV: прокрутка — Animation
      (p95 ≤ 16.7&nbsp;мс/кадр), отрисовка — Load (≤ 1000&nbsp;мс до интерактивности).
      <b>XFAIL</b> — известный недостиг относительно этих порогов (цель зафиксирована),
      <b>РЕГРЕССИЯ</b> — неожиданный выход за порог. Метрика — реальная работа
      главного потока (CDP-трейс); числа зависят от машины.</p>
    ${section('Первая отрисовка', 'render')}
    ${section('Прокрутка', 'scroll')}
    <footer>Сгенерировано scripts/perf-report.mjs из performance-results/latest.json</footer>
  </div>
</body>
</html>
`

writeFileSync(htmlPath, html)
console.log(
  `Дашборд: ${htmlPath} (${met}/${allStatuses.length} в бюджете, ${xfail} xfail, ${regr} регрессий)`,
)
