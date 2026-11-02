import { exportFormats } from '../plugins/dataExport'
import { stepAction } from './demos/GuideStory'
import { stepDone } from './__mocks__/catalogPlay'
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
import {
  columnsOf,
  idsOf,
  rowIds,
  sortOf,
  sortTo,
} from './__mocks__/typeGuides'
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
  headCell,
  orderedRows,
  pollUntil,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { DATE_COLUMNS } from './__mocks__/editingData'
import { storyLabels } from './__mocks__/storyLabels'
import { productColumns } from './__mocks__/dataTypesData'
import {
  calendar,
  chooseOperator,
  closePanel,
  filterActive,
  filteredCount,
  openPanel,
  pickDay,
} from './__mocks__/filterGuide'
import {
  productEditButton,
  productArgs,
  datePopup,
  dateDay,
  dateTime,
  openDateEdit,
  dateText,
  OWN_TABLE,
} from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Date',
} satisfies Meta<StoryProps>

export default meta

export const DatePlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: дата выпуска — дата строкой. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'released']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['released'],
    enableColumnSorting: true,
    enableColumnFiltering: true,
    timeZone: 'UTC',
  },
  parameters: showControls(
    [
      'enableCellEditing',
      'enableColumnSorting',
      'enableColumnFiltering',
      'locale',
      'timeZone',
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
  name: 'Filter',
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

const NEW_DAY = '2026-01-20'

const EDIT_DATE: readonly GuideStoryStep[] = [
  {
    title: 'Даты в таблице',
    hint: 'Дата выпуска — день без времени. Её можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Календарь',
    hint: 'Пользователь нажал кнопку правки даты выпуска. Под ячейкой календарь, в нём выбран день из ячейки.',
    states: ['body.editing', 'overlay.dateEditor'],
    enter: untilDone(
      () => !!dateDay('2026-01-01'),
      root => openDateEdit(root, 'released'),
    ),
  },
  {
    title: 'День выбран',
    hint: 'Пользователь выбрал другой день. Календарь закрылся, в ячейке новая дата.',
    enter: untilDone(
      root => !datePopup() && /\b20\b/.test(dateText(root, 'released')),
      root => {
        const day = dateDay(NEW_DAY)
        if (day) day.click()
        else if (!datePopup()) openDateEdit(root, 'released')
      },
    ),
  },
]

/** ADR 0175, S3: пользователь выбирает дату в календаре. */
export const EditingDate: StoryObj<StoryProps> = {
  name: 'Edit',
  parameters: { scenario: '0175/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Правка даты"
      steps={EDIT_DATE}
      args={guideArgs(
        {
          ...productArgs,
          columnsOverride: DATE_COLUMNS.filter(
            column => column.id !== 'updatedAt',
          ),
          editableColumns: ['released'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_DATE[0]!.title, async () => {
      await waitForRows(canvas)
      expect(productEditButton(canvas, 'released')).not.toBeNull()
    })
    await step(EDIT_DATE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(dateDay('2026-01-01')).not.toBeNull())
      expect(dateTime()).toBeNull()
    })
    await step(EDIT_DATE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(dateText(canvas, 'released')).toMatch(/\b20\b/))
      expect(datePopup()).toBeNull()
      expect(consoleText()).toContain(`value:"${NEW_DAY}"`)
      await settle()
    })
  },
}

// --- ADR 0175: этап 4 -----------------------------------------------------------------

const clearButton = () =>
  datePopup()?.querySelector<HTMLElement>('[data-testid="edit-clear-value"]') ??
  null

const EDIT_DATE_CLEAR: readonly GuideStoryStep[] = [
  {
    title: 'Дата в ячейке',
    hint: 'У товара есть дата выпуска. Её можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Календарь с очисткой',
    hint: 'Пользователь нажал кнопку правки. Под календарём — пункт очистки значения.',
    states: ['body.editing', 'overlay.dateEditor'],
    enter: untilDone(
      () => !!clearButton(),
      root => {
        if (!datePopup()) openDateEdit(root, 'released')
      },
    ),
  },
  {
    title: 'Дата очищена',
    hint: 'Пользователь выбрал очистку. Календарь закрылся, ячейка пуста.',
    enter: untilDone(
      root => !datePopup() && dateText(root, 'released') === '',
      root => {
        const clear = clearButton()
        if (clear) clear.click()
        else if (!datePopup()) openDateEdit(root, 'released')
      },
    ),
  },
]

/** ADR 0175, S8: пользователь очищает дату в календаре. */
export const EditingDateClear: StoryObj<StoryProps> = {
  name: 'Clear',
  parameters: { scenario: '0175/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title="Очистка даты"
      steps={EDIT_DATE_CLEAR}
      args={guideArgs(
        {
          ...productArgs,
          columnsOverride: DATE_COLUMNS,
          editableColumns: ['released', 'updatedAt'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_DATE_CLEAR[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(dateText(canvas, 'released')).not.toBe(''))
    })
    await step(EDIT_DATE_CLEAR[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(clearButton()).not.toBeNull())
    })
    await step(EDIT_DATE_CLEAR[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(datePopup()).toBeNull()
        expect(dateText(canvas, 'released')).toBe('')
      })
      expect(consoleText()).toContain('value:null')
      await settle()
    })
  },
}

// --- ADR 0172, S10: сортировка дат -----------------------------------------------------------

const DATE_SORT: readonly GuideStoryStep[] = [
  {
    title: 'Даты выпуска в порядке данных',
    hint: 'Товары идут в порядке данных. Дата выпуска хранится строкой; у одного товара даты нет — его ячейка пуста.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'released']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Пользователь отсортировал по дате выпуска',
    hint: 'Даты хранятся строками, но сравниваются как даты: от поздней к ранней. Товар без даты — в конце.',
    enter: sortTo('released', 'descending'),
  },
  {
    title: 'Пользователь сменил направление',
    hint: 'Пользователь нажал кнопку сортировки ещё раз. Даты идут от ранней к поздней, товар без даты по-прежнему в конце.',
    enter: sortTo('released', 'ascending'),
  },
]

/** ADR 0172, S10: пользователь сортирует даты, хранящиеся строками, — по дате, пустые в конце. */
export const DataTypesDateSort: StoryObj<StoryProps> = {
  name: 'Sort',
  parameters: { scenario: '0172/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title="Сортировка дат"
      steps={DATE_SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DATE_SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(DATE_SORT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(8, 3, 9, 0, 6, 2, 1, 7, 5, 4)),
      )
      expect(sortOf(canvas, 'released')).toBe('descending')
    })
    await step(DATE_SORT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(5, 7, 1, 2, 6, 0, 9, 3, 8, 4)),
      )
      expect(sortOf(canvas, 'released')).toBe('ascending')
      await settle()
    })
  },
}

// --- ADR 0172, S11: выгрузка дат в Excel ---------------------------------------------------

const EXPORT_ROWS = productRows(20)

/** Пользователь выбирает Excel в настройках выгрузки. */
const exportXlsx = async (root: HTMLElement, signal: AbortSignal) => {
  await openExportPanel(root, signal)
  await chooseAxis('format', 'xlsx', signal)
}

const DATE_EXCEL: readonly GuideStoryStep[] = [
  {
    title: 'Даты выпуска',
    hint: 'Дата выпуска хранится строкой, у колонки задан тип даты. К выгрузке подключён формат Excel.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'released']),
      dataOverride: EXPORT_ROWS,
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
    enter: stepAction((root, { signal }) => exportXlsx(root, signal)),
  },
  {
    title: 'Пользователь выгрузил',
    hint: 'Скачался файл Excel. Даты выпуска в нём — даты, а не текст: их можно сортировать и сравнивать в Excel.',
    enter: stepAction(async (root, { signal }) => {
      await exportXlsx(root, signal)
      await runExport(signal)
    }),
  },
]

/** ADR 0172, S11: выгрузка в Excel — даты, хранящиеся строками, ячейками дат. */
export const DataTypesDateExcel: StoryObj<StoryProps> = {
  name: 'Export to Excel',
  parameters: { scenario: '0172/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выгрузка дат в Excel"
      steps={DATE_EXCEL}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(DATE_EXCEL[0]!.title, async () => {
        await waitForRows(canvas)
      })
      await step(DATE_EXCEL[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(DATE_EXCEL[2]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        expect(download.names).toEqual(['export.xlsx'])
        const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
        const sheet = await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')
        // Строка 2 — первая строка данных: B — дата числом дней со стилем даты.
        expect(sheet).toMatch(/<c r="B2" s="\d+"><v>[\d.]+<\/v><\/c>/)
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}
