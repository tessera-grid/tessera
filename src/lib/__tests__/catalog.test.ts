/**
 * Каталог визуальных состояний (ADR 0093): истории идут в `npm test` проектами
 * `storybook` и `storybook-dark` — рендер, `play` и axe.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import main from '../../../.storybook/main'
import preview from '../../../.storybook/preview'
import {
  SNAPSHOT_BUDGET,
  countSnapshots,
  handMadeModes,
  storyExports,
  unexplainedSkips,
} from '../../../scripts/catalog'
import mainConfig from '../../../vitest.config'
import {
  CONTRASTS,
  FULL_MODES,
  PALETTES,
  THEMES,
  WIDTHS,
  withVrModes,
} from '../stories/__mocks__/catalog'
import { A11Y_EXCLUSIONS } from '../stories/__tests__/catalog'

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

  it("VR9: истории с тегом vr-modes снимаются в режимах тема × палитра × контраст × ширина; высокая контрастность — истории с chromatic.forcedColors: 'active'", () => {
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

    const story = withVrModes({ name: 'X', tags: ['own'] })
    expect(story.tags).toEqual(['own', 'vr-modes'])
    expect(
      (story.parameters as { chromatic: { modes: unknown } }).chromatic.modes,
    ).toBe(FULL_MODES)

    // В каталоге есть узловые истории, режимы вручную не задаются.
    const files = storyFiles()
    expect(
      files.flatMap(storyExports).filter(s => /\bwithVrModes\(/.test(s.body))
        .length,
    ).toBeGreaterThan(0)
    expect(handMadeModes(files)).toEqual([])
    expect(
      handMadeModes([
        { file: 'x', text: "export const X = { tags: ['vr-modes'] }" },
      ]),
    ).toEqual(['x:X'])

    const forced = files
      .flatMap(storyExports)
      .filter(s => /forcedColors:\s*'active'/.test(s.body))
      .map(s => `${s.file}:${s.name}`)
    expect(forced).toContain(
      'DataGrid.Core.HighContrast.stories.tsx:HighContrast',
    )
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
          'export const B = withVrModes({})',
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
})
