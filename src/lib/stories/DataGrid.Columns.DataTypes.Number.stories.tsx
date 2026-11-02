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
    title: 'Цены на русском языке',
    hint: 'Строки приходят с сервера, таблица на русском языке. Цена показана с пробелом между разрядами и запятой перед дробной частью.',
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
  name: 'Edit with a decimal comma',
  parameters: { scenario: '0172/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title="Правка числа по языку"
      steps={EDIT_COMMA}
      args={guideArgs({ height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_COMMA[0]!.title, async () => {
      await until(() =>
        expect(priceText(canvas)).toBe(moneyIn('ru-RU', COMMA_ROWS[0]!.price)),
      )
      await expect(priceEditButton(canvas)).not.toBeNull()
    })
    await step(EDIT_COMMA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)?.value).toBe(TYPED_PRICE))
    })
    await step(EDIT_COMMA[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priceInput(canvas)).toBeNull())
      await expect(priceText(canvas)).toBe(savedText())
      await settle()
    })
  },
}

const NOT_A_NUMBER = 'abc'
const NEW_PRICE = '1250'

const EDIT_NUMBER: readonly GuideStoryStep[] = [
  {
    title: 'Цены на языке таблицы',
    hint: 'Цена — число в формате денег на языке таблицы. Её можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Поле правки числа',
    hint: 'Пользователь нажал кнопку правки цены. В поле то же число с десятичным знаком языка таблицы, без знака валюты и разрядов.',
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'price'),
      root => productEditButton(root, 'price')?.click(),
    ),
  },
  {
    title: 'Не число',
    hint: 'Пользователь набрал буквы и нажал Enter. Значение не сохранено: поле осталось открытым, под ним текст ошибки.',
    states: ['body.editing'],
    enter: untilDone(
      root => fieldError(root, 'price') !== '',
      root => typeAndSave(root, 'price', NOT_A_NUMBER),
    ),
  },
  {
    title: 'Число сохранено',
    hint: 'Пользователь набрал число и нажал Enter. Поле закрылось, в ячейке новая цена в формате денег.',
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
      title="Правка числа"
      steps={EDIT_NUMBER}
      args={guideArgs(productArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const locale = localeOf(args)
    const labels = storyLabels(args.locale)
    const original = EDIT_ROWS[0]!.price
    await step(EDIT_NUMBER[0]!.title, async () => {
      await waitForRows(canvas)
      expect(productText(canvas, 'price')).toBe(dollars(locale, original))
      expect(productEditButton(canvas, 'price')).not.toBeNull()
    })
    await step(EDIT_NUMBER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).not.toBeNull())
      expect(productInput(canvas, 'price')!.value).toBe(
        new Intl.NumberFormat(locale, { useGrouping: false }).format(original),
      )
    })
    await step(EDIT_NUMBER[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(fieldError(canvas, 'price')).toBe(labels.editInvalidNumber),
      )
      expect(productInput(canvas, 'price')!.value).toBe(NOT_A_NUMBER)
      expect(productInput(canvas, 'price')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(consoleText()).not.toContain('onCellEdit')
    })
    await step(EDIT_NUMBER[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).toBeNull())
      expect(productText(canvas, 'price')).toBe(
        dollars(locale, Number(NEW_PRICE)),
      )
      expect(consoleText()).toMatch(
        new RegExp(`value:${NEW_PRICE},text:"${NEW_PRICE}"`),
      )
      await settle()
    })
  },
}

// --- ADR 0172, S9: сортировка чисел --------------------------------------------------------

const NUMBER_SORT: readonly GuideStoryStep[] = [
  {
    title: 'Цены в порядке данных',
    hint: 'Товары идут в порядке данных. У двух товаров нет цены — их ячейки пусты.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
    }),
  },
  {
    title: 'Пользователь отсортировал по цене',
    hint: 'Цены сравниваются как числа, а не как текст: от большей к меньшей, тысяча выше двухсот. Товары без цены — в конце.',
    enter: sortTo('price', 'descending'),
  },
  {
    title: 'Пользователь сменил направление',
    hint: 'Пользователь нажал кнопку сортировки ещё раз. Цены идут от меньшей к большей, товары без цены по-прежнему в конце.',
    enter: sortTo('price', 'ascending'),
  },
]

/** ADR 0172, S9: пользователь сортирует числа — по значению, пустые в конце. */
export const DataTypesNumberSort: StoryObj<StoryProps> = {
  name: 'Sort',
  parameters: { scenario: '0172/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title="Сортировка чисел"
      steps={NUMBER_SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(NUMBER_SORT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(4, 6, 0, 5, 2, 7, 1, 8),
        ),
      )
      expect(sortOf(canvas, 'price')).toBe('descending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(3, 9).sort())
    })
    await step(NUMBER_SORT[2]!.title, async () => {
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
    title: 'Цены без настройки фильтра',
    hint: 'Цена — число, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь открыл фильтр цены',
    hint: 'Тип колонки — число, поэтому панель предлагает условия сравнения чисел и поле для числа.',
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'price', signal)
      await pollUntil(() => !!filterValueField(), signal)
    }),
  },
  {
    title: 'Пользователь отобрал цены больше границы',
    hint: 'Пользователь выбрал условие «больше» и набрал число. Остались товары дороже: цены сравниваются как числа. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) => filterAbove(root, signal)),
  },
]

/** ADR 0172, S13: пользователь фильтрует числа без настройки фильтра колонки. */
export const DataTypesNumberFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S13', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр чисел"
      steps={NUMBER_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(NUMBER_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(filterValueField()).toHaveAttribute('inputmode', 'decimal')
      await settle()
    })
    await step(NUMBER_FILTER[2]!.title, async () => {
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
    title: 'Цена и количество',
    hint: 'В таблице цена и количество — числа. К выгрузке подключён формат Excel.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price', 'quantity']),
      dataOverride: EXPORT_ROWS,
      enableDataExport: true,
      dataExportFormats: [exportFormats.csv(), exportFormats.xlsx()],
      onExported,
    }),
  },
  {
    title: 'Пользователь выбрал Excel',
    hint: 'В настройках выгрузки выбран формат Excel.',
    states: ['overlay.export'],
    enter: stepAction((root, { signal }) => exportXlsx(root, signal)),
  },
  {
    title: 'Пользователь выгрузил',
    hint: 'Скачался файл Excel. Цена и количество в нём — числа: их можно считать и сортировать по значению, а не как текст.',
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
      title="Выгрузка чисел в Excel"
      steps={NUMBER_EXCEL}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(NUMBER_EXCEL[0]!.title, async () => {
        await waitForRows(canvas)
      })
      await step(NUMBER_EXCEL[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(NUMBER_EXCEL[2]!.title, async () => {
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
