/**
 * Прогон в движках (ADR 0084, CB3): все визуальные наборы в Firefox и WebKit, кроме
 * исключений с причиной, с теми же командами, что у Chromium.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import browsersConfig from '../../../vitest.browsers.config'
import { testCommands } from '../../../vitest.commands'
import mainConfig from '../../../vitest.config'
import enginesConfig from '../../../vitest.engines.config'
import { ENGINE_EXCLUSIONS, MOBILE_SUITE } from '../stories/__tests__/engines'

interface ProjectTest {
  name?: string
  include?: string[]
  exclude?: string[]
  browser?: {
    commands?: unknown
    instances?: { browser: string; name?: string }[]
  }
}

const projectsOf = (config: unknown) =>
  (
    (config as { test: { projects: unknown[] } }).test.projects.filter(
      project => typeof project === 'object',
    ) as { test: ProjectTest }[]
  ).map(project => project.test)

const byName = (config: unknown, name: string) =>
  projectsOf(config).find(project => project.name === name)!

describe('Прогон в движках', () => {
  it('CB3: test:engines — все визуальные наборы в Firefox и WebKit, кроме исключений с причиной; команды те же, что у Chromium', () => {
    const chromium = byName(mainConfig, 'browser')
    const engines = byName(enginesConfig, 'engines')
    const mobile = byName(enginesConfig, 'mobile')

    for (const project of [chromium, engines, mobile]) {
      expect(project.browser!.commands).toBe(testCommands)
    }
    expect(
      (browsersConfig as { test: ProjectTest }).test.browser!.commands,
    ).toBe(testCommands)

    expect(engines.include).toEqual([
      'src/lib/stories/__tests__/visual/**/*.test.tsx',
    ])
    expect(engines.browser!.instances!.map(i => i.browser)).toEqual([
      'firefox',
      'webkit',
    ])
    for (const exclusion of ENGINE_EXCLUSIONS) {
      expect(existsSync(exclusion.file), exclusion.file).toBe(true)
      expect(exclusion.reason.trim().length, exclusion.file).toBeGreaterThan(10)
      expect(engines.exclude).toContain(exclusion.file)
    }
    expect(
      engines.exclude!.filter(
        pattern => !ENGINE_EXCLUSIONS.some(e => e.file === pattern),
      ),
    ).not.toContainEqual(expect.stringContaining('visual/'))

    expect(mobile.include).toEqual([MOBILE_SUITE])
    expect(mobile.browser!.instances!.map(i => i.name)).toEqual([
      'iphone',
      'pixel',
    ])
    expect(chromium.exclude).toContain(MOBILE_SUITE)
  })
})
