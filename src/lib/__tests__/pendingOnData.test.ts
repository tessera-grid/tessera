/**
 * Ожидание на данных (ADR 0155; PW5): правило «что ждёт → как видно» записано в
 * `docs/architecture/rendering.md` — по строке на каждый вид ожидания.
 * Запуск: npx vitest run --config vitest.node.config.ts pendingOnData
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const RENDERING = new URL(
  '../../../docs/architecture/rendering.md',
  import.meta.url,
)

/** Строки таблицы под заголовком «Что ждёт | Как видно»: [что ждёт, как видно]. */
const ruleRows = (text: string) => {
  const lines = text.split('\n')
  const start = lines.findIndex(line =>
    /^\|\s*Что ждёт\s*\|\s*Как видно/.test(line),
  )
  if (start < 0) return []
  const rows: [string, string][] = []
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    const [what, how] = line
      .split('|')
      .slice(1, 3)
      .map(cell => cell.trim())
    rows.push([what!, how!])
  }
  return rows
}

describe('Ожидание на данных (ADR 0155)', () => {
  it('PW5: правило «что ждёт → как видно» — в docs/architecture/rendering.md', () => {
    const text = readFileSync(RENDERING, 'utf8')
    expect(text).toContain('0155-pending-on-data.md')
    const rows = ruleRows(text)
    const howOf = (pattern: RegExp) =>
      rows.find(([what]) => pattern.test(what))?.[1]
    expect(howOf(/кебаб.*инлайн-кнопка/)).toMatch(/дуга на инициаторе/)
    expect(howOf(/контекстного меню/)).toMatch(/волна/)
    expect(howOf(/вся таблица.*'table'/)).toMatch(
      /свечение под шапкой.*приглушение/,
    )
    expect(howOf(/ленивые дети/)).toMatch(/скелеты/)
    expect(rows).toHaveLength(4)
  })
})
