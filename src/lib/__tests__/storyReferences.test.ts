/**
 * Ссылка «Раздел/… — Имя» на историю в `docs` указывает на существующую историю
 * (ADR 0151, OC4). Разделы и имена — из заголовков мет и `name` историй.
 * Запуск: npx vitest run --config vitest.node.config.ts storyReferences
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sectionOf, storyFiles } from './storyFiles'

const ROOT = join(__dirname, '..', '..', '..')

/**
 * Расхождения на момент ADR 0151: ADR описывает истории на день решения, их потом
 * переименовали. Список только сокращается — исправленная ссылка уходит из него.
 */
const BASELINE: Record<string, string> = {
  'docs/decisions/0042-demo-story-smoke-tests.md: «Cells/Editing — Server (async)»':
    'теперь «Cells/Editing — Server save»',
  'docs/decisions/0044-export.md: «Export — presets»':
    'теперь «Export — Settings and quick sets»',
  'docs/decisions/0046-toolbar-and-status-bar-visibility.md: «Panels/Status bar — Off (own pager)»':
    'теперь «Panels/Pagination — Own pager»',
  'docs/decisions/0089-contrast-matrix.md: «Panels/Pagination — Default»':
    'теперь «Panels/Pagination — Playground»',
  'docs/decisions/0089-contrast-matrix.md: «Panels/Toolbar — All buttons»':
    'теперь «Panels/Toolbar — Playground»',
  'docs/decisions/0093-visual-state-catalog.md: «Core/Stubs — Default»':
    'теперь «Core/Stubs — Playground»',
  'docs/decisions/0093-visual-state-catalog.md: «Core/High contrast — Default»':
    'раздел теперь «Common/High contrast»',
  'docs/decisions/0093-visual-state-catalog.md: «Cells/Selection — State: cell range»':
    'истории `State: …` ушли в гайды (ADR 0117): «Cells/Selection — Select and copy»',
  'docs/decisions/0121-shared-skeleton-wave.md: «Core/Skeleton — Playground»':
    'раздел теперь «Data loading/Skeleton»',
  'docs/decisions/0123-empty-state-stubs.md: «Core/Stubs — Default»':
    'теперь «Core/Stubs — Playground»',
}

/** Разделы каталога и имена их историй. */
const catalog = () => {
  const sections = new Map<string, Set<string>>()
  for (const file of storyFiles()) {
    const names = sections.get(file.section) ?? new Set<string>()
    for (const story of file.stories) names.add(story.name)
    sections.set(file.section, names)
  }
  return sections
}

const markdown = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdown(path)
    return name.endsWith('.md') ? [path] : []
  })

/** Раздел, похожий на путь каталога: латиница, со слешем. */
const SECTION_LIKE = /^[A-Z][\w ]*\/[\w /]+$/

/** Ссылки на истории в `docs`, которых нет в каталоге. */
const brokenReferences = () => {
  const sections = catalog()
  const broken = new Set<string>()
  for (const file of markdown(join(ROOT, 'docs'))) {
    const text = readFileSync(file, 'utf8').replace(/\n\s*/g, ' ')
    for (const match of text.matchAll(/«([^»]+)»|`([^`]+)`/g)) {
      const quote = sectionOf(match[1] ?? match[2]!)
      const at = quote.indexOf(' — ')
      if (at < 0) continue
      const section = quote.slice(0, at)
      const name = quote.slice(at + 3)
      const names = sections.get(section)
      if (names ? names.has(name) : !SECTION_LIKE.test(section)) continue
      const path = relative(ROOT, file).replaceAll('\\', '/')
      broken.add(`${path}: «${quote}»`)
    }
  }
  return [...broken].sort()
}

describe('ссылки на истории (ADR 0151)', () => {
  it('OC4: ссылка «Раздел/… — Имя» на историю в docs указывает на существующую историю; расхождения — в базе с причиной, база только сокращается', () => {
    const sections = catalog()
    expect(sections.get('Export')).toContain('Server')
    const broken = brokenReferences()
    expect(broken.filter(ref => !(ref in BASELINE))).toEqual([])
    expect(Object.keys(BASELINE).filter(ref => !broken.includes(ref))).toEqual(
      [],
    )
  })
})
