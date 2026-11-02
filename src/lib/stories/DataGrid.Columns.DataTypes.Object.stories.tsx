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
    title: 'Менеджеры — записи',
    hint: 'У каждой строки в колонке менеджера — запись с номером и именем. Таблица показывает имя.',
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
    title: 'Пользователь отсортировал по менеджеру',
    hint: 'Пользователь нажал кнопку сортировки дважды. Строки упорядочены по имени менеджера, по алфавиту.',
    enter: sortTo('manager', 'ascending'),
  },
  {
    title: 'Пользователь открыл фильтр менеджера',
    hint: 'Панель предлагает список имён с флажками и числом строк у каждого.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'manager', signal)
      await pollUntil(() => !!byTestId('filter-options'), signal)
    }),
  },
  {
    title: 'Пользователь отметил менеджера',
    hint: 'Остались строки этого менеджера. Записи из разных строк таблица узнаёт по номеру, поэтому все они попали в отбор.',
    enter: stepAction((root, { signal }) => filterManager(root, signal)),
  },
]

/** ADR 0174, S1: пользователь сортирует и фильтрует колонку менеджеров-записей по имени. */
export const DataTypesObject: StoryObj<StoryProps> = {
  name: 'Sort and filter records',
  parameters: { scenario: '0174/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Записи в колонке"
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
    await step(OBJECT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(managerTexts(canvas)[0]).toBe(MANAGED_ROWS[0]!.manager.name)
    })
    await step(OBJECT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(sortOf(canvas, 'manager')).toBe('ascending'))
      const texts = managerTexts(canvas)
      await expect(texts).toEqual(
        [...texts].sort(new Intl.Collator('en').compare),
      )
      await expect(texts[0]).toBe(MANAGERS[0]!.name)
    })
    await step(OBJECT[2]!.title, async () => {
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
    await step(OBJECT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filteredCount()).toBe(labels.filteredRows(count, total))
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
    title: 'Запись без настройки',
    hint: 'Приложение назначило колонке владельца тип записи, но у его записей нет полей, которые таблица понимает сама: номер лежит в другом поле, имя — в двух. Ячейки пусты, в консоли разработчика — предупреждение о записи без номера.',
    props: () => ({
      columnsOverride: [
        ...columnsOf('number', ['name', 'price']),
        ownerColumn('object'),
      ],
      dataOverride: OWNED_ROWS,
    }),
  },
  {
    title: 'Приложение описало запись',
    hint: 'Приложение описало свой тип «человек»: где у записи номер и как из её полей собрать подпись. Колонка владельца показывает имя и фамилию.',
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
      title="Ключ и подпись записи"
      steps={OBJECT_LABEL}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const { owner } = OWNED_ROWS[0]!
    await step(OBJECT_LABEL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'owner')).toBe(''))
    })
    await step(OBJECT_LABEL[1]!.title, async () => {
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
    title: 'Менеджеры из справочника',
    hint: 'Менеджер — запись из справочника на сервере: в ячейке его имя. Его можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Справочник загружается',
    hint: 'Пользователь нажал кнопку правки. Сервер ещё не ответил: под полем поиска — строки-заготовки списка.',
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
    title: 'Сервер отказал',
    hint: 'Справочник не загрузился. Под полем поиска — сообщение об ошибке и кнопка повтора.',
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
    title: 'Справочник загружен',
    hint: 'Пользователь нажал повтор, сервер ответил. В списке записи справочника, текущая отмечена.',
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
    title: 'Запись сохранена',
    hint: 'Пользователь выбрал другого менеджера. Поле закрылось, в ячейке его имя, а в данных — вся запись.',
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
      title="Выбор из справочника"
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
    await step(EDIT_LOOKUP[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Ann'))
    })
    await step(EDIT_LOOKUP[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(lookupStatus()).toBe('loading'))
    })
    await step(EDIT_LOOKUP[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(lookupFailed()).toBe(true))
    })
    await step(EDIT_LOOKUP[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem(NEW_MANAGER)).not.toBeNull())
      expect(optionItem('m1')).toHaveAttribute('data-selected')
    })
    await step(EDIT_LOOKUP[4]!.title, async () => {
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
    title: 'Менеджеры без справочника',
    hint: 'Менеджер — запись с ключом и именем. Справочника у колонки нет: записи лежат только в строках таблицы.',
  },
  {
    title: 'Записи из таблицы',
    hint: 'Пользователь нажал кнопку правки менеджера. В списке — менеджеры, которые уже встречаются в таблице, текущий отмечен.',
    states: ['body.editing', 'overlay.optionEditor'],
    enter: untilDone(
      () => !!optionItem(PICKED),
      root => {
        if (!selectField()) openOptionEdit(root, 'manager')
      },
    ),
  },
  {
    title: 'Запись сохранена',
    hint: 'Пользователь выбрал другого менеджера. Поле закрылось, в ячейке его имя, а в данных — та же запись, что и в другой строке.',
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
      title="Запись из таблицы"
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
    await step(EDIT_RECORD_FROM_DATA[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Ann'))
    })
    await step(EDIT_RECORD_FROM_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(optionItem(PICKED)).not.toBeNull())
      expect(optionItem('m1')).toHaveAttribute('data-selected')
    })
    await step(EDIT_RECORD_FROM_DATA[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(optionCellText(canvas, 'manager')).toBe('Cy'))
      expect(selectField()).toBeNull()
      expect(consoleText()).toMatch(/value:\{id:"m3",name:"Cy"\}/)
      await settle()
    })
  },
}
