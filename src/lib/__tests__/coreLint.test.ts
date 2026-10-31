/**
 * Сборка ядра без записи ref в рендере (ADR 0171, §3): правило `react-hooks/refs` действует
 * для `useCreateTable` и хранилища срезов, исключения в конфиге линта нет.
 * Запуск: npx vitest run --config vitest.node.config.ts coreLint
 */
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const severityOf = (rule: unknown) =>
  Array.isArray(rule) ? rule[0] : (rule ?? 'off')

describe('линт сборки ядра (ADR 0171)', () => {
  it('EF8: для useCreateTable и useEffectiveState нет исключения react-hooks/refs, линт проходит без него', async () => {
    const eslint = new ESLint()
    const files = [
      'src/lib/core/useCreateTable.ts',
      'src/lib/core/effectiveState.ts',
    ]
    for (const file of files) {
      const config = await eslint.calculateConfigForFile(file)
      expect([2, 'error']).toContain(
        severityOf(config.rules['react-hooks/refs']),
      )
    }
    const results = await eslint.lintFiles(files)
    expect(
      results.flatMap(result =>
        result.messages
          .filter(message => message.ruleId === 'react-hooks/refs')
          .map(message => `${result.filePath}:${message.line}`),
      ),
    ).toEqual([])
  }, 60_000)
})
