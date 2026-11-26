// `npm run test:engines`: движки идут по очереди (ADR 0084, §5). В полном прогоне
// матрица контраста WebKit запускается последней в своём процессе: длительный
// обход не удерживает браузер для остальных наборов. В целевых запусках
// аргументы передаются каждому проекту по прежней схеме.

import { spawnSync } from 'node:child_process'

const VITEST = 'node_modules/vitest/vitest.mjs'
const CONFIG = 'vitest.engines.config.ts'
const args = process.argv.slice(2)
const fullRun = args.length === 0
const runs = [
  { project: 'engines (firefox)' },
  { project: 'engines (webkit)', contrast: fullRun ? 'skip' : '' },
  { project: 'mobile*' },
]
if (fullRun) runs.push({ project: 'engines (webkit)', contrast: 'only' })

let failed = false
for (const { project, contrast } of runs) {
  const { status } = spawnSync(
    process.execPath,
    [VITEST, 'run', '--config', CONFIG, '--project', project, ...args],
    {
      stdio: 'inherit',
      env: { ...process.env, TESSERA_ENGINE_CONTRAST: contrast ?? '' },
    },
  )
  if (status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
