import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { CellComponentProps } from '../core/createSlots'
import type { ServerRowsRequest } from '../plugins'
import { exportFormats } from '../plugins/dataExport'
import type { ColumnDef } from '../types'
import { compareDecimal, decimalText, parseDecimal } from '../util/decimal'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  byTestId,
  guideNext,
  headCell,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import {
  AMOUNT_ROWS,
  BALANCE_COLUMN,
  LOCALE_ROWS,
  MANAGERS,
  MANAGER_COLUMN,
  MEDIUM_DATES,
  MONEY_TYPES,
  PERSON_TYPES,
  SORT_ROWS,
  STATUS_OPTIONS,
  managedRows,
  ownedRows,
  productColumns,
  productRows,
} from './__mocks__/dataTypesData'
import {
  axisChecked,
  chooseAxis,
  interceptDownload,
  onExported,
  openExportPanel,
  runExport,
  zipEntryText,
} from './__mocks__/exportGuide'
import {
  calendar,
  checkOption,
  chooseOperator,
  closePanel,
  filterActive,
  filteredCount,
  openPanel,
  optionOf,
  pickDay,
} from './__mocks__/filterGuide'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Типы данных колонок (ADR 0172): вид значения, выравнивание и формат по типу колонки,
 * свои типы реестром. `Playground` — все встроенные типы и свой тип «деньги»; язык и пояс
 * меняют формат денег и время.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types',
} satisfies Meta<StoryProps>

export default meta

const ROWS = productRows(50)
const OWN_TABLE = 'Строки и колонки задаёт раздел: по колонке на каждый тип'

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

// --- Чтение ячеек в `play` ----------------------------------------------------------

const CELL = '.data-grid__body-cell'
const cellOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  root.querySelectorAll<HTMLElement>(
    `.data-grid__body-row ${CELL}[data-column-id="${columnId}"]`,
  )[rowIndex]
const textOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  cellOf(root, rowIndex, columnId)?.textContent?.trim()

const localeOf = (args: StoryProps) =>
  args.locale === 'ru' ? 'ru-RU' : 'en-US'

// --- S3: свой тип «деньги» ------------------------------------------------------------

const CUSTOM_TYPE: readonly GuideStoryStep[] = [
  {
    title: 'Цена — обычное число',
    hint: 'Приложение показывает цену как число без единиц. Значения выровнены по правому краю, цифры стоят друг под другом.',
    props: () => ({
      columnsOverride: productColumns('number'),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Свой тип «деньги»',
    hint: 'Приложение описало свой тип для денег и назначило его колонке цены. Цена показана в долларах со знаком валюты и двумя знаками после запятой, выравнивание по правому краю сохранилось.',
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
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBe('end')
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

// --- Порядок и отбор в `play` и действиях шагов ----------------------------------------

const rowIds = (root: HTMLElement) =>
  orderedRows(root).map(row => row.dataset.rowId)
const idsOf = (...indexes: number[]) =>
  indexes.map(index => `product-${index + 1}`)
const sortButtonOf = (root: HTMLElement, column: string) =>
  headCell(root, column)?.querySelector<HTMLElement>('.column-sort__button') ??
  null
const sortOf = (root: HTMLElement, column: string) =>
  headCell(root, column)?.getAttribute('aria-sort') ?? 'none'
/** Пользователь нажимает кнопку сортировки колонки, пока порядок не станет нужным. */
const sortTo = (column: string, direction: 'ascending' | 'descending') =>
  untilDone(
    root => sortOf(root, column) === direction,
    root => sortButtonOf(root, column)?.click(),
  )
const columnsOf = (priceType: string, ids: readonly string[]) =>
  productColumns(priceType).filter(column => ids.includes(column.id!))

// --- S1: сортировка по типу ------------------------------------------------------------

const SORT: readonly GuideStoryStep[] = [
  {
    title: 'Строки в порядке данных',
    hint: 'Товары идут в порядке данных. У части товаров нет названия, цены или даты выпуска — такие ячейки пусты.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price', 'released']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Пользователь отсортировал по названию',
    hint: 'Названия идут от конца алфавита к началу без учёта заглавных букв, а номера в названиях сравниваются как числа: десятый номер выше второго. Товары без названия — в конце.',
    enter: sortTo('name', 'descending'),
  },
  {
    title: 'Пользователь сменил направление',
    hint: 'Пользователь нажал кнопку сортировки ещё раз. Названия идут по алфавиту, второй номер раньше десятого. Товары без названия по-прежнему в конце.',
    enter: sortTo('name', 'ascending'),
  },
  {
    title: 'Пользователь отсортировал по цене',
    hint: 'Цены сравниваются как числа, а не как текст: от большей к меньшей. Товары без цены — в конце.',
    enter: sortTo('price', 'descending'),
  },
  {
    title: 'Пользователь отсортировал по дате выпуска',
    hint: 'Даты выпуска хранятся строками, но сравниваются как даты: от поздней к ранней. Товар без даты — в конце.',
    enter: sortTo('released', 'descending'),
  },
]

/** ADR 0172, S1: пользователь сортирует текст, числа и даты-строки — порядок по типу. */
export const DataTypesSort: StoryObj<StoryProps> = {
  name: 'Sort by type',
  parameters: { scenario: '0172/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Сортировка по типу данных"
      steps={SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const sortedBy = async (column: string, order: string[]) => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, order.length)).toEqual(order),
      )
      await expect(sortOf(canvas, column)).not.toBe('none')
    }
    await step(SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(SORT[1]!.title, async () => {
      await sortedBy('name', idsOf(4, 0, 3, 6, 9, 7, 5, 1))
      await expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(2, 8).sort())
    })
    await step(SORT[2]!.title, async () => {
      await sortedBy('name', idsOf(1, 5, 7, 9, 6, 3, 0, 4))
      await expect(sortOf(canvas, 'name')).toBe('ascending')
      await expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(2, 8).sort())
    })
    await step(SORT[3]!.title, async () => {
      await sortedBy('price', idsOf(4, 6, 0, 5, 2, 7, 1, 8))
      await expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(3, 9).sort())
    })
    await step(SORT[4]!.title, async () => {
      await sortedBy('released', idsOf(8, 3, 9, 0, 6, 2, 1, 7, 5, 4))
      await settle()
    })
  },
}

// --- S2: фильтр дат, хранящихся строками ----------------------------------------------

const FILTER_ROWS = productRows(50)
const FILTER_DAY = '2026-06-15'
const RELEASED = {
  on: FILTER_ROWS.filter(row => row.released === FILTER_DAY).length,
  after: FILTER_ROWS.filter(row => row.released > FILTER_DAY).length,
}
/** Число строк, которое называет нижняя панель: первое число подписи. */
const shownRows = () => Number(filteredCount().match(/\d+/)?.[0] ?? Number.NaN)

/** Пользователь выбирает день выпуска и условие, затем закрывает панель. */
const filterReleased = async (
  root: HTMLElement,
  operator: keyof typeof RELEASED,
  signal: AbortSignal,
) => {
  if (shownRows() !== RELEASED[operator]) {
    await openPanel(root, 'released', signal)
    if (!filterActive(root, 'released')) {
      await pickDay('2026', 5, FILTER_DAY, signal)
      await pollUntil(() => filterActive(root, 'released'), signal)
    }
    await chooseOperator(operator, signal)
    await pollUntil(() => shownRows() === RELEASED[operator], signal)
  }
  await closePanel(signal)
}

const FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Колонка дат без настройки фильтра',
    hint: 'Дата выпуска хранится строкой, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: productColumns(),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Пользователь открыл фильтр даты выпуска',
    hint: 'Тип колонки — дата, поэтому панель предлагает условие и календарь для выбора дня, а не поле для текста.',
    states: ['overlay.filterDate'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'released', signal)
      await pollUntil(() => !!calendar(), signal)
    }),
  },
  {
    title: 'Пользователь выбрал день',
    hint: 'Остались товары, выпущенные в этот день: строки с датами сравниваются как даты. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) => filterReleased(root, 'on', signal)),
  },
  {
    title: 'Пользователь сменил условие',
    hint: 'Пользователь выбрал условие для дней позже выбранного. Остались товары, выпущенные после этого дня.',
    enter: stepAction((root, { signal }) =>
      filterReleased(root, 'after', signal),
    ),
  },
]

/** ADR 0172, S2: пользователь фильтрует даты-строки без настройки фильтра колонки. */
export const DataTypesFilter: StoryObj<StoryProps> = {
  name: 'Filter by type',
  parameters: { scenario: '0172/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр по типу данных"
      steps={FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = FILTER_ROWS.length
    await step(FILTER[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(
        headCell(canvas, 'released')?.querySelector('.column-filter__button'),
      ).not.toBeNull()
    })
    await step(FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(calendar()).not.toBeNull()
      await expect(byTestId('filter-value')).toBeNull()
      await settle()
    })
    await step(FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(
        labels.filteredRows(RELEASED.on, total),
      )
      await expect(orderedRows(canvas).map(row => row.dataset.rowId)).toEqual(
        FILTER_ROWS.filter(row => row.released === FILTER_DAY).map(
          row => row.id,
        ),
      )
    })
    await step(FILTER[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(
        labels.filteredRows(RELEASED.after, total),
      )
      await settle()
    })
  },
}

// --- S6: выгрузка в Excel ячейками своего типа -----------------------------------------

const EXPORT_ROWS = productRows(20)

const EXPORT_XLSX: readonly GuideStoryStep[] = [
  {
    title: 'Колонки разных типов',
    hint: 'В таблице есть цена и количество, отметка наличия и даты. К выгрузке подключён формат Excel.',
    props: () => ({
      columnsOverride: columnsOf('money', [
        'name',
        'price',
        'quantity',
        'inStock',
        'released',
        'updatedAt',
      ]),
      dataOverride: EXPORT_ROWS,
      dataTypes: MONEY_TYPES,
      enableDataExport: true,
      dataExportFormats: [exportFormats.csv(), exportFormats.xlsx()],
      onExported,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Пользователь выбрал Excel',
    hint: 'В настройках выгрузки выбран формат Excel.',
    states: ['overlay.export'],
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
    }),
  },
  {
    title: 'Пользователь выгрузил',
    hint: 'Скачался файл Excel. Цена и количество в нём — числа, отметка наличия — да или нет, даты — даты: в Excel их можно считать и сортировать по значению, а не как текст.',
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
      await runExport(signal)
    }),
  },
]

/** ADR 0172, S6: выгрузка в Excel — числа, булевы значения и даты ячейками своего типа. */
export const DataTypesExportXlsx: StoryObj<StoryProps> = {
  name: 'Export to Excel',
  parameters: { scenario: '0172/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выгрузка типов в Excel"
      steps={EXPORT_XLSX}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(EXPORT_XLSX[0]!.title, async () => {
        await waitForRows(canvas)
      })
      await step(EXPORT_XLSX[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(EXPORT_XLSX[2]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.xlsx'])
        const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
        const sheet = await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')
        const { name, price, quantity, inStock } = EXPORT_ROWS[0]!
        // Строка 2 — первая строка данных: A — текст, B–C — числа, D — булево, E–F — даты.
        expect(sheet).toContain(`<t xml:space="preserve">${name}</t>`)
        expect(sheet).toContain(`<c r="B2"><v>${price}</v></c>`)
        expect(sheet).toContain(`<c r="C2"><v>${quantity}</v></c>`)
        expect(sheet).toContain(`<c r="D2" t="b"><v>${inStock ? 1 : 0}</v></c>`)
        expect(sheet).toMatch(/<c r="E2" s="\d+"><v>[\d.]+<\/v><\/c>/)
        expect(sheet).toMatch(/<c r="F2" s="\d+"><v>[\d.]+<\/v><\/c>/)
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

// --- S7: язык на лету -------------------------------------------------------------------

const LOCALE_COLUMNS = columnsOf('money', ['name', 'price', 'quantity'])
const namesIn = (locale: string) =>
  LOCALE_ROWS.map(row => row.name).sort(new Intl.Collator(locale).compare)
const moneyIn = (locale: string, value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    value,
  )

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
      ).toBe(storyLabels('en').clearSort)
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
      ).toBe(storyLabels('ru').clearSort)
      await settle()
    })
  },
}

// --- S8: правка числа с десятичной запятой ---------------------------------------------

const EDIT_TOTAL = 200
const EDIT_ROWS = productRows(EDIT_TOTAL)
const EDIT_ROW = 'product-1'
const TYPED_PRICE = '1 234,5'
const SAVED_PRICE = 1234.5

const priceCellOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${EDIT_ROW}"] ${CELL}[data-column-id="price"]`,
  )
const priceInput = (root: ParentNode) =>
  priceCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
const priceEditButton = (root: ParentNode) =>
  priceCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null
/** Значение в ячейке — без кнопки правки. */
const priceText = (root: ParentNode) => {
  const copy = priceCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
/** Пользователь открывает правку цены кнопкой ячейки и набирает число. */
const draftPrice = (root: HTMLElement) => {
  const input = priceInput(root)
  if (!input) priceEditButton(root)?.click()
  else if (input.value !== TYPED_PRICE) typeInto(input, TYPED_PRICE)
}
/** Черновик набран — пользователь сохраняет его клавишей Enter. */
const savePrice = (root: HTMLElement) => {
  const input = priceInput(root)
  if (input?.value === TYPED_PRICE)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
  else draftPrice(root)
}
const savedText = () => moneyIn('ru-RU', SAVED_PRICE)

const EDIT_NUMBER: readonly GuideStoryStep[] = [
  {
    title: 'Цены на русском языке',
    hint: 'Строки приходят с сервера, таблица на русском языке. Цена показана с пробелом между разрядами и запятой перед дробной частью.',
    props: () => ({
      locale: 'ru',
      columnsOverride: columnsOf('money', ['name', 'price', 'quantity']),
      dataOverride: [],
      dataTypes: MONEY_TYPES,
      enableServerRowModel: true,
      serverRowModelBlockSize: 50,
      rowCount: EDIT_TOTAL,
      serverRowModelGetRows: ({ start, end }: ServerRowsRequest) =>
        Promise.resolve({
          rows: EDIT_ROWS.slice(start, end),
          rowCount: EDIT_TOTAL,
        }),
      enableCellEditing: true,
      cellEditingCanEditCell: (ctx: CellComponentProps) =>
        ctx.column.id === 'price',
    }),
  },
  {
    title: 'Пользователь набрал цену',
    hint: 'Пользователь открыл правку цены и набрал число так, как его пишут по-русски: с пробелом между разрядами и десятичной запятой.',
    states: ['body.editing'],
    enter: untilDone(
      root => priceInput(root)?.value === TYPED_PRICE,
      draftPrice,
    ),
  },
  {
    title: 'Таблица сохранила число',
    hint: 'Пользователь нажал Enter. Таблица разобрала набранный текст по правилам языка и записала в строку число: ячейка показывает новую цену в том же виде, что и остальные.',
    enter: untilDone(
      root => !priceInput(root) && priceText(root) === savedText(),
      savePrice,
    ),
  },
]

/** ADR 0172, S8: пользователь правит цену с десятичной запятой — ввод разобран по языку. */
export const DataTypesEditNumber: StoryObj<StoryProps> = {
  name: 'Edit a number',
  parameters: { scenario: '0172/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title="Правка числа по языку"
      steps={EDIT_NUMBER}
      args={guideArgs({ height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_NUMBER[0]!.title, async () => {
      await until(() =>
        expect(priceText(canvas)).toBe(moneyIn('ru-RU', EDIT_ROWS[0]!.price)),
      )
      await expect(priceEditButton(canvas)).not.toBeNull()
    })
    await step(EDIT_NUMBER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)?.value).toBe(TYPED_PRICE))
    })
    await step(EDIT_NUMBER[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)).toBeNull())
      await expect(priceText(canvas)).toBe(savedText())
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
          labels.filteredRows(SEARCH_COUNTS.day, total),
        ),
      )
    })
    await step(SEARCH[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(byTestId('filtered-rows-count')?.textContent).toBe(
          labels.filteredRows(SEARCH_COUNTS.sale, total),
        ),
      )
      await expect(statusTexts(canvas).every(text => text === ON_SALE)).toBe(
        true,
      )
      await settle()
    })
  },
}

// --- ADR 0174, S1: запись в сортировке и фильтре ---------------------------------------

const MANAGED_ROWS = managedRows(40)
const OBJECT_MANAGER = MANAGERS[1]!
const managerTexts = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row
        .querySelector(`${CELL}[data-column-id="manager"]`)
        ?.textContent?.trim() ?? '',
  )
const managerFiltered = (root: HTMLElement) =>
  filterActive(root, 'manager') &&
  managerTexts(root).length > 0 &&
  managerTexts(root).every(text => text === OBJECT_MANAGER.name)

/** Пользователь отмечает менеджера в фильтре и закрывает панель. */
const filterManager = async (root: HTMLElement, signal: AbortSignal) => {
  if (!managerFiltered(root)) {
    await openPanel(root, 'manager', signal)
    await pollUntil(() => !!byTestId('filter-options'), signal)
    await checkOption(OBJECT_MANAGER.id, signal)
    await pollUntil(() => managerFiltered(root), signal)
  }
  await closePanel(signal)
}

const OBJECT: readonly GuideStoryStep[] = [
  {
    title: 'Менеджеры — записи',
    hint: 'У каждой строки в колонке менеджера — запись с номером и именем. Таблица показывает имя.',
    props: () => ({
      columnsOverride: [
        ...columnsOf('number', ['name', 'price']),
        MANAGER_COLUMN,
      ],
      dataOverride: MANAGED_ROWS,
      enableColumnSorting: true,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь отсортировал по менеджеру',
    hint: 'Пользователь нажал кнопку сортировки дважды. Строки упорядочены по имени менеджера, по алфавиту.',
    enter: sortTo('manager', 'ascending'),
  },
  {
    title: 'Пользователь открыл фильтр менеджера',
    hint: 'Панель предлагает список имён с флажками и числом строк у каждого.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'manager', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
    }),
  },
  {
    title: 'Пользователь отметил менеджера',
    hint: 'Остались строки этого менеджера. Записи из разных строк таблица узнаёт по номеру, поэтому все они попали в отбор.',
    enter: stepAction((root, { signal }) => filterManager(root, signal)),
  },
]

/** ADR 0174, S1: пользователь сортирует и фильтрует колонку менеджеров-записей по имени. */
export const DataTypesObject: StoryObj<StoryProps> = {
  name: 'Object records',
  parameters: { scenario: '0174/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Записи в колонке"
      steps={OBJECT}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const total = MANAGED_ROWS.length
    const count = MANAGED_ROWS.filter(
      row => row.manager.id === OBJECT_MANAGER.id,
    ).length
    await step(OBJECT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(managerTexts(canvas)[0]).toBe(MANAGED_ROWS[0]!.manager.name)
    })
    await step(OBJECT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(sortOf(canvas, 'manager')).toBe('ascending'))
      const texts = managerTexts(canvas)
      await expect(texts).toEqual(
        [...texts].sort(new Intl.Collator('en').compare),
      )
      await expect(texts[0]).toBe(MANAGERS[0]!.name)
    })
    await step(OBJECT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(optionOf(OBJECT_MANAGER.id)?.textContent).toContain(
        OBJECT_MANAGER.name,
      )
      await expect(optionOf(OBJECT_MANAGER.id)?.textContent).toContain(
        String(count),
      )
      await settle()
    })
    await step(OBJECT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(labels.filteredRows(count, total))
      await expect(managerFiltered(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0174, S2: ключ и составная подпись записи -------------------------------------

const OWNED_ROWS = ownedRows(20)
const ownerColumn = (dataType: string): ColumnDef<any, any> => ({
  id: 'owner',
  accessorKey: 'owner',
  header: 'Owner',
  dataType,
})

const OBJECT_LABEL: readonly GuideStoryStep[] = [
  {
    title: 'Запись без настройки',
    hint: 'Приложение назначило колонке владельца тип записи, но у его записей нет полей, которые таблица понимает сама: номер лежит в другом поле, имя — в двух. Ячейки пусты, в консоли разработчика — предупреждение о записи без номера.',
    props: () => ({
      columnsOverride: [
        ...columnsOf('number', ['name', 'price']),
        ownerColumn('object'),
      ],
      dataOverride: OWNED_ROWS,
    }),
  },
  {
    title: 'Приложение описало запись',
    hint: 'Приложение описало свой тип «человек»: где у записи номер и как из её полей собрать подпись. Колонка владельца показывает имя и фамилию.',
    props: () => ({
      columnsOverride: [
        ...columnsOf('number', ['name', 'price']),
        ownerColumn('person'),
      ],
      dataTypes: PERSON_TYPES,
    }),
  },
]

/** ADR 0174, S2: разработчик задаёт ключ и составную подпись своей записи. */
export const DataTypesObjectLabel: StoryObj<StoryProps> = {
  name: 'Object key and label',
  parameters: { scenario: '0174/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Ключ и подпись записи"
      steps={OBJECT_LABEL}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const { owner } = OWNED_ROWS[0]!
    await step(OBJECT_LABEL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'owner')).toBe(''))
    })
    await step(OBJECT_LABEL[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(textOf(canvas, 0, 'owner')).toBe(`${owner.first} ${owner.last}`),
      )
      await settle()
    })
  },
}

// --- ADR 0174, S3: суммы строками — точный порядок ---------------------------------------

const AMOUNT_COLUMNS: ColumnDef<any, any>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'numberString',
    size: 240,
  },
]
const amountTexts = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row
        .querySelector(`${CELL}[data-column-id="amount"]`)
        ?.textContent?.trim() ?? '',
  )
/** Порядок сумм по значению: те же строки, сравнение — по цифрам. */
const amountsDesc = () =>
  [...AMOUNT_ROWS]
    .map(row => row.amount)
    .sort((a, b) => compareDecimal(parseDecimal(b)!, parseDecimal(a)!))

const NUMBER_STRING: readonly GuideStoryStep[] = [
  {
    title: 'Суммы хранятся строками',
    hint: 'Сервер отдаёт суммы строками, чтобы не терять знаки: у двух самых больших сумм различается только последняя цифра. Таблица показывает суммы как есть и выравнивает их по правому краю.',
    props: () => ({
      columnsOverride: AMOUNT_COLUMNS,
      dataOverride: AMOUNT_ROWS,
      enableColumnSorting: true,
    }),
  },
  {
    title: 'Пользователь отсортировал по сумме',
    hint: 'Суммы упорядочены по значению от большей к меньшей, с учётом знака. Две самые большие суммы стоят в верном порядке, хотя обычным числом они бы совпали.',
    enter: sortTo('amount', 'descending'),
  },
]

/** ADR 0174, S3: пользователь сортирует суммы, хранящиеся строками, — порядок точный. */
export const DataTypesNumberString: StoryObj<StoryProps> = {
  name: 'Decimal strings',
  parameters: { scenario: '0174/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Суммы строками"
      steps={NUMBER_STRING}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_STRING[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(amountTexts(canvas)).toEqual(AMOUNT_ROWS.map(row => row.amount)),
      )
      await expect(cellOf(canvas, 0, 'amount')!.dataset.align).toBe('end')
    })
    await step(NUMBER_STRING[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(amountTexts(canvas)).toEqual(amountsDesc()))
      const [first, second] = amountTexts(canvas)
      await expect(Number(first)).toBe(Number(second))
      await settle()
    })
  },
}

// --- ADR 0174, S4: суммы строками в Excel -----------------------------------------------

const AMOUNT_EXPORT: readonly GuideStoryStep[] = [
  {
    title: 'Суммы строками и выгрузка',
    hint: 'Суммы хранятся строками. К выгрузке подключён формат Excel.',
    props: () => ({
      columnsOverride: AMOUNT_COLUMNS,
      dataOverride: AMOUNT_ROWS,
      enableDataExport: true,
      dataExportFormats: [exportFormats.csv(), exportFormats.xlsx()],
      onExported,
    }),
  },
  {
    title: 'Пользователь выбрал Excel',
    hint: 'В настройках выгрузки выбран формат Excel.',
    states: ['overlay.export'],
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
    }),
  },
  {
    title: 'Пользователь выгрузил',
    hint: 'Скачался файл Excel. Суммы в нём — числа, с ними можно считать. Сумма длиннее пятнадцати знаков записана текстом: числом Excel её бы округлил.',
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
      await runExport(signal)
    }),
  },
]

/** ADR 0174, S4: пользователь выгружает суммы-строки в Excel и получает числа. */
export const DataTypesNumberStringExport: StoryObj<StoryProps> = {
  name: 'Decimal strings to Excel',
  parameters: { scenario: '0174/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Суммы строками в Excel"
      steps={AMOUNT_EXPORT}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(AMOUNT_EXPORT[0]!.title, async () => {
        await waitForRows(canvas)
      })
      await step(AMOUNT_EXPORT[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(AMOUNT_EXPORT[2]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.xlsx'])
        const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
        const sheet = await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')
        // Строка 2 — первая сумма: длинная, текстом; строка 4 — короткая, числом.
        expect(sheet).toContain(
          `<t xml:space="preserve">${AMOUNT_ROWS[0]!.amount}</t>`,
        )
        expect(sheet).toContain(
          `<c r="B4"><v>${decimalText(parseDecimal(AMOUNT_ROWS[2]!.amount)!)}</v></c>`,
        )
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}
