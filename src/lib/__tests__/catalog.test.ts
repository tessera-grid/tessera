/**
 * Каталог визуальных состояний (ADR 0093): истории идут в `npm test` проектами
 * `storybook` и `storybook-dark` — рендер, `play` и axe.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  type ConsoleErrors,
  isExpectedConsoleError,
} from '../../../.storybook/consoleErrors'
import main from '../../../.storybook/main'
import preview from '../../../.storybook/preview'
import {
  SNAPSHOT_BUDGET,
  countSnapshots,
  guideStepCounts,
  handMadeModes,
  isStoryTestFile,
  storyExports,
  storyTests,
  unexplainedSkips,
} from '../../../scripts/catalog'
import mainConfig from '../../../vitest.config'
import {
  BASE_MODES,
  CATALOG_STATES,
  CONTRASTS,
  FULL_MODES,
  PALETTES,
  THEMES,
  WIDTHS,
  forcedTwinSources,
  stepTwins,
  vrModes,
} from '../stories/__mocks__/catalog'
import { forcedStep } from '../stories/__mocks__/catalogPlay'
import { A11Y_EXCLUSIONS, KEPT_STORY_TESTS } from '../stories/__tests__/catalog'

const ROOT = join(__dirname, '..', '..', '..')
const STORIES_DIR = join(ROOT, 'src/lib/stories')

/** Файлы историй каталога: имя относительно `src/lib/stories` и текст. */
const storyFiles = () =>
  readdirSync(STORIES_DIR)
    .filter(file => file.endsWith('.stories.tsx'))
    .map(file => ({
      file,
      text: readFileSync(join(STORIES_DIR, file), 'utf8'),
    }))

interface Project {
  plugins?: unknown[]
  test: {
    name?: string
    setupFiles?: string[]
    browser?: { enabled?: boolean; instances?: { browser: string }[] }
  }
}

const projects = (
  mainConfig as { test: { projects: unknown[] } }
).test.projects.filter(
  (project): project is Project => typeof project === 'object',
)

const byName = (name: string) =>
  projects.find(project => project.test.name === name)

interface LoadedStory {
  tags?: string[]
  parameters?: {
    vrStates?: string[]
    requirements?: string[]
    scenario?: string
    guideStep?: number
    chromatic?: { forcedColors?: string; modes?: unknown }
    consoleErrors?: ConsoleErrors
  }
}

const storyModules = import.meta.glob<Record<string, LoadedStory>>(
  '../stories/*.stories.tsx',
)

const HIGH_CONTRAST = 'HighContrast.vr.stories.tsx'

describe('Каталог визуальных состояний', () => {
  it('VR1: каждая история Tessera/** идёт в npm test проектом storybook — рендер без исключений и console.error, play проходит; StrictMode включён', () => {
    const catalog = byName('storybook')
    expect(catalog?.plugins?.length).toBeGreaterThan(0)
    expect(catalog?.test.browser?.enabled).toBe(true)
    expect(catalog?.test.browser?.instances?.map(i => i.browser)).toEqual([
      'chromium',
    ])
    // Истории берутся из main.ts — все `*.stories.tsx` каталога.
    expect(main.stories).toContain('../src/**/*.stories.@(ts|tsx)')
    expect(main.addons).toContain('@storybook/addon-vitest')

    // console.error роняет тест истории.
    expect(catalog?.test.setupFiles).toContain('./.storybook/vitest.setup.ts')
    const setup = readFileSync(join(ROOT, '.storybook/vitest.setup.ts'), 'utf8')
    expect(setup).toMatch(/console\.error =/)
    expect(setup).toMatch(/throw new Error/)

    const framework = main.framework as { options?: { strictMode?: boolean } }
    expect(framework.options?.strictMode).toBe(true)
  })

  it('VR2: axe с color-contrast по каждой истории каталога в светлой и тёмной теме — без нарушений; исключение — в списке с причиной', () => {
    expect(main.addons).toContain('@storybook/addon-a11y')
    const a11y = (
      preview.parameters as {
        a11y?: {
          test?: string
          options?: { rules?: Record<string, { enabled: boolean }> }
        }
      }
    ).a11y
    expect(a11y?.test).toBe('error')
    // Отключены только правила с причиной из ADR 0020; контраст проверяется.
    expect(Object.keys(a11y?.options?.rules ?? {}).sort()).toEqual([
      'region',
      'scrollable-region-focusable',
    ])
    expect(a11y?.options?.rules?.['color-contrast']).toBeUndefined()

    // Обе темы — по проекту.
    expect(byName('storybook')).toBeDefined()
    expect(byName('storybook-dark')).toBeDefined()
    const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
    expect(config).toMatch(/initialGlobals: \{ theme, catalog: true \}/)

    // История вне axe — только с причиной в списке исключений.
    const STORIES = join(ROOT, 'src/lib/stories')
    const offAxe = readdirSync(STORIES)
      .filter(file => file.endsWith('.stories.tsx'))
      .flatMap(file =>
        [
          ...readFileSync(join(STORIES, file), 'utf8').matchAll(
            /a11y:\s*\{[^}]*(?:test:\s*'(?:todo|off)'|disable:\s*true)/g,
          ),
        ].map(() => file),
      )
    expect(offAxe.sort()).toEqual(
      A11Y_EXCLUSIONS.map(entry => entry.file).sort(),
    )
    for (const entry of A11Y_EXCLUSIONS) {
      expect(entry.reason.trim().length, entry.story).toBeGreaterThan(10)
    }
  })

  it('VR9: истории с тегом vr-modes снимаются в режимах тема × палитра × контраст × ширина; высокая контрастность — близнецы историй каталога: chromatic.forcedColors ставит только forced()', () => {
    // Полный перебор осей, каждый режим — на холсте каталога.
    const modes = Object.values(FULL_MODES)
    expect(modes).toHaveLength(
      THEMES.length *
        PALETTES.length *
        CONTRASTS.length *
        Object.keys(WIDTHS).length,
    )
    expect(
      new Set(
        modes.map(m => `${m.theme}/${m.palette}/${m.contrast}/${m.viewport}`),
      ).size,
    ).toBe(modes.length)
    expect(modes.every(m => m.catalog)).toBe(true)

    const parameters = vrModes({ own: 1, chromatic: { delay: 5 } })
    expect(parameters).toEqual({
      own: 1,
      chromatic: { delay: 5, modes: FULL_MODES },
    })

    // В каталоге есть узловые истории; тег и режимы — только вместе.
    const files = storyFiles()
    expect(
      files.flatMap(storyExports).filter(s => /\bvrModes\(/.test(s.body))
        .length,
    ).toBeGreaterThan(0)
    expect(handMadeModes(files)).toEqual([])
    expect(
      handMadeModes([
        { file: 'x', text: "export const X = { tags: ['vr-modes'] }" },
        { file: 'x', text: 'export const Y = { parameters: vrModes() }' },
        {
          file: 'x',
          text: 'export const Z = { parameters: { chromatic: { modes: {} } } }',
        },
      ]),
    ).toEqual(['x:X', 'x:Y', 'x:Z'])

    const forced = files
      .flatMap(storyExports)
      .filter(s => /forcedColors:\s*'active'/.test(s.body))
      .map(s => `${s.file}:${s.name}`)
    // Высокую контрастность ставит только `forced()` близнецов (VR17).
    expect(forced).toEqual([])
  })

  it('VR17: у каждой истории каталога — один близнец высокой контрастности в Tessera/Common/High contrast (HighContrast.vr.stories.tsx), вне тестов каталога; близнец без истории каталога и тег !test вне близнецов роняют страж', async () => {
    const sources: [string, LoadedStory][] = []
    const twins: string[] = []
    const wrong: string[] = []
    for (const [path, load] of Object.entries(storyModules)) {
      const file = path.replace('../stories/', '')
      const { default: _meta, ...stories } = await load()
      for (const [name, story] of Object.entries(stories)) {
        const id = `${file}:${name}`
        if (story.parameters?.vrStates) sources.push([id, story])
        if (!story.tags?.includes('!test')) continue
        const { chromatic, vrStates, requirements, scenario } =
          story.parameters ?? {}
        if (
          file !== HIGH_CONTRAST ||
          chromatic?.forcedColors !== 'active' ||
          chromatic.modes !== BASE_MODES ||
          vrStates ||
          requirements ||
          scenario
        ) {
          wrong.push(id)
        } else if (!story.parameters?.guideStep) {
          twins.push(id)
        }
      }
    }
    expect(sources.length).toBeGreaterThan(0)
    expect(wrong).toEqual([])
    // Близнецы регистрируются при импорте своего файла — проверка после загрузки всех.
    expect(
      sources
        .filter(([, story]) => !forcedTwinSources.has(story))
        .map(([id]) => id),
    ).toEqual([])
    expect(twins).toHaveLength(sources.length)
  }, 60_000)

  it('DG3: у каждого шага гайда — один близнец высокой контрастности: play проходит гайд до шага, forcedColors, базовый режим, тег !test, без scenario, requirements и vrStates; шаг без близнеца и близнец без шага роняют страж', async () => {
    // Близнец шага останавливает play после своего шага.
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => setTimeout(run))
    vi.stubGlobal('document', { getAnimations: () => [] })
    try {
      const played: string[] = []
      const source = {
        parameters: { scenario: 'X/S1' },
        play: async ({
          step,
        }: {
          step: (label: string, run: () => unknown) => Promise<void>
        }) => {
          for (const label of ['a', 'b', 'c']) await step(label, () => {})
        },
      }
      const twin = forcedStep({}, source, 2)
      await (twin.play as typeof source.play)({
        step: async (label, run) => {
          played.push(label)
          await run()
        },
      })
      expect(played).toEqual(['a', 'b'])
      stepTwins.delete(source)
      expect(() => forcedStep({}, { parameters: {} }, 1)).toThrow()
    } finally {
      vi.unstubAllGlobals()
    }

    const counts = guideStepCounts(storyFiles())
    expect(counts.size).toBeGreaterThan(0)
    const loaded = new Map<string, LoadedStory>()
    const wrong: string[] = []
    for (const [path, load] of Object.entries(storyModules)) {
      const file = path.replace('../stories/', '')
      const { default: _meta, ...stories } = await load()
      for (const [name, story] of Object.entries(stories)) {
        loaded.set(`${file}:${name}`, story)
        const { guideStep, chromatic, scenario, requirements, vrStates } =
          story.parameters ?? {}
        if (!guideStep) continue
        if (
          file !== HIGH_CONTRAST ||
          !story.tags?.includes('!test') ||
          chromatic?.forcedColors !== 'active' ||
          chromatic.modes !== BASE_MODES ||
          scenario ||
          requirements ||
          vrStates
        ) {
          wrong.push(`${file}:${name}: вид близнеца шага`)
        }
      }
    }
    // Шаги истории — ровно 1…N, где N — шаги её play.
    for (const [id, steps] of counts) {
      const twinned = [...(stepTwins.get(loaded.get(id)!) ?? [])].sort(
        (a, b) => a - b,
      )
      const expected = Array.from({ length: steps }, (_, i) => i + 1)
      if (twinned.join() !== expected.join()) {
        wrong.push(`${id}: шагов ${steps}, близнецы [${twinned.join()}]`)
      }
    }
    const sources = new Set([...counts.keys()].map(id => loaded.get(id)))
    for (const story of stepTwins.keys()) {
      if (!sources.has(story as LoadedStory)) {
        wrong.push('близнец шага без истории сценария')
      }
    }
    expect(wrong).toEqual([])
  }, 60_000)

  it('DG7: скрипт бюджета снимков считает близнецов шагов в базовом режиме', () => {
    const modes = Object.keys(FULL_MODES).length
    const twin = [
      'export const T = {',
      '  ...twinStep(stories, stories.A, 1),',
      "  name: 'A, шаг 1',",
      "  tags: ['!test'],",
      '}',
    ].join('\n')
    expect(countSnapshots([{ file: 'x', text: twin }], modes)).toBe(1)

    const files = storyFiles()
    const highContrast = files.filter(({ file }) => file === HIGH_CONTRAST)
    const twins = [...highContrast[0]!.text.matchAll(/twinStep\(/g)].length
    const steps = [...guideStepCounts(files).values()].reduce(
      (a, b) => a + b,
      0,
    )
    expect(twins).toBe(steps)
    // Каждый близнец шага — один снимок в бюджете сборки.
    const withoutSteps = files.map(file =>
      file.file === HIGH_CONTRAST
        ? {
            ...file,
            text: file.text.replace(
              /^export const HighContrast\w+Step\d+ = \{[\s\S]*?^\}\n?/gm,
              '',
            ),
          }
        : file,
    )
    expect(
      countSnapshots(files, modes) - countSnapshots(withoutSteps, modes),
    ).toBe(steps)
  })

  it('VR18: история перечисляет ожидаемые сообщения console.error параметром consoleErrors — образцы и причина: сообщение по образцу тест не роняет, любое другое роняет; параметр без образцов или без причины роняет страж', async () => {
    const setup = readFileSync(join(ROOT, '.storybook/vitest.setup.ts'), 'utf8')
    expect(setup).toMatch(/!isExpectedConsoleError\(message\)/)
    expect(setup).toMatch(/expectConsoleErrors\(undefined\)/)

    // Список задаёт `preview` из параметра истории, которая идёт сейчас.
    const beforeEach = preview.beforeEach as (context: object) => unknown
    beforeEach({
      parameters: {
        consoleErrors: { expected: [/plugin failed/], reason: 'падение' },
      },
    })
    expect(isExpectedConsoleError('Error: plugin failed')).toBe(true)
    expect(isExpectedConsoleError('Warning: unique key')).toBe(false)
    beforeEach({ parameters: {} })
    expect(isExpectedConsoleError('Error: plugin failed')).toBe(false)

    const wrong: string[] = []
    let declared = 0
    for (const [path, load] of Object.entries(storyModules)) {
      const { default: _meta, ...stories } = await load()
      for (const [name, story] of Object.entries(stories)) {
        const errors = story.parameters?.consoleErrors
        if (!errors) continue
        declared++
        if (errors.expected.length === 0 || errors.reason.trim() === '')
          wrong.push(`${path}:${name}`)
      }
    }
    expect(declared).toBeGreaterThan(0)
    expect(wrong).toEqual([])
  })

  it('VR10: история вне снимков несёт причину; история без снимка и без причины роняет страж', () => {
    expect(unexplainedSkips(storyFiles())).toEqual([])
    const skip = (reason: string) =>
      `export const X = { parameters: { chromatic: { disableSnapshot: true }, vrSkipReason: '${reason}' } }`
    expect(unexplainedSkips([{ file: 'x', text: skip('') }])).toEqual(['x:X'])
    expect(
      unexplainedSkips([{ file: 'x', text: skip('живые данные с сервера') }]),
    ).toEqual([])
  })

  it('VR11: число снимков полной сборки (истории × режимы) считается скриптом и не выходит за бюджет', () => {
    const modes = Object.keys(FULL_MODES).length
    const fixture = [
      {
        file: 'x',
        text: [
          'export const A = {}',
          "export const B = { tags: ['vr-modes'], parameters: vrModes() }",
          'export const C = { parameters: { chromatic: { disableSnapshot: true } } }',
        ].join('\n'),
      },
    ]
    expect(countSnapshots(fixture, modes)).toBe(1 + modes)

    const total = countSnapshots(storyFiles(), modes)
    expect(total).toBeGreaterThan(0)
    expect(total, `снимков в сборке: ${total}`).toBeLessThanOrEqual(
      SNAPSHOT_BUDGET,
    )
  })

  it('VR4: тело — наведение обычной и выбранной строки, выбор, фокус, правка, ожидание и ошибка, подсветка, диапазон ячеек, обновление данных, дерево с линиями, группы, закрепление слева и справа, скелет, пустое состояние — истории каталога', () => {
    expect(missingStates('body')).toEqual([])
  })

  it('VR5: шапка и футер — сортировка, индикаторы включённого действия, вложенная шапка, кебаб, ручка ширины, строка футера — истории каталога', () => {
    expect(missingStates('head')).toEqual([])
  })

  it('VR6: наложения — меню, вложенный раздел, контекстное меню, панели фильтров текста, даты и вариантов, экспорт, «Колонки», тултип — истории каталога; поповер целиком внутри холста истории', () => {
    expect(missingStates('overlay')).toEqual([])
    // История наложения открывает его в play и проверяет вмещение в холст.
    for (const story of statesOf().filter(s =>
      s.state.startsWith('overlay.'),
    )) {
      expect(story.body, story.where).toMatch(/\bplay:/)
      expect(story.text, story.where).toMatch(/\bexpectPopupInCanvas\(/)
    }
  })

  it('VR7: панели — тулбар, нижняя панель, пагинация, узкая ширина — истории каталога', () => {
    expect(missingStates('panel')).toEqual([])
  })

  it('DG1: реестр содержит область drag — rowHandle, columnHandle, row, column, rowInvalid, groupParent, pending, rejected, landed; у каждого есть носитель', () => {
    expect([...CATALOG_STATES.drag].sort()).toEqual(
      [
        'rowHandle',
        'columnHandle',
        'row',
        'column',
        'rowInvalid',
        'groupParent',
        'pending',
        'rejected',
        'landed',
      ].sort(),
    )
    // Носитель — шаг гайда со `states` (VR14; проверку во всех сочетаниях даёт DG2).
    const declared = stepStates()
    expect(
      CATALOG_STATES.drag
        .map(state => `drag.${state}`)
        .filter(state => !declared.has(state)),
    ).toEqual([])
  })

  it('VR13: дымовые тесты историй ADR 0042 и тесты «история …» — play-функции своих историй; отдельных файлов *-stories.test.tsx нет', () => {
    const tests = testFiles()
    expect(tests.filter(t => isStoryTestFile(t.file))).toEqual([])
    // Тест о демо-истории в наборе фичи — только из списка с причиной.
    const found = storyTests(tests)
    expect(found.filter(id => !(id in KEPT_STORY_TESTS))).toEqual([])
    expect(
      Object.keys(KEPT_STORY_TESTS).filter(id => !found.includes(id)),
    ).toEqual([])
    for (const reason of Object.values(KEPT_STORY_TESTS)) {
      expect(reason.trim().length).toBeGreaterThan(10)
    }
    // Страж видит тест истории по-русски и по-английски, но не упоминание историй.
    // Имена собраны помощником: сверка требований не читает их как тесты.
    const named = (name: string) => `test('${name}', () => {})`
    expect(
      storyTests([
        {
          file: 'x',
          text: [
            named('ZZ1: история «Basic» рендерится'),
            named('ZZ2: the "Basic" story renders'),
            named('ZZ3: две отрисовки одной истории дают одно'),
          ].join('\n'),
        },
      ]),
    ).toEqual(['ZZ1', 'ZZ2'])
    expect(isStoryTestFile('visual/panels-stories.test.tsx')).toBe(true)

    // Дымовые тесты ADR 0042 — в параметрах историй.
    const inStories = storyFiles().flatMap(file =>
      [...file.text.matchAll(/requirements:\s*\[([^\]]*)\]/g)].flatMap(m =>
        [...m[1]!.matchAll(/'(\w+)'/g)].map(id => id[1]!),
      ),
    )
    expect(inStories).toEqual(
      expect.arrayContaining(['DS1', 'DS2', 'DS3', 'DS4', 'DS5', 'DS6']),
    )
  })
})

/** Тесты на историях: имя относительно `src/lib/stories/__tests__` и текст. */
const testFiles = () => {
  const dir = join(STORIES_DIR, '__tests__')
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(file => /\.test\.tsx?$/.test(file))
    .filter(file => statSync(join(dir, file)).isFile())
    .map(file => ({ file, text: readFileSync(join(dir, file), 'utf8') }))
}

/** Состояния каталога, которые показывают истории (`vrStates(...)` в параметрах). */
const statesOf = () =>
  storyFiles().flatMap(file =>
    storyExports(file).flatMap(story =>
      [...story.body.matchAll(/\bvrStates\(([^)]*)\)/g)].flatMap(call =>
        [...call[1]!.matchAll(/'([\w.]+)'/g)].map(state => ({
          state: state[1]!,
          where: `${story.file}:${story.name}`,
          body: story.body,
          text: file.text,
        })),
      ),
    ),
  )

/** Состояния, которые объявляют шаги гайдов полем `states`. */
const stepStates = () =>
  new Set(
    storyFiles().flatMap(file =>
      [...file.text.matchAll(/\bstates: \[([^\]]*)\]/g)].flatMap(list =>
        [...list[1]!.matchAll(/'([\w.]+)'/g)].map(state => state[1]!),
      ),
    ),
  )

/** Состояние каталога показывает история `vrStates` или шаг гайда со `states` (ADR 0117). */
const missingStates = (area: keyof typeof CATALOG_STATES) => {
  const shown = new Set([...statesOf().map(s => s.state), ...stepStates()])
  return CATALOG_STATES[area]
    .map(state => `${area}.${state}`)
    .filter(state => !shown.has(state))
}
