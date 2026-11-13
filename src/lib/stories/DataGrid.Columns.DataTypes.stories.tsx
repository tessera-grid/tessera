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
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
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

const CUSTOM_TYPE: readonly GuideStoryStep[] = [
  {
    title: 'Цена — обычное число',
    hint: 'Приложение показывает цену как число без единиц. Значения выровнены по левому краю, как текст, цифры одной ширины.',
    props: () => ({
      columnsOverride: productColumns('number'),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Свой тип «деньги»',
    hint: 'Приложение описало свой тип для денег и назначило его колонке цены. Цена показана в долларах со знаком валюты и двумя знаками после запятой и выровнена по правому краю — так задал тип.',
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
    <GuideStory
      title="Свой тип данных"
      steps={CUSTOM_TYPE}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const price = ROWS[0]!.price
    await step(CUSTOM_TYPE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'price')).toBe(String(price)))
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBeUndefined()
    })
    await step(CUSTOM_TYPE[1]!.title, async () => {
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

const OVERRIDE_BUILT_IN: readonly GuideStoryStep[] = [
  {
    title: 'Даты по умолчанию',
    hint: 'Даты показаны в нейтральном виде: год, месяц и день, у даты со временем — ещё часы и минуты.',
    props: () => ({
      columnsOverride: productColumns(),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Вид дат сменился во всей таблице',
    hint: 'Приложение в одном месте задало новый вид для встроенных типов дат. Обе колонки с датами показывают месяц словом, а дата со временем — ещё и время, хотя сами колонки не менялись.',
    props: () => ({ dataTypes: MEDIUM_DATES }),
  },
]

/** ADR 0172, S4: разработчик меняет вид всех дат таблицы в одном месте. */
export const DataTypesOverrideBuiltIn: StoryObj<StoryProps> = {
  name: 'Override built-in type',
  parameters: { scenario: '0172/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вид встроенного типа"
      steps={OVERRIDE_BUILT_IN}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const { released, updatedAt } = ROWS[0]!
    await step(OVERRIDE_BUILT_IN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'released')).toBe(released))
      await expect(textOf(canvas, 0, 'updatedAt')).toBe(
        `${updatedAt.slice(0, 10)} ${updatedAt.slice(11, 16)}`,
      )
    })
    await step(OVERRIDE_BUILT_IN[1]!.title, async () => {
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

const LOCALE: readonly GuideStoryStep[] = [
  {
    title: 'Таблица на английском языке',
    hint: 'Цены показаны по правилам английского языка: знак доллара перед числом, запятая между разрядами.',
    props: () => ({
      locale: 'en',
      columnsOverride: LOCALE_COLUMNS,
      dataOverride: LOCALE_ROWS,
      dataTypes: MONEY_TYPES,
      enableColumnSorting: true,
    }),
  },
  {
    title: 'Пользователь отсортировал по названию',
    hint: 'Названия идут по алфавиту. По правилам английского языка латиница стоит раньше кириллицы.',
    enter: sortTo('name', 'ascending'),
  },
  {
    title: 'Пользователь переключил язык на русский',
    hint: 'Приложение сменило язык, таблица не открывалась заново и сохранила сортировку. Цены показаны по-русски: пробел между разрядами, запятая перед дробной частью, знак доллара после числа. По правилам русского языка кириллица стоит раньше латиницы, поэтому порядок названий сменился. Подписи кнопок таблицы тоже на русском.',
    props: () => ({ locale: 'ru' }),
    enter: sortTo('name', 'ascending'),
  },
]

/** ADR 0172, S7: язык на лету — формат денег и порядок сортировки без пересоздания. */
export const DataTypesLocale: StoryObj<StoryProps> = {
  name: 'Switch language',
  parameters: { scenario: '0172/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title="Язык таблицы"
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
    await step(LOCALE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(textOf(canvas, 0, 'price')).toBe(moneyIn('en-US', price)),
      )
    })
    await step(LOCALE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(rowIds(canvas)).toEqual(nameOrder('en-US')))
      await expect(
        sortButtonOf(canvas, 'name')?.getAttribute('aria-label'),
      ).toBe(columnSortingLabels(storyLabels('en')).clearSort)
    })
    await step(LOCALE[2]!.title, async () => {
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

const SEARCH: readonly GuideStoryStep[] = [
  {
    title: 'Товары с датами и статусами',
    hint: 'В таблице есть даты выпуска, статусы и цены. Над таблицей — поле поиска.',
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
    title: 'Пользователь ищет дату',
    hint: 'Пользователь набрал дату так, как она показана в таблице. Остался товар, выпущенный в этот день; нижняя панель называет число найденных строк.',
    enter: searchFor(
      SEARCH_DAY,
      root =>
        orderedRows(root).length === SEARCH_COUNTS.day &&
        searchField()?.value === SEARCH_DAY,
    ),
  },
  {
    title: 'Пользователь ищет статус',
    hint: 'Пользователь набрал статус так, как он показан в ячейке. Остались товары с этим статусом, хотя в данных статус хранится другим словом.',
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
    <GuideStory
      title="Поиск по показанному тексту"
      steps={SEARCH}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = SEARCH_ROWS.length
    await step(SEARCH[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(searchField()).not.toBeNull())
    })
    await step(SEARCH[1]!.title, async () => {
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
    await step(SEARCH[2]!.title, async () => {
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

const EDIT_TYPE_EDITOR: readonly GuideStoryStep[] = [
  {
    title: 'Приоритет — свой тип',
    hint: 'Приоритет — тип из реестра типов таблицы: в данных число, в ячейке — слово. Тип задаёт и свой редактор.',
  },
  {
    title: 'Редактор типа',
    hint: 'Пользователь нажал кнопку правки приоритета. Вместо поля ввода — переключатель из трёх вариантов: его задал тип колонки.',
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
    title: 'Вариант сохранён',
    hint: 'Пользователь выбрал высокий приоритет. Правка закрылась, в ячейке новая подпись, в данных — число.',
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
    <GuideStory
      title="Свой редактор типа"
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
    await step(EDIT_TYPE_EDITOR[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(priorityText(canvas)).toBe(
          priorityLabel(PRIORITY_ROWS[0]!.priority),
        ),
      )
    })
    await step(EDIT_TYPE_EDITOR[1]!.title, async () => {
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
    await step(EDIT_TYPE_EDITOR[2]!.title, async () => {
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
