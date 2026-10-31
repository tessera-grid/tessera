/**
 * Аргументы плагинов историй DataGrid (ADR 0106): имена по правилу и полнота панели
 * Controls — у каждого аргумента-данных есть контрол в общей мете, кроме перечисленных
 * ниже с причиной. Список аргументов — из типа `FeatureToggles`: новая опция фабрики
 * без контрола роняет тест — панель не отстаёт от фич. Показ контролов в историях —
 * только свои и базовый набор (ADR 0117, SN1–SN6); у примитивов `UI/*` — только в
 * `Playground` (SN30).
 * Запуск: npx vitest run --config vitest.node.config.ts storyControls
 */
import { describe, expect, it } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import {
  type FeatureToggles,
  argsToPlugins,
} from '../stories/__mocks__/utils/argsToPlugins'
import {
  BASE_CONTROLS,
  dataGridArgTypes,
  dataGridDefaultArgs,
} from '../stories/__mocks__/utils/dataGridControls'
import { pluginFactoryNames } from './builtinPlugins'
import { ENTRY, firstParamProps, typeProps } from './publicTypes'

const TYPES_TIMEOUT = 120_000

/** Аргументы-данные без контрола: панелью их не задать или нужна своя история. */
const WITHOUT_CONTROL: Record<string, string> = {
  paginationPagination: 'страница у приложения — своя история',
  paginationInitialPagination: 'страница у приложения — своя история',
  paginationModelPagination: 'страница у приложения — своя история',
  paginationModelInitialPagination: 'страница у приложения — своя история',
  columnFilteringDateLocale: 'локаль календаря — объект с функциями',
  columnFilteringColumnFilters: 'фильтры у приложения — своя история',
  columnFilteringInitialColumnFilters: 'фильтры у приложения — своя история',
  columnFilteringModelColumnFilters: 'фильтры у приложения — своя история',
  columnFilteringModelInitialColumnFilters:
    'фильтры у приложения — своя история',
  quickSearchGlobalFilter: 'строка поиска у приложения — своя история',
  quickSearchInitialGlobalFilter: 'строка поиска у приложения — своя история',
  quickSearchModelGlobalFilter: 'строка поиска у приложения — своя история',
  quickSearchModelInitialGlobalFilter:
    'строка поиска у приложения — своя история',
  dataExportFormats: 'форматы — объекты с функциями',
  dataExportPresets: 'быстрые наборы задаёт история',
  dataExportModelFormats: 'форматы — объекты с функциями',
  dataExportModelPresets: 'быстрые наборы задаёт история',
  dataExportModelAllow: 'оси своей кнопки выгрузки задаёт история',
  infiniteScrollHasMore: 'конец ленты знает история с сервером',
  headerActionMenuSlots: 'список кнопок — из кода плагинов',
  cellEditingEditing: 'состояние правки у приложения — своя история',
  cellEditingInitialEditing: 'состояние правки у приложения — своя история',
  columnSortingSorting: 'порядок сортировки у приложения — своя история',
  columnSortingInitialSorting: 'порядок сортировки у приложения — своя история',
  columnSortingModelSorting: 'порядок сортировки у приложения — своя история',
  columnSortingModelInitialSorting:
    'порядок сортировки у приложения — своя история',
  rowGroupingGrouping: 'группировка у приложения — своя история',
  rowGroupingInitialGrouping: 'группировка у приложения — своя история',
  rowGroupingModelGrouping: 'группировка у приложения — своя история',
  rowGroupingModelInitialGrouping: 'группировка у приложения — своя история',
  rowExpandingExpanded:
    'раскрытие у приложения — истории задают его `expandAll`',
  rowExpandingInitialExpanded:
    'раскрытие у приложения — истории задают его `expandAll`',
  rowExpandingModelExpanded:
    'раскрытие у приложения — истории задают его `expandAll`',
  rowExpandingModelInitialExpanded:
    'раскрытие у приложения — истории задают его `expandAll`',
  rowSelectionIsAllRowsSelected: 'выбор всех строк ведёт демо-панель истории',
  cellSelectionCellSelection: 'выделение у приложения — своя история',
  cellSelectionInitialCellSelection: 'выделение у приложения — своя история',
  cellSelectionModelCellSelection: 'выделение у приложения — своя история',
  cellSelectionModelInitialCellSelection:
    'выделение у приложения — своя история',
  rowSelectionRowSelection: 'выбор у приложения — своя история',
  rowSelectionInitialRowSelection: 'выбор у приложения — своя история',
  rowSelectionModelRowSelection: 'выбор у приложения — своя история',
  rowSelectionModelInitialRowSelection: 'выбор у приложения — своя история',
  onConflict: 'режим конфликта правки задаёт история',
}

/** Аргументы историй вне плагинов (не подчиняются правилу `<фабрика><Опция>`). */
const STORY_ONLY = ['actionsDemo']

const capitalize = (name: string) => name[0]!.toUpperCase() + name.slice(1)
const uncapitalize = (name: string) => name[0]!.toLowerCase() + name.slice(1)

const toggles = () => typeProps(ENTRY.storyToggles, 'FeatureToggles')

const entriesOf = (args: FeatureToggles): readonly TesseraFeatureEntry[] =>
  argsToPlugins(args)

describe('аргументы плагинов историй DataGrid', () => {
  it(
    'FN5: у каждой фабрики тумблер `enable<Фабрика>`, подопции — `<фабрика><Опция>`, колбэки — `on*` из API',
    () => {
      const factories = pluginFactoryNames()
      const optionsOf = new Map(
        factories.map(name => [
          name,
          firstParamProps(ENTRY.plugins, name).map(prop => prop.name),
        ]),
      )
      const names = toggles().map(prop => prop.name)

      expect(
        factories.filter(name => !names.includes(`enable${capitalize(name)}`)),
      ).toEqual([])

      // Самая длинная фабрика-префикс: `rowActions` и `rowActionMenu` не путаются.
      const ownerOf = (name: string) =>
        factories
          .filter(
            factory =>
              name.startsWith(factory) &&
              /[A-Z]/.test(name[factory.length] ?? ''),
          )
          .sort((a, b) => b.length - a.length)[0]
      const wrong = names.filter(name => {
        if (STORY_ONLY.includes(name)) return false
        const toggled = factories.find(
          factory => name === `enable${capitalize(factory)}`,
        )
        if (toggled) return false
        if (/^on[A-Z]/.test(name)) {
          return !factories.some(factory =>
            optionsOf.get(factory)!.includes(name),
          )
        }
        const owner = ownerOf(name)
        if (!owner) return true
        const option = uncapitalize(name.slice(owner.length))
        return option === 'enabled' || !optionsOf.get(owner)!.includes(option)
      })
      expect(wrong).toEqual([])
    },
    TYPES_TIMEOUT,
  )
})

describe('панель Controls историй DataGrid', () => {
  it(
    'у каждого аргумента-данных есть контрол, кроме функций, колбэков и перечисленных с причиной',
    () => {
      const props = toggles()
      expect(props.length).toBeGreaterThan(60)
      const data = props.filter(prop => !prop.isFunction).map(prop => prop.name)
      const missing = data.filter(
        name => !(name in dataGridArgTypes) && !(name in WITHOUT_CONTROL),
      )
      expect(missing).toEqual([])
      const stale = Object.keys(WITHOUT_CONTROL).filter(
        name => !data.includes(name) || name in dataGridArgTypes,
      )
      expect(stale).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it(
    'значения по умолчанию дают ту же настройку плагинов, что фабрики без аргументов',
    () => {
      const allOn = Object.fromEntries(
        toggles()
          .filter(prop => prop.name.startsWith('enable'))
          .map(prop => [prop.name, true]),
      )
      const bare = entriesOf(allOn)
      const withDefaults = entriesOf({ ...dataGridDefaultArgs, ...allOn })
      // Замыкания фабрик новые на каждый вызов — функции сравниваются по имени.
      const configured = (entries: readonly TesseraFeatureEntry[]) =>
        JSON.stringify(
          entries.map(entry => ({
            id: entry.id,
            options: entry.options,
            actionMenu: entry.actionMenu,
            slots: entry.slots?.map(slot => slot.id),
          })),
          (_, value: unknown) =>
            typeof value === 'function'
              ? `fn:${value.name}`
              : value === undefined
                ? 'undefined'
                : value,
          2,
        )
      expect(configured(withDefaults)).toEqual(configured(bare))
    },
    TYPES_TIMEOUT,
  )

  it('у каждого значения по умолчанию есть контрол', () => {
    expect(
      Object.keys(dataGridDefaultArgs).filter(
        name => !(name in dataGridArgTypes),
      ),
    ).toEqual([])
  })
})

/** Истории с полной панелью Controls. */
const FULL_PANEL: Record<string, string> = {
  DataGridPlayground: 'песочница грида: все фичи вместе',
}

interface ArgType {
  control?: unknown
  if?: { arg?: string; exists?: boolean }
}

interface RawStory {
  name?: string
  tags?: string[]
  args?: Record<string, unknown>
  argTypes?: Record<string, ArgType>
  parameters?: {
    scenario?: string
    controls?: { include?: string[]; exclude?: string[]; disable?: boolean }
    controlsHidden?: Record<string, string>
  }
}

/** Витрины `UI.*` без своего примитива: контролы во всех историях (SN30). */
const UI_SHOWCASES: Record<string, string> = {
  'UI.LoadingAnimations.stories.tsx':
    'витрина анимаций без Playground: замедление нужно во всех её историях',
}

/** Файлы без `Playground` (SN31): песочнице раздела нечего крутить. */
const WITHOUT_PLAYGROUND: Record<string, string> = {
  ...UI_SHOWCASES,
}

/** Служебный раздел: песочницы обвязки и истории только для снимков (ADR 0117 §8). */
const COMMON = 'Tessera/Common/'

const titleOf = (meta: unknown) => (meta as { title?: string })?.title ?? ''

interface StoryEntry {
  id: string
  title: string
  story: RawStory
  argTypes: Record<string, ArgType>
}

const storyModules = import.meta.glob<Record<string, RawStory>>(
  '../stories/*.stories.tsx',
)

/** Истории на общей мете: в `argTypes` меты — все контролы `dataGridArgTypes`. */
const sharedMetaStories = async (): Promise<StoryEntry[]> => {
  const entries: StoryEntry[] = []
  for (const [path, load] of Object.entries(storyModules)) {
    const { default: meta, ...stories } = await load()
    const metaTypes = meta?.argTypes ?? {}
    if (!Object.keys(dataGridArgTypes).every(name => name in metaTypes)) {
      continue
    }
    for (const [name, story] of Object.entries(stories)) {
      // Близнец высокой контрастности повторяет контролы своей истории (ADR 0093, VR17).
      if (story.tags?.includes('!test')) continue
      entries.push({
        id: `${path.replace('../stories/', '')} ${name}`,
        title: titleOf(meta),
        story,
        argTypes: { ...metaTypes, ...story.argTypes },
      })
    }
  }
  return entries
}

const exportName = (entry: StoryEntry) => entry.id.split(' ')[1]!
const isSandbox = (entry: StoryEntry) => exportName(entry) in FULL_PANEL
const shown = (entry: StoryEntry) =>
  entry.story.parameters?.controls?.include ?? []
const hiddenBase = (entry: StoryEntry) =>
  entry.story.parameters?.controlsHidden ?? {}
const hasControl = (type: ArgType | undefined) =>
  type !== undefined && type.control !== false

const STORIES_TIMEOUT = 60_000

describe('контролы историй DataGrid (ADR 0117)', () => {
  it(
    'SN1: история, кроме песочниц, показывает только базовый набор и свой список; базовый контрол убран только с причиной',
    async () => {
      const stories = await sharedMetaStories()
      expect(stories.length).toBeGreaterThan(100)
      const wrong = stories
        .filter(entry => !isSandbox(entry))
        .flatMap(entry => {
          const include = entry.story.parameters?.controls?.include
          if (!include) return [`${entry.id}: полная панель`]
          const hidden = hiddenBase(entry)
          return [
            ...BASE_CONTROLS.filter(
              name => !(name in hidden) && !include.includes(name),
            ).map(name => `${entry.id}: нет базового ${name}`),
            ...Object.entries(hidden)
              .filter(([, reason]) => reason.trim() === '')
              .map(([name]) => `${entry.id}: ${name} убран без причины`),
          ]
        })
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN2: имена списка и скрытых контролов объявлены в argTypes или заданы в args; скрыть можно только базовый',
    async () => {
      const wrong = (await sharedMetaStories()).flatMap(entry => [
        ...shown(entry)
          .filter(
            name =>
              !(name in entry.argTypes) && !(name in (entry.story.args ?? {})),
          )
          .map(name => `${entry.id}: неизвестный ${name}`),
        ...Object.keys(hiddenBase(entry))
          .filter(name => !(BASE_CONTROLS as readonly string[]).includes(name))
          .map(name => `${entry.id}: ${name} не из базового набора`),
      ])
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN3: каждый аргумент истории с объявленным контролом показан',
    async () => {
      const wrong = (await sharedMetaStories())
        .filter(entry => !isSandbox(entry))
        .flatMap(entry =>
          Object.keys(entry.story.args ?? {})
            .filter(
              name =>
                hasControl(entry.argTypes[name]) &&
                !shown(entry).includes(name),
            )
            .map(name => `${entry.id}: ${name} задан, но скрыт`),
        )
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN4: зависимый контрол показан только вместе с контролом, от которого зависит',
    async () => {
      const wrong = (await sharedMetaStories())
        .filter(entry => !isSandbox(entry))
        .flatMap(entry =>
          shown(entry)
            .map(name => [name, entry.argTypes[name]?.if] as const)
            .filter(
              ([, condition]) =>
                condition?.arg !== undefined &&
                condition.exists !== false &&
                hasControl(entry.argTypes[condition.arg]) &&
                !shown(entry).includes(condition.arg),
            )
            .map(
              ([name, condition]) =>
                `${entry.id}: ${name} без ${condition!.arg}`,
            ),
        )
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN5: полная панель — только у песочниц из списка с причиной',
    async () => {
      const stories = await sharedMetaStories()
      const wrong = Object.entries(FULL_PANEL).flatMap(([name, reason]) => {
        const entry = stories.find(story => exportName(story) === name)
        if (!entry) return [`${name}: истории нет`]
        if (entry.story.parameters?.controls?.include) {
          return [`${name}: у песочницы есть список`]
        }
        return reason.trim() === '' ? [`${name}: без причины`] : []
      })
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN28: история сценария с гайдом не показывает контролов — базовые скрыты с причиной, своего списка и args нет, вкладка Controls скрыта; у файла есть Playground с контролами; песочницы Tessera/Common правило не касается',
    async () => {
      const stories = await sharedMetaStories()
      const fileOf = (entry: StoryEntry) => entry.id.split(' ')[0]!
      // Песочницы обвязки `Tessera/Common` — не разделы фич: Playground у них нет (SN31).
      const scenarios = stories.filter(
        entry =>
          entry.story.parameters?.scenario && !entry.title.startsWith(COMMON),
      )
      expect(
        stories.some(
          entry =>
            entry.story.parameters?.scenario && entry.title.startsWith(COMMON),
        ),
      ).toBe(true)
      const problems = (entry: StoryEntry) => {
        const hidden = hiddenBase(entry)
        return [
          ...shown(entry).map(name => `${entry.id}: показан ${name}`),
          ...BASE_CONTROLS.filter(name => !hidden[name]?.trim()).map(
            name => `${entry.id}: базовый ${name} не скрыт с причиной`,
          ),
          ...(entry.story.args ? [`${entry.id}: есть args`] : []),
          // Пустой `include` Storybook не применяет и показывает всю панель.
          ...(entry.story.parameters?.controls?.disable === true
            ? []
            : [`${entry.id}: вкладка Controls не скрыта`]),
        ]
      }
      const files = new Set(scenarios.map(fileOf))
      const wrong = [...files].flatMap(file => {
        const sandbox = stories.find(
          entry =>
            fileOf(entry) === file &&
            entry.story.name === 'Playground' &&
            shown(entry).length > 0,
        )
        return [
          ...scenarios
            .filter(entry => fileOf(entry) === file)
            .flatMap(problems),
          ...(sandbox ? [] : [`${file}: нет Playground с контролами`]),
        ]
      })
      expect(wrong).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it('SN6: базовые dataCount и columnCount скрыты условием при dataOverride и columnsOverride', () => {
    expect(dataGridArgTypes.dataCount.if).toEqual({
      arg: 'dataOverride',
      exists: false,
    })
    expect(dataGridArgTypes.columnCount.if).toEqual({
      arg: 'columnsOverride',
      exists: false,
    })
  })

  it(
    'SN30: истории UI.<Компонент> — первая Playground с явным списком контролов, у остальных историй файла вкладка Controls скрыта; витрина без Playground — только в исключениях с причиной',
    async () => {
      const problems: string[] = []
      for (const [path, load] of Object.entries(storyModules)) {
        const file = path.split('/').pop()!
        if (!file.startsWith('UI.')) continue
        const { default: meta, ...stories } = await load()
        // Порядок экспортов модуля — порядок историй в файле.
        const order = Object.keys(stories)
        const controlsOf = (id: string) => ({
          ...meta?.parameters?.controls,
          ...stories[id]?.parameters?.controls,
        })
        // Скрыта вкладка целиком: пустой `include` историям со своим `render` и `play`
        // Storybook не применяет и показывает таблицу пропов.
        const hidden = (id: string) => controlsOf(id).disable === true
        if (UI_SHOWCASES[file]) {
          if (order.some(id => id.endsWith('Playground'))) {
            problems.push(`${file}: в исключениях, но есть Playground`)
          }
          continue
        }
        const [first, ...rest] = order
        if (
          !first?.endsWith('Playground') ||
          stories[first]?.name !== 'Playground'
        ) {
          problems.push(`${file}: первая история — не Playground`)
        } else if (
          controlsOf(first).disable === true ||
          !stories[first]?.parameters?.controls?.include?.length
        ) {
          problems.push(
            `${file}: у Playground нет явного списка контролов (defaultControls)`,
          )
        }
        for (const id of rest) {
          if (!hidden(id))
            problems.push(`${file} ${id}: вкладка Controls не скрыта`)
        }
      }
      const unknown = Object.keys(UI_SHOWCASES).filter(
        file =>
          !Object.keys(storyModules).some(path => path.endsWith(`/${file}`)),
      )
      expect([...problems, ...unknown]).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN31: каждый файл вне Tessera/Common начинается историей Playground; историй Default и Basic нет; файл без Playground — только в списке с причиной',
    async () => {
      const problems: string[] = []
      const files: string[] = []
      for (const [path, load] of Object.entries(storyModules)) {
        const file = path.split('/').pop()!
        const { default: meta, ...stories } = await load()
        if (titleOf(meta).startsWith(COMMON)) continue
        files.push(file)
        const order = Object.keys(stories)
        for (const id of order) {
          const name = stories[id]?.name ?? id
          if (name === 'Default' || name === 'Basic') {
            problems.push(`${file} ${id}: история ${name}`)
          }
        }
        const hasPlayground = order.some(id => id.endsWith('Playground'))
        if (file in WITHOUT_PLAYGROUND) {
          if (hasPlayground) {
            problems.push(`${file}: в исключениях, но есть Playground`)
          }
          continue
        }
        const [first] = order
        if (
          !first?.endsWith('Playground') ||
          stories[first]?.name !== 'Playground'
        ) {
          problems.push(`${file}: первая история — не Playground`)
        }
      }
      const unknown = Object.keys(WITHOUT_PLAYGROUND)
        .filter(file => !files.includes(file))
        .map(file => `${file}: в исключениях, но файла нет`)
      expect([...problems, ...unknown]).toEqual([])
    },
    STORIES_TIMEOUT,
  )

  it(
    'SN32: Playground показывает свои контролы сверх базового набора — тумблер или подопцию фичи, проп примитива или свой argTypes; полная панель — только у DataGrid/Playground',
    async () => {
      const problems: string[] = []
      for (const [path, load] of Object.entries(storyModules)) {
        const file = path.split('/').pop()!
        const { default: meta, ...stories } = await load()
        if (titleOf(meta).startsWith(COMMON)) continue
        const id = Object.keys(stories).find(name =>
          name.endsWith('Playground'),
        )
        const story = id ? stories[id] : undefined
        if (!id || !story) continue
        const metaTypes = meta?.argTypes ?? {}
        const include = story.parameters?.controls?.include
        if (Object.keys(dataGridArgTypes).every(name => name in metaTypes)) {
          if (id in FULL_PANEL) {
            if (include) problems.push(`${file} ${id}: не полная панель`)
          } else if (!include) {
            problems.push(`${file} ${id}: полная панель`)
          } else if (
            include.every(name =>
              (BASE_CONTROLS as readonly string[]).includes(name),
            )
          ) {
            problems.push(`${file} ${id}: только базовый набор`)
          }
        } else if (story.parameters?.controls?.disable === true) {
          problems.push(`${file} ${id}: вкладка Controls скрыта`)
        } else if (
          !include?.length &&
          Object.keys({ ...metaTypes, ...story.argTypes }).length === 0
        ) {
          problems.push(`${file} ${id}: нет своих контролов`)
        }
      }
      expect(problems).toEqual([])
    },
    STORIES_TIMEOUT,
  )
})
