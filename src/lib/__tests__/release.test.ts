import { describe, expect, it } from 'vitest'

import {
  CHANGELOG_HEADER,
  type ParsedCommit,
  type ReleaseDeps,
  type RepoState,
  parseCommit,
  refusalsOf,
  renderSection,
  runRelease,
  sectionOf,
  suggestLevel,
  withSection,
} from '../../../scripts/releaseTools'

// Команда выпуска (ADR 0103, CI7–CI10) на подставных git, gh и файлах: без сети и без
// настоящих коммитов.

const commit = (subject: string, body = '', hash = 'a'.repeat(40)) => ({
  hash,
  subject,
  body,
})
const parsed = (subject: string, body = '') =>
  parseCommit(commit(subject, body)) as ParsedCommit

const log = (...commits: ReturnType<typeof commit>[]) =>
  commits.map(c => `${c.hash}\x1f${c.subject}\x1f${c.body}\x1e`).join('\n')

const GREEN: RepoState = {
  changed: [],
  branch: 'master',
  behind: 0,
  ahead: 0,
  ci: { status: 'completed', conclusion: 'success' },
}

interface Setup {
  state?: Partial<RepoState>
  tag?: string
  commits?: ReturnType<typeof commit>[]
  version?: string
  changelog?: string
  answer?: string
}

/** Подставное окружение: записывает команды, записи файлов, вопросы и правки. */
const environment = ({
  state = {},
  tag = 'v0.1.0',
  commits = [commit('feat(grid): new thing', '', '1'.repeat(40))],
  version = '0.1.0',
  changelog = CHANGELOG_HEADER,
  answer = 'y',
}: Setup = {}) => {
  const repo = { ...GREEN, ...state }
  const files: Record<string, string | undefined> = {
    'package.json': JSON.stringify({ version }),
    'CHANGELOG.md': changelog,
  }
  const calls: string[] = []
  const output: string[] = []
  const edits: string[] = []
  const prompts: string[] = []
  const deps: ReleaseDeps = {
    run: (command, args) => {
      const line = [command, ...args].join(' ')
      calls.push(line)
      if (line === 'git status --porcelain')
        return repo.changed.map(path => ` M ${path}`).join('\n')
      if (line === 'git rev-parse --abbrev-ref HEAD') return repo.branch
      if (line.startsWith('git rev-list --left-right'))
        return `${repo.behind}\t${repo.ahead}`
      if (line === 'git rev-parse HEAD') return 'f'.repeat(40)
      if (command === 'gh') return JSON.stringify(repo.ci ? [repo.ci] : [])
      if (line.startsWith('git describe')) {
        if (!tag) throw new Error('no tags')
        return tag
      }
      if (line.startsWith('git log')) return log(...commits)
      return ''
    },
    read: path => files[path],
    write: (path, text) => {
      files[path] = text
    },
    edit: path => edits.push(path),
    prompt: async question => {
      prompts.push(question)
      return answer
    },
    log: message => output.push(message),
    today: () => '2026-10-13',
  }
  const released = () =>
    calls.filter(call => /^(npm version|git (add|commit|tag|push))/.test(call))
  return { deps, files, calls, output, edits, prompts, released }
}

describe('Выпуск версии', () => {
  it('CI7: release отказывает, если рабочая копия грязная (кроме CHANGELOG.md), ветка не master, есть расхождение с origin или CI на HEAD не зелёный', async () => {
    const refusals: [Partial<RepoState>, RegExp][] = [
      [{ changed: ['src/a.ts'] }, /грязная: src\/a\.ts/],
      [{ branch: 'feature' }, /ветка feature/],
      [{ behind: 2 }, /2 коммит\(ов\), которых нет локально/],
      [{ ahead: 1 }, /не запушены/],
      [{ ci: undefined }, /не запускался/],
      [{ ci: { status: 'in_progress', conclusion: '' } }, /ещё идёт/],
      [{ ci: { status: 'completed', conclusion: 'failure' } }, /failure/],
    ]
    for (const [state, reason] of refusals) {
      expect(refusalsOf({ ...GREEN, ...state }).join('\n')).toMatch(reason)
      const env = environment({ state })
      expect(
        (await env.deps) && (await runRelease({ yes: true }, env.deps)),
      ).toBe(1)
      expect(env.released(), JSON.stringify(state)).toEqual([])
      expect(env.files['package.json']).toBe(
        JSON.stringify({ version: '0.1.0' }),
      )
    }
    // Подготовленный раздел CHANGELOG — не грязь.
    expect(refusalsOf({ ...GREEN, changed: ['CHANGELOG.md'] })).toEqual([])
    expect(refusalsOf(GREEN)).toEqual([])
  })

  it('CI8: без уровня release предлагает его по коммитам и называет их: до 1.0 ломающее — minor, остальное — patch; с 1.0 ломающее — major, feat — minor, остальное — patch; аргумент главнее', async () => {
    const breaking = parsed('feat(highlight)!: no shimmer')
    const breakingBody = parsed(
      'fix: rename prop',
      'BREAKING CHANGE: prop renamed',
    )
    const feature = parsed('feat: new plugin')
    const fix = parsed('fix: crash')
    const chore = parsed('chore: deps')
    expect(breakingBody.breaking).toBe(true)

    expect(suggestLevel([breaking, feature, fix], '0.3.1')).toEqual({
      level: 'minor',
      because: [breaking],
    })
    expect(suggestLevel([feature, fix, chore], '0.3.1')).toEqual({
      level: 'patch',
      because: [feature, fix],
    })
    expect(suggestLevel([breakingBody, feature], '1.2.0')).toEqual({
      level: 'major',
      because: [breakingBody],
    })
    expect(suggestLevel([feature, fix], '1.2.0')).toEqual({
      level: 'minor',
      because: [feature],
    })
    expect(suggestLevel([fix, chore], '1.2.0')).toEqual({
      level: 'patch',
      because: [fix],
    })

    const env = environment({
      commits: [
        commit('feat(highlight)!: no shimmer', '', 'b'.repeat(40)),
        commit('fix: crash', '', 'c'.repeat(40)),
      ],
    })
    await runRelease({ yes: true }, env.deps)
    expect(env.output.join('\n')).toMatch(
      /Предлагаю: minor \(0\.1\.0 → 0\.2\.0\)/,
    )
    expect(env.output.join('\n')).toContain('bbbbbbb feat!: no shimmer')
    expect(env.output.join('\n')).not.toContain('ccccccc')
    expect(env.calls).toContain('npm version 0.2.0 --no-git-tag-version')

    const override = environment({
      commits: [commit('feat(highlight)!: no shimmer')],
    })
    await runRelease({ level: 'patch', yes: true }, override.deps)
    expect(override.calls).toContain('npm version 0.1.1 --no-git-tag-version')
    expect(override.output.join('\n')).not.toMatch(/Предлагаю/)

    const first = environment({ tag: '', version: '0.0.1' })
    await runRelease({ draft: true }, first.deps)
    expect(first.output.join('\n')).toMatch(
      /minor \(0\.0\.1 → 0\.1\.0\) — первый выпуск/,
    )
  })

  it('CI9: черновик раздела собирается по группам Breaking changes, Features, Fixes, Performance без служебных коммитов; release:draft вписывает его без коммита; готовый раздел берётся как есть', async () => {
    const commits = [
      'feat(grid)!: drop legacy prop',
      'feat(tree): curved lines',
      'fix: tooltip pass-through',
      'perf(grid): stable column window',
      'chore: deps',
      'test: counters',
      'docs: adr',
      'refactor: split module',
      'style: format',
      'build: vite',
      'ci: workflow',
      'Merge branch x',
    ]
      .map(subject => parseCommit(commit(subject)))
      .filter((c): c is ParsedCommit => !!c)
    const section = renderSection('0.2.0', '2026-11-01', commits)
    expect(section).toBe(
      [
        '## [0.2.0] - 2026-11-01',
        '',
        '### Breaking changes',
        '',
        '- **grid:** drop legacy prop (aaaaaaa)',
        '',
        '### Features',
        '',
        '- **tree:** curved lines (aaaaaaa)',
        '',
        '### Fixes',
        '',
        '- tooltip pass-through (aaaaaaa)',
        '',
        '### Performance',
        '',
        '- **grid:** stable column window (aaaaaaa)',
        '',
      ].join('\n'),
    )
    expect(
      renderSection('0.2.1', '2026-11-02', [parsed('chore: x')]),
    ).toContain('- Maintenance release.')

    // Новый раздел — над прошлыми версиями, шапка сохраняется.
    const previous = withSection(
      undefined,
      renderSection('0.1.0', '2026-10-13', 'initial'),
    )
    const next = withSection(previous, section)
    expect(next.startsWith(CHANGELOG_HEADER.trimEnd())).toBe(true)
    expect(next.indexOf('## [0.2.0]')).toBeLessThan(next.indexOf('## [0.1.0]'))
    expect(sectionOf(next, '0.1.0')).toBe('- Initial release.')

    // release:draft — запись без коммита.
    const draft = environment()
    expect(await runRelease({ draft: true }, draft.deps)).toBe(0)
    expect(sectionOf(draft.files['CHANGELOG.md'], '0.1.1')).toContain(
      '### Features',
    )
    expect(draft.released()).toEqual([])
    expect(draft.calls).not.toContain('git status --porcelain')

    // Готовый (переведённый, исправленный) раздел не перезаписывается.
    const prepared = withSection(
      CHANGELOG_HEADER,
      '## [0.1.1] - 2026-10-13\n\n- Hand-written note.\n',
    )
    for (const args of [{ draft: true }, { yes: true }]) {
      const env = environment({ changelog: prepared })
      await runRelease(args, env.deps)
      expect(env.files['CHANGELOG.md']).toBe(prepared)
      expect(env.edits).toEqual([])
    }
  })

  it('CI10: после подтверждения (вопрос или --yes) release поднимает версию, вписывает раздел, делает коммит chore(release) и тег vX.Y.Z и пушит их', async () => {
    const steps = [
      'npm version 0.1.1 --no-git-tag-version',
      'git add package.json package-lock.json CHANGELOG.md',
      'git commit -m chore(release): v0.1.1',
      'git tag -a v0.1.1 -m v0.1.1',
      'git push --atomic origin master v0.1.1',
    ]

    const agent = environment()
    expect(await runRelease({ yes: true }, agent.deps)).toBe(0)
    expect(agent.released()).toEqual(steps)
    expect(agent.prompts).toEqual([])
    expect(agent.edits).toEqual([])
    expect(sectionOf(agent.files['CHANGELOG.md'], '0.1.1')).toContain(
      'new thing',
    )

    // Руками: черновик открывается в редакторе, затем вопрос.
    const human = environment({ answer: 'y' })
    expect(await runRelease({}, human.deps)).toBe(0)
    expect(human.edits).toEqual(['CHANGELOG.md'])
    expect(human.prompts).toEqual(['Выпустить v0.1.1? [y/N] '])
    expect(human.released()).toEqual(steps)

    const declined = environment({ answer: '' })
    expect(await runRelease({}, declined.deps)).toBe(1)
    expect(declined.released()).toEqual([])
    expect(sectionOf(declined.files['CHANGELOG.md'], '0.1.1')).toBeDefined()
  })
})
