import { stepAction } from './demos/GuideStory'
import { pollUntil, stepDone } from './__mocks__/catalogPlay'
import { closePanel, openPanel, panel } from './__mocks__/filterGuide'
import {
  booleanChosen,
  chooseBoolean,
  columnsOf,
  shownCount,
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
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { productRows } from './__mocks__/dataTypesData'
import {
  PRODUCT_ROW,
  productCellOf,
  productInput,
  productArgs,
  OWN_TABLE,
} from './__mocks__/typeGuides'

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types/Boolean',
} satisfies Meta<StoryProps>

export default meta

export const BooleanPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Колонка типа в покое: наличие — булево, флажок во всю ячейку. Правка, сортировка и фильтр включены.
  args: {
    columnsOverride: columnsOf('number', ['name', 'inStock']),
    dataOverride: productRows(50),
    enableCellEditing: true,
    editableColumns: ['inStock'],
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

const stockBox = (root: ParentNode) =>
  productCellOf(root, 'inStock')?.querySelector<HTMLElement>(
    '[role="checkbox"]',
  ) ?? null
const checkedIn = (root: ParentNode) =>
  stockBox(root)?.getAttribute('aria-checked') === 'true'

/** Активная ячейка наличия — пробел с клавиатуры. */
const pressSpaceOnStock = (root: HTMLElement) => {
  const cell = productCellOf(root, 'inStock')
  cell?.focus({ preventScroll: true })
  cell?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
}

const EDIT_BOOLEAN: readonly GuideStoryStep[] = [
  {
    title: 'Флажки наличия',
    hint: 'Наличие на складе — флажок во всю ячейку. Кнопки правки нет: нажатие в ячейке сразу меняет значение.',
  },
  {
    title: 'Флажок переключён',
    hint: 'Пользователь нажал на ячейку. Значение сразу переключилось и сохранилось — без поля правки.',
    enter: untilDone(
      root => checkedIn(root),
      root => stockBox(root)?.click(),
    ),
  },
  {
    title: 'Пробел с клавиатуры',
    keyboard: true,
    hint: 'Пользователь перешёл на ячейку клавиатурой и нажал пробел. Значение переключилось обратно и тоже сохранилось.',
    // Со свежей таблицы флажок ещё не переключали: сперва нажатие, затем пробел.
    enter: (root, app) => {
      let pressed = false
      return untilDone(
        root => pressed && !checkedIn(root),
        root => {
          if (!checkedIn(root)) {
            if (!pressed) stockBox(root)?.click()
          } else if (!pressed) {
            pressed = true
            pressSpaceOnStock(root)
          }
        },
      )(root, app)
    },
  },
]

/** ADR 0175, S2: пользователь переключает булево одним нажатием. */
export const EditingBoolean: StoryObj<StoryProps> = {
  name: 'Toggle',
  parameters: {
    scenario: '0175/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Правка флажка"
      steps={EDIT_BOOLEAN}
      args={guideArgs(productArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_BOOLEAN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(checkedIn(canvas)).toBe(false))
    })
    await step(EDIT_BOOLEAN[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(checkedIn(canvas)).toBe(true))
      await until(() => expect(productInput(canvas, 'inStock')).toBeNull())
      await until(() => expect(consoleText()).toMatch(/value:true/))
    })
    await step(EDIT_BOOLEAN[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(checkedIn(canvas)).toBe(false))
      await until(() => expect(consoleText()).toMatch(/value:false/))
      await settle()
    })
  },
}

const stockCell = (root: ParentNode) => productCellOf(root, 'inStock')
const stockToggle = (root: ParentNode) =>
  stockCell(root)?.querySelector<HTMLElement>('[role="checkbox"]') ?? null
const rowSelected = (root: ParentNode) =>
  root
    .querySelector(`.data-grid__body-row[data-row-id="${PRODUCT_ROW}"]`)
    ?.getAttribute('data-selected') === 'true'
/** Клавиша на активной ячейке наличия. */
const keyOnStock = (root: HTMLElement, shiftKey: boolean) => {
  const cell = stockCell(root)
  cell?.focus({ preventScroll: true })
  cell?.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', shiftKey, bubbles: true }),
  )
}

const EDIT_BOOLEAN_KEYBOARD: readonly GuideStoryStep[] = [
  {
    title: 'Флажок в ячейке',
    hint: 'Наличие на складе можно править: для скринридера значение ячейки — флажок. Строки таблицы можно выбирать.',
  },
  {
    title: 'Пробел переключает флажок',
    keyboard: true,
    hint: 'Пользователь перешёл на ячейку наличия клавиатурой и нажал пробел. Флажок переключился и сохранился, строка не выбрана.',
    enter: untilDone(
      root => stockToggle(root)?.getAttribute('aria-checked') === 'true',
      root => keyOnStock(root, false),
    ),
  },
  {
    title: 'Shift+Space выбирает строку',
    keyboard: true,
    hint: 'На той же ячейке пользователь нажал пробел с Shift. Строка выбрана, флажок не изменился.',
    states: ['body.selection'],
    enter: untilDone(
      root => rowSelected(root),
      root =>
        stockToggle(root)?.getAttribute('aria-checked') === 'true'
          ? keyOnStock(root, true)
          : keyOnStock(root, false),
    ),
  },
]

/** ADR 0175, S10: пользователь без мыши переключает флажок пробелом и выбирает строку Shift+Space. */
export const EditingBooleanKeyboard: StoryObj<StoryProps> = {
  name: 'Toggle and select with the keyboard',
  parameters: { scenario: '0175/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title="Флажок и выбор строки с клавиатуры"
      steps={EDIT_BOOLEAN_KEYBOARD}
      args={guideArgs({ ...productArgs, enableRowSelection: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_BOOLEAN_KEYBOARD[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(stockToggle(canvas)).toHaveAttribute('aria-checked', 'false'),
      )
    })
    await step(EDIT_BOOLEAN_KEYBOARD[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(stockToggle(canvas)).toHaveAttribute('aria-checked', 'true'),
      )
      expect(rowSelected(canvas)).toBe(false)
    })
    await step(EDIT_BOOLEAN_KEYBOARD[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(rowSelected(canvas)).toBe(true))
      expect(stockToggle(canvas)).toHaveAttribute('aria-checked', 'true')
      await settle()
    })
  },
}

// --- ADR 0172, S14: фильтр булева ----------------------------------------------------------

const FILTER_ROWS = productRows(50)
const IN_STOCK = FILTER_ROWS.filter(row => row.inStock).length
const OUT_OF_STOCK = FILTER_ROWS.length - IN_STOCK

/** Пользователь выбирает вариант панели и закрывает её. */
const filterStock = async (
  root: HTMLElement,
  choice: 'yes' | 'no',
  count: number,
  signal: AbortSignal,
) => {
  if (shownCount() !== count) {
    await openPanel(root, 'inStock', signal)
    await chooseBoolean(choice, signal)
    await pollUntil(() => shownCount() === count, signal)
  }
  await closePanel(signal)
}

const BOOLEAN_FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Наличие без настройки фильтра',
    hint: 'Наличие — булево, у колонки задан только тип данных. Фильтры в таблице подключены, но сама колонка фильтр не настраивала.',
    props: () => ({
      columnsOverride: columnsOf('number', ['name', 'inStock']),
      dataOverride: FILTER_ROWS,
      enableColumnFiltering: true,
      columnFilteringFilteredCount: true,
    }),
  },
  {
    title: 'Пользователь открыл фильтр наличия',
    hint: 'Тип колонки — булево, поэтому панель предлагает выбор из вариантов: все, да, нет и пусто. Пока выбраны все.',
    enter: stepAction(async (root, { signal }) => {
      await openPanel(root, 'inStock', signal)
      await pollUntil(() => booleanChosen('all'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал «да»',
    hint: 'Остались товары в наличии. Нижняя панель называет число оставшихся строк.',
    enter: stepAction((root, { signal }) =>
      filterStock(root, 'yes', IN_STOCK, signal),
    ),
  },
  {
    title: 'Пользователь выбрал «нет»',
    hint: 'Остались товары, которых нет в наличии.',
    enter: stepAction((root, { signal }) =>
      filterStock(root, 'no', OUT_OF_STOCK, signal),
    ),
  },
]

/** ADR 0172, S14: пользователь фильтрует булево без настройки фильтра колонки. */
export const DataTypesBooleanFilter: StoryObj<StoryProps> = {
  name: 'Filter',
  parameters: { scenario: '0172/S14', ...guideControls() },
  render: args => (
    <GuideStory
      title="Фильтр булева"
      steps={BOOLEAN_FILTER}
      args={guideArgs({ height: '460' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BOOLEAN_FILTER[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(BOOLEAN_FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(
        panel()?.querySelector('[data-testid="filter-boolean"]'),
      ).not.toBeNull()
      await settle()
    })
    await step(BOOLEAN_FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(IN_STOCK)
    })
    await step(BOOLEAN_FILTER[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(shownCount()).toBe(OUT_OF_STOCK)
      await settle()
    })
  },
}
