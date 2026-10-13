// Выпуск версии (ADR 0103, CI7–CI10): проверки перед выпуском, уровень SemVer по
// Conventional Commits, раздел CHANGELOG и шаги выпуска. Ввод-вывод — через `ReleaseDeps`,
// обёртка — `release.mjs`.

export type Level = 'patch' | 'minor' | 'major'

export interface Commit {
  hash: string
  subject: string
  body: string
}

export interface ParsedCommit {
  hash: string
  type: string
  scope?: string
  breaking: boolean
  description: string
}

/** Формат `git log`: поля через \x1f, коммиты через \x1e. */
export const LOG_FORMAT = '%H%x1f%s%x1f%b%x1e'

export const CHANGELOG_FILE = 'CHANGELOG.md'

export const CHANGELOG_HEADER = `# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`

export const parseLog = (log: string): Commit[] =>
  log
    .split('\x1e')
    .map(entry => entry.replace(/^\s+/, ''))
    .filter(Boolean)
    .map(entry => {
      const [hash = '', subject = '', body = ''] = entry.split('\x1f')
      return { hash, subject, body: body.trim() }
    })

const HEADER = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/

export const parseCommit = (commit: Commit): ParsedCommit | undefined => {
  const match = HEADER.exec(commit.subject)
  if (!match) return undefined
  const [, type, scope, bang, description] = match
  return {
    hash: commit.hash,
    type: type.toLowerCase(),
    scope,
    breaking: !!bang || /^BREAKING[ -]CHANGE:/m.test(commit.body),
    description,
  }
}

const isVisible = (commit: ParsedCommit) =>
  commit.breaking || ['feat', 'fix', 'perf'].includes(commit.type)

export interface Suggestion {
  level: Level
  /** Коммиты, которые определили уровень. */
  because: ParsedCommit[]
}

/**
 * Уровень по SemVer: до 1.0 ломающее — minor, остальное — patch (`^0.1.0` разрешает
 * только `0.1.x`); с 1.0 ломающее — major, `feat` — minor, остальное — patch.
 */
export const suggestLevel = (
  commits: ParsedCommit[],
  version: string,
): Suggestion => {
  const stable = Number(version.split('.')[0]) >= 1
  const breaking = commits.filter(commit => commit.breaking)
  if (breaking.length > 0) {
    return { level: stable ? 'major' : 'minor', because: breaking }
  }
  const features = commits.filter(commit => commit.type === 'feat')
  if (stable && features.length > 0) {
    return { level: 'minor', because: features }
  }
  return { level: 'patch', because: commits.filter(isVisible) }
}

export const bumpVersion = (version: string, level: Level): string => {
  const [major = 0, minor = 0, patch = 0] = version
    .split('-')[0]
    .split('.')
    .map(Number)
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const GROUPS: { title: string; pick: (commit: ParsedCommit) => boolean }[] = [
  { title: 'Breaking changes', pick: commit => commit.breaking },
  {
    title: 'Features',
    pick: commit => !commit.breaking && commit.type === 'feat',
  },
  { title: 'Fixes', pick: commit => !commit.breaking && commit.type === 'fix' },
  {
    title: 'Performance',
    pick: commit => !commit.breaking && commit.type === 'perf',
  },
]

const entryOf = (commit: ParsedCommit) =>
  `- ${commit.scope ? `**${commit.scope}:** ` : ''}${commit.description} (${commit.hash.slice(0, 7)})`

/**
 * Черновик раздела версии: группы по типам коммитов; `chore`, `test`, `docs`,
 * `refactor`, `style`, `build`, `ci` не попадают. Без прошлого тега — первый выпуск.
 */
export const renderSection = (
  version: string,
  date: string,
  commits: ParsedCommit[] | 'initial',
): string => {
  const lines = [`## [${version}] - ${date}`, '']
  if (commits === 'initial') {
    lines.push('- Initial release.', '')
    return lines.join('\n')
  }
  const groups = GROUPS.map(group => ({
    title: group.title,
    entries: commits.filter(group.pick).map(entryOf),
  })).filter(group => group.entries.length > 0)
  if (groups.length === 0) {
    lines.push('- Maintenance release.', '')
  }
  for (const group of groups) {
    lines.push(`### ${group.title}`, '', ...group.entries, '')
  }
  return lines.join('\n')
}

const SECTION = /^## \[([^\]]+)\]/gm

/** Текст раздела версии без заголовка или `undefined`. */
export const sectionOf = (
  changelog: string | undefined,
  version: string,
): string | undefined => {
  if (!changelog) return undefined
  const headings = [...changelog.matchAll(SECTION)]
  const index = headings.findIndex(heading => heading[1] === version)
  if (index === -1) return undefined
  const start = headings[index].index! + headings[index][0].length
  const end = headings[index + 1]?.index ?? changelog.length
  return changelog
    .slice(start, end)
    .replace(/^[^\n]*\n/, '')
    .trim()
}

/** CHANGELOG с новым разделом над прошлыми версиями. */
export const withSection = (
  changelog: string | undefined,
  section: string,
): string => {
  const text = changelog ?? CHANGELOG_HEADER
  const first = text.search(SECTION)
  const head = (first === -1 ? text : text.slice(0, first)).trimEnd()
  const rest = first === -1 ? '' : text.slice(first)
  return `${head}\n\n${section.trimEnd()}\n${rest ? `\n${rest}` : ''}`
}

export interface RepoState {
  /** Изменённые и новые файлы (`git status --porcelain`). */
  changed: string[]
  branch: string
  /** Коммиты `origin/master`, которых нет локально, и наоборот. */
  behind: number
  ahead: number
  /** Последний прогон CI на HEAD. */
  ci?: { status: string; conclusion: string }
}

/** Причины отказа выпуска; подготовленный `CHANGELOG.md` — не грязь. */
export const refusalsOf = (state: RepoState): string[] => {
  const reasons: string[] = []
  const dirty = state.changed.filter(path => path !== CHANGELOG_FILE)
  if (dirty.length > 0) {
    reasons.push(
      `рабочая копия грязная: ${dirty.join(', ')} — закоммитьте или уберите`,
    )
  }
  if (state.branch !== 'master') {
    reasons.push(`ветка ${state.branch}, а выпуск — только с master`)
  }
  if (state.behind > 0) {
    reasons.push(
      `в origin/master ${state.behind} коммит(ов), которых нет локально`,
    )
  }
  if (state.ahead > 0) {
    reasons.push(
      `${state.ahead} коммит(ов) не запушены — запушьте и дождитесь зелёного CI`,
    )
  }
  if (!state.ci) {
    reasons.push('CI на HEAD не запускался — запушьте и дождитесь прогона')
  } else if (state.ci.status !== 'completed') {
    reasons.push('CI на HEAD ещё идёт — дождитесь окончания')
  } else if (state.ci.conclusion !== 'success') {
    reasons.push(
      `CI на HEAD: ${state.ci.conclusion} — выпуск только с зелёного`,
    )
  }
  return reasons
}

export interface ReleaseDeps {
  /** Команда с аргументами; ошибка — исключение. */
  run: (command: string, args: string[]) => string
  read: (path: string) => string | undefined
  write: (path: string, text: string) => void
  /** Открыть файл в редакторе git и дождаться закрытия. */
  edit: (path: string) => void
  prompt: (question: string) => Promise<string>
  log: (message: string) => void
  today: () => string
}

export interface ReleaseArgs {
  level?: Level
  /** Без вопроса — для агента после согласия автора. */
  yes?: boolean
  /** Только вписать раздел в CHANGELOG, без коммита. */
  draft?: boolean
}

const readState = (deps: ReleaseDeps): RepoState => {
  const changed = deps
    .run('git', ['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
  const branch = deps.run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  deps.run('git', ['fetch', 'origin', 'master', '--tags'])
  const [behind = 0, ahead = 0] = deps
    .run('git', ['rev-list', '--left-right', '--count', 'origin/master...HEAD'])
    .trim()
    .split(/\s+/)
    .map(Number)
  const sha = deps.run('git', ['rev-parse', 'HEAD']).trim()
  const runs = JSON.parse(
    deps.run('gh', [
      'run',
      'list',
      '--workflow',
      'ci.yml',
      '--commit',
      sha,
      '--json',
      'status,conclusion',
      '--limit',
      '1',
    ]) || '[]',
  ) as { status: string; conclusion: string }[]
  return { changed, branch, behind, ahead, ci: runs[0] }
}

const lastTag = (deps: ReleaseDeps) => {
  try {
    return (
      deps
        .run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'])
        .trim() || undefined
    )
  } catch {
    return undefined
  }
}

/** `npm run release` и `release:draft`: код выхода. */
export const runRelease = async (
  args: ReleaseArgs,
  deps: ReleaseDeps,
): Promise<number> => {
  if (!args.draft) {
    const refusals = refusalsOf(readState(deps))
    if (refusals.length > 0) {
      deps.log('Выпуск невозможен:')
      for (const reason of refusals) deps.log(`  - ${reason}`)
      return 1
    }
  }

  const tag = lastTag(deps)
  const commits = parseLog(
    deps.run('git', [
      'log',
      tag ? `${tag}..HEAD` : 'HEAD',
      `--format=${LOG_FORMAT}`,
    ]),
  )
    .map(parseCommit)
    .filter((commit): commit is ParsedCommit => !!commit)
  const pkg = JSON.parse(deps.read('package.json') ?? '{}') as {
    version: string
  }

  let level = args.level
  if (!level) {
    const suggestion: Suggestion = tag
      ? suggestLevel(commits, pkg.version)
      : { level: 'minor', because: [] }
    level = suggestion.level
    deps.log(
      `Предлагаю: ${level} (${pkg.version} → ${bumpVersion(pkg.version, level)})` +
        (tag ? '' : ' — первый выпуск'),
    )
    for (const commit of suggestion.because.slice(0, 10)) {
      deps.log(
        `  ${commit.hash.slice(0, 7)} ${commit.type}${commit.breaking ? '!' : ''}: ${commit.description}`,
      )
    }
    if (suggestion.because.length > 10) {
      deps.log(`  … и ещё ${suggestion.because.length - 10}`)
    }
    deps.log('Другой уровень: npm run release -- <patch|minor|major>')
  }
  const version = bumpVersion(pkg.version, level)

  const changelog = deps.read(CHANGELOG_FILE)
  const prepared = sectionOf(changelog, version) !== undefined
  if (!prepared) {
    deps.write(
      CHANGELOG_FILE,
      withSection(
        changelog,
        renderSection(version, deps.today(), tag ? commits : 'initial'),
      ),
    )
  }
  if (args.draft) {
    deps.log(
      prepared
        ? `Раздел ${version} в ${CHANGELOG_FILE} уже есть — правьте его там.`
        : `Черновик раздела ${version} вписан в ${CHANGELOG_FILE} — правьте и запускайте npm run release.`,
    )
    return 0
  }
  if (!prepared && !args.yes) deps.edit(CHANGELOG_FILE)

  if (!args.yes) {
    const answer = await deps.prompt(`Выпустить v${version}? [y/N] `)
    if (!/^y(es)?$/i.test(answer.trim())) {
      deps.log(`Отменено. Раздел ${version} остался в ${CHANGELOG_FILE}.`)
      return 1
    }
  }

  const tagName = `v${version}`
  deps.run('npm', ['version', version, '--no-git-tag-version'])
  deps.run('git', ['add', 'package.json', 'package-lock.json', CHANGELOG_FILE])
  deps.run('git', ['commit', '-m', `chore(release): ${tagName}`])
  deps.run('git', ['tag', '-a', tagName, '-m', tagName])
  deps.run('git', ['push', '--atomic', 'origin', 'master', tagName])
  deps.log(
    `Выпущен ${tagName}: CI прогонит гейт и создаст черновик GitHub Release.`,
  )
  return 0
}

/** Текст раздела для GitHub Release по тегу `vX.Y.Z`. */
export const releaseNotes = (
  changelog: string | undefined,
  tag: string,
): string => {
  const notes = sectionOf(changelog, tag.replace(/^v/, ''))
  if (notes === undefined) {
    throw new Error(`в ${CHANGELOG_FILE} нет раздела ${tag}`)
  }
  return notes
}
