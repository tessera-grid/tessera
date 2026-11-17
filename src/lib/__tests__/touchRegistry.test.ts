/**
 * Реестр касаний (ADR 0231, TV1): у каждого встроенного плагина — ID требований касания из
 * принятых ADR с тестом в наборах касаний или причина без касания.
 * Запуск: npx vitest run --config vitest.node.config.ts touchRegistry
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  parseRequirements,
  parseTestNames,
} from '../../../scripts/requirements'
import { builtinPluginEntries } from './builtinPlugins'
import { TOUCH_REGISTRY, TOUCH_TEST_FILES } from './touchRegistry'

const ROOT = join(__dirname, '..', '..', '..')
const DECISIONS = join(ROOT, 'docs', 'decisions')

const requirementIds = () =>
  new Set(
    readdirSync(DECISIONS)
      .filter(name => /^\d{4}-.*\.md$/.test(name))
      .flatMap(name =>
        parseRequirements(readFileSync(join(DECISIONS, name), 'utf8'), name),
      )
      .map(requirement => requirement.id),
  )

const touchTestIds = () =>
  new Set(
    TOUCH_TEST_FILES.flatMap(file =>
      parseTestNames(readFileSync(join(ROOT, file), 'utf8'), file),
    ).map(test => test.id),
  )

describe('Реестр касаний (ADR 0231)', () => {
  it('TV1: у каждого экспорта `/plugins` — строка реестра касаний: ID требований касания из принятых ADR с тестом проекта `touch` или причина без касания; плагин без строки и неизвестный ID роняют страж', () => {
    const plugins = builtinPluginEntries().map(entry => entry.id)
    expect(plugins.filter(id => !(id in TOUCH_REGISTRY))).toEqual([])
    expect(
      Object.keys(TOUCH_REGISTRY).filter(id => !plugins.includes(id)),
    ).toEqual([])
    const requirements = requirementIds()
    const tests = touchTestIds()
    const problems: string[] = []
    for (const [plugin, row] of Object.entries(TOUCH_REGISTRY)) {
      if (!Array.isArray(row)) {
        if (!(row as { reason: string }).reason.trim())
          problems.push(`${plugin}: пустая причина`)
        continue
      }
      if (row.length === 0) problems.push(`${plugin}: нет ID`)
      for (const id of row) {
        if (!requirements.has(id))
          problems.push(`${plugin}: ${id} — нет среди требований принятых ADR`)
        if (!tests.has(id))
          problems.push(`${plugin}: ${id} — нет теста в наборах касаний`)
      }
    }
    expect(problems).toEqual([])
  })
})
