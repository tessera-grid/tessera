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
    title: 'Статусы товаров',
    hint: 'Статус — один вариант из списка. Его можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Поле с поиском',
    hint: 'Пользователь нажал кнопку правки статуса. Под ячейкой открылся список: сверху поле поиска, ниже все варианты, текущий отмечен, внизу — очистка значения.',
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => !!optionItem('active'),
      root => {
        if (!selectField()) openOptionEdit(root, 'status')
      },
    ),
  },
  {
    title: 'Поиск сужает список',
    hint: 'Пользователь набрал начало подписи. В списке остались только подходящие варианты.',
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
    title: 'Вариант сохранён',
    hint: 'Пользователь нажал Enter. Список закрылся, в ячейке новый статус.',
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
      title="Выбор варианта"
      steps={EDIT_SELECT}
      args={guideArgs(optionArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_SELECT[0]!.title, async () => {
      await waitForRows(canvas)
      expect(optionCellText(canvas, 'status')).toBe('Draft')
    })
    await step(EDIT_SELECT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem('active')).not.toBeNull())
      expect(optionItem('draft')).toHaveAttribute('data-selected')
    })
    await step(EDIT_SELECT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(optionItem('archived')).not.toBeNull()
        expect(optionItem('active')).toBeNull()
      })
    })
    await step(EDIT_SELECT[3]!.title, async () => {
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
    title: 'Статусы без настройки фильтра',
    hint: 'Статус — один вариант из списка, у колонки заданы тип и варианты. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'status']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь открыл фильтр статуса',
    hint: 'Тип колонки — вариант, поэтому панель предлагает список вариантов с флажками и поиском.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'status', signal)
      await pollUntil(() => !!optionOf('archived'), signal)
    }),
  },
  {
    title: 'Пользователь отметил вариант',
    hint: 'Остались товары с отмеченным статусом. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) => filterArchived(root, signal)),
  },
]

/** ADR 0172, S16: пользователь фильтрует варианты без настройки фильтра колонки. */
export const DataTypesSelectFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S16', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр варианта"
      steps={SELECT_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(SELECT_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(optionOf('draft')).not.toBeNull()
      expect(optionOf('active')).not.toBeNull()
      await settle()
    })
    await step(SELECT_FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(ARCHIVED)
      await settle()
    })
  },
}
