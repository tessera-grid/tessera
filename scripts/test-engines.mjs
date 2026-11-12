// `npm run test:engines`: проекты движков по очереди — Firefox, WebKit, затем мобильная
// эмуляция (ADR 0084, §5). Вместе Firefox и WebKit на длинных наборах (матрица контраста
// гайдов) исчерпывают память, и WebKit обрывает соединение посреди прогона: остальные
// файлы не запускаются. Аргументы уходят каждому прогону vitest; итог — ненулевой, если
// упал хоть один.

import { spawnSync } from 'node:child_process'

const VITEST = 'node_modules/vitest/vitest.mjs'
const CONFIG = 'vitest.engines.config.ts'
const RUNS = [['engines (firefox)'], ['engines (webkit)'], ['mobile*']]

const args = process.argv.slice(2)
let failed = false
for (const projects of RUNS) {
  const { status } = spawnSync(
    process.execPath,
    [
      VITEST,
      'run',
      '--config',
      CONFIG,
      ...projects.flatMap(project => ['--project', project]),
      ...args,
    ],
    { stdio: 'inherit' },
  )
  if (status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
