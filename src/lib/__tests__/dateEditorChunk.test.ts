/**
 * Календарь редактора даты (ADR 0175, ED7): общий календарь кита `ui/Calendar` (ADR 0183), в плагин правки
 * попадает только ленивым модулем редактора, модулей фильтров плагин правки не тянет.
 * Запуск: npx vitest run --config vitest.node.config.ts dateEditorChunk
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

const resolveImport = (from: string, spec: string) => {
  const base = resolve(dirname(from), spec)
  return [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    base,
  ].find(path => existsSync(path) && /\.tsx?$/.test(path))
}

/** Модули, которые тянет файл статическими импортами; `import()` не учитывается. */
const staticGraph = (entry: string) => {
  const seen = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const [, spec] of source.matchAll(
      /(?:from|import)\s+'(\.{1,2}\/[^']+)'/g,
    )) {
      const next = resolveImport(file, spec!)
      if (next) walk(next)
    }
  }
  walk(join(root, entry))
  return [...seen].map(file => relative(root, file).replaceAll('\\', '/'))
}

const CALENDAR = 'ui/Calendar/Calendar.tsx'

describe('календарь редактора даты (ADR 0175)', () => {
  it('ED7: календарь лежит в ките (ui/Calendar) и грузится при первой правке даты — ленивым модулем редактора; cellEditing не тянет модули фильтров', () => {
    const plugin = staticGraph('plugins/cellEditing/index.ts')
    expect(plugin).toContain('plugins/cellEditing/editors.tsx')
    expect(plugin).not.toContain(CALENDAR)
    expect(plugin).not.toContain('plugins/cellEditing/DateEditor.tsx')
    expect(
      plugin.filter(file => file.startsWith('plugins/columnFiltering')),
    ).toEqual([])
    expect(
      plugin.filter(file =>
        /^import (?!type )[^;]*?from '@daypicker\/react'/m.test(
          readFileSync(join(root, file), 'utf8'),
        ),
      ),
    ).toEqual([])

    const editors = readFileSync(
      join(root, 'plugins/cellEditing/editors.tsx'),
      'utf8',
    )
    expect(editors).toMatch(/import\('\.\/DateEditor'\)/)
    const editor = staticGraph('plugins/cellEditing/DateEditor.tsx')
    expect(editor).toContain(CALENDAR)
    expect(
      editor.filter(file => file.startsWith('plugins/columnFiltering')),
    ).toEqual([])

    // Тот же календарь у фильтра даты.
    expect(
      staticGraph('plugins/columnFiltering/DateFilterPanel.tsx'),
    ).toContain(CALENDAR)
  })
})
