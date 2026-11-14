import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import type { Failure } from '../core/failures/failuresFeature'
import { untilDone } from './__mocks__/cellGestures'
import { columns as mockColumns } from './__mocks__/columns'
import { getData } from './__mocks__/data'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { createHeldServer } from './__mocks__/heldServer'
import { seed } from './__mocks__/seed'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Ошибка в ячейке (ADR 0150) и отказ сохранения (ADR 0177): отметка в углу ячейки с ошибкой
 * данных и с отклонённым значением.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Errors',
} satisfies Meta<StoryProps>

export default meta

export const CellErrorsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Ошибки данных: больше 15 визитов — точка у ячейки Visits. С правкой ячеек точка встаёт на
  // кнопку правки.
  args: {
    enableCellErrors: true,
    columnCount: 6,
    dataCount: 10,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls([
    'enableCellErrors',
    'enableCellEditing',
    'enableKeyboardNavigation',
  ]),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Действия шагов ------------------------------------------------------------------

const DATA_COUNT = 10
/** Текст демо-ошибки: больше 15 визитов (DataGridStory). */
const DATA_ERROR = 'More than 15 visits'
/** Строка с ошибкой в данных историй. */
const ERROR_ROW = getData(DATA_COUNT).find(row => row.visits > 15)!.id as string
const FIXED_VISITS = '10'
const REFUSAL = 'The server refused the value'

const visitsCellOf = (root: ParentNode, row = ERROR_ROW) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="visits"]`,
  )
const inputOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
/** Отметка ошибки — треугольник в углу ячейки (ADR 0177, §5). */
const markOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLElement>('button[data-cell-issue]') ??
  null
const descriptionOf = (button: HTMLElement | null) =>
  button
    ?.getAttribute('aria-describedby')
    ?.split(' ')
    .map(id => document.getElementById(id)?.textContent)
    .join(' ')
const visitsText = (root: ParentNode) => {
  const copy = visitsCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue]')
    .forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const editButtonOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const press = (input: HTMLInputElement, key: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

/** Открыть правку визитов, набрать значение и сохранить — по такту на действие. */
const saveVisits = (root: HTMLElement, value: string) => {
  const input = inputOf(root)
  if (!input) editButtonOf(root)?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

// --- ADR 0150 S1 ---------------------------------------------------------------------

const FIX_VALUES: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ошибки в данных', en: 'Errors in the data' },
    hint: {
      ru: 'Приложение проверило данные: больше 15 визитов — ошибка. В правом верхнем углу таких ячеек — отметка ошибки, её подсказка — текст ошибки.',
      en: 'The app checked the data: more than 15 visits is an error. Such cells have an error mark in the top-right corner, and its tooltip is the error text.',
    },
    states: ['body.error'],
  },
  {
    title: { ru: 'Значение исправлено', en: 'The value is fixed' },
    hint: {
      ru: 'Пользователь открыл правку числа визитов и сохранил 10. Ошибки больше нет — отметка из угла ячейки ушла.',
      en: 'The user started editing the visit count and saved 10. The error is gone, and the mark disappeared from the cell corner.',
    },
    enter: untilDone(
      root => !inputOf(root) && visitsText(root) === FIXED_VISITS,
      root => saveVisits(root, FIXED_VISITS),
    ),
  },
]

/** ADR 0150, S1: приложение отмечает ошибки данных, пользователь исправляет значение. */
export const CellErrorsFixValues: StoryObj<StoryProps> = {
  name: 'Fix invalid values',
  parameters: { scenario: '0150/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Исправление ошибки', en: 'Fixing an error' }}
      steps={FIX_VALUES}
      args={guideArgs(
        {
          enableCellErrors: true,
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FIX_VALUES[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(markOf(canvas)).not.toBeNull())
      expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR)
      await settle()
    })
    await step(FIX_VALUES[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(visitsText(canvas)).toBe(FIXED_VISITS))
      await until(() => expect(markOf(canvas)).toBeNull())
      await settle()
    })
  },
}

// --- ADR 0150 S2 ---------------------------------------------------------------------

const READ_ONLY_COLUMNS = mockColumns.filter(column =>
  ['firstName', 'lastName', 'visits', 'total'].includes(column.id as string),
)

/** Указатель на элемент — один раз: повтор перезапускал бы задержку подсказки. */
const hovered = new WeakSet<Element>()
const hoverOnce = (element: HTMLElement | null) => {
  if (!element || hovered.has(element)) return
  hovered.add(element)
  element.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
  )
}

const READ_ONLY: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Ошибки в таблице только для чтения',
      en: 'Errors in a read-only table',
    },
    hint: {
      ru: 'Таблицу нельзя править, но приложение проверило данные: больше 15 визитов — ошибка. В правом верхнем углу таких ячеек стоит отметка ошибки.',
      en: 'The table cannot be edited, but the app checked the data: more than 15 visits is an error. Such cells have an error mark in the top-right corner.',
    },
    states: ['body.cellError'],
  },
  {
    title: { ru: 'Текст ошибки', en: 'The error text' },
    hint: {
      ru: 'Пользователь навёл указатель на отметку. Подсказка показывает текст ошибки.',
      en: 'The user hovered over the mark. The tooltip shows the error text.',
    },
    states: ['overlay.tooltip'],
    enter: untilDone(
      root =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === DATA_ERROR,
        ),
      root => hoverOnce(markOf(root)),
    ),
  },
]

/** ADR 0150, S2: таблица только для чтения с ошибками данных. */
export const CellErrorsReadOnly: StoryObj<StoryProps> = {
  name: 'Read-only table',
  parameters: { scenario: '0150/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Ошибки без правки', en: 'Errors without editing' }}
      steps={READ_ONLY}
      args={guideArgs(
        {
          enableCellErrors: true,
          // Колонка визитов — не у правого края: подсказка точки остаётся в окне.
          columnsOverride: READ_ONLY_COLUMNS,
          dataCount: DATA_COUNT,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(READ_ONLY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(markOf(canvas)?.getAttribute('aria-label')).toBe(
          labels.cellError,
        ),
      )
      expect(markOf(canvas)!.querySelector('svg')).toBeNull()
      expect(visitsCellOf(canvas)).toHaveAttribute('aria-invalid', 'true')
      await settle()
    })
    await step(READ_ONLY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          [...document.querySelectorAll('[data-side]')].some(
            el => el.textContent?.trim() === DATA_ERROR,
          ),
        ).toBe(true),
      )
      await settle()
    })
  },
}

// --- ADR 0150 S3 ---------------------------------------------------------------------

/** «Сервер» гайда: отказывает каждому сохранению. */
const refuse = () => Promise.reject(new Error(REFUSAL))

const REFUSAL_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ошибка в данных', en: 'An error in the data' },
    hint: {
      ru: 'Приложение отметило ошибку: больше 15 визитов. В правом верхнем углу ячейки — отметка ошибки, её подсказка — текст ошибки.',
      en: 'The app marked an error: more than 15 visits. The cell has an error mark in the top-right corner, and its tooltip is the error text.',
    },
    states: ['body.error'],
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сохранил новое число визитов, но сервер его отклонил. В ячейке снова значение из данных, подсказка отметки — причина отказа: она важнее ошибки в данных, пока отказ не снят.',
      en: "The user saved a new visit count, but the server rejected it. The cell shows the value from the data again, and the mark's tooltip shows the refusal reason: it takes precedence over the data error until the refusal is cleared.",
    },
    states: ['body.error'],
    enter: untilDone(
      root => descriptionOf(markOf(root))?.includes(REFUSAL) ?? false,
      root => saveVisits(root, '12'),
    ),
  },
  {
    title: { ru: 'Правка отменена', en: 'The edit is canceled' },
    hint: {
      ru: 'Пользователь снова открыл правку и отменил её. Отказ снят — подсказка отметки снова показывает ошибку в данных.',
      en: "The user started editing again and canceled it. The refusal is cleared, and the mark's tooltip shows the data error again.",
    },
    states: ['body.error'],
    enter: untilDone(
      root => !inputOf(root) && descriptionOf(markOf(root)) === DATA_ERROR,
      root => {
        const input = inputOf(root)
        if (input) press(input, 'Escape')
        else editButtonOf(root)?.click()
      },
    ),
  },
]

/** ADR 0150, S3: сервер отказал в сохранении ячейки с ошибкой данных. */
export const CellErrorsRefusal: StoryObj<StoryProps> = {
  name: 'Refusal and data error',
  parameters: { scenario: '0150/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ и ошибка данных', en: 'A refusal and a data error' }}
      steps={REFUSAL_STEPS}
      args={guideArgs(
        {
          enableCellErrors: true,
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: refuse,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(REFUSAL_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR))
      await settle()
    })
    await step(REFUSAL_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(descriptionOf(markOf(canvas))).toBe(REFUSAL))
      expect(Number(visitsText(canvas))).toBeGreaterThan(15)
      await settle()
    })
    await step(REFUSAL_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR))
      expect(inputOf(canvas)).toBeNull()
      await settle()
    })
  },
}

// --- ADR 0177: отметка отказа --------------------------------------------------------

/** Строка без ошибки данных: на ней видна только отметка отказа. */
const RETRY_ROW = getData(DATA_COUNT).find(row => row.visits <= 15)!
  .id as string
const RETRIED_VISITS = '12'

const cellIssueOf = (cell: HTMLElement | null) =>
  cell?.querySelector<HTMLElement>('button[data-cell-issue]') ?? null
const issuePopover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const popoverAction = (action: 'retry' | 'discard') =>
  issuePopover()?.querySelector<HTMLElement>(`[data-action="${action}"]`) ??
  null
const tooltipShows = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
/** Отказ стоит на ячейке: у её отметки — причина отказа. */
const refusedAt = (cell: HTMLElement | null) =>
  descriptionOf(cellIssueOf(cell))?.includes(REFUSAL) ?? false
/** Текст ячейки без её кнопок и отметки. */
const textOf = (cell: HTMLElement | null) => {
  const copy = cell?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue]')
    .forEach(button => button.remove())
  return copy?.textContent?.trim()
}

// --- ADR 0177 S1 ---------------------------------------------------------------------

const RETRY_SERVER = createHeldServer()
const retryCell = (root: ParentNode) => visitsCellOf(root, RETRY_ROW)
const retryInput = (root: ParentNode) =>
  retryCell(root)?.querySelector<HTMLInputElement>('input') ?? null
const openRetryEditor = (root: ParentNode) =>
  retryCell(root)?.querySelector<HTMLElement>('.cell__button button')?.click()

/** Сохранить в ячейке визитов строки `RETRY_ROW` число `value` — по такту на действие. */
const saveRetryVisits = (root: HTMLElement, value: string) => {
  const input = retryInput(root)
  if (!input) openRetryEditor(root)
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

/** Дойти до отказа: «сервер» отказывает, пользователь сохраняет новое число. */
const reachRetryRefusal = (root: HTMLElement) => {
  RETRY_SERVER.answer(false)
  saveRetryVisits(root, RETRIED_VISITS)
}

const RETRY_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка ячеек', en: 'Cell editing' },
    hint: {
      ru: 'Число визитов можно править: сохранённое значение уходит на сервер.',
      en: 'The visit count can be edited: a saved value goes to the server.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сохранил новое число визитов, но сервер его отклонил. В ячейке снова значение из данных, в её правом верхнем углу — отметка отказа.',
      en: 'The user saved a new visit count, but the server rejected it. The cell shows the value from the data again, with a refusal mark in its top-right corner.',
    },
    states: ['body.error'],
    enter: untilDone(
      root => refusedAt(retryCell(root)) && !retryInput(root),
      reachRetryRefusal,
    ),
  },
  {
    title: { ru: 'Причина отказа', en: 'The refusal reason' },
    hint: {
      ru: 'Пользователь навёл указатель на отметку. Подсказка показывает причину отказа.',
      en: 'The user hovered over the mark. The tooltip shows the refusal reason.',
    },
    states: ['body.error', 'overlay.tooltip'],
    enter: untilDone(
      () => tooltipShows(REFUSAL),
      root => {
        if (!refusedAt(retryCell(root))) reachRetryRefusal(root)
        else hoverOnce(cellIssueOf(retryCell(root)))
      },
    ),
  },
  {
    title: { ru: 'Повторная правка', en: 'Editing again' },
    hint: {
      ru: 'Пользователь снова открыл правку ячейки. В поле — отклонённое значение: его можно поправить или сохранить ещё раз.',
      en: 'The user started editing the cell again. The field holds the rejected value: it can be corrected or saved once more.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root =>
        refusedAt(retryCell(root)) &&
        retryInput(root)?.value === RETRIED_VISITS,
      root => {
        if (!refusedAt(retryCell(root))) reachRetryRefusal(root)
        else if (!retryInput(root)) openRetryEditor(root)
      },
    ),
  },
  {
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Пользователь сохранил значение ещё раз, и сервер его принял. В ячейке новое число, отметки отказа больше нет.',
      en: 'The user saved the value once more, and the server accepted it. The cell shows the new number, and the refusal mark is gone.',
    },
    enter: untilDone(
      root =>
        !retryInput(root) &&
        !cellIssueOf(retryCell(root)) &&
        textOf(retryCell(root)) === RETRIED_VISITS,
      root => {
        RETRY_SERVER.answer(true)
        saveRetryVisits(root, RETRIED_VISITS)
      },
    ),
  },
]

/** ADR 0177, S1: сервер отказал в сохранении ячейки, пользователь повторяет правкой. */
export const CellFailureRetry: StoryObj<StoryProps> = {
  name: 'Refused edit and retry',
  parameters: { scenario: '0177/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отказ сохранения и повтор',
        en: 'A save refusal and a retry',
      }}
      steps={RETRY_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: RETRY_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RETRY_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(cellIssueOf(retryCell(canvas))).toBeNull()
      await settle()
    })
    await step(RETRY_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedAt(retryCell(canvas))).toBe(true))
      expect(textOf(retryCell(canvas))).not.toBe(RETRIED_VISITS)
      const cell = retryCell(canvas)!.getBoundingClientRect()
      const mark = cellIssueOf(retryCell(canvas))!.getBoundingClientRect()
      expect(Math.abs(mark.right - cell.right)).toBeLessThanOrEqual(1)
      expect(Math.abs(mark.top - cell.top)).toBeLessThanOrEqual(1)
      await settle()
    })
    await step(RETRY_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(tooltipShows(REFUSAL)).toBe(true))
      await settle()
    })
    await step(RETRY_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(retryInput(canvas)?.value).toBe(RETRIED_VISITS))
      await settle()
    })
    await step(RETRY_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(textOf(retryCell(canvas))).toBe(RETRIED_VISITS))
      expect(cellIssueOf(retryCell(canvas))).toBeNull()
      await settle()
    })
  },
}

// --- ADR 0177 S2 ---------------------------------------------------------------------

interface Product {
  id: string
  name: string
  inStock: boolean
}

const PRODUCTS: Product[] = [
  'Desk lamp',
  'Office chair',
  'Notebook',
  'Water bottle',
  'Headphones',
  'Backpack',
].map((name, index) => ({
  id: `item-id-${index + 1}`,
  name,
  inStock: index % 2 === 0,
}))

const STOCK_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 220 },
  {
    id: 'inStock',
    accessorKey: 'inStock',
    header: 'In stock',
    dataType: 'boolean',
    size: 120,
  },
] as never

const STOCK_ROW = 'item-id-2'
const STOCK_SERVER = createHeldServer()
const stockCell = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${STOCK_ROW}"] .data-grid__body-cell[data-column-id="inStock"]`,
  )
const stockBox = (root: ParentNode) =>
  stockCell(root)?.querySelector<HTMLElement>('[role="checkbox"]') ?? null
const stockChecked = (root: ParentNode) =>
  stockBox(root)?.getAttribute('aria-checked') === 'true'
const STOCK_START = PRODUCTS.find(product => product.id === STOCK_ROW)!.inStock

/** Дойти до отказа флажка: «сервер» отказывает, пользователь нажимает флажок. */
const reachStockRefusal = (root: HTMLElement) => {
  STOCK_SERVER.answer(false)
  if (
    stockBox(root)?.getAttribute('aria-busy') !== 'true' &&
    !refusedAt(stockCell(root))
  )
    stockBox(root)?.click()
}

const DISCARD_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Флажки в ячейках', en: 'Checkboxes in cells' },
    hint: {
      ru: 'В колонке наличия — флажки. Нажатие на флажок сразу сохраняет новое значение на сервере.',
      en: 'The availability column has checkboxes. Clicking a checkbox immediately saves the new value on the server.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь отметил товар, но сервер отклонил значение. Флажок вернулся в прежнее положение, в правом верхнем углу ячейки — отметка отказа.',
      en: 'The user checked a product, but the server rejected the value. The checkbox went back to its previous state, and the cell has a refusal mark in the top-right corner.',
    },
    states: ['body.error'],
    enter: untilDone(root => refusedAt(stockCell(root)), reachStockRefusal),
  },
  {
    title: { ru: 'Отметка открыта', en: "The mark's popover is open" },
    hint: {
      ru: 'Пользователь нажал на отметку. Поповер показывает причину отказа и предлагает повторить сохранение или отбросить изменение; флажок от этого нажатия не переключился.',
      en: 'The user clicked the mark. A popover shows the refusal reason and offers to retry the save or discard the change; the checkbox did not toggle from this click.',
    },
    states: ['body.error', 'overlay.cellIssue'],
    enter: untilDone(
      () => !!issuePopover(),
      root => {
        if (!refusedAt(stockCell(root))) reachStockRefusal(root)
        else cellIssueOf(stockCell(root))?.click()
      },
    ),
  },
  {
    title: { ru: 'Изменение отброшено', en: 'The change is discarded' },
    hint: {
      ru: 'Пользователь отбросил изменение. Отметки отказа больше нет, флажок показывает значение из данных.',
      en: 'The user discarded the change. The refusal mark is gone, and the checkbox shows the value from the data.',
    },
    enter: untilDone(
      root =>
        !issuePopover() &&
        !cellIssueOf(stockCell(root)) &&
        stockChecked(root) === STOCK_START,
      root => {
        if (popoverAction('discard')) popoverAction('discard')!.click()
        else if (refusedAt(stockCell(root)))
          cellIssueOf(stockCell(root))?.click()
        else reachStockRefusal(root)
      },
    ),
  },
]

/** ADR 0177, S2: флажок в ячейке отказан, пользователь отбрасывает изменение. */
export const CellFailureDiscard: StoryObj<StoryProps> = {
  name: 'Refused checkbox, discard',
  parameters: { scenario: '0177/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ флажка', en: 'A checkbox refusal' }}
      steps={DISCARD_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          editableColumns: ['inStock'],
          columnsOverride: STOCK_COLUMNS,
          dataOverride: PRODUCTS,
          onCellEdit: STOCK_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DISCARD_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(stockChecked(canvas)).toBe(STOCK_START))
      await settle()
    })
    await step(DISCARD_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedAt(stockCell(canvas))).toBe(true))
      expect(stockChecked(canvas)).toBe(STOCK_START)
      await settle()
    })
    await step(DISCARD_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(issuePopover()).not.toBeNull())
      expect(issuePopover()!.textContent).toContain(REFUSAL)
      expect(popoverAction('retry')).not.toBeNull()
      expect(popoverAction('discard')).not.toBeNull()
      expect(stockChecked(canvas)).toBe(STOCK_START)
      await settle()
    })
    await step(DISCARD_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cellIssueOf(stockCell(canvas))).toBeNull())
      expect(issuePopover()).toBeNull()
      expect(stockChecked(canvas)).toBe(STOCK_START)
      await settle()
    })
  },
}

// --- ADR 0177 S9–S11: как снимается отметка отказа ---------------------------------

/** Две строки без числа `RETRIED_VISITS`: сохранение этого числа — изменение. */
const [CLEAR_A, CLEAR_B] = getData(DATA_COUNT)
  .filter(row => String(row.visits) !== RETRIED_VISITS)
  .map(row => row.id as string)
const visitsOf = (row: string) =>
  String(getData(DATA_COUNT).find(item => item.id === row)!.visits)

/** Сохранить в ячейке визитов строки `row` число `value` — по такту на действие. */
const saveVisitsAt = (root: HTMLElement, row: string, value: string) => {
  const input =
    visitsCellOf(root, row)?.querySelector<HTMLInputElement>('input') ?? null
  if (!input)
    visitsCellOf(root, row)
      ?.querySelector<HTMLElement>('.cell__button button')
      ?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}
const editingAt = (root: ParentNode, row: string) =>
  !!visitsCellOf(root, row)?.querySelector('input')

/** Дойти до отказов в строках `rows`: «сервер» отказывает, пользователь сохраняет по очереди. */
const reachRefusals = (
  server: ReturnType<typeof createHeldServer>,
  root: HTMLElement,
  rows: readonly string[],
) => {
  server.answer(false)
  const next = rows.find(row => !refusedAt(visitsCellOf(root, row)))
  if (next) saveVisitsAt(root, next, RETRIED_VISITS)
}
const refusedAll = (root: ParentNode, rows: readonly string[]) =>
  rows.every(row => refusedAt(visitsCellOf(root, row)) && !editingAt(root, row))

/** Контекстное меню ячейки — событием, как правая кнопка мыши. */
const contextMenuOn = (cell: HTMLElement | null) => {
  if (!cell) return
  const box = cell.getBoundingClientRect()
  cell.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: box.left + 10,
      clientY: box.top + 10,
    }),
  )
}
const menuItem = (action: string) =>
  document.querySelector<HTMLElement>(
    `[role="menuitem"][data-action-id="contextMenu:${action}"]`,
  )

// --- ADR 0177 S9 ---------------------------------------------------------------------

const MENU_SERVER = createHeldServer()
const reachMenuRefusal = (root: HTMLElement) =>
  reachRefusals(MENU_SERVER, root, [CLEAR_A!])

const DISCARD_MENU_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка ячеек', en: 'Cell editing' },
    hint: {
      ru: 'Число визитов можно править: сохранённое значение уходит на сервер. У ячеек есть контекстное меню.',
      en: 'The visit count can be edited: a saved value goes to the server. Cells have a context menu.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сохранил новое число визитов, но сервер его отклонил. В ячейке снова значение из данных, в её правом верхнем углу — отметка отказа.',
      en: 'The user saved a new visit count, but the server rejected it. The cell shows the value from the data again, with a refusal mark in its top-right corner.',
    },
    states: ['body.error'],
    enter: untilDone(root => refusedAll(root, [CLEAR_A!]), reachMenuRefusal),
  },
  {
    title: { ru: 'Меню ячейки', en: 'The cell menu' },
    hint: {
      ru: 'Пользователь открыл контекстное меню ячейки. В нём два действия с отказом: повторить сохранение и отбросить изменение.',
      en: "The user opened the cell's context menu. It has two actions for the refusal: retry the save and discard the change.",
    },
    states: ['body.error', 'overlay.contextMenu'],
    enter: untilDone(
      () => !!menuItem('discardChange'),
      root => {
        if (!refusedAll(root, [CLEAR_A!])) reachMenuRefusal(root)
        else contextMenuOn(visitsCellOf(root, CLEAR_A))
      },
    ),
  },
  {
    title: { ru: 'Изменение отброшено', en: 'The change is discarded' },
    hint: {
      ru: 'Пользователь отбросил изменение. Отметки больше нет; новая правка начнётся со значения из данных, а не с отклонённого.',
      en: 'The user discarded the change. The mark is gone; a new edit will start from the value in the data, not from the rejected one.',
    },
    enter: untilDone(
      root =>
        !menuItem('discardChange') &&
        !cellIssueOf(visitsCellOf(root, CLEAR_A)) &&
        textOf(visitsCellOf(root, CLEAR_A)) === visitsOf(CLEAR_A!),
      root => {
        if (menuItem('discardChange')) menuItem('discardChange')!.click()
        else if (refusedAll(root, [CLEAR_A!]))
          contextMenuOn(visitsCellOf(root, CLEAR_A))
        else reachMenuRefusal(root)
      },
    ),
  },
]

/** ADR 0177, S9: пользователь отбрасывает отклонённое изменение из контекстного меню. */
export const CellFailureDiscardMenu: StoryObj<StoryProps> = {
  name: 'Discard from the menu',
  parameters: { scenario: '0177/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отбросить из меню', en: 'Discarding from the menu' }}
      steps={DISCARD_MENU_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableContextMenu: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: MENU_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DISCARD_MENU_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(cellIssueOf(visitsCellOf(canvas, CLEAR_A))).toBeNull(),
      )
      await settle()
    })
    await step(DISCARD_MENU_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedAll(canvas, [CLEAR_A!])).toBe(true))
      await until(() =>
        expect(textOf(visitsCellOf(canvas, CLEAR_A))).toBe(visitsOf(CLEAR_A!)),
      )
      await settle()
    })
    await step(DISCARD_MENU_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(menuItem('discardChange')).not.toBeNull())
      await until(() => expect(menuItem('retrySave')).not.toBeNull())
      await settle()
    })
    await step(DISCARD_MENU_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellIssueOf(visitsCellOf(canvas, CLEAR_A))).toBeNull(),
      )
      await until(() => expect(menuItem('discardChange')).toBeNull())
      await until(() =>
        expect(textOf(visitsCellOf(canvas, CLEAR_A))).toBe(visitsOf(CLEAR_A!)),
      )
      await settle()
    })
  },
}

// --- ADR 0177 S10 --------------------------------------------------------------------

const EXTERNAL_SERVER = createHeldServer()
const BOTH = () => [CLEAR_A!, CLEAR_B!]
/** Число визитов первой строки, которое прислал «сервер»: другой пользователь его изменил. */
const EXTERNAL_VISITS = String(Number(visitsOf(CLEAR_A!)) + 1)
const changedRows = (withoutB = false) =>
  getData(DATA_COUNT)
    .filter(row => !withoutB || row.id !== CLEAR_B)
    .map(row =>
      row.id === CLEAR_A ? { ...row, visits: Number(EXTERNAL_VISITS) } : row,
    )
const rowOf = (root: ParentNode, row: string) =>
  root.querySelector(`.data-grid__body-row[data-row-id="${row}"]`)
const failureCount = () =>
  document.querySelector(
    '[data-testid="failure-log-button"] [data-active-indicator]',
  )?.textContent ?? ''
const reachExternalRefusals = (root: HTMLElement) =>
  reachRefusals(EXTERNAL_SERVER, root, BOTH())

const EXTERNAL_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка ячеек', en: 'Cell editing' },
    hint: {
      ru: 'Число визитов можно править: сохранённое значение уходит на сервер.',
      en: 'The visit count can be edited: a saved value goes to the server.',
    },
  },
  {
    title: { ru: 'Сервер отказал дважды', en: 'The server refused twice' },
    hint: {
      ru: 'Пользователь сохранил новые числа в двух строках, сервер отклонил оба. У обеих ячеек — отметки отказа.',
      en: 'The user saved new numbers in two rows, and the server rejected both. Both cells have refusal marks.',
    },
    states: ['body.error'],
    enter: untilDone(root => refusedAll(root, BOTH()), reachExternalRefusals),
  },
  {
    title: { ru: 'Пришли новые данные', en: 'New data arrived' },
    hint: {
      ru: 'Другой пользователь изменил число визитов в первой строке, и таблица получила новые данные. Отклонённое значение устарело: отметка ушла сама, в ячейке — новое число.',
      en: 'Another user changed the visit count in the first row, and the table received new data. The rejected value is outdated: the mark went away on its own, and the cell shows the new number.',
    },
    states: ['body.error'],
    enter: (root, app) => {
      const changed = { done: false }
      return untilDone(
        () =>
          changed.done &&
          !cellIssueOf(visitsCellOf(root, CLEAR_A)) &&
          textOf(visitsCellOf(root, CLEAR_A)) === EXTERNAL_VISITS,
        () => {
          if (changed.done) return
          if (!refusedAll(root, BOTH())) return reachExternalRefusals(root)
          changed.done = true
          app.update(props => ({ ...props, dataOverride: changedRows() }))
        },
      )(root, app)
    },
  },
  {
    title: { ru: 'Строка удалена', en: 'The row was deleted' },
    hint: {
      ru: 'Вторую строку удалили на сервере, и она ушла из таблицы. Вместе с ней ушёл и её отказ: в журнале отказов он не остаётся.',
      en: 'The second row was deleted on the server and disappeared from the table. Its refusal went with it and does not stay in the failure log.',
    },
    enter: (root, app) => {
      const removed = { done: false }
      return untilDone(
        () => removed.done && !rowOf(root, CLEAR_B!) && failureCount() === '',
        () => {
          if (removed.done) return
          if (!refusedAt(visitsCellOf(root, CLEAR_B)))
            return reachExternalRefusals(root)
          if (editingAt(root, CLEAR_A!) || editingAt(root, CLEAR_B!)) return
          removed.done = true
          app.update(props => ({ ...props, dataOverride: changedRows(true) }))
        },
      )(root, app)
    },
  },
]

/** ADR 0177, S10: значение сменилось извне, строку удалили — отметки отказа уходят сами. */
export const CellFailureExternalChange: StoryObj<StoryProps> = {
  name: 'Value changed elsewhere',
  parameters: { scenario: '0177/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Изменение извне', en: 'A change from outside' }}
      steps={EXTERNAL_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableFailureLog: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: EXTERNAL_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EXTERNAL_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(failureCount()).toBe('')
      await settle()
    })
    await step(EXTERNAL_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedAll(canvas, BOTH())).toBe(true))
      expect(failureCount()).toBe('2')
      await settle()
    })
    await step(EXTERNAL_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(textOf(visitsCellOf(canvas, CLEAR_A))).toBe(EXTERNAL_VISITS),
      )
      expect(cellIssueOf(visitsCellOf(canvas, CLEAR_A))).toBeNull()
      expect(refusedAt(visitsCellOf(canvas, CLEAR_B))).toBe(true)
      expect(failureCount()).toBe('1')
      await settle()
    })
    await step(EXTERNAL_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowOf(canvas, CLEAR_B!)).toBeNull())
      await until(() => expect(failureCount()).toBe(''))
      await settle()
    })
  },
}

// --- ADR 0177 S11 --------------------------------------------------------------------

interface FailureTable {
  getFailures: () => Failure[]
  resolveFailure: (key: string) => void
}

const RESET_SERVER = createHeldServer()
let resetTable: FailureTable | undefined
const RESET_SEED = [
  seed<FailureTable>('cellFailureResetTable', table => {
    resetTable = table
  }),
]
/** Сброс в коде приложения: как «Закрыть» журнала — отбросить значение и снять запись. */
const resetFailures = (table: FailureTable) => {
  for (const failure of table.getFailures()) {
    failure.discard?.()
    table.resolveFailure(failure.key)
  }
}
const reachResetRefusals = (root: HTMLElement) =>
  reachRefusals(RESET_SERVER, root, BOTH())

const RESET_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка ячеек', en: 'Cell editing' },
    hint: {
      ru: 'Число визитов можно править: сохранённое значение уходит на сервер.',
      en: 'The visit count can be edited: a saved value goes to the server.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сохранил новые числа в двух строках, сервер отклонил оба. У обеих ячеек — отметки отказа.',
      en: 'The user saved new numbers in two rows, and the server rejected both. Both cells have refusal marks.',
    },
    states: ['body.error'],
    enter: untilDone(root => refusedAll(root, BOTH()), reachResetRefusals),
  },
  {
    title: {
      ru: 'Приложение сбросило отказы',
      en: 'The app cleared the refusals',
    },
    hint: {
      ru: 'Приложение сняло отказы из своего кода, например по своей кнопке сброса. Отметки ушли, в ячейках — значения из данных.',
      en: 'The app cleared the refusals from its own code, for example with its own reset button. The marks are gone, and the cells show the values from the data.',
    },
    enter: root => {
      const reset = { done: false }
      return untilDone(
        () =>
          reset.done &&
          BOTH().every(row => !cellIssueOf(visitsCellOf(root, row))),
        () => {
          if (reset.done) return
          if (!refusedAll(root, BOTH())) return reachResetRefusals(root)
          if (!resetTable) return
          reset.done = true
          resetFailures(resetTable)
        },
      )(root, undefined)
    },
  },
]

/** ADR 0177, S11: приложение снимает отказы ячеек из своего кода. */
export const CellFailureAppReset: StoryObj<StoryProps> = {
  name: 'Reset by the application',
  parameters: { scenario: '0177/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сброс приложением', en: 'A reset by the app' }}
      steps={RESET_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: RESET_SERVER.save,
          extraPlugins: RESET_SEED,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RESET_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await settle()
    })
    await step(RESET_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedAll(canvas, BOTH())).toBe(true))
      await settle()
    })
    await step(RESET_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          BOTH().every(row => !cellIssueOf(visitsCellOf(canvas, row))),
        ).toBe(true),
      )
      for (const row of BOTH())
        await until(() =>
          expect(textOf(visitsCellOf(canvas, row))).toBe(visitsOf(row)),
        )
      await until(() => expect(resetTable!.getFailures()).toEqual([]))
      await settle()
    })
  },
}
