import { expect } from 'storybook/test'
import { exportFormats } from '../plugins/dataExport'
import { guideControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { SORT_ROWS, productRows } from './__mocks__/dataTypesData'
import {
  axisChecked,
  chooseAxis,
  interceptDownload,
  onExported,
  openExportPanel,
  runExport,
  zipEntryText,
} from './__mocks__/exportGuide'
import { chooseOperator, closePanel, openPanel } from './__mocks__/filterGuide'
import {
  columnsOf,
  filterValueField,
  idsOf,
  rowIds,
  shownCount,
  sortOf,
  sortTo,
  typeFilterValue,
} from './__mocks__/typeGuides'
import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { untilDone } from './__mocks__/cellGestures'
import { consoleText } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { EDIT_ROWS } from './__mocks__/editingData'
import { storyLabels } from './__mocks__/storyLabels'
import { type CellComponentProps } from '../core/createSlots'
import { type ServerRowsRequest } from '../plugins'
import { MONEY_TYPES } from './__mocks__/dataTypesData'
import {
  productInput,
  productEditButton,
  productText,
  fieldError,
  typeInto,
  typeAndSave,
  localeOf,
  dollars,
  productArgs,
  OWN_TABLE,
  CELL,
  moneyIn,
} from './__mocks__/typeGuides'
import { cellEditingLabels } from '../plugins/cellEditing/labels'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Number',
} satisfies Meta<StoryProps>

export default meta

export const NumberPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: цена и количество — числа. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'price', 'quantity']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['price', 'quantity'],
    enableColumnSorting: true,
    enableColumnFiltering: true,
  },
  parameters: showControls(
    [
      'enableCellEditing',
      'enableColumnSorting',
      'enableColumnFiltering',
      'locale',
    ],
    { columnCount: OWN_TABLE, dataCount: OWN_TABLE },
  ),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- S8: правка числа с десятичной запятой ---------------------------------------------

const COMMA_TOTAL = 200
const COMMA_ROWS = productRows(COMMA_TOTAL)
const COMMA_ROW = 'product-1'
const TYPED_PRICE = '1 234,5'
const SAVED_PRICE = 1234.5

const priceCellOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${COMMA_ROW}"] ${CELL}[data-column-id="price"]`,
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

const EDIT_COMMA: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Цены на русском языке', en: 'Prices in Russian' },
    hint: {
      ru: 'Строки приходят с сервера, таблица на русском языке. Цена показана с пробелом между разрядами и запятой перед дробной частью.',
      en: 'Rows come from the server, and the table is in Russian. The price is shown with a space between digit groups and a comma before the fractional part.',
    },
    props: () => ({
      locale: 'ru',
      columnsOverride: columnsOf('money', ['name', 'price', 'quantity']),
      dataOverride: [],
      dataTypes: MONEY_TYPES,
      enableServerRowModel: true,
      serverRowModelBlockSize: 50,
      rowCount: COMMA_TOTAL,
      serverRowModelGetRows: ({ start, end }: ServerRowsRequest) =>
        Promise.resolve({
          rows: COMMA_ROWS.slice(start, end),
          rowCount: COMMA_TOTAL,
        }),
      enableCellEditing: true,
      cellEditingCanEditCell: (ctx: CellComponentProps) =>
        ctx.column.id === 'price',
    }),
  },
  {
    title: { ru: 'Пользователь набрал цену', en: 'The user typed a price' },
    hint: {
      ru: 'Пользователь открыл правку цены и набрал число так, как его пишут по-русски: с пробелом между разрядами и десятичной запятой.',
      en: 'The user opened the price editor and typed a number the way it is written in Russian: with a space between digit groups and a decimal comma.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => priceInput(root)?.value === TYPED_PRICE,
      draftPrice,
    ),
  },
  {
    title: { ru: 'Таблица сохранила число', en: 'The table saved the number' },
    hint: {
      ru: 'Пользователь нажал Enter. Таблица разобрала набранный текст по правилам языка и записала в строку число: ячейка показывает новую цену в том же виде, что и остальные.',
      en: "The user pressed Enter. The table parsed the typed text according to the language's rules and wrote a number into the row: the cell shows the new price in the same form as the others.",
    },
    enter: untilDone(
      root => !priceInput(root) && priceText(root) === savedText(),
      savePrice,
    ),
  },
]

/** ADR 0172, S8: пользователь правит цену с десятичной запятой — ввод разобран по языку. */
export const DataTypesEditNumber: StoryObj<StoryProps> = {
  name: 'Edit with a decimal comma',
  parameters: { scenario: '0172/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Правка числа по языку',
        en: 'Locale-aware number editing',
      }}
      steps={EDIT_COMMA}
      args={guideArgs({ height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_COMMA[0]!.title.ru, async () => {
      await until(() =>
        expect(priceText(canvas)).toBe(moneyIn('ru-RU', COMMA_ROWS[0]!.price)),
      )
      await until(() => expect(priceEditButton(canvas)).not.toBeNull())
    })
    await step(EDIT_COMMA[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)?.value).toBe(TYPED_PRICE))
    })
    await step(EDIT_COMMA[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)).toBeNull())
      await until(() => expect(priceText(canvas)).toBe(savedText()))
      await settle()
    })
  },
}

const NOT_A_NUMBER = 'abc'
const NEW_PRICE = '1250'

const EDIT_NUMBER: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Цены на языке таблицы',
      en: "Prices in the table's language",
    },
    hint: {
      ru: 'Цена — число в формате денег на языке таблицы. Её можно править: при наведении на ячейку появляется кнопка правки.',
      en: "The price is a number in a currency format in the table's language. It is editable: hovering over a cell shows an edit button.",
    },
  },
  {
    title: { ru: 'Поле правки числа', en: 'The number editor' },
    hint: {
      ru: 'Пользователь нажал кнопку правки цены. В поле то же число с десятичным знаком языка таблицы, без знака валюты и разрядов.',
      en: "The user clicked the price's edit button. The field holds the same number with the decimal separator of the table's language, without a currency sign or digit grouping.",
    },
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'price'),
      root => productEditButton(root, 'price')?.click(),
    ),
  },
  {
    title: { ru: 'Не число', en: 'Not a number' },
    hint: {
      ru: 'Пользователь набрал буквы и нажал Enter. Значение не сохранено: поле осталось открытым, под ним текст ошибки.',
      en: 'The user typed letters and pressed Enter. The value is not saved: the field stayed open, with an error message below it.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => fieldError(root, 'price') !== '',
      root => typeAndSave(root, 'price', NOT_A_NUMBER),
    ),
  },
  {
    title: { ru: 'Число сохранено', en: 'The number is saved' },
    hint: {
      ru: 'Пользователь набрал число и нажал Enter. Поле закрылось, в ячейке новая цена в формате денег.',
      en: 'The user typed a number and pressed Enter. The field closed, and the cell shows the new price in the currency format.',
    },
    enter: untilDone(
      root =>
        !productInput(root, 'price') &&
        productText(root, 'price')?.replace(/\D/g, '').startsWith(NEW_PRICE) ===
          true,
      root => typeAndSave(root, 'price', NEW_PRICE),
    ),
  },
]

/** ADR 0175, S1: пользователь правит число на языке таблицы и видит ошибку при вводе не числа. */
export const EditingNumber: StoryObj<StoryProps> = {
  name: 'Edit',
  parameters: {
    scenario: '0175/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка числа', en: 'Editing a number' }}
      steps={EDIT_NUMBER}
      args={guideArgs(productArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const locale = localeOf(args)
    const labels = storyLabels(args.locale)
    const original = EDIT_ROWS[0]!.price
    await step(EDIT_NUMBER[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(productText(canvas, 'price')).toBe(dollars(locale, original)),
      )
      await until(() =>
        expect(productEditButton(canvas, 'price')).not.toBeNull(),
      )
    })
    await step(EDIT_NUMBER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).not.toBeNull())
      await until(() =>
        expect(productInput(canvas, 'price')!.value).toBe(
          new Intl.NumberFormat(locale, { useGrouping: false }).format(
            original,
          ),
        ),
      )
    })
    await step(EDIT_NUMBER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(fieldError(canvas, 'price')).toBe(
          cellEditingLabels(labels).editInvalidNumber,
        ),
      )
      await until(() =>
        expect(productInput(canvas, 'price')!.value).toBe(NOT_A_NUMBER),
      )
      await until(() =>
        expect(productInput(canvas, 'price')).toHaveAttribute(
          'aria-invalid',
          'true',
        ),
      )
      await until(() => expect(consoleText()).not.toContain('onCellEdit'))
    })
    await step(EDIT_NUMBER[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).toBeNull())
      await until(() =>
        expect(productText(canvas, 'price')).toBe(
          dollars(locale, Number(NEW_PRICE)),
        ),
      )
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(`value:${NEW_PRICE},text:"${NEW_PRICE}"`),
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0172, S9: сортировка чисел --------------------------------------------------------

const NUMBER_SORT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Цены в порядке данных', en: 'Prices in data order' },
    hint: {
      ru: 'Товары идут в порядке данных. У двух товаров нет цены — их ячейки пусты.',
      en: 'Products follow the data order. Two products have no price, so their cells are empty.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по цене',
      en: 'The user sorted by price',
    },
    hint: {
      ru: 'Цены сравниваются как числа, а не как текст: от большей к меньшей, тысяча выше двухсот. Товары без цены — в конце.',
      en: 'Prices are compared as numbers, not as text: from highest to lowest, with a thousand above two hundred. Products without a price come last.',
    },
    enter: sortTo('price', 'descending'),
  },
  {
    title: {
      ru: 'Пользователь сменил направление',
      en: 'The user changed the direction',
    },
    hint: {
      ru: 'Пользователь нажал кнопку сортировки ещё раз. Цены идут от меньшей к большей, товары без цены по-прежнему в конце.',
      en: 'The user clicked the sort button again. Prices go from lowest to highest, and products without a price still come last.',
    },
    enter: sortTo('price', 'ascending'),
  },
]

/** ADR 0172, S9: пользователь сортирует числа — по значению, пустые в конце. */
export const DataTypesNumberSort: StoryObj<StoryProps> = {
  name: 'Sort',
  parameters: { scenario: '0172/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сортировка чисел', en: 'Sorting numbers' }}
      steps={NUMBER_SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(NUMBER_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(4, 6, 0, 5, 2, 7, 1, 8),
        ),
      )
      expect(sortOf(canvas, 'price')).toBe('descending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(3, 9).sort())
    })
    await step(NUMBER_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(8, 1, 7, 2, 5, 0, 6, 4),
        ),
      )
      expect(sortOf(canvas, 'price')).toBe('ascending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(3, 9).sort())
      await settle()
    })
  },
}

// --- ADR 0172, S13: фильтр чисел -----------------------------------------------------------

const FILTER_ROWS = productRows(50)
const BOUND = '500'
const above = FILTER_ROWS.filter(row => row.price > Number(BOUND)).length

/** Пользователь выбирает условие «больше» и набирает границу. */
const filterAbove = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== above) {
    await openPanel(root, 'price', signal)
    await chooseOperator('greaterThan', signal)
    await typeFilterValue(BOUND, signal)
    await pollUntil(() => shownCount() === above, signal)
  }
  await closePanel(signal)
}

const NUMBER_FILTER: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Цены без настройки фильтра',
      en: 'Prices without a filter setup',
    },
    hint: {
      ru: 'Цена — число, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
      en: 'The price is a number, and the column has only a data type set. Filtering is enabled in the table, but the column itself has not configured a filter.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр цены',
      en: 'The user opened the price filter',
    },
    hint: {
      ru: 'Тип колонки — число, поэтому панель предлагает условия сравнения чисел и поле для числа.',
      en: "The column's type is number, so the panel offers number comparison conditions and a field for a number.",
    },
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'price', signal)
      await pollUntil(() => !!filterValueField(), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отобрал цены больше границы',
      en: 'The user kept prices above a threshold',
    },
    hint: {
      ru: 'Пользователь выбрал условие «больше» и набрал число. Остались товары дороже: цены сравниваются как числа. Нижняя панель называет число оставшихся строк.',
      en: 'The user chose the "greater than" condition and typed a number. More expensive products remain: prices are compared as numbers. The status bar shows the number of remaining rows.',
    },
    enter: stepAction((root, { signal }) => filterAbove(root, signal)),
  },
]

/** ADR 0172, S13: пользователь фильтрует числа без настройки фильтра колонки. */
export const DataTypesNumberFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S13', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Фильтр чисел', en: 'Filtering numbers' }}
      steps={NUMBER_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(NUMBER_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(filterValueField()).toHaveAttribute('inputmode', 'decimal')
      await settle()
    })
    await step(NUMBER_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(above)
      expect(above).toBeGreaterThan(0)
      expect(above).toBeLessThan(FILTER_ROWS.length)
      await settle()
    })
  },
}

// --- ADR 0172, S6: выгрузка чисел в Excel ----------------------------------------------------

const EXPORT_ROWS = productRows(20)

/** Пользователь выбирает Excel и выгружает. */
const exportXlsx = async (root: HTMLElement, signal: AbortSignal) => {
  await openExportPanel(root, signal)
  await chooseAxis('format', 'xlsx', signal)
}

const NUMBER_EXCEL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Цена и количество', en: 'Price and quantity' },
    hint: {
      ru: 'В таблице цена и количество — числа. К выгрузке подключён формат Excel.',
      en: 'In the table, price and quantity are numbers. The Excel format is enabled for export.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price', 'quantity']),
      dataOverride: EXPORT_ROWS,
      enableDataExport: true,
      dataExportFormats: [exportFormats.csv(), exportFormats.xlsx()],
      onExported,
    }),
  },
  {
    title: { ru: 'Пользователь выбрал Excel', en: 'The user chose Excel' },
    hint: {
      ru: 'В настройках выгрузки выбран формат Excel.',
      en: 'The Excel format is selected in the export settings.',
    },
    states: ['overlay.export'],
    enter: stepAction((root, { signal }) => exportXlsx(root, signal)),
  },
  {
    title: { ru: 'Пользователь выгрузил', en: 'The user exported' },
    hint: {
      ru: 'Скачался файл Excel. Цена и количество в нём — числа: их можно считать и сортировать по значению, а не как текст.',
      en: 'An Excel file was downloaded. In it, price and quantity are numbers: they can be used in calculations and sorted by value, not as text.',
    },
    enter: stepAction(async (root, { signal }) => {
      await exportXlsx(root, signal)
      await runExport(signal)
    }),
  },
]

/** ADR 0172, S6: выгрузка в Excel — числа ячейками чисел. */
export const DataTypesNumberExcel: StoryObj<StoryProps> = {
  name: 'Export to Excel',
  parameters: { scenario: '0172/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Выгрузка чисел в Excel', en: 'Exporting numbers to Excel' }}
      steps={NUMBER_EXCEL}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(NUMBER_EXCEL[0]!.title.ru, async () => {
        await waitForRows(canvas)
      })
      await step(NUMBER_EXCEL[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(NUMBER_EXCEL[2]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        expect(download.names).toEqual(['export.xlsx'])
        const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
        const sheet = await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')
        const { name, price, quantity } = EXPORT_ROWS[0]!
        // Строка 2 — первая строка данных: A — текст, B–C — числа.
        expect(sheet).toContain(`<t xml:space="preserve">${name}</t>`)
        expect(sheet).toContain(`<c r="B2"><v>${price}</v></c>`)
        expect(sheet).toContain(`<c r="C2"><v>${quantity}</v></c>`)
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}
