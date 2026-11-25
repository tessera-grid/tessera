import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { press, typeInto } from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import type { ServerRowsRequest } from '../plugins'
import type { ConsoleLog } from './demos/consoleLog'

/**
 * Итоги колонок в футере (ADR 0184): `Playground` — вид в покое, сценарии S1–S4 проигрываются
 * панелью над гридом. Итог есть у колонки с явным `aggregationFn`; свой `footer` главнее.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Column totals',
} satisfies Meta<StoryProps>

export default meta

interface Sale {
  id: string
  name: string
  city: string
  orders: number
  amount: number
  subRows?: Sale[]
}

const SALES: Sale[] = [
  { id: 's1', name: 'Anna', city: 'Paris', orders: 4, amount: 100 },
  { id: 's2', name: 'Boris', city: 'Rome', orders: 7, amount: 200 },
  { id: 's3', name: 'Clara', city: 'Paris', orders: 2, amount: 300 },
  { id: 's4', name: 'Denis', city: 'Rome', orders: 5, amount: 400 },
  { id: 's5', name: 'Elena', city: 'Paris', orders: 9, amount: 500 },
  { id: 's6', name: 'Fedor', city: 'Rome', orders: 1, amount: 600 },
]

/** Отделы — свод: значения отдела сложены из значений его сотрудников. */
const ROLLUP_DEPARTMENTS: Sale[] = [
  {
    id: 'd1',
    name: 'North',
    city: 'Paris',
    orders: 13,
    amount: 300,
    subRows: [
      { id: 'd1-1', name: 'Anna', city: 'Paris', orders: 4, amount: 100 },
      { id: 'd1-2', name: 'Boris', city: 'Paris', orders: 9, amount: 200 },
    ],
  },
  {
    id: 'd2',
    name: 'South',
    city: 'Rome',
    orders: 3,
    amount: 700,
    subRows: [
      { id: 'd2-1', name: 'Clara', city: 'Rome', orders: 3, amount: 700 },
    ],
  },
]

/** Отделы со своими продажами: у отдела свои значения, у сотрудников — свои. */
const OWN_DEPARTMENTS: Sale[] = [
  {
    id: 'd1',
    name: 'North',
    city: 'Paris',
    orders: 20,
    amount: 1000,
    subRows: [
      { id: 'd1-1', name: 'Anna', city: 'Paris', orders: 4, amount: 100 },
      { id: 'd1-2', name: 'Boris', city: 'Paris', orders: 9, amount: 200 },
    ],
  },
  {
    id: 'd2',
    name: 'South',
    city: 'Rome',
    orders: 10,
    amount: 2000,
    subRows: [
      { id: 'd2-1', name: 'Clara', city: 'Rome', orders: 3, amount: 700 },
    ],
  },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
  {
    id: 'orders',
    accessorKey: 'orders',
    header: 'Orders',
    dataType: 'number',
    aggregationFn: 'sum',
    size: 160,
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'number',
    aggregationFn: 'sum',
    size: 160,
  },
]

const AREA = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
} as const

const TOTALS_ARGS = {
  ...AREA,
  columnsOverride: COLUMNS as never,
  dataOverride: SALES,
  enableColumnTotals: true,
  enableFooter: true,
  // Итог вспыхивает при смене значений: рост и падение — стрелкой (ADR 0221, §9).
  enableValueChangeFlash: true,
  valueChangeFlashColumnDefault: 'direction',
} satisfies Partial<StoryProps>

/** Вспышка итога колонки в футере или `null`. */
const footerFlash = (canvas: HTMLElement, column: string) =>
  canvas
    .querySelector(`.data-grid__footer-cell[data-column-id="${column}"]`)
    ?.getAttribute('data-flash') ?? null

const footerText = (canvas: HTMLElement, column: string) =>
  canvas
    .querySelector(`.data-grid__footer-cell[data-column-id="${column}"]`)
    ?.textContent?.trim()

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (text: string) => (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="quick-search"]',
  )
  if (!input) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Итоги в покое: футер колонок с явным агрегатом, поиск, страницы и положение футера. */
export const ColumnTotalsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...showControls(
      [
        'enableColumnTotals',
        'enableFooter',
        'enableValueChangeFlash',
        'valueChangeFlashColumnDefault',
        'footerPosition',
        'enablePagination',
        'paginationInitialPageSize',
        'enableQuickSearch',
      ],
      {
        dataCount: "Rows come from the story's own data",
        columnCount: "Columns come from the story's own column set",
        headerHeight: 'The footer sits below the header at any header height',
        defaultColumn:
          'The footer follows column widths and has no behavior of its own',
      },
    ),
  },
  args: TOTALS_ARGS,
  render: args => <StoryComponent {...normalizeArgs(args)} />,
}

// --- S1 ------------------------------------------------------------------------------

const SEARCH: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итоги всех строк', en: 'Totals of all rows' },
    hint: {
      ru: 'Внизу таблицы — итоги по всем строкам.',
      en: 'The bottom of the table shows totals across all rows.',
    },
  },
  {
    title: { ru: 'Итоги найденных строк', en: 'Totals of found rows' },
    hint: {
      ru: 'Итоги пересчитаны по найденным строкам.',
      en: 'The totals are recalculated over the found rows.',
    },
    enter: typeSearch('Paris'),
  },
]

/** S1: итог следует за поиском. */
export const ColumnTotalsSearch: StoryObj<StoryProps> = {
  name: 'Search changes the total',
  parameters: { scenario: '0184/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Подсчёт итого после поиска',
        en: 'Totals recalculated after a search',
      }}
      steps={SEARCH}
      args={guideArgs({ ...TOTALS_ARGS, enableQuickSearch: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SEARCH[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('2100'))
      await expect(footerText(canvas, 'orders')).toBe('28')
      // Поле поиска приходит с ленивым модулем тулбара: шаг ввода ждёт его.
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="quick-search"]'),
        ).not.toBeNull(),
      )
      await expect(footerText(canvas, 'name')).toBe('')
    })
    await step(SEARCH[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(footerText(canvas, 'amount')).toBe('900'))
      await expect(footerText(canvas, 'orders')).toBe('15')
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const OWN_FOOTER_COLUMNS = COLUMNS.map(column =>
  column.id === 'amount'
    ? {
        ...column,
        footer: ({
          table,
        }: {
          table: { getColumnTotal: (id: string) => unknown }
        }) => `Total: $${String(table.getColumnTotal('amount'))}`,
      }
    : column,
)

const OWN_FOOTER: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итог по типу колонки', en: 'A total by column type' },
    hint: {
      ru: 'Итог показан так же, как значения колонки.',
      en: 'The total looks the same as the column values.',
    },
  },
  {
    title: { ru: 'Своё оформление итога', en: 'Custom total formatting' },
    hint: {
      ru: 'Приложение оформило итог по-своему.',
      en: 'The app formats the total its own way.',
    },
    props: () => ({ columnsOverride: OWN_FOOTER_COLUMNS as never }),
  },
]

/** S2: разработчик оформляет итог своим содержимым футера. */
export const ColumnTotalsOwnFooter: StoryObj<StoryProps> = {
  name: 'Own footer',
  parameters: { scenario: '0184/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Своё оформление итога', en: 'Custom total formatting' }}
      steps={OWN_FOOTER}
      args={guideArgs(TOTALS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_FOOTER[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('2100'))
    })
    await step(OWN_FOOTER[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(footerText(canvas, 'amount')).toBe('Total: $2100'),
      )
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

/** Колонки с итогом по всем строкам дерева (ADR 0229). */
const ALL_NODES_COLUMNS = COLUMNS.map(column =>
  column.aggregationFn ? { ...column, aggregationScope: 'all' } : column,
)

const TREE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Родитель — свод детей', en: 'A parent sums up its children' },
    hint: {
      ru: 'Значение отдела — сумма его сотрудников, поэтому итог складывает только отделы.',
      en: "A department's value is the sum of its employees, so the total adds up only the departments.",
    },
  },
  {
    title: {
      ru: 'У каждой строки свои значения',
      en: 'Every row has its own values',
    },
    hint: {
      ru: 'У отделов и сотрудников свои продажи — итог складывает все строки.',
      en: 'Departments and employees have their own sales, so the total adds up every row.',
    },
    props: () => ({
      columnsOverride: ALL_NODES_COLUMNS as never,
      dataOverride: OWN_DEPARTMENTS,
    }),
  },
]

/** S3: итог в дереве зависит от смысла значений родителя — свод детей или своя запись. */
export const ColumnTotalsTree: StoryObj<StoryProps> = {
  name: 'Tree',
  parameters: { scenario: '0184/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Итог в дереве', en: 'Totals in a tree' }}
      steps={TREE}
      args={guideArgs(
        {
          ...TOTALS_ARGS,
          dataOverride: ROLLUP_DEPARTMENTS,
          enableRowExpanding: true,
          enableTreeLines: true,
          initialExpanded: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0].title.ru, async () => {
      // 300 + 700 и 13 + 3: только отделы.
      await until(() => expect(footerText(canvas, 'amount')).toBe('1000'))
      await expect(footerText(canvas, 'orders')).toBe('16')
    })
    await step(TREE[1].title.ru, async () => {
      await guideNext(canvas)
      // 1000 + 100 + 200 + 2000 + 700 и 20 + 4 + 9 + 10 + 3: отделы и сотрудники.
      await until(() => expect(footerText(canvas, 'amount')).toBe('4000'))
      await expect(footerText(canvas, 'orders')).toBe('46')
    })
    await settle()
  },
}

// --- S4 ------------------------------------------------------------------------------

/** Итог, который сервер считает по всем строкам. */
const SERVER_AMOUNT = 48_000

const SERVER_FOOTER_COLUMNS = COLUMNS.map(column =>
  column.id === 'amount'
    ? { ...column, footer: () => `Total: ${SERVER_AMOUNT}` }
    : column,
)

const SERVER_PAGE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итога нет', en: 'No total' },
    hint: {
      ru: 'На странице только часть строк, поэтому итога нет.',
      en: 'The page holds only some of the rows, so there is no total.',
    },
  },
  {
    title: { ru: 'Итог от сервера', en: 'A total from the server' },
    hint: {
      ru: 'Итог прислал сервер.',
      en: 'The total comes from the server.',
    },
    props: () => ({ columnsOverride: SERVER_FOOTER_COLUMNS as never }),
  },
]

/** S4: при странице с сервера таблица не считает итог сама. */
export const ColumnTotalsServerPage: StoryObj<StoryProps> = {
  name: 'Server page',
  parameters: { scenario: '0184/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Итог при странице с сервера',
        en: 'Totals with a page from the server',
      }}
      steps={SERVER_PAGE}
      args={guideArgs(
        {
          ...TOTALS_ARGS,
          enablePagination: true,
          paginationInitialPageSize: 6,
          dataMode: { pagination: 'server' },
          rowCount: 120,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVER_PAGE[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe(''))
    })
    await step(SERVER_PAGE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(footerText(canvas, 'amount')).toBe(`Total: ${SERVER_AMOUNT}`),
      )
    })
    await settle()
  },
}

// --- S8–S9: правка ---------------------------------------------------------------------

const EDIT_ROW = 's1'
const NEW_AMOUNT = '1100'

const amountCellOf = (root: ParentNode, row: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="amount"]`,
  )
const amountInputOf = (root: ParentNode, row: string) =>
  amountCellOf(root, row)?.querySelector<HTMLInputElement>('input') ?? null
/** Значение в ячейке — без кнопки правки и отметки черновика. */
const amountTextOf = (root: ParentNode, row: string) => {
  const copy = amountCellOf(root, row)?.cloneNode(true) as
    HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim()
}
const draftMarked = (root: ParentNode, row: string) =>
  !!amountCellOf(root, row)?.querySelector('[data-cell-draft]')

/** Открыть правку кнопкой ячейки, набрать значение и сохранить клавишей Enter. */
const saveAmount = (root: HTMLElement, row: string, value: string) => {
  const input = amountInputOf(root, row)
  if (!input) {
    amountCellOf(root, row)
      ?.querySelector<HTMLElement>('.cell__button button')
      ?.click()
  } else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

const EDITING: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итоги всех строк', en: 'Totals of all rows' },
    hint: {
      ru: 'Внизу таблицы — итоги по всем строкам.',
      en: 'The bottom of the table shows totals across all rows.',
    },
  },
  {
    title: { ru: 'Значение изменено', en: 'A value is changed' },
    hint: {
      ru: 'Пользователь изменил сумму в строке — итог пересчитан и вспыхнул ростом.',
      en: 'The user changed an amount in a row — the total was recalculated and flashed a rise.',
    },
    enter: untilDone(
      root =>
        !amountInputOf(root, EDIT_ROW) &&
        amountTextOf(root, EDIT_ROW) === NEW_AMOUNT,
      root => saveAmount(root, EDIT_ROW, NEW_AMOUNT),
    ),
  },
]

const EDITING_ARGS = {
  ...TOTALS_ARGS,
  enableCellEditing: true,
  editableColumns: ['amount'],
} satisfies Partial<StoryProps>

/** S8: правка значения пересчитывает итог. */
export const ColumnTotalsEditing: StoryObj<StoryProps> = {
  name: 'Edit a value',
  parameters: { scenario: '0184/S8', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Итог после правки', en: 'Totals after an edit' }}
      steps={EDITING}
      args={guideArgs(EDITING_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDITING[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('2100'))
    })
    await step(EDITING[1].title.ru, async () => {
      await guideNext(canvas)
      // 2100 − 100 + 1100.
      await until(() => expect(footerText(canvas, 'amount')).toBe('3100'))
      await until(() => expect(footerFlash(canvas, 'amount')).toBe('up'))
    })
    await settle()
  },
}

/** Пульт открыт — «Применить всё»; закрыт — открыть. */
const applyAll = (root: HTMLElement) => {
  if (!document.querySelector('[data-testid="unsaved-changes"]')) {
    root
      .querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
      ?.click()
  } else {
    document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
  }
}

const DRAFTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итоги всех строк', en: 'Totals of all rows' },
    hint: {
      ru: 'Внизу таблицы — итоги по всем строкам.',
      en: 'The bottom of the table shows totals across all rows.',
    },
  },
  {
    title: { ru: 'Правка не применена', en: 'The edit is not applied' },
    hint: {
      ru: 'Значение изменено, но правка ещё не применена — итог прежний.',
      en: 'The value is changed, but the edit is not applied yet, so the total is the same.',
    },
    enter: untilDone(
      root =>
        draftMarked(root, EDIT_ROW) &&
        amountTextOf(root, EDIT_ROW) === NEW_AMOUNT,
      root => saveAmount(root, EDIT_ROW, NEW_AMOUNT),
    ),
  },
  {
    title: { ru: 'Правка применена', en: 'The edit is applied' },
    hint: {
      ru: 'Правку применили — итог пересчитан и вспыхнул ростом.',
      en: 'The edit was applied — the total was recalculated and flashed a rise.',
    },
    enter: untilDone(
      root => footerText(root, 'amount') === '3100',
      root => {
        if (!draftMarked(root, EDIT_ROW)) saveAmount(root, EDIT_ROW, NEW_AMOUNT)
        else applyAll(root)
      },
    ),
  },
]

const DRAFTS_ARGS = {
  ...EDITING_ARGS,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
  enableToolbar: true,
} satisfies Partial<StoryProps>

/** S9: несохранённая правка итог не меняет, пока её не применят. */
export const ColumnTotalsDrafts: StoryObj<StoryProps> = {
  name: 'Edit before applying',
  parameters: { scenario: '0184/S9', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Итог и неприменённая правка',
        en: 'Totals and an unapplied edit',
      }}
      steps={DRAFTS}
      args={guideArgs(DRAFTS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DRAFTS[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('2100'))
    })
    await step(DRAFTS[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(draftMarked(canvas, EDIT_ROW)).toBe(true))
      await expect(amountTextOf(canvas, EDIT_ROW)).toBe(NEW_AMOUNT)
      await expect(footerText(canvas, 'amount')).toBe('2100')
      await expect(footerFlash(canvas, 'amount')).toBeNull()
    })
    await step(DRAFTS[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(footerText(canvas, 'amount')).toBe('3100'))
      await until(() => expect(footerFlash(canvas, 'amount')).toBe('up'))
      await expect(draftMarked(canvas, EDIT_ROW)).toBe(false)
    })
    await settle()
  },
}

// --- ADR 0229: итог дерева по всем узлам --------------------------------------------

/** Ячейка колонки `column` строки `id` в теле. */
const cellText = (canvas: HTMLElement, id: string, column: string) =>
  canvas
    .querySelector(
      `.data-grid__body-row[data-row-id="${id}"] [data-column-id="${column}"]`,
    )
    ?.textContent?.trim()

const ALL_NODES_ARGS = {
  ...TOTALS_ARGS,
  columnsOverride: ALL_NODES_COLUMNS as never,
  dataOverride: OWN_DEPARTMENTS,
  enableRowExpanding: true,
  enableTreeLines: true,
  initialExpanded: true,
} satisfies Partial<StoryProps>

// S1 — поиск

const ALL_NODES_SEARCH: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итог всех строк дерева', en: 'Total of every tree row' },
    hint: {
      ru: 'Итог складывает все строки дерева.',
      en: 'The total adds up every row of the tree.',
    },
  },
  {
    title: { ru: 'Поиск оставил отдел', en: 'The search kept the department' },
    hint: {
      ru: 'Отдел найденного сотрудника остался в таблице и вошёл в итог.',
      en: "The found employee's department stayed in the table and counts toward the total.",
    },
    enter: typeSearch('Anna'),
  },
]

/** ADR 0229, S1: итог по всем узлам учитывает и предков найденных строк. */
export const ColumnTotalsAllNodesSearch: StoryObj<StoryProps> = {
  name: 'All tree rows — search',
  parameters: { scenario: '0229/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Итог всех строк и поиск',
        en: 'Total of all rows and search',
      }}
      steps={ALL_NODES_SEARCH}
      args={guideArgs({ ...ALL_NODES_ARGS, enableQuickSearch: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ALL_NODES_SEARCH[0].title.ru, async () => {
      // 1000 + 100 + 200 + 2000 + 700.
      await until(() => expect(footerText(canvas, 'amount')).toBe('4000'))
      await expect(footerText(canvas, 'orders')).toBe('46')
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="quick-search"]'),
        ).not.toBeNull(),
      )
    })
    await step(ALL_NODES_SEARCH[1].title.ru, async () => {
      await guideNext(canvas)
      // North 1000 и Anna 100.
      await until(() => expect(footerText(canvas, 'amount')).toBe('1100'))
      await expect(footerText(canvas, 'orders')).toBe('24')
    })
    await settle()
  },
}

// S2 — группировка

const ALL_NODES_GROUPS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Группы по городу', en: 'Groups by city' },
    hint: {
      ru: 'Значения групп и итог складывают только отделы.',
      en: 'Group values and the total add up only the departments.',
    },
  },
  {
    title: { ru: 'Группы со всеми строками', en: 'Groups with every row' },
    hint: {
      ru: 'Приложение включило подсчёт всех строк — значения групп и итог складывают отделы вместе с сотрудниками, итог вырос и вспыхнул.',
      en: 'The app turned on counting every row: group values and the total add up departments together with employees, and the total rose and flashed.',
    },
    // Режим меняет приложение посреди шага: прежний итог вспыхивает новым (ADR 0221, VC24).
    enter: (_root, app) =>
      app.update(props => ({
        ...props,
        columnsOverride: ALL_NODES_COLUMNS as never,
      })),
    // Вспышка итога коротка: матрица контраста проверяет её сразу после шага.
    immediate: true,
  },
]

/** ADR 0229, S2: значения групп и итог складывают строки со всеми потомками. */
export const ColumnTotalsAllNodesGroups: StoryObj<StoryProps> = {
  name: 'All tree rows — grouping',
  parameters: { scenario: '0229/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Итог всех строк в группах',
        en: 'Total of all rows in groups',
      }}
      steps={ALL_NODES_GROUPS}
      args={guideArgs(
        {
          ...ALL_NODES_ARGS,
          columnsOverride: COLUMNS as never,
          enableRowGrouping: true,
          rowGroupingInitialGrouping: ['city'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const paris = () => cellText(canvas, 'city:Paris', 'amount')
    await step(ALL_NODES_GROUPS[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('3000'))
      await until(() => expect(paris()).toBe('1000'))
    })
    await step(ALL_NODES_GROUPS[1].title.ru, async () => {
      await guideNext(canvas)
      // Paris: North 1000, Anna 100, Boris 200; Rome: South 2000, Clara 700.
      await until(() => expect(footerText(canvas, 'amount')).toBe('4000'))
      await until(() => expect(footerFlash(canvas, 'amount')).toBe('up'))
      await expect(paris()).toBe('1300')
      await expect(cellText(canvas, 'city:Rome', 'amount')).toBe('2700')
    })
    await settle()
  },
}

// S3 — ленивое дерево

/** Отделы без сотрудников: строки сотрудников загружаются при раскрытии отдела. */
const LAZY_DEPARTMENTS = OWN_DEPARTMENTS.map(({ subRows: _, ...row }) => row)
const employeesOf = (row: { original: { id: string } }) =>
  OWN_DEPARTMENTS.find(item => item.id === row.original.id)?.subRows ?? []

/** Итоги, которые знает «сервер»: по всем строкам дерева. */
const SERVER_TREE_TOTALS = { amount: 4000, orders: 46 }

/** Пользователь раскрывает все отделы кнопкой в шапке. */
const expandDepartments = (root: HTMLElement) => {
  const rows = root.querySelectorAll('.data-grid__body-row[aria-expanded]')
  if ([...rows].some(row => row.getAttribute('aria-expanded') === 'true'))
    return
  root.querySelector<HTMLElement>('.row-expand-all-button')?.click()
}

const LAZY_TREE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итога нет', en: 'No total' },
    hint: {
      ru: 'Сотрудники ещё не загружены, поэтому итога нет.',
      en: 'The employees are not loaded yet, so there is no total.',
    },
  },
  {
    title: { ru: 'Итог от сервера', en: 'A total from the server' },
    hint: {
      ru: 'Приложение получило итог от сервера и передало его таблице — сотрудники в таблицу не загружались.',
      en: 'The app got the total from the server and passed it to the table; no employees were loaded into the table.',
    },
    props: () => ({ columnTotalsTotals: SERVER_TREE_TOTALS }),
  },
  {
    title: { ru: 'Сотрудники загружены', en: 'Employees loaded' },
    hint: {
      ru: 'Пользователь раскрыл все отделы, строки сотрудников загрузились — итог тот же.',
      en: 'The user expanded all departments and the employee rows have loaded; the total is the same.',
    },
    enter: expandDepartments,
  },
]

/** ADR 0229, S3: ленивое дерево не считает итог всех строк, его подаёт приложение. */
export const ColumnTotalsLazyTree: StoryObj<StoryProps> = {
  name: 'All tree rows — lazy children',
  parameters: { scenario: '0229/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Итог ленивого дерева', en: 'Totals of a lazy tree' }}
      steps={LAZY_TREE}
      args={guideArgs(
        {
          ...ALL_NODES_ARGS,
          dataOverride: LAZY_DEPARTMENTS,
          initialExpanded: undefined,
          // Дети могут быть только у отделов: у сотрудников их нет.
          rowExpandingHasChildren: (row: { depth: number }) => row.depth === 0,
          rowExpandingLoadChildren: employeesOf as never,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LAZY_TREE[0].title.ru, async () => {
      await until(() => expect(cellText(canvas, 'd2', 'amount')).toBe('2000'))
      await expect(footerText(canvas, 'amount')).toBe('')
    })
    await step(LAZY_TREE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(footerText(canvas, 'amount')).toBe('4000'))
      await expect(footerText(canvas, 'orders')).toBe('46')
      await expect(cellText(canvas, 'd1-1', 'amount')).toBeUndefined()
    })
    await step(LAZY_TREE[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cellText(canvas, 'd1-1', 'amount')).toBe('100'))
      await until(() => expect(cellText(canvas, 'd2-1', 'amount')).toBe('700'))
      await expect(footerText(canvas, 'amount')).toBe('4000')
    })
    await settle()
  },
}

// S4 — серверная модель

/**
 * «Сервер»: строки отделов и их сотрудников, итог — по режиму колонки из запроса. Запрос
 * и ответ — в консоли истории.
 */
const serverTreeRowsOf = (log: ConsoleLog) => (request: ServerRowsRequest) => {
  const rows = request.parentId
    ? (OWN_DEPARTMENTS.find(item => item.id === request.parentId)?.subRows ??
      [])
    : LAZY_DEPARTMENTS
  const all = request.aggregationScopes.amount === 'all'
  const totals = all ? SERVER_TREE_TOTALS : { amount: 3000, orders: 30 }
  log.log(
    { ru: 'Запрос к серверу', en: 'Server request' },
    request.parentId
      ? `parentId="${request.parentId}"`
      : `aggregationScopes=${JSON.stringify(request.aggregationScopes)}`,
  )
  log.log(
    { ru: 'Ответ сервера', en: 'Server response' },
    request.parentId
      ? `rows=${rows.length}`
      : `totals=${JSON.stringify(totals)}`,
  )
  return Promise.resolve({
    rows: rows.slice(request.start, request.end),
    rowCount: rows.length,
    totals,
  })
}

const SERVER_TREE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Итог верхнего уровня', en: 'Top-level total' },
    hint: {
      ru: 'Сервер прислал итог по отделам.',
      en: 'The server sent a total over the departments.',
    },
    props: ({ log }) => ({
      serverRowModelGetRows: serverTreeRowsOf(log) as never,
    }),
  },
  {
    title: {
      ru: 'Итог всех строк с сервера',
      en: 'Total of all rows from the server',
    },
    hint: {
      ru: 'Приложение включило подсчёт всех строк — таблица заново запросила итог у сервера, он вырос и вспыхнул. Сотрудники в таблицу не загружались.',
      en: 'The app turned on counting every row: the table requested the total from the server again, and it rose and flashed. No employees were loaded into the table.',
    },
    // Режим меняет приложение посреди шага: итог прежний, и новый вспыхивает ростом (VC24).
    enter: (_root, app) =>
      app.update(props => ({
        ...props,
        columnsOverride: ALL_NODES_COLUMNS as never,
      })),
    // Вспышка итога коротка: матрица контраста проверяет её сразу после шага.
    immediate: true,
  },
  {
    title: { ru: 'Сотрудники загружены', en: 'Employees loaded' },
    hint: {
      ru: 'Пользователь раскрыл все отделы, строки сотрудников пришли с сервера — итог тот же.',
      en: 'The user expanded all departments and the employee rows came from the server; the total is the same.',
    },
    props: () => ({ columnsOverride: ALL_NODES_COLUMNS as never }),
    enter: expandDepartments,
  },
]

/** ADR 0229, S4: сервер получает режим колонки и присылает итог по всем строкам. */
export const ColumnTotalsServerTree: StoryObj<StoryProps> = {
  name: 'All tree rows — server row model',
  parameters: { scenario: '0229/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Итог всех строк на сервере',
        en: 'Total of all rows on the server',
      }}
      steps={SERVER_TREE}
      args={guideArgs(
        {
          ...TOTALS_ARGS,
          dataOverride: [],
          enableServerRowModel: true,
          enableRowExpanding: true,
          enableTreeLines: true,
          rowExpandingHasChildren: (row: { depth: number }) => row.depth === 0,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVER_TREE[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('3000'))
    })
    await step(SERVER_TREE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(footerText(canvas, 'amount')).toBe('4000'))
      await until(() => expect(footerFlash(canvas, 'amount')).toBe('up'))
      await expect(footerText(canvas, 'orders')).toBe('46')
      await expect(cellText(canvas, 'd1-1', 'amount')).toBeUndefined()
    })
    await step(SERVER_TREE[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cellText(canvas, 'd1-1', 'amount')).toBe('100'))
      await until(() => expect(cellText(canvas, 'd2-1', 'amount')).toBe('700'))
      await expect(footerText(canvas, 'amount')).toBe('4000')
    })
    await settle()
  },
}
