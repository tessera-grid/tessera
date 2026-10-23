import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { toolbarDemoPlugins } from './toolbarDemo'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { filteringColumns, filteringData } from './__mocks__/filteringData'
import { vrStates } from './__mocks__/catalog'
import { byTestId, guideNext, settle, until } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Тулбар (ADR 0035, ADR 0051): кнопки плагинов, все кнопки, пустой тулбар; до прихода
 * данных — сценарии S1–S3 ADR 0122.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Toolbar',
} satisfies Meta<StoryProps>

export default meta

export const ToolbarPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableToolbar',
    'enableColumnVisibility',
    'enableQuickSearch',
    'enableColumnFiltering',
    'enableDataExport',
  ]),
  args: {
    // Демо-кнопки в двух подгруппах (`view` и `data`): видны порядок, разделитель
    // и состояния F4 — активное (Settings) и disabled (Export). Тулбар вызывают
    // сами кнопки — флаг не нужен (ADR 0046).
    extraPlugins: toolbarDemoPlugins,
  },
}

export const ToolbarAllButtons: StoryObj<StoryProps> = {
  name: 'All buttons',
  parameters: {
    ...vrStates('panel.toolbar'),
    ...showControls([
      'enableColumnVisibility',
      'enableQuickSearch',
      'quickSearchDebounceMs',
      'quickSearchFilteredCount',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
      'enableDataExport',
      'dataExportAllow',
      'dataExportFilename',
    ]),
  },
  args: {
    // Все встроенные кнопки разом (ADR 0051): слева поиск и «Фильтры», справа
    // «Колонки», затем «Экспорт». Порядок задают группы search → view → data, а не
    // порядок плагинов. Сузьте окно — поле поиска сжимается, стороны не наезжают.
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

export const WithEmptyToolbar: StoryObj<StoryProps> = {
  name: 'Empty',
  parameters: showControls(['enableToolbar']),
  args: {
    // Пустой тулбар держит только явный enableToolbar: true (ADR 0046).
    enableToolbar: true,
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

const TOOLBAR_CONTROLS = [
  'enableQuickSearch',
  'enableColumnFiltering',
  'enableColumnVisibility',
  'enableDataExport',
]

/** Грид открыт, данных ещё нет. */
const OPENED: GuideStoryStep = {
  title: 'Таблица открыта, данные загружаются',
  hint: 'Поиск, «Фильтры» и «Колонки» работают: их результат — запрос, а не строки. Клиентскому «Экспорту» выгружать нечего — на его месте скелет.',
  props: () => ({ loading: 'initial', dataOverride: [] }),
}

/** Ответ сервера: данные и конец загрузки приходят одним обновлением. */
const ANSWERED: GuideStoryStep = {
  title: 'Данные получены',
  hint: '«Экспорт» встаёт на место скелета, соседи в тулбаре не сдвигаются.',
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
const waitTestId = (id: string) =>
  until(() => expect(byTestId(id)).not.toBeNull())

// --- S1 ------------------------------------------------------------------------------

const INITIAL_LOADING: readonly GuideStoryStep[] = [OPENED, ANSWERED]

/** S1: клиентские данные — до них работают все функции тулбара, кроме экспорта. */
export const ToolbarInitialLoading: StoryObj<StoryProps> = {
  name: 'Initial loading',
  parameters: {
    scenario: '0122/S1',
    ...showControls(TOOLBAR_CONTROLS),
  },
  args: TOOLBAR_ARGS,
  render: args => (
    <GuideStory
      title="Тулбар до прихода данных"
      steps={INITIAL_LOADING}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    let skeleton = rect(canvas)
    await step(INITIAL_LOADING[0]!.title, async () => {
      await waitTestId('export-skeleton')
      await waitTestId('quick-search')
      await expect(byTestId('export-button')).toBeNull()
      await expect(byTestId('column-visibility-button')).not.toBeNull()
      await expect(
        byTestId('quick-search')!.getAttribute('aria-disabled'),
      ).not.toBe('true')
      skeleton = rect(byTestId('export-skeleton')!)
    })
    await step(INITIAL_LOADING[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('export-button')
      await expectSameBox(rect(byTestId('export-button')!), skeleton)
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
    hint: 'Поиск серверный: грид не ищет сам, запрос уходит приложению.',
  },
  {
    title: `Пользователь ищет «${QUERY}» до прихода данных`,
    hint: 'onSearchChange вызывается сразу; приложение заменяет первый запрос запросом с поиском.',
    enter: typeSearch(QUERY),
  },
  {
    title: 'Сервер ответил по запросу',
    hint: 'Приходят только строки, найденные сервером.',
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
    ...showControls(['enableQuickSearch', 'quickSearchDebounceMs']),
  },
  args: {
    ...FIXED_HEIGHT,
    columnCount: 6,
    dataCount: 40,
    enableQuickSearch: true,
    quickSearchServer: true,
    onSearchChange: search => {
      searchRequests.push(search)
    },
  },
  render: args => (
    <GuideStory
      title="Серверный поиск до прихода данных"
      steps={SEARCH_BEFORE_DATA}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    searchRequests.length = 0
    const dataRows = () => canvas.querySelectorAll('.data-grid__body-row')
    await step(SEARCH_BEFORE_DATA[0]!.title, async () => {
      await waitTestId('quick-search')
      await expect(dataRows()).toHaveLength(0)
    })
    await step(SEARCH_BEFORE_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(searchRequests.at(-1)).toBe(QUERY))
      await expect(dataRows()).toHaveLength(0)
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
    title: 'Колонки придут с сервера',
    hint: 'columns: [] — поиску и «Колонкам» опереться не на что: на их месте скелеты, как и у «Экспорта».',
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: 'Колонки пришли, данные ещё в пути',
    hint: 'Поле поиска и «Колонки» встают на место скелетов; «Экспорт» ждёт данных.',
    props: () => ({ columnsOverride: undefined }),
  },
  ANSWERED,
]

/** S3: колонки приходят с сервера — контролы над колонками ждут их скелетом. */
export const ToolbarColumnsArrive: StoryObj<StoryProps> = {
  name: 'Columns arrive',
  parameters: {
    scenario: '0122/S3',
    ...showControls(TOOLBAR_CONTROLS),
  },
  args: TOOLBAR_ARGS,
  render: args => (
    <GuideStory
      title="Колонки приходят с сервера"
      steps={COLUMNS_ARRIVE}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let field = rect(canvas)
    let columns = rect(canvas)
    await step(COLUMNS_ARRIVE[0]!.title, async () => {
      await waitTestId('quick-search-skeleton')
      await waitTestId('column-visibility-skeleton')
      await waitTestId('export-skeleton')
      field = rect(byTestId('quick-search-skeleton')!)
      columns = rect(byTestId('column-visibility-skeleton')!)
    })
    await step(COLUMNS_ARRIVE[1]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('quick-search')
      await waitTestId('column-visibility-button')
      await expectSameBox(rect(byTestId('quick-search')!.parentElement!), field)
      await expectSameBox(rect(byTestId('column-visibility-button')!), columns)
      await expect(byTestId('export-skeleton')).not.toBeNull()
    })
    await step(COLUMNS_ARRIVE[2]!.title, async () => {
      await guideNext(canvas)
      await waitTestId('export-button')
    })
    await settle()
  },
}
