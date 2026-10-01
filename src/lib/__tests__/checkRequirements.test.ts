import { describe, expect, it } from 'vitest'

import {
  compareWithBaseline,
  findProblems,
  parseRequirements,
  parseTestNames,
} from '../../../scripts/requirements'

// Сверка «требование ↔ тест» (ADR 0043, TQ10).

const adr = (status: string, rows: string) => `# 00XX — Пример

- **Статус:** ${status}

| ID  | Требование | Вид    |
| --- | ---------- | ------ |
${rows}
`

describe('Сверка требований и тестов', () => {
  it('TQ10: находит пропуск, дубль, неизвестный ID, коллизию, битую ссылку → и устаревшую запись базы; ссылки, ревью и непринятые ADR не считает', () => {
    const requirements = [
      ...parseRequirements(
        adr(
          'Принято (реализовано)',
          [
            '| AA1 | есть тест | visual |',
            '| AA2 | нет теста | unit |',
            '| AA3 | два теста | visual |',
            '| AA4 | правило | ревью |',
            '| AA5 | правило фичи | тест фичи |',
            '| R6/R8 | ссылка | visual |',
            '| [CP1](x.md) | ссылка на владельца | visual |',
            '| XX1 | коллизия | unit |',
            '| AA6 | покрыто чужим тестом | → AA1 |',
            '| AA7 | битая ссылка | `→ AA1, QQ1` |',
          ].join('\n'),
        ),
        'a.md',
      ),
      ...parseRequirements(adr('Принято', '| XX1 | снова | unit |'), 'b.md'),
      ...parseRequirements(
        [
          '- **Статус:** Принято',
          '',
          '| ID | Требование | Тест |',
          '| --- | --- | --- |',
          '| DD1 | документ | ревью: README |',
          '| DD3 | импорт | линт: no-restricted-imports |',
          '| DD4 | сборка | скрипт: check:tree-shaking |',
          '| DD2 | с тестом | ✔ `DD2:` |',
        ].join('\n'),
        'd.md',
      ),
      ...parseRequirements(
        adr('Предложено', '| BB1 | черновик | unit |'),
        'c.md',
      ),
    ]
    expect(requirements.map(r => r.id)).toEqual([
      'AA1',
      'AA2',
      'AA3',
      'AA4',
      'AA5',
      'XX1',
      'AA6',
      'AA7',
      'XX1',
      'DD1',
      'DD3',
      'DD4',
      'DD2',
    ])
    expect(requirements.find(r => r.id === 'AA7')?.coveredBy).toEqual([
      'AA1',
      'QQ1',
    ])

    // Вызовы собраны из частей, чтобы сама сверка не приняла фикстуру за тесты.
    const call = (fn: string, name: string, quote = "'") =>
      `${fn}(${quote}${name}${quote}, () => {})`
    const tests = parseTestNames(
      [
        call('test', 'AA1: один'),
        call('it', 'AA3: первый'),
        call('test.fails', 'AA3: второй'),
        call('test', 'ZZ9: без требования'),
        call('test', 'описание без ID'),
        "const CASES = [{ id: 'XX1' }]",
        `for (const c of CASES) ${call('test', '$' + '{c.id}: кейс', '`')}`,
      ].join('\n'),
      't.test.ts',
    )
    expect(tests.map(t => t.id)).toEqual(['AA1', 'AA3', 'AA3', 'ZZ9', 'XX1'])

    const problems = findProblems(requirements, tests)
    expect(problems.map(p => `${p.kind}:${p.id}`)).toEqual([
      'collision:XX1',
      'duplicate:AA3',
      'missing:AA2',
      'missing:DD2',
      'reference:AA7',
      'unknown:ZZ9',
    ])

    const { fresh, stale } = compareWithBaseline(problems, [
      { kind: 'missing', id: 'AA2', reason: 'известно' },
      { kind: 'missing', id: 'AA1', reason: 'уже покрыто' },
    ])
    expect(fresh.map(p => `${p.kind}:${p.id}`)).toEqual([
      'collision:XX1',
      'duplicate:AA3',
      'missing:DD2',
      'reference:AA7',
      'unknown:ZZ9',
    ])
    expect(stale.map(e => `${e.kind}:${e.id}`)).toEqual(['missing:AA1'])
  })
})
