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

/** Модули кита с компонентом: файл `ui/**` с именем с заглавной буквы. */
const kitModules = (dir = '../ui/'): string[] =>
  readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap(
    entry =>
      entry.isDirectory()
        ? kitModules(`${dir}${entry.name}/`)
        : /^[A-Z]\w*\.tsx$/.test(entry.name)
          ? [`${dir.slice('../ui/'.length)}${entry.name.slice(0, -4)}`]
          : [],
  )

/** Имена, под которыми история покрывает модуль: имя файла и его компонентов. */
const coveringNames = (module: string) => [
  module.split('/').at(-1)!,
  ...[...read(`../ui/${module}.tsx`).matchAll(/export const ([A-Z]\w*)/g)].map(
    match => match[1]!,
  ),
]

/** Последняя часть подписи истории и все её части слитно: `Popup/Group` — `Group`, `PopupGroup`. */
const titleNames = (title: string) => {
  const parts = title.slice('Tessera/UI/'.length).split('/')
  return [parts.at(-1)!, parts.join('')]
}

/** Модули кита без своей истории — с причиной. */
const WITHOUT_STORY: Record<string, string> = {
  'Checkbox/CheckboxView':
    'вид флажка только для чтения — история Checkbox «Read only»',
  'CellIssue/CellIssuePopup':
    'ленивый поповер отметки — история CellIssue «Popover open»',
  'Tooltip/TooltipImpl': 'ленивый попап подсказки — история Tooltip «Open»',
  'buttonStates/PendingArc':
    'дуга ожидания кнопок — история «Loading animations»',
  'cellControls/CellInvalid':
    'невидимая метка: ставит ячейке aria-invalid, вида у неё нет',
  'icons/IconsContext': 'контекст набора иконок, не компонент вида',
  'icons/SvgIcon': 'обёртка значков набора — истории кнопок и Stub',
  'icons/EmptyStateIllustration':
    'иллюстрация заглушки — история Stub «Playground»',
  'Popup/ItemButton':
    'кнопка пункта и записи поповера — кнопки записей в истории Popup/Entry',
}

/** Компоненты кита поповеров и контролы этапа 2 (ADR 0183, PK8). */
const POPUP_KIT = [
  'PopupSurface',
  'PopupPanel',
  'PopupItem',
  'PopupGroup',
  'PopupEntry',
  'MenuItems',
  'MenuSections',
  'HandleMenuPopup',
  'Field',
  'SearchField',
  'Checklist',
  'Calendar',
  'SelectTrigger',
  'Radio',
  'Checkbox',
  'StatusIcon',
]

/** Файлы с попапом Base UI в `src/lib/<dir>`: путь от `src/lib` без расширения. */
const popupFiles = (dir: string): string[] =>
  readdirSync(new URL(`../${dir}/`, import.meta.url), {
    withFileTypes: true,
  }).flatMap(entry =>
    entry.isDirectory()
      ? popupFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith('.tsx') &&
          /@base-ui\/react\/(popover|menu|combobox|select|context-menu)'/.test(
            read(`../${dir}/${entry.name}`),
          )
        ? [`${dir}/${entry.name.slice(0, -4)}`]
        : [],
  )

describe('истории UI-примитивов', () => {
  it('PK22: у каждого модуля кита ui/ с компонентом есть история Tessera/UI/… или причина без неё', () => {
    const modules = kitModules()
    expect(modules.length).toBeGreaterThanOrEqual(40)
    const covered = new Set(uiStoryTitles().flatMap(titleNames))
    expect(
      modules.filter(
        module =>
          !(module in WITHOUT_STORY) &&
          !coveringNames(module).some(name => covered.has(name)),
      ),
    ).toEqual([])
    // Список без устаревших записей: модуль существует и своей истории у него нет.
    expect(
      Object.keys(WITHOUT_STORY).filter(
        module =>
          !modules.includes(module) ||
          coveringNames(module).some(name => covered.has(name)),
      ),
    ).toEqual([])
  })

  it('PK8: у компонентов кита поповеров и контролов этапа 2 есть история: первой Playground с контролами, состояния без контролов', () => {
    const covered = new Set(uiStoryTitles().flatMap(titleNames))
    expect(POPUP_KIT.filter(name => !covered.has(name))).toEqual([])
    for (const name of POPUP_KIT) {
      const file = `../stories/UI.${name}.stories.tsx`
      const story = read(file)
      const exports = [...story.matchAll(/^export const (\w+)/gm)].map(
        match => match[1]!,
      )
      expect(exports[0], name).toMatch(/Playground$/)
      const rest = story.slice(story.indexOf(`export const ${exports[1]}`))
      expect(rest, name).not.toMatch(/defaultControls\(/)
    }
  })

  it('PK9: каждый файл с попапом Base UI в grid/ и plugins/ — на шаге гайда PopupAssembled, у каждого поповера гайда есть шаг', () => {
    const guide = read('../stories/UI.PopupAssembled.stories.tsx')
    const named = [...guide.matchAll(/'((?:grid|plugins)\/[\w./-]+)'/g)].map(
      match => match[1]!,
    )
    const files = popupFiles('grid').concat(popupFiles('plugins'))
    expect(files.length).toBeGreaterThanOrEqual(14)
    expect(files.filter(file => !named.includes(file))).toEqual([])
    expect(named.filter(file => !files.includes(file))).toEqual([])
    const ids = [...guide.matchAll(/^ {4}id: '(\w+)',/gm)].map(
      match => match[1]!,
    )
    const steps = [...guide.matchAll(/expectPopup\(canvas, '(\w+)'\)/g)].map(
      match => match[1]!,
    )
    expect(steps).toEqual(ids)
  })

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
