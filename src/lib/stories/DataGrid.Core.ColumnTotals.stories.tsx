import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

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

/** Отделы с продажами: у отдела свои значения, у людей — свои. */
const DEPARTMENTS: Sale[] = [
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
} satisfies Partial<StoryProps>

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

const SEARCH: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Итоги всех строк', en: 'Totals of all rows' },
    hint: {
      ru: 'В колонках с заданным способом подсчёта футер показывает итог. Он считается по всем строкам таблицы.',
      en: 'In columns with an aggregation set, the footer shows a total. It is computed over all rows of the table.',
    },
  },
  {
    title: { ru: 'Итоги найденных строк', en: 'Totals of found rows' },
    hint: {
      ru: 'Поиск оставил часть строк, и итог посчитан заново: он учитывает только то, что осталось.',
      en: 'The search left only some of the rows, and the total was recomputed: it counts only what remains.',
    },
    enter: typeSearch('Paris'),
  },
]

/** S1: итог следует за поиском. */
export const ColumnTotalsSearch: StoryObj<StoryProps> = {
  name: 'Search changes the total',
  parameters: { scenario: '0184/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Итог и поиск', en: 'Totals and search' }}
      steps={SEARCH}
      args={guideArgs(
        { ...TOTALS_ARGS, enableQuickSearch: true, quickSearchDebounceMs: 0 },
        args,
      )}
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

const OWN_FOOTER: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Итог по типу колонки', en: 'A total by column type' },
    hint: {
      ru: 'Таблица показывает итог так же, как значения в этой колонке.',
      en: 'The table displays the total the same way as the values in that column.',
    },
  },
  {
    title: { ru: 'Своё оформление итога', en: 'Custom total formatting' },
    hint: {
      ru: 'Приложение задало колонке своё содержимое футера: оно заменяет итог таблицы, а значение берёт у неё же.',
      en: "The app gave the column its own footer content: it replaces the table's total but takes its value from the table.",
    },
    props: () => ({ columnsOverride: OWN_FOOTER_COLUMNS as never }),
  },
]

/** S2: разработчик оформляет итог своим содержимым футера. */
export const ColumnTotalsOwnFooter: StoryObj<StoryProps> = {
  name: 'Own footer',
  parameters: { scenario: '0184/S2', ...guideControls() },
  render: args => (
    <GuideStory
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

const DEEP_COLUMNS = COLUMNS.map(column =>
  column.aggregationFn ? { ...column, maxAggregationDepth: 1 } : column,
)

const TREE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Итог верхнего уровня', en: 'Top-level total' },
    hint: {
      ru: 'В дереве итог складывает только верхний уровень: иначе родитель и его вложенные строки считались бы вместе.',
      en: 'In a tree, the total adds up only the top level: otherwise a parent and its nested rows would be counted together.',
    },
  },
  {
    title: { ru: 'Итог на уровень глубже', en: 'A total one level deeper' },
    hint: {
      ru: 'Колонкам разрешён подсчёт на уровень глубже: теперь итог складывает вложенные строки вместо их родителей.',
      en: 'The columns are allowed to aggregate one level deeper: now the total adds up the nested rows instead of their parents.',
    },
    props: () => ({ columnsOverride: DEEP_COLUMNS as never }),
  },
]

/** S3: итог в дереве не считает родителя и его детей дважды. */
export const ColumnTotalsTree: StoryObj<StoryProps> = {
  name: 'Tree',
  parameters: { scenario: '0184/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Итог в дереве', en: 'Totals in a tree' }}
      steps={TREE}
      args={guideArgs(
        {
          ...TOTALS_ARGS,
          dataOverride: DEPARTMENTS,
          enableRowExpanding: true,
          initialExpanded: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0].title.ru, async () => {
      await until(() => expect(footerText(canvas, 'amount')).toBe('3000'))
      await expect(footerText(canvas, 'orders')).toBe('30')
    })
    await step(TREE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(footerText(canvas, 'amount')).toBe('1000'))
      await expect(footerText(canvas, 'orders')).toBe('16')
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

const SERVER_PAGE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Итога нет', en: 'No total' },
    hint: {
      ru: 'На странице только часть строк, остальные на сервере. Сумма видимых строк выглядела бы как настоящий итог, поэтому таблица его не показывает.',
      en: "The page holds only some of the rows; the rest are on the server. A sum of the visible rows would look like the real total, so the table doesn't show one.",
    },
  },
  {
    title: { ru: 'Итог от сервера', en: 'A total from the server' },
    hint: {
      ru: 'Настоящий итог знает сервер. Приложение показывает его своим содержимым футера.',
      en: 'Only the server knows the real total. The app shows it with its own footer content.',
    },
    props: () => ({ columnsOverride: SERVER_FOOTER_COLUMNS as never }),
  },
]

/** S4: при странице с сервера таблица не считает итог сама. */
export const ColumnTotalsServerPage: StoryObj<StoryProps> = {
  name: 'Server page',
  parameters: { scenario: '0184/S4', ...guideControls() },
  render: args => (
    <GuideStory
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
