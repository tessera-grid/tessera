import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { missingMetadata } from '../../../scripts/packageChecks'
import { releaseNotes } from '../../../scripts/releaseTools'

// Workflow CI (ADR 0103): триггеры, шаги и условия читаются из YAML как текст — работу
// проверяет первый прогон на GitHub.

const ROOT = resolve(__dirname, '../../..')
const workflow = (file: string) =>
  readFileSync(join(ROOT, '.github/workflows', file), 'utf8')

/** Блок задачи: от `  id:` до следующей задачи. */
const jobOf = (text: string, id: string) => {
  const lines = text.split('\n')
  const start = lines.indexOf(`  ${id}:`)
  expect(start, `задача ${id}`).toBeGreaterThan(-1)
  const end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line))
  return lines.slice(start, end === -1 ? undefined : end).join('\n')
}

/** Блок верхнего уровня (`on:`, `jobs:`…). */
const topOf = (text: string, key: string) => {
  const lines = text.split('\n')
  const start = lines.indexOf(`${key}:`)
  expect(start, key).toBeGreaterThan(-1)
  const end = lines.findIndex((line, i) => i > start && /^\S/.test(line))
  return lines.slice(start, end === -1 ? undefined : end).join('\n')
}

const runsOf = (block: string) =>
  [...block.matchAll(/^\s+(?:- )?run: (.+)$/gm)].map(match => match[1].trim())

/** Задачи workflow — ключи блока `jobs:`. */
const jobIds = (text: string) =>
  [...topOf(text, 'jobs').matchAll(/^ {2}([\w-]+):$/gm)].map(match => match[1])

const usesOf = (block: string) =>
  [...block.matchAll(/^\s+(?:- )?uses: (.+)$/gm)].map(match => match[1].trim())

const ALL = ['ci.yml', 'perf.yml', 'prerelease.yml', 'release.yml']

describe('CI', () => {
  it('CI1: на пуш в master и на pull_request гоняется весь барьер; падение любого шага — красный статус', () => {
    const ci = workflow('ci.yml')
    const on = topOf(ci, 'on')
    expect(on).toMatch(/push:\n\s+branches: \[master\]/)
    expect(on).toMatch(/^ {2}pull_request:/m)
    const runs = runsOf(ci)
    for (const step of [
      'npm run format:check',
      'npm run lint',
      'npm run typecheck',
      'npm run check:requirements',
      'npm run build',
      'npm run check:tree-shaking',
      'npm run check:theme',
      'npm run check:browsers',
      'npm run test:browsers',
    ]) {
      expect(runs, step).toContain(step)
    }
    expect(runs.some(run => run.startsWith('npm test'))).toBe(true)
    expect(ci).not.toMatch(/continue-on-error/)
  })

  it('CI2: npm test идёт шардами, вместе покрывающими весь набор; скриншоты и логи упавшего шарда — архивом', () => {
    const test = jobOf(workflow('ci.yml'), 'test')
    const shards = /shard: \[([^\]]+)\]/.exec(test)![1].split(',').map(Number)
    const count = shards.length
    expect(shards).toEqual(Array.from({ length: count }, (_, i) => i + 1))
    expect(runsOf(test)).toContain(
      `npm test -- --shard=\${{ matrix.shard }}/${count}`,
    )
    expect(test).toMatch(/fail-fast: false/)
    expect(test).toMatch(
      /- if: failure\(\)\n\s+uses: actions\/upload-artifact@v\d+[\s\S]*__screenshots__/,
    )
  })

  it('CI3: новый пуш в ту же ветку отменяет идущий прогон', () => {
    for (const file of ['ci.yml', 'perf.yml']) {
      const concurrency = topOf(workflow(file), 'concurrency')
      expect(concurrency, file).toMatch(/group: .*\$\{\{ github\.ref \}\}/)
      expect(concurrency, file).toMatch(/cancel-in-progress: true/)
    }
  })

  it('CI4: окружение — Node из .nvmrc, npm ci по lockfile, браузеры Playwright из кэша', () => {
    expect(readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim()).toMatch(/^\d+$/)
    for (const file of ALL) {
      const text = workflow(file)
      const setups = text.match(/uses: actions\/setup-node@v\d+/g) ?? []
      const fromFile = text.match(/node-version-file: \.nvmrc/g) ?? []
      expect(fromFile.length, file).toBe(setups.length)
      expect(text, file).not.toMatch(/npm install\b/)
      for (const id of jobIds(text)) {
        const job = jobOf(text, id)
        const runs = runsOf(job)
        if (runs.some(run => /^npm (run|test)/.test(run))) {
          expect(runs, `${file} ${id}`).toContain('npm ci')
        }
        if (runs.some(run => run.includes('playwright install'))) {
          expect(job, `${file} ${id}`).toMatch(
            /uses: actions\/cache@v\d+\n\s+with:\n\s+path: ~\/\.cache\/ms-playwright\n\s+key: .*hashFiles\('package-lock\.json'\)/,
          )
          expect(job.indexOf('ms-playwright')).toBeLessThan(
            job.indexOf('playwright install'),
          )
        }
      }
    }
  })

  it('CI5: perf:compare — ручной запуск с ревизией и кейсами, отчёт и дашборд архивом; на PR и по ночам — только в публичном репозитории', () => {
    const perf = workflow('perf.yml')
    const on = topOf(perf, 'on')
    expect(on).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+ref:[\s\S]*cases:/)
    expect(on).toMatch(/^ {2}pull_request:/m)
    expect(on).toMatch(/^ {2}schedule:/m)
    const compare = jobOf(perf, 'compare')
    expect(compare.replace(/\s+/g, ' ')).toContain(
      "if: >- github.event_name == 'workflow_dispatch' || github.event.repository.private == false",
    )
    // Шаг сравнения — многострочный `run: |`.
    expect(compare).toMatch(/npm run perf:compare -- "\$REF" --cases "\$CASES"/)
    expect(compare).toMatch(/npm run perf:compare -- "\$REF"\n/)
    expect(compare).toMatch(
      /- if: always\(\)\n\s+uses: actions\/upload-artifact@v\d+[\s\S]*path: performance-results\//,
    )
  })

  it('CI6: шаги перед публикацией идут раз в неделю при новых коммитах, гейтом выпуска и по кнопке', () => {
    const prerelease = workflow('prerelease.yml')
    const on = topOf(prerelease, 'on')
    expect(on).toMatch(/schedule:\n\s+- cron: '\d+ \d+ \* \* \d'/)
    expect(on).toMatch(/^ {2}workflow_dispatch:/m)
    expect(on).toMatch(/^ {2}workflow_call:/m)
    expect(jobOf(prerelease, 'changes')).toContain("--since='7 days ago'")
    const checks = jobOf(prerelease, 'checks')
    expect(checks).toContain(
      "if: github.event_name != 'schedule' || needs.changes.outputs.recent == 'true'",
    )
    const runs = runsOf(checks)
    for (const step of [
      'npm run test:engines',
      'npm run test:react18',
      'npm run check:package',
    ]) {
      expect(runs, step).toContain(step)
    }
    expect(usesOf(jobOf(workflow('release.yml'), 'prerelease'))).toContain(
      './.github/workflows/prerelease.yml',
    )
  })

  it('CI11: пуш тега v* запускает выпуск — барьер и шаги перед публикацией гейтом, затем черновик GitHub Release с текстом раздела; публикации в npm нет', () => {
    const release = workflow('release.yml')
    expect(topOf(release, 'on')).toMatch(/push:\n\s+tags: \['v\*'\]/)
    expect(usesOf(jobOf(release, 'barrier'))).toContain(
      './.github/workflows/ci.yml',
    )
    expect(topOf(workflow('ci.yml'), 'on')).toMatch(/^ {2}workflow_call:/m)
    const draft = jobOf(release, 'github-release')
    expect(draft).toContain('needs: [barrier, prerelease]')
    const runs = runsOf(draft)
    expect(runs).toContain(
      'node scripts/release.mjs --notes "$TAG" > release-notes.md',
    )
    expect(runs).toContain(
      'gh release create "$TAG" --draft --title "$TAG" --notes-file release-notes.md',
    )
    for (const file of ALL)
      expect(workflow(file), file).not.toMatch(/npm publish/)

    const changelog =
      '# Changelog\n\n## [0.2.0] - 2026-11-01\n\n### Features\n\n- New grid.\n\n## [0.1.0] - 2026-10-13\n\n- Initial release.\n'
    expect(releaseNotes(changelog, 'v0.2.0')).toBe(
      '### Features\n\n- New grid.',
    )
    expect(releaseNotes(changelog, 'v0.1.0')).toBe('- Initial release.')
    expect(() => releaseNotes(changelog, 'v0.3.0')).toThrow(
      /нет раздела v0\.3\.0/,
    )
  })

  it('CI12: LICENSE — MIT; в package.json есть license, repository, homepage, bugs, engines; check:package их проверяет', () => {
    expect(readFileSync(join(ROOT, 'LICENSE'), 'utf8')).toMatch(/^MIT License/)
    expect(missingMetadata(ROOT)).toEqual([])
    const empty = mkdtempSync(join(tmpdir(), 'tessera-metadata-'))
    try {
      writeFileSync(join(empty, 'package.json'), '{"license":"ISC"}')
      expect(missingMetadata(empty)).toEqual([
        'license: MIT',
        'файл LICENSE',
        'repository.url',
        'homepage',
        'bugs.url',
        'engines.node',
      ])
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
    expect(
      readFileSync(join(ROOT, 'scripts/check-package.mjs'), 'utf8'),
    ).toMatch(/missingMetadata\(root\)/)
  })

  it('PF20: CI на каждый пуш гоняет весь барьер, включая счётчики работы, без замеров времени', () => {
    const ci = workflow('ci.yml')
    const runs = runsOf(ci)
    // Счётчики работы — проект browser в `npm test` (visual/work-counters).
    expect(runs.some(run => /^npm test(\s|$)/.test(run))).toBe(true)
    const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
    expect(config).toMatch(
      /include: \['src\/\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}'\]/,
    )
    expect(config).not.toMatch(/work-counters/)
    // Замеры времени — только `perf:compare` в perf.yml.
    expect(ci).not.toMatch(/npm run perf\b/)
    expect(ci).not.toMatch(/perf:compare|vitest\.perf/)
  })

  it('VR15: CI на пуш в master и на PR отдаёт Storybook в Chromatic с TurboSnap; без токена шаг падает с понятной ошибкой', () => {
    const chromatic = jobOf(workflow('ci.yml'), 'chromatic')
    expect(chromatic.replace(/\s+/g, ' ')).toContain(
      "(github.event_name == 'push' && github.ref == 'refs/heads/master') || github.event_name == 'pull_request'",
    )
    expect(chromatic).toMatch(/fetch-depth: 0/)
    expect(chromatic).toMatch(
      /if \[ -z "\$CHROMATIC_PROJECT_TOKEN" \]; then\n\s+echo "::error::Нет секрета CHROMATIC_PROJECT_TOKEN[^"]*"\n\s+exit 1/,
    )
    expect(runsOf(chromatic)).toContain(
      'npx chromatic --only-changed --exit-zero-on-changes --build-script-name build-storybook',
    )
  })
})
