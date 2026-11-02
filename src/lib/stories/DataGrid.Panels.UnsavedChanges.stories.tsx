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
 * список. `Playground` — два неприменённых условия фильтра; S4 — пользователь применяет их из
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

// --- Playground -----------------------------------------------------------------------

export const UnsavedChangesPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Два неприменённых условия фильтра: откройте кнопку справа в тулбаре. Без них на ней нет счётчика.
  args: GRID,
  parameters: {
    ...vrStates('panel.toolbar', 'head.draft'),
    ...showControls([
      'enableUnsavedChanges',
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
const entries = () => [
  ...(byTestId('unsaved-changes')?.querySelectorAll<HTMLElement>(
    '[role="listitem"]',
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
  await pollUntil(
    () => filterActive(root, 'name') && allMatch(root, 'name', NAME),
    signal,
  )
}

const APPLY: readonly GuideStoryStep[] = [
  {
    title: 'Два условия не применены',
    hint: 'Пользователь набрал условия фильтров двух колонок и не применил их. На кнопке пульта в тулбаре — число неприменённых изменений, на кнопках фильтра этих колонок — кольца.',
    states: ['head.draft'],
    props: ({ app, log }) => ({ onFilterChange: answers(app, log) }),
  },
  {
    title: 'Пульт открыт',
    hint: 'Пользователь открыл пульт: в нём оба условия — что задано и для какой колонки, у каждого — переход к колонке, применение и отказ от изменения.',
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
          countOf() === 0,
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
      await expect(countOf()).toBe(2)
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
