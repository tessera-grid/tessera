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

const NOT_LABELS = 'На подписи не влияет'

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
const recreated = () => consoleText().includes('Грид пересоздан')

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

const NBSP = ' '

// --- ADR 0132 S1 ---------------------------------------------------------------------

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
    title: 'Подписи по умолчанию',
    hint: 'Без словаря таблица подписана по-английски: поле «Search», диапазон «1–25 of 1,000».',
  },
  {
    title: 'Словарь из JSON',
    hint: 'Приложение передаёт словарь из JSON-файла и язык `ru-RU`: поле «Поиск», диапазон «1–25 из 1 000» — число с русским разделителем.',
    props: () => ({ locale: 'ru' }),
    enter: closePopups,
  },
  {
    title: 'Меню «Колонки»',
    hint: 'Меню колонок тоже по-русски: поле «Найти колонку», флажок «Все колонки», счётчик «Выбрано: N колонок» и кнопка «Сбросить».',
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
    title: 'Фильтр колонки',
    hint: 'Панель фильтра колонки «Country»: условие «Содержит», кнопка «Сбросить».',
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
      title="Перевод из файла приложения"
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
    await step(FROM_JSON[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeOf(canvas)).toBe('1–25 of 1,000'))
      await until(() => expect(searchOf(canvas)?.placeholder).toBe('Search'))
    })
    await step(FROM_JSON[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(rangeOf(canvas)).toBe(`1–25 из 1${NBSP}000`))
      await until(() => expect(searchOf(canvas)?.placeholder).toBe('Поиск'))
    })
    await step(FROM_JSON[2].title, async () => {
      await guideNext(canvas)
      await until(() => {
        const panel = document.querySelector<HTMLInputElement>(
          '[role="dialog"] input',
        )
        expect(panel?.placeholder).toBe('Найти колонку')
        expect(popupText('[role="dialog"]')).toContain('Все колонки')
        expect(popupText('[role="dialog"]')).toMatch(/Выбрано: \d+ колонок/)
        expect(popupText('[role="dialog"]')).toContain('Сбросить')
      })
      await settle()
    })
    await step(FROM_JSON[3].title, async () => {
      await guideNext(canvas)
      await until(() => {
        const text = popupText('[data-testid="filter-panel"]')
        expect(text).toContain('Содержит')
        expect(text).toContain('Сбросить')
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
    title: 'Английский интерфейс',
    hint: 'Таблица подписана по-английски. Пользователь ещё ничего не искал и не выбирал.',
  },
  {
    title: 'Пользователь нашёл и выбрал строки',
    hint: 'Пользователь нашёл «1», прокрутил таблицу и выбрал две строки.',
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
    title: 'Русский интерфейс',
    hint: 'Приложение переключает язык: подписи по-русски, таблица не пересоздаётся — поиск, выбор и прокрутка на месте.',
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
      title="Смена языка на лету"
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
    await step(SWITCH[0].title, async () => {
      await waitForRows(canvas)
    })
    await step(SWITCH[1].title, async () => {
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
    await step(SWITCH[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('Выбрано: 2 строки'))
      await until(() =>
        expect(toolbarOf(canvas)).toBe('Панель инструментов таблицы'),
      )
      await kept()
    })
    await settle()
  },
}

// --- ADR 0132 S3 ---------------------------------------------------------------------

const OVERRIDES: readonly GuideStoryStep[] = [
  {
    title: 'Подписи по умолчанию',
    hint: 'Поле «Search», диапазон «1–25 of 1,000».',
  },
  {
    title: 'Свои формулировки',
    hint: 'Приложение меняет две подписи: поле «Find a person», диапазон «Rows 1–25 of 1,000». Остальные — по умолчанию: «Rows per page».',
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
      title="Свои формулировки"
      steps={OVERRIDES}
      args={guideArgs(
        { ...LABELLED, height: TABLE_HEIGHT },
        { colorMode: args.colorMode, locale: 'en' },
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVERRIDES[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeOf(canvas)).toBe('1–25 of 1,000'))
      await until(() => expect(searchOf(canvas)?.placeholder).toBe('Search'))
    })
    await step(OVERRIDES[1].title, async () => {
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
    title: 'Строки не выбраны',
    hint: 'Приложение включило счётчик выбранных строк. Пока ничего не выбрано.',
  },
  {
    title: 'Выбраны все строки',
    hint: 'Пользователь выбрал все строки: «1,000 rows selected» — подпись по умолчанию.',
    enter: selectAllRows,
  },
  {
    title: 'Подпись функцией',
    hint: 'Порог шаблоном не выразить — приложение передаёт функцию: «99+ rows selected».',
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
      title="Подпись функцией"
      steps={FUNCTION}
      args={guideArgs(FUNCTION_ARGS, {
        colorMode: args.colorMode,
        locale: 'en',
      })}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FUNCTION[0].title, async () => {
      await waitForRows(canvas)
    })
    await step(FUNCTION[1].title, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('1,000 rows selected'))
    })
    await step(FUNCTION[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedOf(canvas)).toBe('99+ rows selected'))
    })
    await settle()
  },
}
