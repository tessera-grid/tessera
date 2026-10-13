/**
 * Аргументы плагинов историй DataGrid (ADR 0106): имена по правилу и полнота панели
 * Controls — у каждого аргумента-данных есть контрол в общей мете, кроме перечисленных
 * ниже с причиной. Список аргументов — из типа `FeatureToggles`: новая опция фабрики
 * без контрола роняет тест — панель не отстаёт от фич.
 * Запуск: npx vitest run --config vitest.node.config.ts storyControls
 */
import { describe, expect, it } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import {
  type FeatureToggles,
  argsToPlugins,
} from '../stories/__mocks__/utils/argsToPlugins'
import {
  dataGridArgTypes,
  dataGridDefaultArgs,
} from '../stories/__mocks__/utils/dataGridControls'
import { pluginFactoryNames } from './builtinPlugins'
import { ENTRY, firstParamProps, typeProps } from './publicTypes'

const TYPES_TIMEOUT = 120_000

/** Аргументы-данные без контрола: панелью их не задать или нужна своя история. */
const WITHOUT_CONTROL: Record<string, string> = {
  paginationServer: 'без имитации сервера ломает показ — своя история',
  paginationRowCount: 'только вместе с paginationServer',
  columnFilteringServer: 'без имитации сервера ломает показ — своя история',
  columnFilteringFilteredRowCount: 'только вместе с columnFilteringServer',
  columnFilteringTotalRowCount: 'только вместе с columnFilteringServer',
  columnFilteringDateLocale: 'локаль календаря — объект с функциями',
  quickSearchServer: 'без имитации сервера ломает показ — своя история',
  dataExportServer: 'без имитации сервера ломает показ — своя история',
  dataExportFormats: 'форматы — объекты с функциями',
  dataExportPresets: 'быстрые наборы задаёт история',
  infiniteScrollHasMore: 'конец ленты знает история с сервером',
  infiniteScrollRowCount: 'итог знает история с сервером',
  headerActionMenuSlots: 'список кнопок — из кода плагинов',
  cellEditingEditing: 'состояние правки у приложения — своя история',
  keyboardNavigationActiveCell: 'активная ячейка у приложения — своя история',
  rowSelectionIsAllRowsSelected: 'выбор всех строк ведёт демо-панель истории',
  onConflict: 'режим конфликта правки задаёт история',
  actionsDemo:
    'набор демо-действий задаёт история — у каждого набора своя история',
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
