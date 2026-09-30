// Сверка «требование ↔ тест» (ADR 0043, TQ10): у каждого требования принятого ADR
// ровно один тест с его ID, у каждого ID в имени теста есть требование. Расхождения
// на момент принятия — в requirements-baseline.json; список только сокращается.
// Запуск: `npm run check:requirements`.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  compareWithBaseline,
  findProblems,
  parseRequirements,
  parseTestNames,
} from './requirements.ts'

const root = process.cwd()
const tracked = (...patterns) =>
  execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', ...patterns],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter(Boolean)
const read = file => readFileSync(resolve(root, file), 'utf8')

const requirements = tracked('docs/decisions/0*.md').flatMap(file =>
  parseRequirements(read(file), file),
)
const tests = tracked('src/*.test.ts', 'src/*.test.tsx').flatMap(file =>
  parseTestNames(read(file), file),
)
const baseline = JSON.parse(read('scripts/requirements-baseline.json'))
const problems = findProblems(requirements, tests)
const { fresh, stale } = compareWithBaseline(problems, baseline)

const LABEL = {
  missing: 'нет теста',
  duplicate: 'больше одного теста',
  unknown: 'тест ссылается на несуществующий ID',
  collision: 'ID определён в нескольких ADR',
  reference: 'ссылка → на требование без теста или несуществующее',
}

if (process.argv.includes('--list')) {
  for (const p of problems) console.log(`${p.kind}\t${p.id}\t${p.detail}`)
  process.exit(0)
}

for (const p of fresh) {
  console.error(`[check-requirements] ${p.id}: ${LABEL[p.kind]} — ${p.detail}`)
}
for (const entry of stale) {
  console.error(
    `[check-requirements] ${entry.id}: запись базы «${LABEL[entry.kind]}» больше не расходится — удалите её из scripts/requirements-baseline.json`,
  )
}
if (fresh.length || stale.length) process.exit(1)

console.log(
  `[check-requirements] OK — требований ${new Set(requirements.map(r => r.id)).size}, ID в тестах ${new Set(tests.map(t => t.id)).size}, известных расхождений ${baseline.length}`,
)
