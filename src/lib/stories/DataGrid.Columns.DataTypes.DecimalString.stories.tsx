import { untilDone } from './__mocks__/cellGestures'
import { consoleText } from './__mocks__/catalogPlay'
import {
  productEditButton,
  productInput,
  productText,
  typeAndSave,
} from './__mocks__/typeGuides'
import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  settle,
  until,
  waitForRows,
  orderedRows,
  stepDone,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { exportFormats } from '../plugins/dataExport'
import { compareDecimal, decimalText, parseDecimal } from '../util/decimal'
import { AMOUNT_ROWS, AMOUNT_COLUMNS } from './__mocks__/dataTypesData'
import {
  axisChecked,
  chooseAxis,
  interceptDownload,
  onExported,
  openExportPanel,
  runExport,
  zipEntryText,
} from './__mocks__/exportGuide'
import { OWN_TABLE, CELL, cellOf, sortTo } from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Decimal string',
} satisfies Meta<StoryProps>

export default meta

export const DecimalStringPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: суммы — десятичные строки без потери знаков. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: AMOUNT_COLUMNS,
    dataOverride: AMOUNT_ROWS,
    enableCellEditing: true,
    editableColumns: ['amount'],
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

const NUMBER_STRING: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Суммы хранятся строками',
      en: 'Amounts are stored as strings',
    },
    hint: {
      ru: 'Сервер отдаёт суммы строками, чтобы не терять знаки: у двух самых больших сумм различается только последняя цифра. Таблица показывает суммы как есть, цифры одной ширины.',
      en: 'The server sends amounts as strings so no digits are lost: the two largest amounts differ only in the last digit. The table shows the amounts as they are, with digits of equal width.',
    },
    props: () => ({
      columnsOverride: AMOUNT_COLUMNS,
      dataOverride: AMOUNT_ROWS,
      enableColumnSorting: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по сумме',
      en: 'The user sorted by amount',
    },
    hint: {
      ru: 'Суммы упорядочены по значению от большей к меньшей, с учётом знака. Две самые большие суммы стоят в верном порядке, хотя обычным числом они бы совпали.',
      en: 'The amounts are ordered by value from largest to smallest, taking the sign into account. The two largest amounts are in the right order, even though as regular numbers they would be equal.',
    },
    enter: sortTo('amount', 'descending'),
  },
]

/** ADR 0174, S3: пользователь сортирует суммы, хранящиеся строками, — порядок точный. */
export const DataTypesNumberString: StoryObj<StoryProps> = {
  name: 'Exact order',
  parameters: { scenario: '0174/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Суммы строками', en: 'Amounts as strings' }}
      steps={NUMBER_STRING}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBER_STRING[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(amountTexts(canvas)).toEqual(AMOUNT_ROWS.map(row => row.amount)),
      )
      await expect(cellOf(canvas, 0, 'amount')!.dataset.align).toBeUndefined()
    })
    await step(NUMBER_STRING[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(amountTexts(canvas)).toEqual(amountsDesc()))
      const [first, second] = amountTexts(canvas)
      await expect(Number(first)).toBe(Number(second))
      await settle()
    })
  },
}

// --- ADR 0174, S4: суммы строками в Excel -----------------------------------------------

const AMOUNT_EXPORT: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Суммы строками и выгрузка',
      en: 'Amounts as strings and export',
    },
    hint: {
      ru: 'Суммы хранятся строками. К выгрузке подключён формат Excel.',
      en: 'Amounts are stored as strings. The Excel format is added to export.',
    },
    props: () => ({
      columnsOverride: AMOUNT_COLUMNS,
      dataOverride: AMOUNT_ROWS,
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
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
    }),
  },
  {
    title: { ru: 'Пользователь выгрузил', en: 'The user exported' },
    hint: {
      ru: 'Скачался файл Excel. Суммы в нём — числа, с ними можно считать. Сумма длиннее пятнадцати знаков записана текстом: числом Excel её бы округлил.',
      en: 'An Excel file was downloaded. The amounts in it are numbers you can calculate with. An amount longer than fifteen digits is written as text, because Excel would round it as a number.',
    },
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
      await runExport(signal)
    }),
  },
]

/** ADR 0174, S4: пользователь выгружает суммы-строки в Excel и получает числа. */
export const DataTypesNumberStringExport: StoryObj<StoryProps> = {
  name: 'Export to Excel',
  parameters: { scenario: '0174/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Суммы строками в Excel',
        en: 'Amounts as strings in Excel',
      }}
      steps={AMOUNT_EXPORT}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(AMOUNT_EXPORT[0]!.title.ru, async () => {
        await waitForRows(canvas)
      })
      await step(AMOUNT_EXPORT[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(AMOUNT_EXPORT[2]!.title.ru, async () => {
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

// --- ADR 0175, S12: правка десятичной строки --------------------------------------------

const ORIGINAL = AMOUNT_ROWS[0]!.amount
const NEW_AMOUNT = '12345678901234567.89'

/** Новая сумма с десятичным знаком языка таблицы — тем же, что в поле. */
const typedAmount = (root: ParentNode) =>
  productInput(root, 'amount')?.value.includes(',')
    ? NEW_AMOUNT.replace('.', ',')
    : NEW_AMOUNT

const DECIMAL_EDIT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Суммы строками', en: 'Amounts as strings' },
    hint: {
      ru: 'Сервер отдаёт суммы строками, чтобы не терять знаки. Их можно править: при наведении на ячейку появляется кнопка правки.',
      en: 'The server sends amounts as strings so no digits are lost. They can be edited: hovering over a cell shows an edit button.',
    },
  },
  {
    title: { ru: 'Поле правки суммы', en: 'The amount edit field' },
    hint: {
      ru: 'Пользователь нажал кнопку правки суммы. В поле та же сумма — все значащие цифры, с десятичным знаком языка таблицы.',
      en: "The user pressed the edit button on an amount. The field holds the same amount: all significant digits, with the decimal separator of the table's language.",
    },
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'amount'),
      root => productEditButton(root, 'amount')?.click(),
    ),
  },
  {
    title: { ru: 'Сумма сохранена', en: 'The amount was saved' },
    hint: {
      ru: 'Пользователь набрал сумму из восемнадцати цифр и нажал Enter. В ячейке и в сохранённом значении все знаки — сумма не округлилась.',
      en: 'The user typed an eighteen-digit amount and pressed Enter. The cell and the saved value keep all the digits: the amount was not rounded.',
    },
    enter: untilDone(
      root =>
        !productInput(root, 'amount') &&
        productText(root, 'amount') === NEW_AMOUNT,
      root =>
        typeAndSave(
          root,
          'amount',
          productInput(root, 'amount') ? typedAmount(root) : '',
        ),
    ),
  },
]

/** ADR 0175, S12: пользователь правит десятичную строку без потери знаков. */
export const EditingDecimalString: StoryObj<StoryProps> = {
  name: 'Edit',
  parameters: { scenario: '0175/S12', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Правка десятичной строки', en: 'Editing a decimal string' }}
      steps={DECIMAL_EDIT}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnsOverride: AMOUNT_COLUMNS,
          dataOverride: AMOUNT_ROWS,
          editableColumns: ['amount'],
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DECIMAL_EDIT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(productText(canvas, 'amount')).toBe(ORIGINAL))
    })
    await step(DECIMAL_EDIT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'amount')).not.toBeNull())
      // Конечные нули дробной части поле не показывает — значение то же.
      await until(() =>
        expect(productInput(canvas, 'amount')!.value.replace(',', '.')).toBe(
          ORIGINAL.replace(/0+$/, ''),
        ),
      )
    })
    await step(DECIMAL_EDIT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'amount')).toBeNull())
      await until(() => expect(productText(canvas, 'amount')).toBe(NEW_AMOUNT))
      await until(() =>
        expect(consoleText()).toContain(`value:"${NEW_AMOUNT}"`),
      )
      await settle()
    })
  },
}
