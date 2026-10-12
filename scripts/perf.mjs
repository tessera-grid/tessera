// `npm run perf` (ADR 0099): перф-матрица и дашборд. Дашборд строится и при красном
// прогоне — значения пишутся до проверок; код выхода — от vitest.

import { spawnSync } from 'node:child_process'

const node = args =>
  spawnSync(process.execPath, args, { stdio: 'inherit' }).status ?? 1

const status = node([
  'node_modules/vitest/vitest.mjs',
  'run',
  '--config',
  'vitest.perf.config.ts',
  ...process.argv.slice(2),
])
node(['scripts/perf-report.mjs'])
process.exit(status)
