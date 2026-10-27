// `npm run check:static`: шаги 1–4 барьера (AGENTS.md §4) — формат, линт, типы и сверка
// требований — одновременно. Шаги независимы, время прогона — время самого долгого.
// Вывод шага печатается целиком по его окончании, код выхода — 1, если упал хоть один.

import { spawn } from 'node:child_process'

const STEPS = ['format:check', 'lint', 'typecheck', 'check:requirements']

const run = name =>
  new Promise(resolve => {
    const started = performance.now()
    const child = spawn('npm', ['run', '-s', name], { shell: true })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('close', status => {
      const seconds = ((performance.now() - started) / 1000).toFixed(1)
      const verdict = status === 0 ? 'ok' : `упал (код ${status})`
      console.log(`\n── ${name}: ${verdict}, ${seconds} с`)
      if (output.trim()) console.log(output.trimEnd())
      resolve(status)
    })
  })

const statuses = await Promise.all(STEPS.map(run))
process.exit(statuses.every(status => status === 0) ? 0 : 1)
