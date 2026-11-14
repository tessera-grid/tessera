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
  orderedRows,
  pollUntil,
  stepDone,
} from './__mocks__/catalogPlay'
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
import {
  DIRECTORY,
  LOOKUP_COLUMNS,
  LOOKUP_ROWS,
  RECORD_COLUMNS,
} from './__mocks__/editingData'
import { storyLabels } from './__mocks__/storyLabels'
import { type ColumnDef } from '../types'
import {
  MANAGERS,
  MANAGER_COLUMN,
  PERSON_TYPES,
  managedRows,
  ownedRows,
} from './__mocks__/dataTypesData'
import {
  checkOption,
  closePanel,
  filterActive,
  filteredCount,
  openPanel,
  optionOf,
} from './__mocks__/filterGuide'
import {
  productArgs,
  optionCellText,
  openOptionEdit,
  selectField,
  optionsPopup,
  optionItem,
  OWN_TABLE,
  CELL,
  textOf,
  sortOf,
  sortTo,
  columnsOf,
} from './__mocks__/typeGuides'
import { filteringLabels } from '../shared/filtering/labels'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Object',
} satisfies Meta<StoryProps>

export default meta

export const ObjectPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: менеджер — запись с ключом и подписью. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: [...columnsOf('number', ['name']), MANAGER_COLUMN],
    dataOverride: managedRows(50),
    enableCellEditing: true,
    editableColumns: ['manager'],
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
    title: { ru: 'Менеджеры — записи', en: 'Managers are records' },
    hint: {
      ru: 'У каждой строки в колонке менеджера — запись с номером и именем. Таблица показывает имя.',
      en: 'Each row has a record with an id and a name in the manager column. The table shows the name.',
    },
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
    title: {
      ru: 'Пользователь отсортировал по менеджеру',
      en: 'The user sorted by manager',
    },
    hint: {
      ru: 'Пользователь нажал кнопку сортировки дважды. Строки упорядочены по имени менеджера, по алфавиту.',
      en: "The user clicked the sort button twice. The rows are ordered alphabetically by the manager's name.",
    },
    enter: sortTo('manager', 'ascending'),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр менеджера',
      en: 'The user opened the manager filter',
    },
    hint: {
      ru: 'Панель предлагает список имён с флажками и числом строк у каждого.',
      en: 'The panel offers a list of names with checkboxes and a row count for each.',
    },
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'manager', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отметил менеджера',
      en: 'The user checked a manager',
    },
    hint: {
      ru: 'Остались строки этого менеджера. Записи из разных строк таблица узнаёт по номеру, поэтому все они попали в отбор.',
      en: "Only this manager's rows remain. The table recognizes records from different rows by their id, so all of them made it through the filter.",
    },
    enter: stepAction((root, { signal }) => filterManager(root, signal)),
  },
]

/** ADR 0174, S1: пользователь сортирует и фильтрует колонку менеджеров-записей по имени. */
export const DataTypesObject: StoryObj<StoryProps> = {
  name: 'Sort and filter records',
  parameters: { scenario: '0174/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Записи в колонке', en: 'Records in a column' }}
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
    await step(OBJECT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(managerTexts(canvas)[0]).toBe(MANAGED_ROWS[0]!.manager.name)
    })
    await step(OBJECT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sortOf(canvas, 'manager')).toBe('ascending'))
      const texts = managerTexts(canvas)
      await expect(texts).toEqual(
        [...texts].sort(new Intl.Collator('en').compare),
      )
      await expect(texts[0]).toBe(MANAGERS[0]!.name)
    })
    await step(OBJECT[2]!.title.ru, async () => {
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
    await step(OBJECT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(
        filteringLabels(labels).filteredRows(count, total),
      )
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
    title: { ru: 'Запись без настройки', en: 'A record without setup' },
    hint: {
      ru: 'Приложение назначило колонке владельца тип записи, но у его записей нет полей, которые таблица понимает сама: номер лежит в другом поле, имя — в двух. Ячейки пусты, в консоли разработчика — предупреждение о записи без номера.',
      en: 'The app gave the owner column the record type, but its records lack the fields the table understands on its own: the id is in a different field, and the name is split across two. The cells are empty, and the developer console shows a warning about a record without an id.',
    },
    props: () => ({
      columnsOverride: [
        ...columnsOf('number', ['name', 'price']),
        ownerColumn('object'),
      ],
      dataOverride: OWNED_ROWS,
    }),
  },
  {
    title: {
      ru: 'Приложение описало запись',
      en: 'The app described the record',
    },
    hint: {
      ru: 'Приложение описало свой тип «человек»: где у записи номер и как из её полей собрать подпись. Колонка владельца показывает имя и фамилию.',
      en: 'The app described its own "person" type: where the record keeps its id and how to build a label from its fields. The owner column shows the first and last name.',
    },
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
  name: 'Key and label',
  parameters: { scenario: '0174/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Ключ и подпись записи', en: "A record's key and label" }}
      steps={OBJECT_LABEL}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const { owner } = OWNED_ROWS[0]!
    await step(OBJECT_LABEL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'owner')).toBe(''))
    })
    await step(OBJECT_LABEL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(textOf(canvas, 0, 'owner')).toBe(`${owner.first} ${owner.last}`),
      )
      await settle()
    })
  },
}

const lookupStatus = () =>
  optionsPopup()?.querySelector('[aria-busy="true"]') ? 'loading' : null
const lookupFailed = () =>
  !!optionsPopup()?.querySelector('[data-testid="edit-options-retry"]')
const NEW_MANAGER = 'm4'

const EDIT_LOOKUP: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Менеджеры из справочника', en: 'Managers from a lookup' },
    hint: {
      ru: 'Менеджер — запись из справочника на сервере: в ячейке его имя. Его можно править: при наведении на ячейку появляется кнопка правки.',
      en: 'A manager is a record from a lookup on the server; the cell shows their name. The manager can be edited: hovering over the cell shows an edit button.',
    },
  },
  {
    title: { ru: 'Справочник загружается', en: 'The lookup is loading' },
    hint: {
      ru: 'Пользователь нажал кнопку правки. Сервер ещё не ответил: под полем поиска — строки-заготовки списка.',
      en: 'The user clicked the edit button. The server has not responded yet: under the search field, the list shows skeleton rows.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => lookupStatus() === 'loading',
      root => {
        DIRECTORY.hold()
        if (!selectField()) openOptionEdit(root, 'manager')
      },
    ),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Справочник не загрузился. Под полем поиска — сообщение об ошибке и кнопка повтора.',
      en: 'The lookup failed to load. Under the search field are an error message and a retry button.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => lookupFailed(),
      root => {
        DIRECTORY.hold()
        if (!selectField()) return openOptionEdit(root, 'manager')
        DIRECTORY.refuse()
      },
    ),
  },
  {
    title: { ru: 'Справочник загружен', en: 'The lookup has loaded' },
    hint: {
      ru: 'Пользователь нажал повтор, сервер ответил. В списке записи справочника, текущая отмечена.',
      en: 'The user clicked retry, and the server responded. The list shows the lookup records, with the current one checked.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      root => !!optionItem(NEW_MANAGER),
      root => {
        if (!selectField()) {
          DIRECTORY.answer()
          return openOptionEdit(root, 'manager')
        }
        DIRECTORY.answer()
        optionsPopup()
          ?.querySelector<HTMLElement>('[data-testid="edit-options-retry"]')
          ?.click()
      },
    ),
  },
  {
    title: { ru: 'Запись сохранена', en: 'The record was saved' },
    hint: {
      ru: 'Пользователь выбрал другого менеджера. Поле закрылось, в ячейке его имя, а в данных — вся запись.',
      en: "The user chose another manager. The editor closed; the cell shows the manager's name, and the data holds the whole record.",
    },
    enter: untilDone(
      root => !selectField() && optionCellText(root, 'manager') === 'Dana',
      root => {
        DIRECTORY.answer()
        if (!selectField()) return openOptionEdit(root, 'manager')
        optionItem(NEW_MANAGER)?.click()
      },
    ),
  },
]

/** ADR 0175, S5: пользователь выбирает запись справочника с сервера — ответ и отказ загрузки. */
export const EditingLookup: StoryObj<StoryProps> = {
  name: 'Choose from a directory',
  parameters: { scenario: '0175/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Выбор из справочника', en: 'Choosing from a lookup' }}
      steps={EDIT_LOOKUP}
      args={guideArgs(
        {
          ...productArgs,
          columnsOverride: LOOKUP_COLUMNS,
          dataOverride: LOOKUP_ROWS,
          editableColumns: ['manager'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_LOOKUP[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Ann'))
    })
    await step(EDIT_LOOKUP[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(lookupStatus()).toBe('loading'))
    })
    await step(EDIT_LOOKUP[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(lookupFailed()).toBe(true))
    })
    await step(EDIT_LOOKUP[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem(NEW_MANAGER)).not.toBeNull())
      expect(optionItem('m1')).toHaveAttribute('data-selected')
    })
    await step(EDIT_LOOKUP[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Dana'))
      expect(selectField()).toBeNull()
      expect(consoleText()).toMatch(/value:\{id:"m4",name:"Dana"\}/)
      await settle()
    })
  },
}

const PICKED = 'm3'

const EDIT_RECORD_FROM_DATA: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Менеджеры без справочника', en: 'Managers without a lookup' },
    hint: {
      ru: 'Менеджер — запись с ключом и именем. Справочника у колонки нет: записи лежат только в строках таблицы.',
      en: 'A manager is a record with a key and a name. The column has no lookup: the records live only in the table rows.',
    },
  },
  {
    title: { ru: 'Записи из таблицы', en: 'Records from the table' },
    hint: {
      ru: 'Пользователь нажал кнопку правки менеджера. В списке — менеджеры, которые уже встречаются в таблице, текущий отмечен.',
      en: 'The user clicked the manager edit button. The list shows the managers already present in the table, with the current one checked.',
    },
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      () => !!optionItem(PICKED),
      root => {
        if (!selectField()) openOptionEdit(root, 'manager')
      },
    ),
  },
  {
    title: { ru: 'Запись сохранена', en: 'The record was saved' },
    hint: {
      ru: 'Пользователь выбрал другого менеджера. Поле закрылось, в ячейке его имя, а в данных — та же запись, что и в другой строке.',
      en: "The user chose another manager. The editor closed; the cell shows the manager's name, and the data holds the same record as in another row.",
    },
    enter: untilDone(
      root => !selectField() && optionCellText(root, 'manager') === 'Cy',
      root => {
        if (!selectField()) return openOptionEdit(root, 'manager')
        optionItem(PICKED)?.click()
      },
    ),
  },
]

/** ADR 0175, S9: пользователь выбирает запись колонки, у которой нет справочника. */
export const EditingRecordFromData: StoryObj<StoryProps> = {
  name: 'Choose a record from the table',
  parameters: { scenario: '0175/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Запись из таблицы', en: 'A record from the table' }}
      steps={EDIT_RECORD_FROM_DATA}
      args={guideArgs(
        {
          ...productArgs,
          columnsOverride: RECORD_COLUMNS,
          dataOverride: LOOKUP_ROWS,
          editableColumns: ['manager'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_RECORD_FROM_DATA[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Ann'))
    })
    await step(EDIT_RECORD_FROM_DATA[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem(PICKED)).not.toBeNull())
      expect(optionItem('m1')).toHaveAttribute('data-selected')
    })
    await step(EDIT_RECORD_FROM_DATA[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Cy'))
      expect(selectField()).toBeNull()
      expect(consoleText()).toMatch(/value:\{id:"m3",name:"Cy"\}/)
      await settle()
    })
  },
}
