/**
 * Клиентские сценарии и истории (ADR 0117, §5–§8; SN7–SN8, SN11–SN13, SN29): у каждого сценария таблицы
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
    'SN29: Default открывается в покое — её play вне тестов каталога ничего не делает',
    async () => {
      const wrong: string[] = []
      for (const [path, load] of Object.entries(rawModules)) {
        const { default: meta, ...exports } = await load()
        for (const [name, story] of Object.entries(exports)) {
          if ((story.name ?? name) !== 'Default') continue
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

  it('SN13: *.dev.stories.tsx — в историях storybook dev и тестов, но не storybook build; остальные истории — в обоих', async () => {
    const argv = process.argv
    const storiesOf = async (args: string[]) => {
      process.argv = [...argv.slice(0, 2), ...args]
      vi.resetModules()
      const { default: config } = await import('../../../.storybook/main')
      return config.stories as string[]
    }
    try {
      const dev = await storiesOf(['dev'])
      const build = await storiesOf(['build'])
      const included = (patterns: string[], file: string) =>
        patterns.some(pattern =>
          matchesGlob(`../src/lib/stories/${file}`, pattern),
        )
      const files = readdirSync(join(__dirname, '..', 'stories')).filter(file =>
        /\.stories\.tsx$/.test(file),
      )
      const devFiles = files.filter(file => file.endsWith('.dev.stories.tsx'))
      expect(devFiles.length).toBeGreaterThan(0)
      for (const file of files) {
        expect(included(dev, file), `dev: ${file}`).toBe(true)
        expect(included(build, file), `build: ${file}`).toBe(
          !devFiles.includes(file),
        )
      }
    } finally {
      process.argv = argv
      vi.resetModules()
    }
  })
})
