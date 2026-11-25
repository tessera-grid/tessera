import { stepAction } from './demos/DemoStory'
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
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import {
  press,
  lastOf,
  optionCellText,
  openOptionEdit,
  optionArgs,
  OWN_TABLE,
} from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Multi select',
} satisfies Meta<StoryProps>

export default meta

export const MultiSelectPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: метки — несколько вариантов. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'tags']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['tags'],
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

const multiPopup = () => lastOf<HTMLElement>('[data-testid="edit-multiselect"]')
const tagBox = (value: string) =>
  multiPopup()?.querySelector<HTMLElement>(
    `[data-value="${value}"] [role="checkbox"]`,
  ) ?? null
const tagChecked = (value: string) =>
  tagBox(value)?.getAttribute('aria-checked') === 'true'
/** Метки первого товара: «new» и «eco» отмечены, «sale» — нет. */
const ADDED_TAG = 'sale'

const EDIT_MULTI: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Метки товаров', en: 'Product tags' },
    hint: {
      ru: 'Метки — несколько вариантов из списка. Их можно править: при наведении на ячейку появляется кнопка правки.',
      en: 'Tags are several options from a list. They are editable: hovering over a cell shows an edit button.',
    },
  },
  {
    title: { ru: 'Список с флажками', en: 'A list with checkboxes' },
    hint: {
      ru: 'Пользователь нажал кнопку правки меток. Под ячейкой поиск и список с флажками, отмечены метки из ячейки.',
      en: "The user clicked the edit button for the tags. Below the cell are a search field and a list with checkboxes; the cell's tags are checked.",
    },
    states: ['body.editing', 'overlay.multiSelectEditor'],
    enter: untilDone(
      root => !!tagBox('new'),
      root => {
        if (!multiPopup()) openOptionEdit(root, 'tags')
      },
    ),
  },
  {
    title: { ru: 'Метка отмечена', en: 'A tag is checked' },
    hint: {
      ru: 'Пользователь отметил ещё одну метку. Под списком ячейка показывает черновик, но правка ещё не сохранена: значение уйдёт в данные по Enter.',
      en: 'The user checked one more tag. Beneath the list, the cell shows a draft, but the edit is not saved yet: the value will go to the data when Enter is pressed.',
    },
    states: ['body.editing', 'overlay.multiSelectEditor'],
    enter: untilDone(
      root => tagChecked(ADDED_TAG),
      root => {
        if (!multiPopup()) return openOptionEdit(root, 'tags')
        tagBox(ADDED_TAG)?.click()
      },
    ),
  },
  {
    title: { ru: 'Метки сохранены', en: 'The tags are saved' },
    hint: {
      ru: 'Пользователь нажал Enter. Список закрылся, в ячейке новые метки.',
      en: 'The user pressed Enter. The list closed, and the cell shows the new tags.',
    },
    enter: untilDone(
      root => !multiPopup() && optionCellText(root, 'tags').includes('Sale'),
      root => {
        if (!multiPopup()) return openOptionEdit(root, 'tags')
        if (!tagChecked(ADDED_TAG)) return tagBox(ADDED_TAG)?.click()
        const search = multiPopup()!.querySelector<HTMLInputElement>('input')!
        press(search, 'Enter')
      },
    ),
  },
]

/** ADR 0175, S6: пользователь выбирает несколько вариантов в списке с флажками. */
export const EditingMultiSelect: StoryObj<StoryProps> = {
  name: 'Choose several',
  parameters: { scenario: '0175/S6', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Выбор нескольких вариантов',
        en: 'Picking several options',
      }}
      steps={EDIT_MULTI}
      args={guideArgs(optionArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_MULTI[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(optionCellText(canvas, 'tags')).not.toContain('Sale')
    })
    await step(EDIT_MULTI[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(tagChecked('new')).toBe(true))
      expect(tagChecked(ADDED_TAG)).toBe(false)
    })
    await step(EDIT_MULTI[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(tagChecked(ADDED_TAG)).toBe(true))
      expect(consoleText()).not.toContain('onCellEdit')
    })
    await step(EDIT_MULTI[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(multiPopup()).toBeNull()
        expect(optionCellText(canvas, 'tags')).toContain('Sale')
      })
      await settle()
    })
  },
}

// --- ADR 0172, S17: фильтр нескольких вариантов -------------------------------------------

const FILTER_ROWS = productRows(50)
const ON_SALE = FILTER_ROWS.filter(row => row.tags.includes('sale')).length

/** Пользователь отмечает метку и закрывает панель. */
const filterSale = async (root: HTMLElement, signal: AbortSignal) => {
  if (shownCount() !== ON_SALE) {
    await openPanel(root, 'tags', signal)
    await checkOption('sale', signal)
    await pollUntil(() => shownCount() === ON_SALE, signal)
  }
  await closePanel(signal)
}

const MULTI_FILTER: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Метки без настройки фильтра',
      en: 'Tags without a filter setup',
    },
    hint: {
      ru: 'У товара может быть несколько меток, у колонки заданы тип и варианты. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
      en: 'A product can have several tags, and the column has a type and options set. Filtering is enabled in the table, but the column itself has not configured a filter.',
    },
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'tags']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл фильтр меток',
      en: 'The user opened the tag filter',
    },
    hint: {
      ru: 'Тип колонки — несколько вариантов, поэтому панель предлагает список меток с флажками и поиском.',
      en: "The column's type allows several options, so the panel offers a list of tags with checkboxes and a search field.",
    },
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'tags', signal)
      await pollUntil(() => !!optionOf('sale'), signal)
    }),
  },
  {
    title: { ru: 'Пользователь отметил метку', en: 'The user checked a tag' },
    hint: {
      ru: 'Остались товары, среди меток которых есть отмеченная. Нижняя панель называет число оставшихся строк.',
      en: 'Only products that have the checked tag among their tags remain. The status bar shows the number of remaining rows.',
    },
    enter: stepAction((root, { signal }) => filterSale(root, signal)),
  },
]

/** ADR 0172, S17: пользователь фильтрует несколько вариантов без настройки фильтра колонки. */
export const DataTypesMultiSelectFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S17', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Фильтр нескольких вариантов',
        en: 'Filtering by several options',
      }}
      steps={MULTI_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MULTI_FILTER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(MULTI_FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(optionOf('new')).not.toBeNull()
      await settle()
    })
    await step(MULTI_FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(ON_SALE)
      await settle()
    })
  },
}
