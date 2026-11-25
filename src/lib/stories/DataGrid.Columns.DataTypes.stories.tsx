import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { untilDone } from './__mocks__/cellGestures'
import {
  consoleText,
  guideNext,
  settle,
  until,
  waitForRows,
  byTestId,
  orderedRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import {
  PRIORITY_COLUMNS,
  PRIORITY_ROWS,
  PRIORITY_TYPES,
  priorityLabel,
} from './__mocks__/editingData'
import { storyLabels } from './__mocks__/storyLabels'
import {
  BALANCE_COLUMN,
  LOCALE_ROWS,
  MANAGER_COLUMN,
  MEDIUM_DATES,
  MONEY_TYPES,
  STATUS_OPTIONS,
  managedRows,
  productColumns,
  productRows,
} from './__mocks__/dataTypesData'
import {
  PRODUCT_ROW,
  typeInto,
  localeOf,
  OWN_TABLE,
  CELL,
  cellOf,
  textOf,
  rowIds,
  sortButtonOf,
  sortOf,
  sortTo,
  columnsOf,
  moneyIn,
} from './__mocks__/typeGuides'
import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { filteringLabels } from '../shared/filtering/labels'

/**
 * Типы данных колонок (ADR 0172): вид значения, выравнивание и формат по типу колонки,
 * свои типы реестром. `Playground` — все встроенные типы и свой тип «деньги»; язык и пояс
 * меняют формат денег и время.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Overview',
} satisfies Meta<StoryProps>

export default meta

const ROWS = productRows(50)

export const DataTypesPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    columnsOverride: [
      ...productColumns('money'),
      MANAGER_COLUMN,
      BALANCE_COLUMN,
    ],
    dataOverride: managedRows(50),
    dataTypes: MONEY_TYPES,
    timeZone: 'UTC',
  },
  parameters: showControls(['locale', 'timeZone'], {
    columnCount: OWN_TABLE,
    dataCount: OWN_TABLE,
  }),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- S3: свой тип «деньги» ------------------------------------------------------------

const CUSTOM_TYPE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Цена — обычное число', en: 'The price is a plain number' },
    hint: {
      ru: 'Приложение показывает цену как число без единиц. Значения выровнены по левому краю, как текст, цифры одной ширины.',
      en: 'The app shows the price as a number without units. The values are left-aligned like text, and all digits have the same width.',
    },
    props: () => ({
      columnsOverride: productColumns('number'),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: { ru: 'Свой тип «деньги»', en: 'A custom “money” type' },
    hint: {
      ru: 'Приложение описало свой тип для денег и назначило его колонке цены. Цена показана в долларах со знаком валюты и двумя знаками после запятой и выровнена по правому краю — так задал тип.',
      en: 'The app defined its own type for money and assigned it to the price column. The price is shown in dollars with the currency sign and two decimal places, and it is right-aligned, as the type specifies.',
    },
    props: () => ({
      columnsOverride: productColumns('money'),
      dataTypes: MONEY_TYPES,
    }),
  },
]

/** ADR 0172, S3: разработчик задаёт свой тип «деньги» — валюта и выравнивание вправо. */
export const DataTypesCustomType: StoryObj<StoryProps> = {
  name: 'Custom type',
  parameters: { scenario: '0172/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Свой тип данных', en: 'A custom data type' }}
      steps={CUSTOM_TYPE}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const price = ROWS[0]!.price
    await step(CUSTOM_TYPE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'price')).toBe(String(price)))
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBeUndefined()
    })
    await step(CUSTOM_TYPE[1]!.title.ru, async () => {
      await guideNext(canvas)
      const money = new Intl.NumberFormat(localeOf(args), {
        style: 'currency',
        currency: 'USD',
      }).format(price)
      await until(() => expect(textOf(canvas, 0, 'price')).toBe(money))
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBe('end')
      await settle()
    })
  },
}

// --- S4: вид всех дат в одном месте ---------------------------------------------------

const OVERRIDE_BUILT_IN: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Даты по умолчанию', en: 'Default dates' },
    hint: {
      ru: 'Даты показаны в нейтральном виде: год, месяц и день, у даты со временем — ещё часы и минуты.',
      en: 'Dates are shown in a neutral format: year, month, and day, plus hours and minutes for a date with time.',
    },
    props: () => ({
      columnsOverride: productColumns(),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: {
      ru: 'Вид дат сменился во всей таблице',
      en: 'The date format changed across the table',
    },
    hint: {
      ru: 'Приложение в одном месте задало новый вид для встроенных типов дат. Обе колонки с датами показывают месяц словом, а дата со временем — ещё и время, хотя сами колонки не менялись.',
      en: 'The app set a new format for the built-in date types in one place. Both date columns now spell out the month, and the date with time also shows the time, even though the columns themselves did not change.',
    },
    props: () => ({ dataTypes: MEDIUM_DATES }),
  },
]

/** ADR 0172, S4: разработчик меняет вид всех дат таблицы в одном месте. */
export const DataTypesOverrideBuiltIn: StoryObj<StoryProps> = {
  name: 'Override built-in type',
  parameters: { scenario: '0172/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Вид встроенного типа', en: 'The look of a built-in type' }}
      steps={OVERRIDE_BUILT_IN}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const { released, updatedAt } = ROWS[0]!
    await step(OVERRIDE_BUILT_IN[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'released')).toBe(released))
      await expect(textOf(canvas, 0, 'updatedAt')).toBe(
        `${updatedAt.slice(0, 10)} ${updatedAt.slice(11, 16)}`,
      )
    })
    await step(OVERRIDE_BUILT_IN[1]!.title.ru, async () => {
      await guideNext(canvas)
      const locale = localeOf(args)
      const day = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(`${released}T00:00:00Z`))
      const moment = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(updatedAt))
      await until(() => expect(textOf(canvas, 0, 'released')).toBe(day))
      await expect(textOf(canvas, 0, 'updatedAt')).toBe(moment)
      await settle()
    })
  },
}

// --- S7: язык на лету -------------------------------------------------------------------

const LOCALE_COLUMNS = columnsOf('money', ['name', 'price', 'quantity'])
const namesIn = (locale: string) =>
  LOCALE_ROWS.map(row => row.name).sort(new Intl.Collator(locale).compare)

const LOCALE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица на английском языке', en: 'The table in English' },
    hint: {
      ru: 'Цены показаны по правилам английского языка: знак доллара перед числом, запятая между разрядами.',
      en: 'Prices follow English rules: the dollar sign goes before the number, and a comma separates digit groups.',
    },
    props: () => ({
      locale: 'en',
      columnsOverride: LOCALE_COLUMNS,
      dataOverride: LOCALE_ROWS,
      dataTypes: MONEY_TYPES,
      enableColumnSorting: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по названию',
      en: 'The user sorted by product name',
    },
    hint: {
      ru: 'Названия идут по алфавиту. По правилам английского языка латиница стоит раньше кириллицы.',
      en: 'Product names are in alphabetical order. Under English rules, Latin letters come before Cyrillic ones.',
    },
    enter: sortTo('name', 'ascending'),
  },
  {
    title: {
      ru: 'Пользователь переключил язык на русский',
      en: 'The user switched the language to Russian',
    },
    hint: {
      ru: 'Приложение сменило язык, таблица не открывалась заново и сохранила сортировку. Цены показаны по-русски: пробел между разрядами, запятая перед дробной частью, знак доллара после числа. По правилам русского языка кириллица стоит раньше латиницы, поэтому порядок названий сменился. Подписи кнопок таблицы тоже на русском.',
      en: "The app changed the language; the table did not reopen and kept its sorting. Prices follow Russian rules: a space between digit groups, a comma before the decimal part, and the dollar sign after the number. Under Russian rules, Cyrillic letters come before Latin ones, so the order of names changed. The table's button labels are in Russian too.",
    },
    props: () => ({ locale: 'ru' }),
    enter: sortTo('name', 'ascending'),
  },
]

/** ADR 0172, S7: язык на лету — формат денег и порядок сортировки без пересоздания. */
export const DataTypesLocale: StoryObj<StoryProps> = {
  name: 'Switch language',
  parameters: { scenario: '0172/S7', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Язык таблицы', en: 'Table language' }}
      steps={LOCALE}
      args={guideArgs({ height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const nameOrder = (locale: string) =>
      namesIn(locale).map(
        name => LOCALE_ROWS.find(row => row.name === name)!.id,
      )
    const { price } = LOCALE_ROWS[0]!
    await step(LOCALE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(textOf(canvas, 0, 'price')).toBe(moneyIn('en-US', price)),
      )
    })
    await step(LOCALE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowIds(canvas)).toEqual(nameOrder('en-US')))
      await expect(
        sortButtonOf(canvas, 'name')?.getAttribute('aria-label'),
      ).toBe(columnSortingLabels(storyLabels('en')).clearSort)
    })
    await step(LOCALE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowIds(canvas)).toEqual(nameOrder('ru-RU')))
      await expect(sortOf(canvas, 'name')).toBe('ascending')
      const first = LOCALE_ROWS.find(row => row.id === nameOrder('ru-RU')[0])!
      await expect(textOf(canvas, 0, 'price')).toBe(
        moneyIn('ru-RU', first.price),
      )
      await expect(
        sortButtonOf(canvas, 'name')?.getAttribute('aria-label'),
      ).toBe(columnSortingLabels(storyLabels('ru')).clearSort)
      await settle()
    })
  },
}

// --- S5: поиск по показанному тексту ---------------------------------------------------

const SEARCH_ROWS = productRows(50)
const SEARCH_DAY = '2026-06-15'
const ON_SALE = 'On sale'
/** Подпись варианта отличается от значения: «active» показан как «On sale». */
const SEARCH_COLUMNS = productColumns('money').map(column =>
  column.id === 'status'
    ? {
        ...column,
        options: STATUS_OPTIONS.map(option =>
          option.value === 'active' ? { ...option, label: ON_SALE } : option,
        ),
      }
    : column,
)
const searchField = () => byTestId('quick-search') as HTMLInputElement | null
/** Пользователь набирает запрос в поле поиска. */
const searchFor = (text: string, done: (root: HTMLElement) => boolean) =>
  untilDone(done, () => {
    const field = searchField()
    if (field && field.value !== text) typeInto(field, text)
  })
const statusTexts = (root: HTMLElement) =>
  orderedRows(root).map(row =>
    row.querySelector(`${CELL}[data-column-id="status"]`)?.textContent?.trim(),
  )
const SEARCH_COUNTS = {
  day: SEARCH_ROWS.filter(row => row.released === SEARCH_DAY).length,
  sale: SEARCH_ROWS.filter(row => row.status === 'active').length,
}

const SEARCH: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Товары с датами и статусами',
      en: 'Products with dates and statuses',
    },
    hint: {
      ru: 'В таблице есть даты выпуска, статусы и цены. Над таблицей — поле поиска.',
      en: 'The table has release dates, statuses, and prices. Above the table is a search field.',
    },
    props: () => ({
      columnsOverride: SEARCH_COLUMNS,
      dataOverride: SEARCH_ROWS,
      dataTypes: MONEY_TYPES,
      enableQuickSearch: true,
      quickSearchFilteredCount: true,
      timeZone: 'UTC',
    }),
  },
  {
    title: { ru: 'Пользователь ищет дату', en: 'The user searches for a date' },
    hint: {
      ru: 'Пользователь набрал дату так, как она показана в таблице. Остался товар, выпущенный в этот день; нижняя панель называет число найденных строк.',
      en: 'The user typed the date the way the table shows it. The product released on that day remains; the status bar shows the number of rows found.',
    },
    enter: searchFor(
      SEARCH_DAY,
      root =>
        orderedRows(root).length === SEARCH_COUNTS.day &&
        searchField()?.value === SEARCH_DAY,
    ),
  },
  {
    title: {
      ru: 'Пользователь ищет статус',
      en: 'The user searches for a status',
    },
    hint: {
      ru: 'Пользователь набрал статус так, как он показан в ячейке. Остались товары с этим статусом, хотя в данных статус хранится другим словом.',
      en: 'The user typed the status the way the cell shows it. Products with that status remain, even though the data stores the status as a different word.',
    },
    enter: searchFor(
      ON_SALE,
      root =>
        searchField()?.value === ON_SALE &&
        statusTexts(root).length > 0 &&
        statusTexts(root).every(text => text === ON_SALE),
    ),
  },
]

/** ADR 0172, S5: пользователь ищет дату и подпись варианта по показанному тексту. */
export const DataTypesSearch: StoryObj<StoryProps> = {
  name: 'Search shown text',
  parameters: { scenario: '0172/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Поиск по показанному тексту',
        en: 'Search by the shown text',
      }}
      steps={SEARCH}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = SEARCH_ROWS.length
    await step(SEARCH[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(searchField()).not.toBeNull())
    })
    await step(SEARCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(orderedRows(canvas)).toHaveLength(SEARCH_COUNTS.day),
      )
      await expect(textOf(canvas, 0, 'released')).toBe(SEARCH_DAY)
      await until(() =>
        expect(byTestId('filtered-rows-count')?.textContent).toBe(
          filteringLabels(labels).filteredRows(SEARCH_COUNTS.day, total),
        ),
      )
    })
    await step(SEARCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(byTestId('filtered-rows-count')?.textContent).toBe(
          filteringLabels(labels).filteredRows(SEARCH_COUNTS.sale, total),
        ),
      )
      await expect(statusTexts(canvas).every(text => text === ON_SALE)).toBe(
        true,
      )
      await settle()
    })
  },
}

const priorityCell = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="priority"]`,
  )
const priorityEditor = (root: ParentNode) =>
  priorityCell(root)?.querySelector<HTMLElement>('[data-priority-editor]') ??
  null
const priorityText = (root: ParentNode) => {
  const copy = priorityCell(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}

const HIGH = 3

const EDIT_TYPE_EDITOR: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Приоритет — свой тип', en: 'Priority is a custom type' },
    hint: {
      ru: 'Приоритет — тип из реестра типов таблицы: в данных число, в ячейке — слово. Тип задаёт и свой редактор.',
      en: "Priority is a type from the table's type registry: a number in the data, a word in the cell. The type also sets its own editor.",
    },
  },
  {
    title: { ru: 'Редактор типа', en: 'The type editor' },
    hint: {
      ru: 'Пользователь нажал кнопку правки приоритета. Вместо поля ввода — переключатель из трёх вариантов: его задал тип колонки.',
      en: 'The user pressed the priority edit button. Instead of an input field, there is a switch with three options, set by the column type.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => !!priorityEditor(root),
      root =>
        priorityCell(root)
          ?.querySelector<HTMLElement>('.cell__button button')
          ?.click(),
    ),
  },
  {
    title: { ru: 'Вариант сохранён', en: 'The option is saved' },
    hint: {
      ru: 'Пользователь выбрал высокий приоритет. Правка закрылась, в ячейке новая подпись, в данных — число.',
      en: 'The user chose high priority. Editing closed; the cell shows the new label, and the data holds a number.',
    },
    enter: untilDone(
      root =>
        !priorityEditor(root) && priorityText(root) === priorityLabel(HIGH),
      root => {
        const editor = priorityEditor(root)
        if (!editor)
          priorityCell(root)
            ?.querySelector<HTMLElement>('.cell__button button')
            ?.click()
        else
          editor.querySelector<HTMLElement>(`[data-value="${HIGH}"]`)?.click()
      },
    ),
  },
]

/** ADR 0175, S7: разработчик задаёт свой редактор типа в реестре `dataTypes`. */
export const EditingTypeEditor: StoryObj<StoryProps> = {
  name: 'Editor of a data type',
  parameters: {
    scenario: '0175/S7',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Свой редактор типа', en: 'A custom type editor' }}
      steps={EDIT_TYPE_EDITOR}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnsOverride: PRIORITY_COLUMNS,
          dataOverride: PRIORITY_ROWS,
          dataTypes: PRIORITY_TYPES,
          editableColumns: ['priority'],
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_TYPE_EDITOR[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(priorityText(canvas)).toBe(
          priorityLabel(PRIORITY_ROWS[0]!.priority),
        ),
      )
    })
    await step(EDIT_TYPE_EDITOR[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(priorityEditor(canvas)).not.toBeNull())
      await until(() =>
        expect(
          priorityCell(canvas)!.querySelector('input:not([type="radio"])'),
        ).toBeNull(),
      )
      await until(() =>
        expect(
          priorityEditor(canvas)!.querySelector('[role="radiogroup"]'),
        ).not.toBeNull(),
      )
    })
    await step(EDIT_TYPE_EDITOR[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(priorityEditor(canvas)).toBeNull())
      await until(() => expect(priorityText(canvas)).toBe(priorityLabel(HIGH)))
      await until(() =>
        expect(consoleText()).toMatch(new RegExp(`value:${HIGH}`)),
      )
      await settle()
    })
  },
}
