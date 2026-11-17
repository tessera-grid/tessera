/**
 * Реестр клавиатуры (ADR 0232, KX1): у каждого встроенного плагина — ID требования
 * из принятого ADR с тестом на настоящих клавишах или причина без интерфейса.
 * Запуск: npx vitest run --config vitest.node.config.ts keyboardRegistry
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  parseRequirements,
  parseTestNames,
} from '../../../scripts/requirements'
import { builtinPluginEntries } from './builtinPlugins'
import { KEYBOARD_REGISTRY, KEYBOARD_TEST_FILES } from './keyboardRegistry'

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

const keyboardTestIds = () =>
  new Set(
    KEYBOARD_TEST_FILES.flatMap(file =>
      parseTestNames(readFileSync(join(ROOT, file), 'utf8'), file),
    ).map(test => test.id),
  )

describe('Реестр клавиатуры (ADR 0232)', () => {
  it('KX1: у каждого экспорта `/plugins` — строка реестра клавиатуры: ID требований из принятых ADR с тестом на настоящих клавишах или причина без интерфейса; плагин без строки и неизвестный ID роняют страж', () => {
    const plugins = builtinPluginEntries().map(entry => entry.id)
    expect(plugins.filter(id => !(id in KEYBOARD_REGISTRY))).toEqual([])
    expect(
      Object.keys(KEYBOARD_REGISTRY).filter(id => !plugins.includes(id)),
    ).toEqual([])
    const requirements = requirementIds()
    const tests = keyboardTestIds()
    const problems: string[] = []
    for (const [plugin, row] of Object.entries(KEYBOARD_REGISTRY)) {
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
          problems.push(`${plugin}: ${id} — нет теста в клавиатурных наборах`)
      }
    }
    expect(problems).toEqual([])
  })
})
