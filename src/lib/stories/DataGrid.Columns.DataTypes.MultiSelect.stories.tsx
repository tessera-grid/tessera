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

const EDIT_MULTI: readonly GuideStoryStep[] = [
  {
    title: 'Метки товаров',
    hint: 'Метки — несколько вариантов из списка. Их можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Список с флажками',
    hint: 'Пользователь нажал кнопку правки меток. Под ячейкой поиск и список с флажками, отмечены метки из ячейки.',
    states: ['body.editing', 'overlay.multiSelectEditor'],
    enter: untilDone(
      root => !!tagBox('new'),
      root => {
        if (!multiPopup()) openOptionEdit(root, 'tags')
      },
    ),
  },
  {
    title: 'Метка отмечена',
    hint: 'Пользователь отметил ещё одну метку. Под списком ячейка показывает черновик, но правка ещё не сохранена: значение уйдёт в данные по Enter.',
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
    title: 'Метки сохранены',
    hint: 'Пользователь нажал Enter. Список закрылся, в ячейке новые метки.',
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
    <GuideStory
      title="Выбор нескольких вариантов"
      steps={EDIT_MULTI}
      args={guideArgs(optionArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_MULTI[0]!.title, async () => {
      await waitForRows(canvas)
      expect(optionCellText(canvas, 'tags')).not.toContain('Sale')
    })
    await step(EDIT_MULTI[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(tagChecked('new')).toBe(true))
      expect(tagChecked(ADDED_TAG)).toBe(false)
    })
    await step(EDIT_MULTI[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(tagChecked(ADDED_TAG)).toBe(true))
      expect(consoleText()).not.toContain('onCellEdit')
    })
    await step(EDIT_MULTI[3]!.title, async () => {
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

const MULTI_FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Метки без настройки фильтра',
    hint: 'У товара может быть несколько меток, у колонки заданы тип и варианты. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'tags']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь открыл фильтр меток',
    hint: 'Тип колонки — несколько вариантов, поэтому панель предлагает список меток с флажками и поиском.',
    states: ['overlay.filterOptions'],
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'tags', signal)
      await pollUntil(() => !!optionOf('sale'), signal)
    }),
  },
  {
    title: 'Пользователь отметил метку',
    hint: 'Остались товары, среди меток которых есть отмеченная. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) => filterSale(root, signal)),
  },
]

/** ADR 0172, S17: пользователь фильтрует несколько вариантов без настройки фильтра колонки. */
export const DataTypesMultiSelectFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S17', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр нескольких вариантов"
      steps={MULTI_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MULTI_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(MULTI_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(optionOf('new')).not.toBeNull()
      await settle()
    })
    await step(MULTI_FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(ON_SALE)
      await settle()
    })
  },
}
