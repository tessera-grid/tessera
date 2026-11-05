import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import type { Draft } from '../core/drafts/drafts'
import type { TesseraFeatureEntry } from '../core/features'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { filterActive } from './__mocks__/filterGuide'
import { filteringColumns } from './__mocks__/filteringData'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideApp,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { type ConsoleLog, createConsoleLog } from './demos/consoleLog'
import {
  SERVER_DATA,
  SERVER_TOTAL,
  type ServerFilters,
  queryFiltering,
} from './demos/filteringDemos'

/**
 * Пульт черновиков (ADR 0178, §8): кнопка тулбара со счётчиком неприменённых изменений и их
 * список. `Playground` — все виды изменений: ячейки, строки и условия фильтров; S4 — пользователь применяет их из
 * пульта.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Unsaved changes',
} satisfies Meta<StoryProps>

export default meta

const NAME = 'Bob'
const CITY = 'Rome'

/** Два неприменённых условия — по имени и по городу. */
const DRAFTS: Draft[] = [
  {
    kind: 'columnFilter',
    target: { column: 'name' },
    value: { operator: 'contains', value: NAME },
  },
  {
    kind: 'columnFilter',
    target: { column: 'city' },
    value: { operator: 'contains', value: CITY },
  },
]

const GRID = {
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  columnsOverride: filteringColumns,
  dataOverride: SERVER_DATA,
  dataMode: { filtering: 'server' },
  rowCount: SERVER_TOTAL,
  totalRowCount: SERVER_TOTAL,
  enableColumnFiltering: true,
  enableUnsavedChanges: true,
  enableToolbar: true,
  initialDrafts: DRAFTS,
} satisfies Partial<StoryProps>

/**
 * Все виды изменений сразу: правки ячеек (две — в одной строке), новая и удалённая строки —
 * списком данных; условия фильтров — разделом ниже.
 */
const PLAYGROUND_DRAFTS: Draft[] = [
  {
    kind: 'cellValue',
    target: { cell: ['item-id-0', 'name'] },
    value: { value: 'Alice Smith', text: 'Alice Smith' },
  },
  {
    kind: 'cellValue',
    target: { cell: ['item-id-0', 'age'] },
    value: { value: 30, text: '30' },
  },
  {
    kind: 'cellValue',
    target: { cell: ['item-id-2', 'city'] },
    value: { value: 'Lima', text: 'Lima' },
  },
  {
    kind: 'rowInsert',
    target: { row: '5b0d6c1e-3f2a-4c8e-9a71-2d4e6f8a0b13' },
    value: {
      values: { name: 'Ada Lovelace', city: 'London', age: 36, vip: true },
      index: 4,
      after: 'item-id-3',
    },
  },
  { kind: 'rowDelete', target: { row: 'item-id-5' }, value: null },
  ...DRAFTS,
]

// --- Playground -----------------------------------------------------------------------

export const UnsavedChangesPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Все виды изменений: правки ячеек, новая и удалённая строки, условия фильтров. Откройте
  // кнопку справа в тулбаре; без сохранения по кнопке в пульте остаются только фильтры.
  args: {
    ...GRID,
    enableCellEditing: true,
    cellEditingSaveMode: 'manual',
    editableColumns: ['name', 'city', 'age'],
    initialDrafts: PLAYGROUND_DRAFTS,
  },
  parameters: {
    ...vrStates(
      'panel.toolbar',
      'head.draft',
      'body.cellDraft',
      'body.rowDraft',
    ),
    ...showControls([
      'enableUnsavedChanges',
      'enableCellEditing',
      'cellEditingSaveMode',
      'enableColumnFiltering',
      'dataMode',
      'enableToolbar',
    ]),
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- ADR 0178 S4 ----------------------------------------------------------------------

/** «Сервер»: отвечает строками по условиям фильтров и считает запросы. */
const server = { requests: 0, table: undefined as unknown }

const serverReset: TesseraFeatureEntry = {
  id: 'unsavedChangesReset',
  setup: table => {
    const store = (table as { store: unknown }).store
    if (server.table === store) return
    server.table = store
    server.requests = 0
  },
}

const answers =
  (app: GuideApp, log: ConsoleLog) => (filters: ServerFilters) => {
    server.requests += 1
    const rows = queryFiltering(filters, '', [])
    log.log('server', `${rows.length} of ${SERVER_TOTAL} rows`)
    app.update(props => ({
      ...props,
      dataOverride: rows,
      rowCount: rows.length,
    }))
    return Promise.resolve()
  }

const panelButton = () => byTestId('unsaved-changes-button')
const panelOpen = () => !!byTestId('unsaved-changes')
/** Записи пульта. */
const entries = () => [
  ...(byTestId('unsaved-changes')?.querySelectorAll<HTMLElement>(
    '[data-draft-kind]',
  ) ?? []),
]
const countOf = () =>
  Number(
    panelButton()?.querySelector('[data-active-indicator]')?.textContent || 0,
  )
const cellsOf = (root: HTMLElement, column: string) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      `.data-grid__body-cell[data-column-id="${column}"]`,
    ),
  ].map(cell => cell.textContent ?? '')
const allMatch = (root: HTMLElement, column: string, needle: string) => {
  const cells = cellsOf(root, column)
  return cells.length > 0 && cells.every(text => text.includes(needle))
}

/** Пульт открыт. */
const openPanel = (signal: AbortSignal) =>
  pollUntil(() => {
    if (panelOpen()) return entries().length > 0
    panelButton()?.click()
    return false
  }, signal)

/** Условие по имени применено из пульта, сервер ответил. */
const nameApplied = async (root: HTMLElement, signal: AbortSignal) => {
  if (filterActive(root, 'name')) return
  await openPanel(signal)
  entries()
    .find(entry => entry.textContent?.includes(NAME))
    ?.querySelector<HTMLElement>('[data-action="apply"]')
    ?.click()
  // Пульт закрывается после «Применить» анимацией выхода — шаг ждёт её конца.
  await pollUntil(
    () =>
      filterActive(root, 'name') &&
      allMatch(root, 'name', NAME) &&
      !panelOpen(),
    signal,
  )
}

const APPLY: readonly GuideStoryStep[] = [
  {
    title: 'Два условия не применены',
    hint: 'Пользователь набрал условия фильтров двух колонок и не применил их. На кнопке пульта в тулбаре — число неприменённых изменений, на кнопках фильтра этих колонок — отметки неприменённого.',
    states: ['head.draft'],
    props: ({ app, log }) => ({ onFilterChange: answers(app, log) }),
  },
  {
    title: 'Пульт открыт',
    hint: 'Пользователь открыл пульт: оба условия — в разделе фильтров, у каждого — колонка и что задано, переход к колонке, применение и отказ от изменения.',
    states: ['overlay.unsavedChanges'],
    enter: stepAction((_root, { signal }) => openPanel(signal)),
  },
  {
    title: 'Одно применено',
    hint: 'Пользователь применил условие по имени. Пульт закрылся, сервер прислал строки с этим именем: на кнопке фильтра колонки точка, на кнопке пульта осталось одно изменение.',
    states: ['head.activeIndicator', 'head.draft'],
    enter: stepAction((root, { signal }) => nameApplied(root, signal)),
  },
  {
    title: 'Всё применено',
    hint: 'Пользователь открыл пульт и применил всё. Сервер отфильтровал строки по обоим условиям, неприменённых изменений не осталось.',
    states: ['head.activeIndicator'],
    enter: stepAction(async (root, { signal }) => {
      await nameApplied(root, signal)
      await openPanel(signal)
      byTestId('unsaved-changes')
        ?.querySelector<HTMLElement>('[data-action="apply-all"]')
        ?.click()
      await pollUntil(
        () =>
          filterActive(root, 'city') &&
          allMatch(root, 'city', CITY) &&
          countOf() === 0 &&
          !panelOpen(),
        signal,
      )
    }),
  },
]

/** ADR 0178, S4: пользователь открывает пульт и применяет условия — одно, затем все. */
export const UnsavedChangesApply: StoryObj<StoryProps> = {
  name: 'Apply from the panel',
  parameters: { scenario: '0178/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Применение из пульта"
      steps={APPLY}
      args={guideArgs({ ...GRID, extraPlugins: [serverReset] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(APPLY[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(countOf()).toBe(2))
    })
    await step(APPLY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(entries()).toHaveLength(2)
    })
    await step(APPLY[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(panelOpen()).toBe(false)
      await expect(filterActive(canvas, 'name')).toBe(true)
      await expect(countOf()).toBe(1)
    })
    await step(APPLY[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'city')).toBe(true)
      await expect(countOf()).toBe(0)
      await settle()
    })
  },
}
