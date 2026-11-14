import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  pressEscape,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  closeViewSettings,
  openViewSettingsSection,
  viewSettingsPopover,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
import { untilDone } from './__mocks__/cellGestures'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { shellText } from './demos/storyShell'
import { storyLabels } from './__mocks__/storyLabels'
import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { paginationLabels } from '../plugins/pagination/labels'
import { quickSearchLabels } from '../plugins/quickSearch/labels'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'

/**
 * Подписи таблицы словарём «ключ → значение» (ADR 0132, S1–S4). Язык Playground — в
 * переключателе Language тулбара; гайды начинают с английского: язык — их предмет.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Customization/Localization',
} satisfies Meta<StoryProps>

export default meta

/** Область таблицы: строк больше, чем помещается. */
const TABLE_HEIGHT = '460'

/** Таблица с подписями в тулбаре, нижней панели и пагинации. */
const LABELLED = {
  dataCount: 1000,
  enablePagination: true,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnVisibility: true,
} satisfies Partial<StoryProps>

const NOT_LABELS = 'Does not affect the labels'

/** Таблица по-русски; переключатель Language в тулбаре возвращает английский. */
export const LocalizationPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  globals: { locale: 'ru' },
  parameters: showControls(
    [
      'enableColumnSorting',
      'enableColumnVisibility',
      'enableRowSelection',
      'rowSelectionSelectedCount',
      'enableQuickSearch',
      'enableColumnFiltering',
      'enablePagination',
      'enableDataExport',
    ],
    {
      columnCount: NOT_LABELS,
      containerHeight: NOT_LABELS,
      height: NOT_LABELS,
      maxHeight: NOT_LABELS,
      rowHeight: NOT_LABELS,
      headerHeight: NOT_LABELS,
      defaultColumn: NOT_LABELS,
    },
  ),
  args: {
    ...LABELLED,
    enableColumnSorting: true,
    enableDataExport: true,
  },
  render: function Render(args) {
    // Консоль песочницы (ADR 0124): журнал живёт, пока открыта история.
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} height={TABLE_HEIGHT} />
      </WithConsole>
    )
  },
}

// --- Чтение таблицы в `play` и шагах -----------------------------------------------

const rangeOf = (root: ParentNode) =>
  root.querySelector('[data-testid="pagination-range"]')?.textContent
const searchOf = (root: ParentNode) =>
  root.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const selectedOf = (root: ParentNode) =>
  root.querySelector('[data-testid="selected-rows-count"]')?.textContent
const toolbarOf = (root: ParentNode) =>
  root.querySelector('[role="toolbar"]')?.getAttribute('aria-label')
const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const bodyOf = (root: ParentNode) => root.querySelector('.data-grid__body')
/** Запись пересоздания — на любом языке: шаг гайда меняет язык консоли. */
const recreated = () =>
  (['en', 'ru'] as const).some(locale =>
    consoleText().includes(shellText(locale, 'lifecycleRecreated')),
  )

/** Действие шага — после отрисовки строк: первый шаг входит при монтировании грида. */
const afterRows =
  (action: (root: HTMLElement) => void) => (root: HTMLElement) => {
    const run = () =>
      root.querySelector('.data-grid__body-row')
        ? action(root)
        : requestAnimationFrame(run)
    requestAnimationFrame(run)
  }

/** Выбраны ровно первые `count` строк — как нажатия пользователя по флажкам. */
const selectFirst = (count: number) =>
  afterRows(root => {
    // Видимые строки: смонтированные за краем области окна виртуализации не в счёт.
    const top = root
      .querySelector('.data-grid__head')!
      .getBoundingClientRect().bottom
    const rows = [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')]
      .filter(row => row.getBoundingClientRect().top >= top - 1)
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    rows.forEach((row, index) => {
      const box = row.querySelector<HTMLElement>('[role="checkbox"]')
      const checked = box?.getAttribute('aria-checked') === 'true'
      if (box && checked !== index < count) box.click()
    })
  })

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (root: HTMLElement, text: string) => {
  const input = searchOf(root)
  if (!input || input.value === text) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

// --- ADR 0132 S1 ---------------------------------------------------------------------

/** Подписи таблицы на русском — язык, на который гайды переключают таблицу. */
const RU = storyLabels('ru')

/** Счётчик «Выбрано: N колонок» с любым числом — в форме слова для 5. */
const selectedColumnsPattern = new RegExp(
  columnVisibilityLabels(RU)
    .selectedColumns(5)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('5', '\\d+'),
)

/** Закрыть открытое меню или панель — как `Escape` пользователя. */
const closePopups = pressEscape

const filterButtonOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="country"] .column-filter__button',
  )
const popupText = (selector: string) =>
  document.querySelector(selector)?.textContent ?? ''

/** Открыть меню нажатием на его кнопку, закрыв прежнее. */
const openWith = (button: (root: ParentNode) => HTMLElement | null) =>
  afterRows(root => {
    closePopups()
    requestAnimationFrame(() => button(root)?.click())
  })

const FROM_JSON: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Подписи по умолчанию', en: 'Default labels' },
    hint: {
      ru: 'Без словаря таблица подписана по-английски: поле «Search», диапазон «1–25 of 1,000».',
      en: 'Without a dictionary, the table labels are in English: the field says “Search”, and the range reads “1–25 of 1,000”.',
    },
  },
  {
    title: { ru: 'Словарь из JSON', en: 'A dictionary from JSON' },
    hint: {
      ru: 'Приложение передаёт словарь из JSON-файла и язык `ru-RU`: поле «Поиск», диапазон «1–25 из 1 000» — число с русским разделителем.',
      en: 'The app passes a dictionary from a JSON file and the `ru-RU` locale: the search field and the page range are now in Russian, and 1,000 uses the Russian thousands separator.',
    },
    props: () => ({ locale: 'ru' }),
    enter: closePopups,
  },
  {
    title: { ru: 'Меню «Колонки»', en: 'The columns menu' },
    hint: {
      ru: 'Меню колонок тоже по-русски: поле «Найти колонку», флажок «Все колонки», счётчик «Выбрано: N колонок» и кнопка «Сбросить».',
      en: 'The columns menu is in Russian too: the column search field, the all-columns checkbox, the selected-columns counter, and the reset button.',
    },
    // Раздел «Колонки» «Настроек вида» (ADR 0215): сначала «Настройки вида», затем раздел.
    enter: untilDone(
      () => !!viewSettingsSectionOpen('columns'),
      root => {
        if (!viewSettingsPopover()) closePopups()
        openViewSettingsSection(root, 'columns')
      },
    ),
  },
  {
    title: { ru: 'Фильтр колонки', en: 'Column filter' },
    hint: {
      ru: 'Панель фильтра колонки «Country»: условие «Содержит», кнопка «Сбросить».',
      en: 'The filter panel of the “Country” column: the contains condition and the reset button are in Russian.',
    },
    enter: untilDone(
      () => !!document.querySelector('[data-testid="filter-panel"]'),
      root => {
        if (viewSettingsPopover()) closeViewSettings(root)
        else filterButtonOf(root)?.click()
      },
    ),
  },
]

/** ADR 0132, S1: приложение подключает перевод из своего JSON-файла. */
export const LocalizationFromJson: StoryObj<StoryProps> = {
  name: 'From JSON',
  parameters: {
    scenario: '0132/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Перевод из файла приложения',
        en: 'Translation from the app file',
      }}
      steps={FROM_JSON}
      args={guideArgs(
        { ...LABELLED, height: TABLE_HEIGHT },
        { colorMode: args.colorMode, locale: 'en' },
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(FROM_JSON[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeOf(canvas)).toBe('1–25 of 1,000'))
      await until(() => expect(searchOf(canvas)?.placeholder).toBe('Search'))
    })
    await step(FROM_JSON[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeOf(canvas)).toBe(
          paginationLabels(RU).pageRange(1, 25, 1000),
        ),
      )
      await until(() =>
        expect(searchOf(canvas)?.placeholder).toBe(
          quickSearchLabels(RU).search,
        ),
      )
    })
    await step(FROM_JSON[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        const panel = document.querySelector<HTMLInputElement>(
          '[role="dialog"] input',
        )
        expect(panel?.placeholder).toBe(
          columnVisibilityLabels(RU).searchColumns,
        )
        expect(popupText('[role="dialog"]')).toContain(
          columnVisibilityLabels(RU).allColumns,
        )
        expect(popupText('[role="dialog"]')).toMatch(selectedColumnsPattern)
        expect(popupText('[role="dialog"]')).toContain(
          columnVisibilityLabels(RU).resetColumns,
        )
      })
      await settle()
    })
    await step(FROM_JSON[3].title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        const text = popupText('[data-testid="filter-panel"]')
        expect(text).toContain(columnFilteringLabels(RU).filterContains)
        expect(text).toContain(columnFilteringLabels(RU).filterReset)
      })
      await until(() =>
        expect(
          document
            .querySelector('[data-testid="view-settings-button"]')
            ?.getAttribute('aria-expanded'),
        ).not.toBe('true'),
      )
      await settle()
    })
  },
}

// --- ADR 0132 S2 ---------------------------------------------------------------------

const SEARCH = '1'
const SCROLL = 200

const SWITCH: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Английский интерфейс', en: 'English interface' },
    hint: {
      ru: 'Таблица подписана по-английски. Пользователь ещё ничего не искал и не выбирал.',
      en: 'The table labels are in English. The user has not searched for or selected anything yet.',
    },
  },
  {
    title: {
      ru: 'Пользователь нашёл и выбрал строки',
      en: 'The user found and selected rows',
    },
    hint: {
      ru: 'Пользователь нашёл «1», прокрутил таблицу и выбрал две строки.',
      en: 'The user searched for “1”, scrolled the table, and selected two rows.',
    },
    enter: afterRows(root => {
      typeSearch(root, SEARCH)
      // Строки на новом месте монтируются к следующему кадру — выбор после прокрутки.
      requestAnimationFrame(() => {
        scrollerOf(root).scrollTop = SCROLL
        requestAnimationFrame(() => selectFirst(2)(root))
      })
    }),
  },
  {
    title: { ru: 'Русский интерфейс', en: 'Russian interface' },
    hint: {
      ru: 'Приложение переключает язык: подписи по-русски, таблица не пересоздаётся — поиск, выбор и прокрутка на месте.',
      en: 'The app switches the language: the labels are in Russian, and the table is not recreated: the search, the selection, and the scroll position stay as they were.',
    },
    props: () => ({ locale: 'ru' }),
  },
]

/** ADR 0132, S2: пользователь переключает язык приложения — таблица меняет язык на лету. */
export const LocalizationSwitch: StoryObj<StoryProps> = {
  name: 'Switch language',
  parameters: {
    scenario: '0132/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Смена языка на лету',
        en: 'Switching the language on the fly',
      }}
      steps={SWITCH}
      args={guideArgs(
        // Поиск сразу: строки выбираются среди найденных.
        { ...LABELLED, height: TABLE_HEIGHT, quickSearchDebounceMs: 0 },
        { colorMode: args.colorMode, locale: 'en' },
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let body: Element | null = null
    let scrollTop = 0
    const kept = async () => {
      await until(() => expect(searchOf(canvas)?.value).toBe(SEARCH))
      await until(() => expect(scrollerOf(canvas).scrollTop).toBe(scrollTop))
      await until(() => expect(bodyOf(canvas)).toBe(body))
      await until(() => expect(recreated()).toBe(false))
    }
    await step(SWITCH[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SWITCH[1].title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('2 rows selected'))
      await until(() =>
        expect(
          Math.abs(scrollerOf(canvas).scrollTop - SCROLL),
        ).toBeLessThanOrEqual(1),
      )
      await settle()
      scrollTop = scrollerOf(canvas).scrollTop
      body = bodyOf(canvas)
    })
    await step(SWITCH[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(selectedOf(canvas)).toBe(rowSelectionLabels(RU).selectedRows(2)),
      )
      await until(() => expect(toolbarOf(canvas)).toBe(RU.toolbar))
      await kept()
    })
    await settle()
  },
}

// --- ADR 0132 S3 ---------------------------------------------------------------------

const OVERRIDES: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Подписи по умолчанию', en: 'Default labels' },
    hint: {
      ru: 'Поле «Search», диапазон «1–25 of 1,000».',
      en: 'The field says “Search”, and the range reads “1–25 of 1,000”.',
    },
  },
  {
    title: { ru: 'Свои формулировки', en: 'Custom wording' },
    hint: {
      ru: 'Приложение меняет две подписи: поле «Find a person», диапазон «Rows 1–25 of 1,000». Остальные — по умолчанию: «Rows per page».',
      en: 'The app changes two labels: the field says “Find a person”, and the range reads “Rows 1–25 of 1,000”. The rest keep their defaults, such as “Rows per page”.',
    },
    props: () => ({
      localization: {
        'quickSearch.search': 'Find a person',
        'pagination.pageRange': 'Rows {from}–{to} of {total}',
      },
    }),
  },
]

/** ADR 0132, S3: приложение меняет несколько формулировок, остальные — по умолчанию. */
export const LocalizationOverrides: StoryObj<StoryProps> = {
  name: 'Own wording',
  parameters: {
    scenario: '0132/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Свои формулировки', en: 'Custom wording' }}
      steps={OVERRIDES}
      args={guideArgs(
        { ...LABELLED, height: TABLE_HEIGHT },
        { colorMode: args.colorMode, locale: 'en' },
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVERRIDES[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeOf(canvas)).toBe('1–25 of 1,000'))
      await until(() => expect(searchOf(canvas)?.placeholder).toBe('Search'))
    })
    await step(OVERRIDES[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rangeOf(canvas)).toBe('Rows 1–25 of 1,000'))
      await until(() =>
        expect(searchOf(canvas)?.placeholder).toBe('Find a person'),
      )
      await expect(
        canvas.querySelector('[data-testid="pagination"]')?.textContent,
      ).toContain('Rows per page')
    })
    await settle()
  },
}

// --- ADR 0132 S4 ---------------------------------------------------------------------

/** Порог числа шаблоном не выразить: значение подписи — функция. */
const selectedRowsCapped = (count: number) =>
  count === 1
    ? '1 row selected'
    : count > 99
      ? '99+ rows selected'
      : `${count} rows selected`

/** Пользователь выбирает все строки флажком в шапке. */
const selectAllRows = afterRows(root => {
  const all = root.querySelector<HTMLElement>(
    '.data-grid__head [role="checkbox"]',
  )
  if (all?.getAttribute('aria-checked') !== 'true') all?.click()
})

const FUNCTION: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки не выбраны', en: 'No rows are selected' },
    hint: {
      ru: 'Приложение включило счётчик выбранных строк. Пока ничего не выбрано.',
      en: 'The app turned on the selected rows counter. Nothing is selected yet.',
    },
  },
  {
    title: { ru: 'Выбраны все строки', en: 'All rows are selected' },
    hint: {
      ru: 'Пользователь выбрал все строки: «1,000 rows selected» — подпись по умолчанию.',
      en: 'The user selected all rows: “1,000 rows selected” is the default label.',
    },
    enter: selectAllRows,
  },
  {
    title: { ru: 'Подпись функцией', en: 'A label as a function' },
    hint: {
      ru: 'Порог шаблоном не выразить — приложение передаёт функцию: «99+ rows selected».',
      en: 'A threshold cannot be expressed with a template, so the app passes a function: “99+ rows selected”.',
    },
    props: () => ({
      localization: { 'rowSelection.selectedRows': selectedRowsCapped },
    }),
    // Со свежей таблицы строки ещё не выбраны.
    enter: selectAllRows,
  },
]

const FUNCTION_ARGS = {
  height: TABLE_HEIGHT,
  dataCount: 1000,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
} satisfies Partial<StoryProps>

/** ADR 0132, S4: особый случай — функция вместо шаблона. */
export const LocalizationFunction: StoryObj<StoryProps> = {
  name: 'Function label',
  parameters: {
    scenario: '0132/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Подпись функцией', en: 'A label as a function' }}
      steps={FUNCTION}
      args={guideArgs(FUNCTION_ARGS, {
        colorMode: args.colorMode,
        locale: 'en',
      })}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FUNCTION[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FUNCTION[1].title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('1,000 rows selected'))
    })
    await step(FUNCTION[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('99+ rows selected'))
    })
    await settle()
  },
}
