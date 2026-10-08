/**
 * У каждого компонента публичного входа `/ui` есть история `Tessera/UI/<Компонент>`:
 * новый примитив без истории роняет тест.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8')

/** Значимые (не `type`) экспорты `src/ui.ts`. */
const uiExports = () =>
  [...read('../../ui.ts').matchAll(/export\s*\{([^}]*)\}/g)].flatMap(match =>
    match[1]!
      .split(',')
      .map(name => name.trim())
      .filter(name => name !== '' && !name.startsWith('type ')),
  )

const uiStoryTitles = () => {
  const dir = new URL('../stories/', import.meta.url)
  return readdirSync(dir)
    .filter(file => file.endsWith('.stories.tsx'))
    .flatMap(file =>
      [
        ...read(`../stories/${file}`).matchAll(
          /title: '(Tessera\/UI\/[^']+)'/g,
        ),
      ].map(match => match[1]!),
    )
}

describe('истории UI-примитивов', () => {
  it('у каждого компонента /ui есть история Tessera/UI/<Компонент>', () => {
    const components = uiExports()
    expect(components.length).toBeGreaterThanOrEqual(10)
    const titles = uiStoryTitles()
    expect(
      components.filter(name => !titles.includes(`Tessera/UI/${name}`)),
    ).toEqual([])
  })

  it('SG5: Segments экспортируется из /ui и имеет историю Tessera/UI/Segments', () => {
    expect(uiExports()).toContain('Segments')
    expect(uiStoryTitles()).toContain('Tessera/UI/Segments')
  })
})
