/**
 * Прогон на React 18 (ADR 0091, EV1): те же браузерные наборы, что у `npm test`, с
 * React 18 из `tools/react18`; исключения — с причиной; серверный рендер — свой проект.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import mainConfig from '../../../vitest.config'
import react18Config from '../../../vitest.react18.config'
import {
  REACT18_EXCLUSIONS,
  REACT18_ROOT,
  SSR_SUITE,
} from '../stories/__tests__/react18'

interface ProjectTest {
  name?: string
  include?: string[]
  exclude?: string[]
  environment?: string
  setupFiles?: string[]
}

const projectsOf = (config: unknown) =>
  (
    (config as { test: { projects: unknown[] } }).test.projects.filter(
      project => typeof project === 'object',
    ) as { test: ProjectTest }[]
  ).map(project => project.test)

const byName = (config: unknown, name: string) =>
  projectsOf(config).find(project => project.name === name)!

describe('Прогон на React 18', () => {
  it('EV1: test:react18 — браузерные наборы npm test на React 18 из tools/react18, исключения с причиной, серверный рендер в node', () => {
    const browser = byName(mainConfig, 'browser')
    const react18 = byName(react18Config, 'react18')
    const unit = byName(react18Config, 'react18-unit')
    const touch = byName(react18Config, 'react18-touch')

    // Те же наборы, что у npm test, минус исключения.
    expect(react18.include).toEqual(browser.include)
    expect(react18.exclude).toEqual([
      ...browser.exclude!,
      ...REACT18_EXCLUSIONS.map(exclusion => exclusion.file),
    ])
    expect(touch.include).toEqual(byName(mainConfig, 'touch').include)
    expect(unit).toMatchObject({ include: [SSR_SUITE], environment: 'node' })

    for (const exclusion of REACT18_EXCLUSIONS) {
      expect(existsSync(exclusion.file), exclusion.file).toBe(true)
      expect(exclusion.reason.length, exclusion.file).toBeGreaterThan(10)
    }

    // React и React DOM подменены на 18 из отдельного проекта.
    const aliases = (
      react18Config as {
        resolve: { alias: { find: RegExp | string; replacement: string }[] }
      }
    ).resolve.alias
    for (const name of ['react', 'react-dom']) {
      const alias = aliases.find(
        a => a.find instanceof RegExp && a.find.test(name),
      )!
      expect(alias.replacement.split('\\').join('/')).toContain(
        `${REACT18_ROOT}/${name}`,
      )
    }
    const tools = JSON.parse(
      readFileSync('tools/react18/package.json', 'utf8'),
    ) as { dependencies: Record<string, string> }
    expect(tools.dependencies.react).toMatch(/^18\./)
    expect(tools.dependencies['react-dom']).toMatch(/^18\./)

    const scripts = (
      JSON.parse(readFileSync('package.json', 'utf8')) as {
        scripts: Record<string, string>
      }
    ).scripts
    expect(scripts['test:react18']).toContain('npm ci --prefix tools/react18')
    expect(scripts['test:react18']).toContain('vitest.react18.config.ts')
  })
})
