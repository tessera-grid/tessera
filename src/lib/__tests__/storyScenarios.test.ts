/**
 * Клиентские сценарии и истории (ADR 0117, §5–§8; SN7–SN8, SN11–SN13, SN29, SN37): у каждого сценария таблицы
 * «Сценарии» принятого ADR — ровно одна история, и история ссылается на свой сценарий
 * через `parameters.scenario: '<ADR>/S<n>'`.
 * Запуск: npx vitest run --config vitest.node.config.ts storyScenarios
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, matchesGlob } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

const DECISIONS = join(__dirname, '..', '..', '..', 'docs', 'decisions')

interface Scenario {
  adr: string
  id: string
  story: string
}

const PLANNED = 'этап'

/** Строки таблиц `| № | Сценарий | … | История |` принятых ADR, вне блоков кода. */
const scenarios = (): Scenario[] =>
  readdirSync(DECISIONS)
    .filter(file => /^\d{4}-.*\.md$/.test(file))
    .flatMap(file => {
      const text = readFileSync(join(DECISIONS, file), 'utf8')
      if (!/^- \*\*Статус:\*\*\s*Принято/m.test(text)) return []
      const adr = file.slice(0, 4)
      const rows: Scenario[] = []
      let fenced = false
      let storyColumn = -1
      for (const line of text.split(/\r?\n/)) {
        if (line.trimStart().startsWith('```')) fenced = !fenced
        if (fenced || !line.startsWith('|')) {
          storyColumn = -1
          continue
        }
        const cells = line
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim())
        if (cells[0] === '№' && cells[1] === 'Сценарий') {
          storyColumn = cells.indexOf('История')
          continue
        }
        if (storyColumn < 0 || /^-+$/.test(cells[0]!)) continue
        // Сценарий этапа внедрения (`этап N · История`): истории до этапа нет.
        if (cells[storyColumn]!.startsWith(PLANNED)) continue
        rows.push({
          adr,
          id: cells[0]!,
          story: cells[storyColumn]!.replace(/`/g, ''),
        })
      }
      return rows
    })

const storyModules = import.meta.glob<
  Record<string, { parameters?: { scenario?: string } }>
>('../stories/*.stories.tsx')

/** Истории по имени экспорта: ссылка на сценарий из `parameters.scenario`. */
const stories = async () => {
  const all = new Map<string, string | undefined>()
  for (const load of Object.values(storyModules)) {
    const { default: _meta, ...exports } = await load()
    for (const [name, story] of Object.entries(exports)) {
      all.set(name, story.parameters?.scenario)
    }
  }
  return all
}

const TIMEOUT = 60_000

describe('сценарии и истории (ADR 0117)', () => {
  it(
    'SN7: у каждого сценария таблицы «Сценарии» есть история из колонки «История», и её parameters.scenario — <ADR>/S<n> этой строки',
    async () => {
      const rows = scenarios()
      expect(rows.length).toBeGreaterThan(0)
      const all = await stories()
      const wrong = rows.flatMap(({ adr, id, story }) => {
        const ref = `${adr}/${id}`
        if (!/^S\d+$/.test(id)) return [`${ref}: номер не S<n>`]
        if (!all.has(story)) return [`${ref}: истории ${story} нет`]
        const scenario = all.get(story)
        return scenario === ref
          ? []
          : [`${ref}: у ${story} scenario = ${scenario ?? '—'}`]
      })
      expect(wrong).toEqual([])
    },
    TIMEOUT,
  )

  it(
    'SN8: сценарий и история — один к одному: история не названа у двух сценариев, история с parameters.scenario есть в таблице этого ADR под этим номером',
    async () => {
      const rows = scenarios()
      const all = await stories()
      const byRef = new Map(rows.map(row => [`${row.adr}/${row.id}`, row]))
      const named = new Map<string, string[]>()
      for (const row of rows) {
        named.set(row.story, [
          ...(named.get(row.story) ?? []),
          `${row.adr}/${row.id}`,
        ])
      }
      const wrong = [
        ...[...named]
          .filter(([, refs]) => refs.length > 1)
          .map(([story, refs]) => `${story}: у сценариев ${refs.join(', ')}`),
        ...[...all]
          .filter(([, scenario]) => scenario !== undefined)
          .filter(([story, scenario]) => byRef.get(scenario!)?.story !== story)
          .map(([story, scenario]) => `${story}: ${scenario} нет в таблице`),
      ]
      // Номер сценария не повторён внутри ADR.
      expect(rows.length).toBe(byRef.size)
      expect(wrong).toEqual([])
    },
    TIMEOUT,
  )
})

type RawModule = Record<
  string,
  {
    name?: string
    parameters?: { scenario?: string }
    play?: (context: unknown) => unknown
  }
>
const rawModules = import.meta.glob<RawModule>('../stories/*.stories.tsx')

/** Объект, который запоминает любое обращение: `play` вне каталога его не трогает. */
const trap = (touched: string[], name: string) =>
  new Proxy(() => {}, {
    get: (_, key) => {
      touched.push(`${name}.${String(key)}`)
      return undefined
    },
    apply: () => {
      touched.push(`${name}()`)
    },
  })

describe('проигрывание сценариев (ADR 0117, §6–§8)', () => {
  it(
    'SN11: история сценария несёт свой play, и вне тестов каталога он ничего не делает',
    async () => {
      const wrong: string[] = []
      for (const [path, load] of Object.entries(rawModules)) {
        const { default: meta, ...exports } = await load()
        for (const [name, story] of Object.entries(exports)) {
          if (!story.parameters?.scenario) continue
          if (typeof story.play !== 'function' || story.play === meta?.play) {
            wrong.push(`${path} ${name}: нет своего play`)
            continue
          }
          const touched: string[] = []
          await story.play({
            globals: {},
            args: {},
            id: name,
            canvasElement: trap(touched, 'canvasElement'),
            step: trap(touched, 'step'),
          })
          if (touched.length) {
            wrong.push(`${path} ${name}: вне каталога — ${touched.join(', ')}`)
          }
        }
      }
      expect(wrong).toEqual([])
    },
    TIMEOUT,
  )

  it(
    'SN29: Playground открывается в покое — её play вне тестов каталога ничего не делает',
    async () => {
      const wrong: string[] = []
      for (const [path, load] of Object.entries(rawModules)) {
        const { default: meta, ...exports } = await load()
        for (const [name, story] of Object.entries(exports)) {
          if ((story.name ?? name) !== 'Playground') continue
          const play = story.play ?? meta?.play
          if (typeof play !== 'function') continue
          const touched: string[] = []
          await play({
            globals: {},
            args: {},
            id: name,
            canvasElement: trap(touched, 'canvasElement'),
            step: trap(touched, 'step'),
          })
          if (touched.length) {
            wrong.push(`${path} ${name}: вне каталога — ${touched.join(', ')}`)
          }
        }
      }
      expect(wrong).toEqual([])
    },
    TIMEOUT,
  )

  it(
    'SN12: мета историй не несёт play — история не проигрывает чужой сценарий',
    async () => {
      const withPlay: string[] = []
      for (const [path, load] of Object.entries(rawModules)) {
        const { default: meta } = await load()
        if (meta && 'play' in meta && meta.play) withPlay.push(path)
      }
      expect(withPlay).toEqual([])
    },
    TIMEOUT,
  )

  it('SN13: наборы историй — storybook dev и тесты все файлы; storybook build (для Chromatic) без *.dev; с STORYBOOK_TARGET=public сборка и storybook dev без *.dev и *.vr; storybook:public и build-storybook:public ставят переменную сами', async () => {
    const argv = process.argv
    const storiesOf = async (args: string[], target?: string) => {
      process.argv = [...argv.slice(0, 2), ...args]
      vi.unstubAllEnvs()
      if (target) vi.stubEnv('STORYBOOK_TARGET', target)
      vi.resetModules()
      const { default: config } = await import('../../../.storybook/main')
      return config.stories as string[]
    }
    try {
      const dev = await storiesOf(['dev'])
      const devPublic = await storiesOf(['dev'], 'public')
      const build = await storiesOf(['build'])
      const published = await storiesOf(['build'], 'public')
      const included = (patterns: string[], file: string) =>
        patterns.some(pattern =>
          matchesGlob(`../src/lib/stories/${file}`, pattern),
        )
      const files = readdirSync(join(__dirname, '..', 'stories')).filter(file =>
        /\.stories\.tsx$/.test(file),
      )
      const devFiles = files.filter(file => file.endsWith('.dev.stories.tsx'))
      const vrFiles = files.filter(file => file.endsWith('.vr.stories.tsx'))
      expect(devFiles.length).toBeGreaterThan(0)
      expect(vrFiles.length).toBeGreaterThan(0)
      for (const file of files) {
        const sandbox = devFiles.includes(file)
        const snapshotOnly = vrFiles.includes(file)
        expect(included(dev, file), `dev: ${file}`).toBe(true)
        expect(included(build, file), `build: ${file}`).toBe(!sandbox)
        expect(included(published, file), `public: ${file}`).toBe(
          !sandbox && !snapshotOnly,
        )
        expect(included(devPublic, file), `dev public: ${file}`).toBe(
          !sandbox && !snapshotOnly,
        )
      }
    } finally {
      process.argv = argv
      vi.unstubAllEnvs()
      vi.resetModules()
    }
    const root = join(__dirname, '..', '..', '..')
    const { scripts } = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
    expect(scripts['storybook:public']).toBe(
      'node scripts/storybook-public.mjs dev',
    )
    expect(scripts['build-storybook:public']).toBe(
      'node scripts/storybook-public.mjs build',
    )
    expect(
      readFileSync(join(root, 'scripts', 'storybook-public.mjs'), 'utf8'),
    ).toMatch(/STORYBOOK_TARGET: 'public'/)
  })
})

/** Вне раздела не по сценарию — витрина с причиной или ещё не переведённая история (SN37). */
const NOT_SCENARIO: Record<string, string> = {
  Palette:
    'витрина ролей цветовых токенов в двух темах для автора темы — не сценарий и не вид таблицы (решение пользователя 2026-10-25)',
  RowDraggingTreeLines: 'файл в работе по ADR 0137 — перевод после её коммита',
}

/** Файл фичи: не песочницы `Tessera/Common`, не `UI/*`, не снимки и не dev-истории. */
const featureFile = (path: string, title: string | undefined) =>
  !/\.(dev|vr)\.stories\.tsx$/.test(path) &&
  !!title &&
  !title.startsWith('Tessera/Common') &&
  !title.startsWith('Tessera/UI/')

describe('форма раздела (ADR 0117, §5)', () => {
  it(
    'SN37: каждая история файла вне Tessera/Common и UI — Playground или история сценария; иная — только в базе с причиной, устаревшая запись роняет страж',
    async () => {
      const seen = new Map<string, 'playground' | 'scenario' | 'other'>()
      for (const [path, load] of Object.entries(rawModules)) {
        const { default: meta, ...exports } = (await load()) as RawModule & {
          default?: { title?: string }
        }
        if (!featureFile(path, meta?.title)) continue
        for (const [name, story] of Object.entries(exports)) {
          seen.set(
            name,
            story.parameters?.scenario
              ? 'scenario'
              : story.name === 'Playground'
                ? 'playground'
                : 'other',
          )
        }
      }
      expect(seen.size).toBeGreaterThan(0)
      const wrong = [
        ...[...seen]
          .filter(([name, kind]) => kind === 'other' && !(name in NOT_SCENARIO))
          .map(([name]) => `${name}: не Playground и не сценарий`),
        ...Object.entries(NOT_SCENARIO)
          .filter(([name, reason]) => seen.get(name) !== 'other' || !reason)
          .map(([name]) => `${name}: запись базы устарела`),
      ]
      expect(wrong).toEqual([])
    },
    TIMEOUT,
  )
})
