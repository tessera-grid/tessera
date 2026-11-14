import { expect } from 'storybook/test'
import { guideControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import {
  consoleText,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { SORT_ROWS } from './__mocks__/dataTypesData'
import {
  chooseOperator,
  closePanel,
  openPanel,
  operatorValue,
} from './__mocks__/filterGuide'
import {
  filterValueField,
  idsOf,
  productArgs,
  productEditButton,
  productInput,
  productText,
  rowIds,
  shownCount,
  sortOf,
  sortTo,
  typeAndSave,
  typeFilterValue,
} from './__mocks__/typeGuides'
import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { productRows } from './__mocks__/dataTypesData'
import { OWN_TABLE, columnsOf } from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Text',
} satisfies Meta<StoryProps>

export default meta

export const TextPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: название товара — текст. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['name'],
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

// --- ADR 0172, S1: сортировка текста ----------------------------------------------------

const TEXT_SORT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Названия в порядке данных', en: 'Names in data order' },
    hint: {
      ru: 'Товары идут в порядке данных. У двух товаров нет названия — их ячейки пусты.',
      en: 'Products appear in data order. Two products have no name, so their cells are empty.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по названию',
      en: 'The user sorted by product name',
    },
    hint: {
      ru: 'Названия идут от конца алфавита к началу без учёта заглавных букв, а номера в названиях сравниваются как числа: десятый номер выше второго. Товары без названия — в конце.',
      en: 'Names run from the end of the alphabet to the start, ignoring capitalization, and numbers inside names are compared as numbers: number ten comes above number two. Products without a name are at the end.',
    },
    enter: sortTo('name', 'descending'),
  },
  {
    title: {
      ru: 'Пользователь сменил направление',
      en: 'The user changed the direction',
    },
    hint: {
      ru: 'Пользователь нажал кнопку сортировки ещё раз. Названия идут по алфавиту, второй номер раньше десятого. Товары без названия по-прежнему в конце.',
      en: 'The user pressed the sort button again. Names are in alphabetical order, and number two comes before number ten. Products without a name are still at the end.',
    },
    enter: sortTo('name', 'ascending'),
  },
]

/** ADR 0172, S1: пользователь сортирует текст — по языку, номера по значению, пустые в конце. */
export const DataTypesTextSort: StoryObj<StoryProps> = {
  name: 'Sort',
  parameters: { scenario: '0172/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сортировка текста', en: 'Sorting text' }}
      steps={TEXT_SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TEXT_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(TEXT_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(4, 0, 3, 6, 9, 7, 5, 1),
        ),
      )
      expect(sortOf(canvas, 'name')).toBe('descending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(2, 8).sort())
    })
    await step(TEXT_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(1, 5, 7, 9, 6, 3, 0, 4),
        ),
      )
      expect(sortOf(canvas, 'name')).toBe('ascending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(2, 8).sort())
      await settle()
    })
  },
}

// --- ADR 0172, S12: фильтр текста ---------------------------------------------------------

const FILTER_ROWS = productRows(50)
const PART = 'lamp'
const START = 'desk'
const containing = FILTER_ROWS.filter(row =>
  row.name.toLowerCase().includes(PART),
).length
const starting = FILTER_ROWS.filter(row =>
  row.name.toLowerCase().startsWith(START),
).length

/** Пользователь набирает часть названия и закрывает панель. */
const filterContaining = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== containing) {
    await openPanel(root, 'name', signal)
    await typeFilterValue(PART, signal)
    await pollUntil(() => shownCount() === containing, signal)
  }
  await closePanel(signal)
}

/** Пользователь выбирает условие «начинается с» и набирает начало названия. */
const filterStarting = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== starting) {
    await openPanel(root, 'name', signal)
    await chooseOperator('startsWith', signal)
    await typeFilterValue(START, signal)
    await pollUntil(() => shownCount() === starting, signal)
  }
  await closePanel(signal)
}

const TEXT_FILTER: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Названия без настройки фильтра',
      en: 'Names without filter setup',
    },
    hint: {
      ru: 'Название — текст, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
      en: 'The name is text; the column only sets its data type. Filtering is enabled in the table, but the column itself has no filter setup.',
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
      ru: 'Пользователь открыл фильтр названия',
      en: 'The user opened the name filter',
    },
    hint: {
      ru: 'Тип колонки — текст, поэтому панель предлагает условие и поле для текста. Условие по умолчанию — «содержит».',
      en: 'The column type is text, so the panel offers a condition and a text field. The default condition is “contains”.',
    },
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'name', signal)
      await pollUntil(() => !!filterValueField(), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь набрал часть названия',
      en: 'The user typed part of a name',
    },
    hint: {
      ru: 'Остались товары, в названии которых есть набранный текст, без учёта заглавных букв. Нижняя панель называет число оставшихся строк.',
      en: 'Only the products whose name contains the typed text remain, ignoring capitalization. The status bar shows how many rows remain.',
    },
    enter: stepAction((root, { signal }) => filterContaining(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь сменил условие',
      en: 'The user changed the condition',
    },
    hint: {
      ru: 'Пользователь выбрал условие «начинается с» и набрал начало названия. Остались товары, чьё название так начинается.',
      en: 'The user chose the “starts with” condition and typed the beginning of a name. Only the products whose name starts that way remain.',
    },
    enter: stepAction((root, { signal }) => filterStarting(root, signal)),
  },
]

/** ADR 0172, S12: пользователь фильтрует текст без настройки фильтра колонки. */
export const DataTypesTextFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S12', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Фильтр текста', en: 'Filtering text' }}
      steps={TEXT_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TEXT_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(TEXT_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(filterValueField()).not.toBeNull()
      expect(operatorValue()).toBe('contains')
      await settle()
    })
    await step(TEXT_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(containing)
      expect(containing).toBeGreaterThan(0)
    })
    await step(TEXT_FILTER[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(starting)
      await settle()
    })
  },
}

// --- ADR 0175, S11: правка текста ---------------------------------------------------------

const NEW_NAME = 'Desk lamp XL'

const TEXT_EDIT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Названия товаров', en: 'Product names' },
    hint: {
      ru: 'Название — текст. Его можно править: при наведении на ячейку появляется кнопка правки.',
      en: 'The name is text. It can be edited: hovering over a cell reveals an edit button.',
    },
  },
  {
    title: { ru: 'Поле правки текста', en: 'The text editor' },
    hint: {
      ru: 'Пользователь нажал кнопку правки названия. В ячейке поле с тем же текстом.',
      en: 'The user pressed the edit button on a name. The cell shows a field with the same text.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'name'),
      root => productEditButton(root, 'name')?.click(),
    ),
  },
  {
    title: { ru: 'Текст сохранён', en: 'The text is saved' },
    hint: {
      ru: 'Пользователь набрал новое название и нажал Enter. Поле закрылось, в ячейке новый текст.',
      en: 'The user typed a new name and pressed Enter. The field closed, and the cell shows the new text.',
    },
    enter: untilDone(
      root =>
        !productInput(root, 'name') && productText(root, 'name') === NEW_NAME,
      root => typeAndSave(root, 'name', NEW_NAME),
    ),
  },
]

/** ADR 0175, S11: пользователь правит текст. */
export const EditingText: StoryObj<StoryProps> = {
  name: 'Edit',
  parameters: { scenario: '0175/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка текста', en: 'Editing text' }}
      steps={TEXT_EDIT}
      args={guideArgs({ ...productArgs, editableColumns: ['name'] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const original = productRows(1)[0]!.name
    await step(TEXT_EDIT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(productText(canvas, 'name')).toBe(original))
    })
    await step(TEXT_EDIT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'name')).not.toBeNull())
      await until(() =>
        expect(productInput(canvas, 'name')!.value).toBe(original),
      )
    })
    await step(TEXT_EDIT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'name')).toBeNull())
      await until(() => expect(productText(canvas, 'name')).toBe(NEW_NAME))
      await until(() => expect(consoleText()).toContain(`value:"${NEW_NAME}"`))
      await settle()
    })
  },
}
