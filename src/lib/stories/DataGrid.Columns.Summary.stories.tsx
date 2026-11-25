import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, headKebab, settle, until } from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  openViewSettingsSection,
  viewSettingsLevel,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
import type { ConsoleLog } from './demos/consoleLog'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import type { ServerRowsRequest } from '../plugins'

/**
 * Сводка колонки (ADR 0230): пользователь выбирает функцию итога и значений групп в меню колонки.
 * `Playground` — вид в покое; сценарии S1–S8 проигрываются панелью над гридом.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Summary',
} satisfies Meta<StoryProps>

export default meta

interface Sale {
  id: string
  name: string
  city: string
  orders: number
  amount: number
}

const SALES: Sale[] = [
  { id: 's1', name: 'Anna', city: 'Paris', orders: 4, amount: 100 },
  { id: 's2', name: 'Boris', city: 'Rome', orders: 7, amount: 200 },
  { id: 's3', name: 'Clara', city: 'Paris', orders: 2, amount: 300 },
  { id: 's4', name: 'Denis', city: 'Rome', orders: 5, amount: 400 },
  { id: 's5', name: 'Elena', city: 'Paris', orders: 9, amount: 500 },
  { id: 's6', name: 'Fedor', city: 'Rome', orders: 1, amount: 600 },
]

const amountColumn = (extra: Record<string, unknown> = {}) => ({
  id: 'amount',
  accessorKey: 'amount',
  header: 'Amount',
  dataType: 'number',
  aggregationFn: 'sum',
  size: 180,
  ...extra,
})

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 180 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
  {
    id: 'orders',
    accessorKey: 'orders',
    header: 'Orders',
    dataType: 'number',
    aggregationFn: 'sum',
    size: 180,
  },
  amountColumn(),
]

const SUMMARY_ARGS = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
  columnsOverride: COLUMNS as never,
  dataOverride: SALES,
  enableColumnTotals: true,
  enableColumnAggregation: true,
  enableHeaderActionMenu: true,
  enableFooter: true,
} satisfies Partial<StoryProps>

// --- Чтение таблицы и шаги -----------------------------------------------------------

const footerOf = (root: ParentNode, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__footer-cell[data-column-id="${column}"]`,
  )
/** Число итога колонки — без имени функции; без строки итогов — `undefined`. */
const totalOf = (root: ParentNode, column: string) => {
  const cell = footerOf(root, column)
  // Строки итогов ещё нет — итога не знаем, а не «пусто».
  if (!cell) return undefined
  const label = cell?.querySelector('[data-total-label]')
  return (
    (label ? label.nextElementSibling : cell)?.textContent?.trim() ?? ''
  ).replace(/\s/g, '')
}
const hasLabel = (root: ParentNode, column: string) =>
  !!footerOf(root, column)?.querySelector('[data-total-label]')
const groupValue = (root: ParentNode, city: string) =>
  root
    .querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="city:${city}"] .data-grid__body-cell[data-column-id="amount"]`,
    )
    ?.textContent?.trim()
    .replace(/\s/g, '')
const openMenu = () => document.querySelector<HTMLElement>('[role="menu"]')
/** Пункт списка функций — по имени функции, а не по подписи. */
const functionItem = (name: string | null) =>
  openMenu()?.querySelector<HTMLElement>(
    name === null
      ? '[role^="menuitem"][data-action-id="noSummary"]'
      : `[role^="menuitem"][data-action-id="summaryFunctions"][data-item-id="${name}"]`,
  ) ?? null
const summaryItem = () =>
  openMenu()?.querySelector<HTMLElement>(
    '[role^="menuitem"][data-action-id="columnAggregation"]',
  ) ?? null
/** Точка включённого действия на кнопке меню колонки видна. */
const marked = (root: ParentNode, column: string) => {
  const dot = headKebab(root, column)?.querySelector<HTMLElement>(
    '[data-active-indicator]',
  )
  return !!dot && getComputedStyle(dot).opacity === '1'
}

/** Открыть меню колонки и войти в список функций. */
const openFunctions = (root: HTMLElement, column: string) => {
  const menu = openMenu()
  if (!menu) {
    headKebab(root, column)?.click()
    return
  }
  if (!menu.hasAttribute('data-open') || functionItem(null)) return
  summaryItem()?.click()
}

/** Пользователь открыл список функций колонки. */
const showFunctions = (column: string) =>
  untilDone(
    () => !!functionItem(null),
    root => openFunctions(root, column),
  )

/** Пользователь выбрал функцию колонки в меню; `null` — без сводки. */
const pick = (column: string, name: string | null) => (root: HTMLElement) => {
  let chosen = false
  return untilDone(
    () => chosen && !openMenu(),
    current => {
      if (chosen) return
      const item = functionItem(name)
      if (item) {
        item.click()
        chosen = true
        return
      }
      openFunctions(current, column)
    },
  )(root, undefined as never)
}

// --- Playground ----------------------------------------------------------------------

/** Сводка в покое: функция колонки в меню и подпись у итога. */
export const SummaryPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...showControls(
      [
        'enableColumnAggregation',
        'enableColumnTotals',
        'enableFooter',
        'enableRowGrouping',
        'enableHeaderActionMenu',
      ],
      {
        dataCount: "Rows come from the story's own data",
        columnCount: "Columns come from the story's own column set",
        headerHeight: 'The summary does not depend on the header height',
        defaultColumn: 'The summary does not depend on column widths',
      },
    ),
  },
  args: SUMMARY_ARGS,
  render: args => <StoryComponent {...normalizeArgs(args)} />,
}

// --- S1 ------------------------------------------------------------------------------

const SUM_AT_BOTTOM: DemoStoryStep = {
  title: { ru: 'Сумма внизу', en: 'A sum at the bottom' },
  hint: {
    ru: 'Внизу колонок — суммы их значений.',
    en: 'The bottom of the columns shows the sums of their values.',
  },
}

const PICK: readonly DemoStoryStep[] = [
  SUM_AT_BOTTOM,
  {
    title: { ru: 'Список функций', en: 'The function list' },
    hint: {
      ru: 'Пользователь открыл меню колонки и сводку — текущая функция отмечена.',
      en: 'The user opened the column menu and its summary; the current function is checked.',
    },
    enter: showFunctions('amount'),
  },
  {
    title: { ru: 'Выбрано среднее', en: 'Average is chosen' },
    hint: {
      ru: 'Пользователь выбрал среднее — внизу среднее значение, на кнопке меню колонки — точка.',
      en: 'The user chose the average; the bottom shows the mean value, and the column menu button has a dot.',
    },
    enter: pick('amount', 'mean'),
  },
]

/** ADR 0230, S1: пользователь выбирает функцию в меню колонки. */
export const SummaryPick: StoryObj<StoryProps> = {
  name: 'Pick a function',
  parameters: { scenario: '0230/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Выбор функции сводки', en: 'Picking a summary function' }}
      steps={PICK}
      args={guideArgs(SUMMARY_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PICK[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
      await expect(hasLabel(canvas, 'amount')).toBe(true)
    })
    await step(PICK[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(functionItem('mean')).not.toBeNull())
      await expect(
        functionItem('sum')!.querySelector('[data-popup-item-mark="checked"]'),
      ).not.toBeNull()
    })
    await step(PICK[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(totalOf(canvas, 'amount')).toBe('350'))
      await until(() => expect(marked(canvas, 'amount')).toBe(true))
      await expect(totalOf(canvas, 'orders')).toBe('28')
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const GROUPS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Группы по городу', en: 'Groups by city' },
    hint: {
      ru: 'Строки сгруппированы по городу: у групп и внизу — суммы.',
      en: 'Rows are grouped by city: the groups and the bottom show sums.',
    },
  },
  {
    title: { ru: 'Выбран максимум', en: 'Max is chosen' },
    hint: {
      ru: 'Пользователь выбрал максимум — у групп и внизу самые большие значения.',
      en: 'The user chose the maximum; the groups and the bottom show the largest values.',
    },
    enter: pick('amount', 'max'),
  },
]

/** ADR 0230, S2: при группировке функция меняет и значения групп, и итог. */
export const SummaryGroups: StoryObj<StoryProps> = {
  name: 'Groups',
  parameters: { scenario: '0230/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сводка в группах', en: 'Summary in groups' }}
      steps={GROUPS}
      args={guideArgs(
        {
          ...SUMMARY_ARGS,
          enableRowGrouping: true,
          rowGroupingInitialGrouping: ['city'],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPS[0].title.ru, async () => {
      await until(() => expect(groupValue(canvas, 'Paris')).toBe('900'))
      await expect(groupValue(canvas, 'Rome')).toBe('1200')
      await expect(totalOf(canvas, 'amount')).toBe('2100')
    })
    await step(GROUPS[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(groupValue(canvas, 'Paris')).toBe('500'))
      await expect(groupValue(canvas, 'Rome')).toBe('600')
      await expect(totalOf(canvas, 'amount')).toBe('600')
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const NONE: readonly DemoStoryStep[] = [
  SUM_AT_BOTTOM,
  {
    title: { ru: 'Сводка убрана', en: 'The summary is removed' },
    hint: {
      ru: 'Пользователь убрал сводку колонки — внизу у неё пусто.',
      en: 'The user removed the column summary; its bottom is empty.',
    },
    enter: pick('amount', null),
  },
]

/** ADR 0230, S3: без сводки итог колонки пуст. */
export const SummaryNone: StoryObj<StoryProps> = {
  name: 'No summary',
  parameters: { scenario: '0230/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Колонка без сводки', en: 'A column without a summary' }}
      steps={NONE}
      args={guideArgs(SUMMARY_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NONE[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
    })
    await step(NONE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(totalOf(canvas, 'amount')).toBe(''))
      await expect(totalOf(canvas, 'orders')).toBe('28')
      await until(() => expect(marked(canvas, 'amount')).toBe(true))
    })
    await settle()
  },
}

// --- S4 ------------------------------------------------------------------------------

const ALLOWED_COLUMNS = COLUMNS.map(column =>
  column.id === 'amount'
    ? amountColumn({ aggregationFns: ['sum', 'mean', 'max'] })
    : column,
)

const ALLOWED: readonly DemoStoryStep[] = [
  SUM_AT_BOTTOM,
  {
    title: { ru: 'Короткий список', en: 'A short list' },
    hint: {
      ru: 'У колонки только три функции — так решил разработчик.',
      en: 'The column has only three functions; the developer decided so.',
    },
    enter: showFunctions('amount'),
  },
]

/** ADR 0230, S4: разработчик ограничил список функций колонки. */
export const SummaryAllowed: StoryObj<StoryProps> = {
  name: 'Allowed functions',
  parameters: { scenario: '0230/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Свой список функций', en: 'An own function list' }}
      steps={ALLOWED}
      args={guideArgs(
        { ...SUMMARY_ARGS, columnsOverride: ALLOWED_COLUMNS as never },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ALLOWED[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
    })
    await step(ALLOWED[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(functionItem('max')).not.toBeNull())
      const names = [
        ...openMenu()!.querySelectorAll<HTMLElement>(
          '[data-action-id="summaryFunctions"][data-item-id]',
        ),
      ].map(item => item.dataset.itemId)
      await expect(names).toEqual(['sum', 'mean', 'max'])
    })
    await settle()
  },
}

// --- S5 ------------------------------------------------------------------------------

const CHANGED = { orders: 'max', amount: 'mean' }

/** Уровень раздела «Сводка» колонки. */
const levelOf = (column: string) =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    `[data-view-settings-level="${column}"]`,
  ) ?? null

const VIEW: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Свои функции', en: 'Own functions' },
    hint: {
      ru: 'У двух колонок выбраны свои функции — на их кнопках меню точки.',
      en: 'Two columns have their own functions; their menu buttons have dots.',
    },
  },
  {
    title: { ru: 'Раздел сводки', en: 'The summary section' },
    hint: {
      ru: 'Пользователь открыл настройки вида — в разделе сводки обе колонки и их функции.',
      en: 'The user opened the view settings; the summary section lists both columns and their functions.',
    },
    enter: untilDone(
      () => !!viewSettingsSectionOpen('summary'),
      root => openViewSettingsSection(root, 'summary'),
    ),
  },
  {
    title: { ru: 'Сводка сброшена', en: 'The summary is reset' },
    hint: {
      ru: 'Пользователь сбросил сводку одной колонки — внизу у неё снова сумма.',
      en: 'The user reset the summary of one column; its bottom shows the sum again.',
    },
    enter: untilDone(
      () => !!viewSettingsSectionOpen('summary') && !levelOf('amount'),
      root => {
        if (!openViewSettingsSection(root, 'summary')) return
        levelOf('amount')
          ?.querySelector<HTMLElement>('button[data-view-settings-remove]')
          ?.click()
      },
    ),
  },
]

/** ADR 0230, S5: изменённые сводки — в «Настройках вида», там же их сбрасывают. */
export const SummaryViewSettings: StoryObj<StoryProps> = {
  name: 'View settings',
  parameters: { scenario: '0230/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сводка в настройках вида', en: 'Summary in view settings' }}
      steps={VIEW}
      args={guideArgs(
        {
          ...SUMMARY_ARGS,
          columnAggregationInitialColumnAggregations: CHANGED,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(VIEW[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('350'))
      await expect(totalOf(canvas, 'orders')).toBe('9')
      await until(() => expect(marked(canvas, 'amount')).toBe(true))
    })
    await step(VIEW[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(levelOf('amount')).not.toBeNull())
      await expect(levelOf('orders')).not.toBeNull()
    })
    await step(VIEW[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
      await expect(levelOf('orders')).not.toBeNull()
    })
    await settle()
  },
}

// --- S6 ------------------------------------------------------------------------------

const RESTORE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Сохранённый выбор', en: 'A saved choice' },
    hint: {
      ru: 'Таблица открылась с выбором, который приложение сохранило раньше.',
      en: 'The table opened with the choice the app saved earlier.',
    },
  },
  {
    title: { ru: 'Новый выбор', en: 'A new choice' },
    hint: {
      ru: 'Пользователь выбрал сумму — приложение получило новый выбор и сохранит его.',
      en: 'The user chose the sum; the app received the new choice and will save it.',
    },
    enter: pick('amount', 'sum'),
  },
]

/** ADR 0230, S6: приложение восстанавливает сохранённый выбор при открытии. */
export const SummaryRestore: StoryObj<StoryProps> = {
  name: 'Restore a saved choice',
  parameters: { scenario: '0230/S6', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сохранённая сводка', en: 'A saved summary' }}
      steps={RESTORE}
      args={guideArgs(
        {
          ...SUMMARY_ARGS,
          columnAggregationInitialColumnAggregations: CHANGED,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RESTORE[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('350'))
      await expect(totalOf(canvas, 'orders')).toBe('9')
    })
    await step(RESTORE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
      await until(() => expect(marked(canvas, 'amount')).toBe(false))
    })
    await settle()
  },
}

// --- S7, S8 --------------------------------------------------------------------------

/** Итог по функции: «сервер» считает сам. */
const serverTotal = (column: 'orders' | 'amount', name: string | undefined) => {
  const values = SALES.map(row => row[column])
  switch (name) {
    case 'max':
      return Math.max(...values)
    case 'mean':
      return values.reduce((a, b) => a + b, 0) / values.length
    case undefined:
      return undefined
    default:
      return values.reduce((a, b) => a + b, 0)
  }
}

/**
 * «Сервер»: строки и итоги по функциям запроса; `refuse` — функция, которую сервер не считает.
 * Запрос и ответ — в консоли истории.
 */
const serverRowsOf =
  (log: ConsoleLog, refuse?: string) => (request: ServerRowsRequest) => {
    const { aggregations } = request
    log.log(
      { ru: 'Запрос к серверу', en: 'Server request' },
      `aggregations=${JSON.stringify(aggregations)}`,
    )
    if (refuse && Object.values(aggregations).includes(refuse)) {
      log.log({ ru: 'Отказ сервера', en: 'Server refusal' }, refuse)
      return Promise.reject(new Error('This summary is not available'))
    }
    const totals = {
      orders: serverTotal('orders', aggregations.orders),
      amount: serverTotal('amount', aggregations.amount),
    }
    log.log(
      { ru: 'Ответ сервера', en: 'Server response' },
      `totals=${JSON.stringify(totals)}`,
    )
    return Promise.resolve({
      rows: SALES.slice(request.start, request.end),
      rowCount: SALES.length,
      totals,
    })
  }

const SERVER_ARGS = {
  ...SUMMARY_ARGS,
  dataOverride: [],
  enableServerRowModel: true,
} satisfies Partial<StoryProps>

const SERVER_SUM: DemoStoryStep = {
  title: { ru: 'Сумма с сервера', en: 'A sum from the server' },
  hint: {
    ru: 'Итоги внизу прислал сервер.',
    en: 'The server sent the totals at the bottom.',
  },
}

const SERVER: readonly DemoStoryStep[] = [
  {
    ...SERVER_SUM,
    props: ({ log }) => ({ serverRowModelGetRows: serverRowsOf(log) as never }),
  },
  {
    title: { ru: 'Максимум с сервера', en: 'A max from the server' },
    hint: {
      ru: 'Пользователь выбрал максимум — таблица запросила у сервера новый итог.',
      en: 'The user chose the maximum; the table requested a new total from the server.',
    },
    enter: pick('amount', 'max'),
  },
]

/** ADR 0230, S7: выбор уходит в запрос, сервер присылает новый итог. */
export const SummaryServer: StoryObj<StoryProps> = {
  name: 'Server row model',
  parameters: { scenario: '0230/S7', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сводка на сервере', en: 'Summary on the server' }}
      steps={SERVER}
      args={guideArgs(SERVER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVER[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
    })
    await step(SERVER[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(totalOf(canvas, 'amount')).toBe('600'))
      await expect(totalOf(canvas, 'orders')).toBe('28')
    })
    await settle()
  },
}

const REFUSED: readonly DemoStoryStep[] = [
  {
    ...SERVER_SUM,
    props: ({ log }) => ({
      serverRowModelGetRows: serverRowsOf(log, 'mean') as never,
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь выбрал среднее, сервер отказал — осталась прежняя функция, над таблицей сообщение.',
      en: 'The user chose the average and the server refused; the previous function stayed, and a message is above the table.',
    },
    enter: pick('amount', 'mean'),
  },
]

/** ADR 0230, S8: сервер отказал — выбор откатился, плашка. */
export const SummaryServerRefused: StoryObj<StoryProps> = {
  name: 'Refused by the server',
  parameters: {
    scenario: '0230/S8',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Отказ сервера в сводке',
        en: 'The server refuses a summary',
      }}
      steps={REFUSED}
      args={guideArgs(SERVER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0].title.ru, async () => {
      await until(() => expect(totalOf(canvas, 'amount')).toBe('2100'))
    })
    await step(REFUSED[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="load-error-banner"]'),
        ).not.toBeNull(),
      )
      await expect(totalOf(canvas, 'amount')).toBe('2100')
      await expect(marked(canvas, 'amount')).toBe(false)
    })
    await settle()
  },
}
