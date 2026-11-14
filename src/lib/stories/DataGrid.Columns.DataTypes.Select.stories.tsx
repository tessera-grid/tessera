import { stepAction } from './demos/GuideStory'
import { pollUntil, stepDone } from './__mocks__/catalogPlay'
import { productRows } from './__mocks__/dataTypesData'
import {
  checkOption,
  closePanel,
  openPanel,
  optionOf,
} from './__mocks__/filterGuide'
import { columnsOf, shownCount } from './__mocks__/typeGuides'
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
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import {
  typeInto,
  press,
  optionCellText,
  openOptionEdit,
  selectField,
  optionItem,
  highlightedValue,
  optionArgs,
  OWN_TABLE,
} from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Select',
} satisfies Meta<StoryProps>

export default meta

export const SelectPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: статус — один вариант из списка. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'status']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['status'],
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

const STATUS_QUERY = 'arch'

const EDIT_SELECT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Статусы товаров', en: 'Product statuses' },
    hint: {
      ru: 'Статус — один вариант из списка. Его можно править: при наведении на ячейку появляется кнопка правки.',
      en: 'A status is one option from a list. It can be edited: hovering over a cell shows an edit button.',
    },
  },
  {
    title: { ru: 'Поле с поиском', en: 'A field with search' },
    hint: {
      ru: 'Пользователь нажал кнопку правки статуса. Под ячейкой открылся список: сверху поле поиска, ниже все варианты, текущий отмечен, внизу — очистка значения.',
      en: 'The user clicked the status edit button. A list opened below the cell: a search field on top, all options below it with the current one checked, and a way to clear the value at the bottom.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => !!optionItem('active'),
      root => {
        if (!selectField()) openOptionEdit(root, 'status')
      },
    ),
  },
  {
    title: { ru: 'Поиск сужает список', en: 'Search narrows the list' },
    hint: {
      ru: 'Пользователь набрал начало подписи. В списке остались только подходящие варианты.',
      en: 'The user typed the start of a label. Only matching options remain in the list.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => !optionItem('active') && !!optionItem('archived'),
      root => {
        const field = selectField()
        if (!field) return openOptionEdit(root, 'status')
        if (field.value !== STATUS_QUERY) typeInto(field, STATUS_QUERY)
      },
    ),
  },
  {
    title: { ru: 'Вариант сохранён', en: 'The option is saved' },
    hint: {
      ru: 'Пользователь нажал Enter. Список закрылся, в ячейке новый статус.',
      en: 'The user pressed Enter. The list closed, and the cell shows the new status.',
    },
    enter: untilDone(
      root => !selectField() && optionCellText(root, 'status') === 'Archived',
      root => {
        const field = selectField()
        if (!field) return openOptionEdit(root, 'status')
        if (field.value !== STATUS_QUERY) return typeInto(field, STATUS_QUERY)
        // Стрелка подсвечивает найденный вариант, Enter выбирает его.
        if (highlightedValue() !== 'archived') press(field, 'ArrowDown')
        else press(field, 'Enter')
      },
    ),
  },
]

/** ADR 0175, S4: пользователь выбирает вариант с поиском. */
export const EditingSelect: StoryObj<StoryProps> = {
  name: 'Choose',
  parameters: { scenario: '0175/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Выбор варианта', en: 'Choosing an option' }}
      steps={EDIT_SELECT}
      args={guideArgs(optionArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_SELECT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(optionCellText(canvas, 'status')).toBe('Draft')
    })
    await step(EDIT_SELECT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem('active')).not.toBeNull())
      expect(optionItem('draft')).toHaveAttribute('data-selected')
    })
    await step(EDIT_SELECT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(optionItem('archived')).not.toBeNull()
        expect(optionItem('active')).toBeNull()
      })
    })
    await step(EDIT_SELECT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(optionCellText(canvas, 'status')).toBe('Archived'),
      )
      expect(selectField()).toBeNull()
      expect(consoleText()).toContain('value:"archived"')
      await settle()
    })
  },
}

// --- ADR 0172, S16: фильтр варианта -------------------------------------------------------

const FILTER_ROWS = productRows(50)
const ARCHIVED = FILTER_ROWS.filter(row => row.status === 'archived').length

/** Пользователь отмечает вариант и закрывает панель. */
const filterArchived = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== ARCHIVED) {
    await openPanel(root, 'status', signal)
    await checkOption('archived', signal)
    await pollUntil(() => shownCount() === ARCHIVED, signal)
  }
  await closePanel(signal)
}

const SELECT_FILTER: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Статусы без настройки фильтра',
      en: 'Statuses without filter setup',
    },
    hint: {
      ru: 'Статус — один вариант из списка, у колонки заданы тип и варианты. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
      en: "A status is one option from a list; the column has a type and options set. Filtering is enabled in the table, but the column itself doesn't configure a filter.",
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'status']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр статуса',
      en: 'The user opened the status filter',
    },
    hint: {
      ru: 'Тип колонки — вариант, поэтому панель предлагает список вариантов с флажками и поиском.',
      en: 'The column has the option type, so the panel offers a list of options with checkboxes and search.',
    },
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'status', signal)
      await pollUntil(() => !!optionOf('archived'), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отметил вариант',
      en: 'The user checked an option',
    },
    hint: {
      ru: 'Остались товары с отмеченным статусом. Нижняя панель называет число оставшихся строк.',
      en: 'Only products with the checked status remain. The status bar shows how many rows are left.',
    },
    enter: stepAction((root, { signal }) => filterArchived(root, signal)),
  },
]

/** ADR 0172, S16: пользователь фильтрует варианты без настройки фильтра колонки. */
export const DataTypesSelectFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S16', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Фильтр варианта', en: 'Option filter' }}
      steps={SELECT_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SELECT_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(optionOf('draft')).not.toBeNull()
      expect(optionOf('active')).not.toBeNull()
      await settle()
    })
    await step(SELECT_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(ARCHIVED)
      await settle()
    })
  },
}
