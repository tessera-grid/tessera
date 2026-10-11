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
import mainConfig from '../../../vitest.config'
import { A11Y_EXCLUSIONS } from '../stories/__tests__/catalog'

const ROOT = join(__dirname, '..', '..', '..')

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
    expect(config).toMatch(/initialGlobals: \{ theme \}/)

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
})
