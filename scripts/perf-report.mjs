// Локальный перф-дашборд (ADR 0099, PF19): performance-results/latest.json → index.html,
// прогон дописывается в history.json (тренд), сравнение — из compare.json, если есть.
// Запуск: `npm run perf:report` (или `npm run perf`, который сперва прогоняет матрицу).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { appendHistory, renderDashboard } from './perfTools.ts'

const dir = resolve(process.cwd(), 'performance-results')
const read = name => JSON.parse(readFileSync(resolve(dir, name), 'utf8'))

if (!existsSync(resolve(dir, 'latest.json'))) {
  console.error(
    'Нет performance-results/latest.json. Сначала прогоните перф-тесты: npm run perf',
  )
  process.exit(1)
}

const report = read('latest.json')
const history = appendHistory(
  existsSync(resolve(dir, 'history.json')) ? read('history.json') : [],
  report,
)
writeFileSync(
  resolve(dir, 'history.json'),
  `${JSON.stringify(history, null, 2)}\n`,
)
const compare = existsSync(resolve(dir, 'compare.json'))
  ? read('compare.json')
  : undefined
const htmlPath = resolve(dir, 'index.html')
writeFileSync(htmlPath, renderDashboard(report, history, compare))
console.log(`Дашборд: ${htmlPath} (история: ${history.length} прогонов)`)
