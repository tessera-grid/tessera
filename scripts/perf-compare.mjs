// `npm run perf:compare <ref> [--cases P2,P4] [--install] [--inject-b 30]` (ADR 0099,
// PF12–PF18): перф-кейсы рабочей копии (B) против ревизии `ref` (A) вперемешку.
// Ненулевой код выхода — только на регрессии.

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  compareReport,
  exitCodeOf,
  formatCompareTable,
  prepareWorktree,
  removeWorktree,
  runRounds,
  samplesOf,
} from './perfTools.ts'
import { PR_CASES } from '../src/lib/stories/__tests__/perf.constants.ts'

const args = process.argv.slice(2)
const option = name => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const ref = args.find(
  (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'),
)
if (!ref) {
  console.error(
    'Использование: npm run perf:compare -- <ref> [--cases P2,P4] [--install] [--inject-b 30] [--min 5] [--max 15]',
  )
  process.exit(2)
}
const cases = option('--cases')?.split(',') ?? PR_CASES
const injectB = option('--inject-b')
const min = Number(option('--min') ?? 5)
const max = Number(option('--max') ?? 15)

const repo = process.cwd()
const out = resolve(repo, 'performance-results')
const runsDir = resolve(out, 'compare-runs')
rmSync(runsDir, { recursive: true, force: true })
mkdirSync(runsDir, { recursive: true })

const escape = id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tree = prepareWorktree(repo, ref, { install: args.includes('--install') })
// Vite отдаёт файлы только из корня дерева: node_modules по ссылке лежит у проекта, и
// без разрешения сторона A грузила бы шрифты и стили иначе, чем B.
const COMPARE_CONFIG = 'vitest.perf-compare.config.mts'
writeFileSync(
  resolve(tree.dir, COMPARE_CONFIG),
  [
    "import { mergeConfig, searchForWorkspaceRoot } from 'vite'",
    "import base from './vitest.perf.config.ts'",
    'export default mergeConfig(base, {',
    `  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ${JSON.stringify(resolve(repo, 'node_modules'))}] } },`,
    '})',
    '',
  ].join('\n'),
)
let code
try {
  const run = await runRounds({
    cases,
    min,
    max,
    runSide: async (side, pending, round) => {
      const cwd = side === 'A' ? tree.dir : repo
      const results = resolve(runsDir, `${side}-${round}.json`)
      // Ревизия до ADR 0099 пишет только в свой latest.json.
      const fallback = resolve(cwd, 'performance-results/latest.json')
      if (side === 'A') rmSync(fallback, { force: true })
      const pattern = `\\b(${pending.map(escape).join('|')}):`
      console.log(`раунд ${round}, сторона ${side}: ${pending.join(', ')}`)
      spawnSync(
        process.execPath,
        [
          'node_modules/vitest/vitest.mjs',
          'run',
          '--config',
          side === 'A' ? COMPARE_CONFIG : 'vitest.perf.config.ts',
          '--project',
          'perf',
          '-t',
          pattern,
        ],
        {
          cwd,
          stdio: 'inherit',
          env: {
            ...process.env,
            TESSERA_PERF_RESULTS: results,
            TESSERA_PERF_INJECT_PCT: side === 'B' && injectB ? injectB : '0',
          },
        },
      )
      const report = [results, fallback]
        .map(path => {
          try {
            return JSON.parse(readFileSync(path, 'utf8'))
          } catch {
            return undefined
          }
        })
        .find(Boolean)
      if (!report) {
        throw new Error(
          `perf:compare: прогон ${side}-${round} не записал ни одного замера — см. вывод vitest`,
        )
      }
      return samplesOf(report.records, pending)
    },
  })
  const report = compareReport(run, { ref, sha: tree.sha })
  writeFileSync(
    resolve(out, 'compare.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(`\n${formatCompareTable(report)}`)
  code = exitCodeOf(report.results.map(r => r.verdict))
} finally {
  removeWorktree(repo, tree)
}
process.exit(code)
