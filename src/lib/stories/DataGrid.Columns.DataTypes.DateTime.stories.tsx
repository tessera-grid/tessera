import { expect } from 'storybook/test'
import { guideControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
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
import { DATE_COLUMNS } from './__mocks__/editingData'
import {
  calendar,
  chooseOperator,
  closePanel,
  filterActive,
  openPanel,
  pickDay,
} from './__mocks__/filterGuide'
import {
  dateDay,
  datePopup,
  dateText,
  dateTime,
  openDateEdit,
  press,
  productArgs,
  shownCount,
  timeValue,
  typeTime,
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
  title: 'Tessera/DataGrid/Columns/Data types/Date & time',
} satisfies Meta<StoryProps>

export default meta

export const DateTimePlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: время обновления — дата со временем строкой. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'updatedAt']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['updatedAt'],
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

// --- ADR 0175, S13: правка даты со временем ----------------------------------------------

const NEW_MOMENT_DAY = '2026-10-02'
const NEW_TIME = '14:30'

const EDIT_DATE_TIME: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Время обновления', en: 'Update time' },
    hint: {
      ru: 'Время обновления — день и время в поясе таблицы. Его можно править: при наведении на ячейку появляется кнопка правки.',
      en: "The update time is a day and time in the table's time zone. It can be edited: hovering over the cell shows an edit button.",
    },
  },
  {
    title: {
      ru: 'Календарь и поле времени',
      en: 'A calendar and a time field',
    },
    hint: {
      ru: 'Пользователь нажал кнопку правки времени обновления. Под ячейкой календарь, под ним поле времени — часы пояса таблицы.',
      en: "The user clicked the edit button in the update time cell. A calendar appears below the cell, with a time field under it showing the time in the table's time zone.",
    },
    states: ['body.editing', 'overlay.dateEditor'],
    enter: untilDone(
      () => !!dateTime(),
      root => {
        if (!datePopup()) openDateEdit(root, 'updatedAt')
      },
    ),
  },
  {
    title: { ru: 'Время сохранено', en: 'The time is saved' },
    hint: {
      ru: 'Пользователь выбрал день, набрал время и нажал Enter. Календарь закрылся, в ячейке новые день и время.',
      en: 'The user picked a day, typed a time and pressed Enter. The calendar closed, and the cell shows the new day and time.',
    },
    enter: untilDone(
      root => !datePopup() && /:30/.test(dateText(root, 'updatedAt')),
      root => {
        const time = dateTime()
        if (!time) return openDateEdit(root, 'updatedAt')
        const day = dateDay(NEW_MOMENT_DAY)
        if (
          day &&
          day.getAttribute('aria-label')?.includes('selected') !== true
        )
          return day.click()
        if (timeValue(time) !== NEW_TIME) return typeTime(time, NEW_TIME)
        press(time, 'Enter')
      },
    ),
  },
]

/** ADR 0175, S13: пользователь выбирает день и время в календаре даты со временем. */
export const EditingDateTime: StoryObj<StoryProps> = {
  name: 'Edit',
  parameters: { scenario: '0175/S13', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Правка даты со временем', en: 'Editing a date with time' }}
      steps={EDIT_DATE_TIME}
      args={guideArgs(
        {
          ...productArgs,
          columnsOverride: DATE_COLUMNS.filter(
            column => column.id !== 'released',
          ),
          editableColumns: ['updatedAt'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_DATE_TIME[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(dateText(canvas, 'updatedAt')).toMatch(/\d\d:\d\d/)
    })
    await step(EDIT_DATE_TIME[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(dateTime()).not.toBeNull())
    })
    await step(EDIT_DATE_TIME[2]!.title.ru, async () => {
      await guideNext(canvas)
      // Черновик виден в ячейке ещё до сохранения: ждём и закрытия календаря.
      await until(() => {
        expect(datePopup()).toBeNull()
        expect(dateText(canvas, 'updatedAt')).toMatch(/:30/)
      })
      expect(consoleText()).toMatch(/value:"2026-10-02T\d\d:30:00\.000Z"/)
      await settle()
    })
  },
}

// --- ADR 0172, S15: фильтр даты со временем -------------------------------------------------

const FILTER_ROWS = productRows(50)
const FILTER_DAY = '2026-10-15'
const onDay = FILTER_ROWS.filter(row =>
  row.updatedAt.startsWith(FILTER_DAY),
).length

/** Пользователь выбирает условие «в день» и день, затем закрывает панель. */
const filterOnDay = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== onDay) {
    await openPanel(root, 'updatedAt', signal)
    if (!filterActive(root, 'updatedAt')) {
      await pickDay('2026', 9, FILTER_DAY, signal)
      await pollUntil(() => filterActive(root, 'updatedAt'), signal)
    }
    await chooseOperator('on', signal)
    await pollUntil(() => shownCount() === onDay, signal)
  }
  await closePanel(signal)
}

const DATE_TIME_FILTER: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Время обновления без настройки фильтра',
      en: 'Update time without a filter setup',
    },
    hint: {
      ru: 'Время обновления хранится строкой, у колонки задан только тип даты со временем. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
      en: 'The update time is stored as a string, and the column only sets the date-with-time type. Filters are enabled in the table, but the column itself has no filter setup.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'updatedAt']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
      timeZone: 'UTC',
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр времени обновления',
      en: 'The user opened the update time filter',
    },
    hint: {
      ru: 'Тип колонки — дата со временем, поэтому панель предлагает условие и календарь для выбора дня.',
      en: 'The column type is a date with time, so the panel offers a condition and a calendar to pick a day.',
    },
    states: ['overlay.filterDate'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'updatedAt', signal)
      await pollUntil(() => !!calendar(), signal)
    }),
  },
  {
    title: { ru: 'Пользователь выбрал день', en: 'The user picked a day' },
    hint: {
      ru: 'Остались товары, обновлённые в этот день в поясе таблицы, в любое время суток. Нижняя панель называет число оставшихся строк.',
      en: "Only products updated on that day in the table's time zone, at any time of day, remain. The status bar shows how many rows remain.",
    },
    enter: stepAction((root, { signal }) => filterOnDay(root, signal)),
  },
]

/** ADR 0172, S15: пользователь фильтрует даты со временем, хранящиеся строками. */
export const DataTypesDateTimeFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S15', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Фильтр даты со временем',
        en: 'Filtering a date with time',
      }}
      steps={DATE_TIME_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DATE_TIME_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(DATE_TIME_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(calendar()).not.toBeNull()
      await settle()
    })
    await step(DATE_TIME_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(onDay)
      expect(onDay).toBeGreaterThan(0)
      await settle()
    })
  },
}
