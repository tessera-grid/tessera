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
    title: 'Названия в порядке данных',
    hint: 'Товары идут в порядке данных. У двух товаров нет названия — их ячейки пусты.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name']),
      dataOverride: SORT_ROWS,
      enableColumnSorting: true,
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
]

/** ADR 0172, S1: пользователь сортирует текст — по языку, номера по значению, пустые в конце. */
export const DataTypesTextSort: StoryObj<StoryProps> = {
  name: 'Sort',
  parameters: { scenario: '0172/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Сортировка текста"
      steps={TEXT_SORT}
      args={guideArgs({ height: '560' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TEXT_SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rowIds(canvas)).toEqual(idsOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      )
    })
    await step(TEXT_SORT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rowIds(canvas).slice(0, 8)).toEqual(
          idsOf(4, 0, 3, 6, 9, 7, 5, 1),
        ),
      )
      expect(sortOf(canvas, 'name')).toBe('descending')
      expect(rowIds(canvas).slice(8).sort()).toEqual(idsOf(2, 8).sort())
    })
    await step(TEXT_SORT[2]!.title, async () => {
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
    title: 'Названия без настройки фильтра',
    hint: 'Название — текст, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'price']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь открыл фильтр названия',
    hint: 'Тип колонки — текст, поэтому панель предлагает условие и поле для текста. Условие по умолчанию — «содержит».',
    states: ['overlay.filterText'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'name', signal)
      await pollUntil(() => !!filterValueField(), signal)
    }),
  },
  {
    title: 'Пользователь набрал часть названия',
    hint: 'Остались товары, в названии которых есть набранный текст, без учёта заглавных букв. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) => filterContaining(root, signal)),
  },
  {
    title: 'Пользователь сменил условие',
    hint: 'Пользователь выбрал условие «начинается с» и набрал начало названия. Остались товары, чьё название так начинается.',
    enter: stepAction((root, { signal }) => filterStarting(root, signal)),
  },
]

/** ADR 0172, S12: пользователь фильтрует текст без настройки фильтра колонки. */
export const DataTypesTextFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S12', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр текста"
      steps={TEXT_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TEXT_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(TEXT_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(filterValueField()).not.toBeNull()
      expect(operatorValue()).toBe('contains')
      await settle()
    })
    await step(TEXT_FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(containing)
      expect(containing).toBeGreaterThan(0)
    })
    await step(TEXT_FILTER[3]!.title, async () => {
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
    title: 'Названия товаров',
    hint: 'Название — текст. Его можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Поле правки текста',
    hint: 'Пользователь нажал кнопку правки названия. В ячейке поле с тем же текстом.',
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'name'),
      root => productEditButton(root, 'name')?.click(),
    ),
  },
  {
    title: 'Текст сохранён',
    hint: 'Пользователь набрал новое название и нажал Enter. Поле закрылось, в ячейке новый текст.',
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
      title="Правка текста"
      steps={TEXT_EDIT}
      args={guideArgs({ ...productArgs, editableColumns: ['name'] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const original = productRows(1)[0]!.name
    await step(TEXT_EDIT[0]!.title, async () => {
      await waitForRows(canvas)
      expect(productText(canvas, 'name')).toBe(original)
    })
    await step(TEXT_EDIT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'name')).not.toBeNull())
      expect(productInput(canvas, 'name')!.value).toBe(original)
    })
    await step(TEXT_EDIT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'name')).toBeNull())
      expect(productText(canvas, 'name')).toBe(NEW_NAME)
      expect(consoleText()).toContain(`value:"${NEW_NAME}"`)
      await settle()
    })
  },
}
