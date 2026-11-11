import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { filteringColumns, filteringData } from './__mocks__/filteringData'
import { vrStates } from './__mocks__/catalog'
import { byTestId, guideNext, settle, until } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/**
 * Тулбар (ADR 0035, ADR 0051): `Playground` — все встроенные кнопки; до прихода
 * данных — сценарии S1–S3 ADR 0122; свой порядок кнопок — S1 ADR 0205.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Toolbar',
} satisfies Meta<StoryProps>

export default meta

export const ToolbarPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('panel.toolbar'),
    ...showControls([
      'enableToolbar',
      'enableColumnVisibility',
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'timeZone',
      'enableDataExport',
      'dataExportAllow',
      'dataExportFilename',
    ]),
  },
  args: {
    // Все встроенные кнопки (ADR 0051): слева поиск и «Фильтры», справа «Колонки», затем
    // «Экспорт». Выключите все кнопки и включите enableToolbar — останется пустой тулбар.
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    enableColumnVisibility: true,
    enableDataExport: true,
    // Грид в окне матрицы контраста (ADR 0089, CX16).
    height: '460',
    maxHeight: '460',
  },
}

// --- До прихода данных (ADR 0122) -----------------------------------------------------

/** Область фиксированной высоты: скелет и таблица одного размера. */
const FIXED_HEIGHT = {
  containerHeight: '600',
  height: '500',
  maxHeight: '500',
} as const

const TOOLBAR_ARGS = {
  ...FIXED_HEIGHT,
  columnCount: 6,
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnVisibility: true,
  enableDataExport: true,
} satisfies Partial<StoryProps>

/** Грид открыт, данных ещё нет. */
const OPENED: GuideStoryStep = {
  title: 'Данные загружаются',
  hint: 'Данные ещё не пришли. Поиск и настройки вида уже работают, их результат станет запросом к данным. Выгружать пока нечего, поэтому на месте кнопки выгрузки — состояние загрузки.',
  props: () => ({ loading: 'initial', dataOverride: [] }),
}

/** Ответ сервера: данные и конец загрузки приходят одним обновлением. */
const ANSWERED: GuideStoryStep = {
  title: 'Данные загружены',
  hint: 'Данные пришли. Кнопка выгрузки встаёт на место состояния загрузки, остальные кнопки тулбара не сдвигаются.',
  props: ({ rows }) => ({ loading: false, dataOverride: rows }),
}

/** Бокс в координатах тулбара: панель шагов над гридом меняет высоту от шага к шагу. */
const rect = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect()
  const origin = byTestId('data-grid-toolbar')?.getBoundingClientRect()
  return {
    left: left - (origin?.left ?? 0),
    top: top - (origin?.top ?? 0),
    width,
    height,
  }
}
const expectSameBox = async (
  actual: ReturnType<typeof rect>,
  expected: ReturnType<typeof rect>,
) => {
  for (const key of ['left', 'top', 'width', 'height'] as const) {
    await expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(0.5)
  }
}
const skeletonRow = (canvas: HTMLElement) =>
  canvas.querySelector('.data-grid__body-row--skeleton')
const waitTestId = (id: string) =>
  until(() => expect(byTestId(id)).not.toBeNull())

// --- S1 ------------------------------------------------------------------------------

const INITIAL_LOADING: readonly GuideStoryStep[] = [OPENED, ANSWERED]

/** S1: клиентские данные — до них работают все функции тулбара, кроме экспорта. */
export const ToolbarInitialLoading: StoryObj<StoryProps> = {
  name: 'Initial loading',
  parameters: {
    scenario: '0122/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Тулбар до прихода данных"
      steps={INITIAL_LOADING}
      args={guideArgs(TOOLBAR_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    let skeleton = rect(canvas)
    let view = rect(canvas)
    await step(INITIAL_LOADING[0]!.title, async () => {
      await waitTestId('export-skeleton')
      await waitTestId('quick-search')
      await expect(byTestId('export-button')).toBeNull()
      await expect(byTestId('view-settings-button')).not.toBeNull()
      await expect(
        byTestId('quick-search')!.getAttribute('aria-disabled'),
      ).not.toBe('true')
      skeleton = rect(byTestId('export-skeleton')!)
      view = rect(byTestId('view-settings-button')!)
    })
    await step(INITIAL_LOADING[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('export-button')
      await expectSameBox(rect(byTestId('export-button')!), skeleton)
      await expectSameBox(rect(byTestId('view-settings-button')!), view)
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

/** Запрос, который пользователь вводит до прихода данных. */
const QUERY = 'an'
/** Запросы, ушедшие «серверу» через `onSearchChange`. */
const searchRequests: string[] = []

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (text: string) => (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="quick-search"]',
  )
  if (!input) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const matches = (row: Record<string, unknown>) =>
  Object.values(row).some(value => String(value).toLowerCase().includes(QUERY))

const SEARCH_BEFORE_DATA: readonly GuideStoryStep[] = [
  {
    ...OPENED,
    hint: 'Данные ещё не пришли, а поиск идёт на сервере. Поле поиска уже доступно, тело таблицы в состоянии загрузки.',
  },
  {
    title: `Пользователь ищет «${QUERY}» до прихода данных`,
    hint: 'Пользователь ввёл запрос, не дожидаясь данных. Запрос сразу ушёл приложению, тело таблицы по-прежнему ждёт ответа.',
    enter: typeSearch(QUERY),
  },
  {
    title: 'Сервер ответил по запросу',
    hint: 'Сервер вернул строки по запросу пользователя. Таблица показывает только найденные строки.',
    props: ({ rows }) => ({
      loading: false,
      dataOverride: rows.filter(matches),
    }),
  },
]

/** S2: серверный поиск до прихода данных — запрос уходит приложению сразу. */
export const ToolbarSearchBeforeDataServer: StoryObj<StoryProps> = {
  name: 'Search before data (server)',
  parameters: {
    scenario: '0122/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Серверный поиск до прихода данных"
      steps={SEARCH_BEFORE_DATA}
      args={guideArgs(
        {
          ...FIXED_HEIGHT,
          columnCount: 6,
          dataCount: 40,
          enableQuickSearch: true,
          dataMode: { search: 'server' },
          onSearchChange: search => {
            searchRequests.push(search)
          },
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    searchRequests.length = 0
    const dataRows = () => canvas.querySelectorAll('.data-grid__body-row')
    await step(SEARCH_BEFORE_DATA[0]!.title, async () => {
      await waitTestId('quick-search')
      await expect(dataRows()).toHaveLength(0)
      await expect(skeletonRow(canvas)).not.toBeNull()
    })
    await step(SEARCH_BEFORE_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(searchRequests.at(-1)).toBe(QUERY))
      await expect(dataRows()).toHaveLength(0)
      await expect(skeletonRow(canvas)).not.toBeNull()
    })
    await step(SEARCH_BEFORE_DATA[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(dataRows().length).toBeGreaterThan(0))
      for (const row of dataRows()) {
        await expect(row.textContent!.toLowerCase()).toContain(QUERY)
      }
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const COLUMNS_ARRIVE: readonly GuideStoryStep[] = [
  {
    title: 'Ожидание списка колонок от сервера',
    hint: 'Структура таблицы ещё неизвестна. Поле поиска, кнопка настроек вида, кнопка выгрузки и тело таблицы в состоянии загрузки.',
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: 'Колонки загружены',
    hint: 'Сервер вернул список колонок, данные ещё не пришли. Поле поиска и кнопка настроек вида встают на место состояния загрузки, кнопка выгрузки ждёт данных.',
    props: () => ({ columnsOverride: undefined }),
  },
  ANSWERED,
]

/** S3: колонки приходят с сервера — контролы над колонками ждут их скелетом. */
export const ToolbarColumnsArrive: StoryObj<StoryProps> = {
  name: 'Columns arrive',
  parameters: {
    scenario: '0122/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Колонки приходят с сервера"
      steps={COLUMNS_ARRIVE}
      args={guideArgs(TOOLBAR_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let field = rect(canvas)
    let columns = rect(canvas)
    await step(COLUMNS_ARRIVE[0]!.title, async () => {
      await waitTestId('quick-search-skeleton')
      await waitTestId('view-settings-skeleton')
      await waitTestId('export-skeleton')
      await expect(skeletonRow(canvas)).not.toBeNull()
      field = rect(byTestId('quick-search-skeleton')!)
      columns = rect(byTestId('view-settings-skeleton')!)
    })
    await step(COLUMNS_ARRIVE[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('quick-search')
      await waitTestId('view-settings-button')
      await expectSameBox(rect(byTestId('quick-search')!.parentElement!), field)
      await expectSameBox(rect(byTestId('view-settings-button')!), columns)
      await expect(byTestId('export-skeleton')).not.toBeNull()
    })
    await step(COLUMNS_ARRIVE[2]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('export-button')
    })
    await settle()
  },
}

// --- ADR 0205, S1 -----------------------------------------------------------------------

const OWN_ORDER_ARGS = {
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnSorting: true,
  enableColumnVisibility: true,
  enableDataExport: true,
  columnCount: 5,
  dataCount: 30,
  containerHeight: '420',
  height: '320',
  maxHeight: '320',
} satisfies Partial<StoryProps>

/** «Экспорт» — в левой группе, в её конце. */
const EXPORT_LEFT = {
  group: 'search',
  align: 'start',
  order: 'last',
} as const

const box = (testId: string) =>
  byTestId(testId)?.getBoundingClientRect() ?? null

const OWN_ORDER: readonly GuideStoryStep[] = [
  {
    title: 'Кнопки на местах по умолчанию',
    hint: 'Слева — поле поиска, справа — кнопка настроек вида и выгрузка.',
  },
  {
    title: 'Выгрузка слева',
    hint: 'Приложение поставило кнопку выгрузки в левую группу, сразу после поля поиска. Стрелки клавиатуры проходят кнопки тулбара в новом порядке.',
    props: () => ({ dataExportToolbar: EXPORT_LEFT }),
  },
  {
    title: 'Поле поиска убрано',
    hint: 'Приложению поле поиска не нужно — его больше нет, выгрузка встала первой слева.',
    props: () => ({ quickSearchToolbar: false }),
  },
]

/** ADR 0205, S1: приложение переносит «Экспорт» влево и убирает поле поиска. */
export const ToolbarOwnOrder: StoryObj<StoryProps> = {
  name: 'Own button order',
  parameters: {
    scenario: '0205/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Свой порядок кнопок"
      steps={OWN_ORDER}
      args={guideArgs(OWN_ORDER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_ORDER[0]!.title, async () => {
      await until(() => expect(box('export-button')).not.toBeNull())
      await until(() => expect(box('quick-search')).not.toBeNull())
      await expect(box('export-button')!.left).toBeGreaterThan(
        box('view-settings-button')!.right,
      )
    })
    await step(OWN_ORDER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(box('export-button')!.right).toBeLessThan(
          box('view-settings-button')!.left,
        ),
      )
      await expect(box('export-button')!.left).toBeGreaterThan(
        box('quick-search')!.right,
      )
      await settle()
    })
    await step(OWN_ORDER[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(box('quick-search')).toBeNull())
      await expect(box('export-button')!.right).toBeLessThan(
        box('view-settings-button')!.left,
      )
      await settle()
    })
  },
}
