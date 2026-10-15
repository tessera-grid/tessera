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

  it('BN7: Button экспортируется из /ui и имеет историю Tessera/UI/Button с контролами варианта, иконки, ожидания и выключения', () => {
    expect(uiExports()).toContain('Button')
    expect(uiStoryTitles()).toContain('Tessera/UI/Button')
    const story = read('../stories/UI.Button.stories.tsx')
    for (const arg of ['variant', 'withIcon', 'pending', 'disabled']) {
      expect(story, arg).toMatch(new RegExp(`\\b${arg}:`))
    }
  })

  it('UB5: IconButton экспортируется из /ui; у UI.Button и UI.IconButton есть история «Variants» со всеми вариантами, формами и состояниями', () => {
    expect(uiExports()).toEqual(
      expect.arrayContaining(['Button', 'IconButton']),
    )
    expect(uiStoryTitles()).toContain('Tessera/UI/IconButton')
    const cases = {
      'UI.Button.stories.tsx': ['outline', 'ghost'],
      'UI.IconButton.stories.tsx': ['ghost', 'overlay', 'circle', 'square'],
    }
    for (const [file, variants] of Object.entries(cases)) {
      const story = read(`../stories/${file}`)
      const at = story.indexOf("name: 'Variants'")
      expect(at, `${file}: история «Variants»`).toBeGreaterThan(0)
      const body = story.slice(at)
      for (const variant of variants) expect(body).toContain(`'${variant}'`)
      for (const state of ['pending', 'disabled']) {
        expect(body, `${file}: ${state}`).toMatch(new RegExp(`\\b${state}\\b`))
      }
    }
    expect(
      read('../stories/UI.IconButton.stories.tsx').slice(
        read('../stories/UI.IconButton.stories.tsx').indexOf(
          "name: 'Variants'",
        ),
      ),
    ).toMatch(/\bactive\b/)
  })

  it('SK4: Skeleton экспортируется из /ui и имеет историю Tessera/UI/Skeleton с контролами размера и анимации', () => {
    expect(uiExports()).toContain('Skeleton')
    expect(uiStoryTitles()).toContain('Tessera/UI/Skeleton')
    const story = read('../stories/UI.Skeleton.stories.tsx')
    const argTypes = story.slice(story.indexOf('argTypes:'))
    for (const arg of ['width', 'height', 'animation']) {
      expect(argTypes, arg).toMatch(new RegExp(`\\b${arg}: \\{ control`))
    }
  })

  it('SG5: Segments экспортируется из /ui и имеет историю Tessera/UI/Segments', () => {
    expect(uiExports()).toContain('Segments')
    expect(uiStoryTitles()).toContain('Tessera/UI/Segments')
  })
})
