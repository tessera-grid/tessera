import { describe, expect, it } from 'vitest'

import {
  compareWithBaseline,
  findProblems,
  parseRequirements,
  parseStoryRequirements,
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
  it('TQ10: находит пропуск, дубль, неизвестный ID, коллизию, битую ссылку →, тест у требования «этап N» и устаревшую запись базы; ссылки, ревью, этапы без теста и непринятые ADR не считает', () => {
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
            '| AA8 | запланировано | этап 2 |',
            '| AA9 | этап сделан | этап 3 |',
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
      'AA8',
      'AA9',
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
        call('test', 'AA9: тест уже есть'),
        call('test', 'описание без ID'),
        "const CASES = [{ id: 'XX1' }]",
        `for (const c of CASES) ${call('test', '$' + '{c.id}: кейс', '`')}`,
      ].join('\n'),
      't.test.ts',
    )
    expect(tests.map(t => t.id)).toEqual([
      'AA1',
      'AA3',
      'AA3',
      'ZZ9',
      'AA9',
      'XX1',
    ])

    const problems = findProblems(requirements, tests)
    expect(problems.map(p => `${p.kind}:${p.id}`)).toEqual([
      'collision:XX1',
      'duplicate:AA3',
      'missing:AA2',
      'missing:DD2',
      'planned:AA9',
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
      'planned:AA9',
      'reference:AA7',
      'unknown:ZZ9',
    ])
    expect(stale.map(e => `${e.kind}:${e.id}`)).toEqual(['missing:AA1'])
  })

  it('VR12: check:requirements читает ID требований из parameters.requirements историй — пропуск, дубль и неизвестный ID ловятся как у тестов', () => {
    const requirements = parseRequirements(
      adr(
        'Принято',
        [
          '| SS1 | есть история | visual |',
          '| SS2 | нет ни теста, ни истории | visual |',
          '| SS3 | история и тест | visual |',
        ].join('\n'),
      ),
      's.md',
    )
    // История собрана из частей, чтобы сверка не приняла фикстуру за настоящую.
    const story = (ids: string) =>
      `export const S = { parameters: { requir` + `ements: [${ids}] } }`
    const stories = parseStoryRequirements(
      [story("'SS1'"), story("'SS3', 'ZZ8'")].join('\n'),
      'x.stories.tsx',
    )
    expect(stories.map(s => `${s.id}@${s.line}`)).toEqual([
      'SS1@1',
      'SS3@2',
      'ZZ8@2',
    ])
    const call = `te` + `st('SS3: тест', () => {})`
    const tests = [...parseTestNames(call, 't.test.ts'), ...stories]
    expect(
      findProblems(requirements, tests).map(p => `${p.kind}:${p.id}`),
    ).toEqual(['duplicate:SS3', 'missing:SS2', 'unknown:ZZ8'])
  })
})
