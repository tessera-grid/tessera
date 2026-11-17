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
  pointAt,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { unsavedChangesLabels } from '../plugins/unsavedChanges/labels'
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
    title: {
      ru: 'Два условия не применены',
      en: 'Two conditions are not applied',
    },
    hint: {
      ru: 'Пользователь набрал условия фильтров двух колонок и не применил их. На кнопке пульта в тулбаре — число неприменённых изменений, на кнопках фильтра этих колонок — отметки неприменённого.',
      en: 'The user typed filter conditions for two columns and did not apply them. The unsaved changes button in the toolbar shows the number of unapplied changes, and the filter buttons of those columns carry an unapplied mark.',
    },
    states: ['head.draft'],
    props: ({ app, log }) => ({ onFilterChange: answers(app, log) }),
  },
  {
    title: { ru: 'Пульт открыт', en: 'The unsaved changes panel is open' },
    hint: {
      ru: 'Пользователь открыл пульт: оба условия — в разделе фильтров, у каждого — колонка и что задано, переход к колонке, применение и отказ от изменения.',
      en: 'The user opened the unsaved changes panel: both conditions are in the filters section, each with its column and what was set, plus buttons to go to the column, apply the change, and revert it.',
    },
    states: ['overlay.unsavedChanges'],
    enter: stepAction((_root, { signal }) => openPanel(signal)),
  },
  {
    title: { ru: 'Одно применено', en: 'One is applied' },
    hint: {
      ru: 'Пользователь применил условие по имени. Пульт закрылся, сервер прислал строки с этим именем: на кнопке фильтра колонки точка, на кнопке пульта осталось одно изменение.',
      en: "The user applied the name condition. The panel closed, and the server sent the rows with that name: the column's filter button shows a dot, and the unsaved changes button shows one change left.",
    },
    states: ['head.activeIndicator', 'head.draft'],
    enter: stepAction((root, { signal }) => nameApplied(root, signal)),
  },
  {
    title: { ru: 'Всё применено', en: 'Everything is applied' },
    hint: {
      ru: 'Пользователь открыл пульт и применил всё. Сервер отфильтровал строки по обоим условиям, неприменённых изменений не осталось.',
      en: 'The user opened the panel and applied everything. The server filtered the rows by both conditions, and no unapplied changes are left.',
    },
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
      title={{
        ru: 'Применение из пульта',
        en: 'Applying from the unsaved changes panel',
      }}
      steps={APPLY}
      args={guideArgs({ ...GRID, extraPlugins: [serverReset] }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(APPLY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(countOf()).toBe(2))
    })
    await step(APPLY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(entries()).toHaveLength(2)
    })
    await step(APPLY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(panelOpen()).toBe(false)
      await expect(filterActive(canvas, 'name')).toBe(true)
      await expect(countOf()).toBe(1)
    })
    await step(APPLY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(filterActive(canvas, 'city')).toBe(true)
      await expect(countOf()).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0206 S1 ----------------------------------------------------------------------

const DISCARDED = 'Lima'

/** Три несохранённые правки ячеек. */
const CELL_DRAFTS = PLAYGROUND_DRAFTS.filter(
  draft => draft.kind === 'cellValue',
)

const DISCARD_ARGS = {
  ...GRID,
  enableCellEditing: true,
  cellEditingSaveMode: 'manual',
  editableColumns: ['name', 'city', 'age'],
  initialDrafts: CELL_DRAFTS,
} satisfies Partial<StoryProps>

/** Пульт открыт; правка `text` сброшена кнопкой своей записи. */
const discardEntry = async (text: string, signal: AbortSignal) => {
  const entry = () =>
    entries().find(item => item.textContent?.includes(text)) ?? null
  if (countOf() === CELL_DRAFTS.length) {
    await openPanel(signal)
    entry()?.querySelector<HTMLElement>('[data-action="discard"]')?.click()
  }
  await pollUntil(
    () => countOf() === CELL_DRAFTS.length - 1 && panelOpen() && !entry(),
    signal,
  )
}

const DISCARD: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Три несохранённые правки', en: 'Three unsaved edits' },
    hint: {
      ru: 'Пользователь поправил три ячейки и не сохранил правки. Пульт пока закрыт.',
      en: 'The user edited three cells and did not save the edits. The unsaved changes panel is still closed.',
    },
  },
  {
    title: { ru: 'Пульт открыт', en: 'The unsaved changes panel is open' },
    hint: {
      ru: 'Пользователь поправил три ячейки и не сохранил правки, затем открыл пульт. Кнопка отказа у каждой правки и кнопка отказа от всех внизу выделены тоном опасного действия сразу, без наведения: они безвозвратно теряют правки, а применение и переход к ячейке — нет.',
      en: 'The user edited three cells without saving, then opened the unsaved changes panel. The revert button on each edit and the revert-all button at the bottom are styled as dangerous actions right away, without hovering: they lose the edits for good, while applying and going to the cell do not.',
    },
    states: ['overlay.unsavedChanges'],
    enter: stepAction((_root, { signal }) => openPanel(signal)),
  },
  {
    title: { ru: 'Одна правка сброшена', en: 'One edit is reverted' },
    hint: {
      ru: 'Пользователь отказался от правки города прямо в пульте. Её запись ушла, пульт остался открытым; в ячейке снова прежнее значение, на кнопке пульта — две несохранённые правки.',
      en: 'The user reverted the city edit right in the panel. Its entry disappeared, and the panel stayed open; the cell shows its previous value again, and the panel button shows two unsaved edits.',
    },
    states: ['overlay.unsavedChanges', 'body.cellDraft'],
    enter: stepAction((_root, { signal }) => discardEntry(DISCARDED, signal)),
  },
  {
    title: { ru: 'Всё сброшено', en: 'Everything is reverted' },
    hint: {
      ru: 'Пользователь отказался от всех оставшихся правок. Пульт пуст, несохранённых изменений не осталось, в ячейках — прежние значения.',
      en: 'The user reverted all the remaining edits. The panel is empty, no unsaved changes are left, and the cells show their previous values.',
    },
    states: ['overlay.unsavedChanges'],
    enter: stepAction(async (_root, { signal }) => {
      await discardEntry(DISCARDED, signal)
      if (countOf() > 0) {
        await openPanel(signal)
        byTestId('unsaved-changes')
          ?.querySelector<HTMLElement>('[data-action="discard-all"]')
          ?.click()
      }
      await pollUntil(
        () => countOf() === 0 && panelOpen() && entries().length === 0,
        signal,
      )
    }),
  },
]

/** ADR 0206, S1: пользователь сбрасывает правки из пульта — опасные кнопки видны сразу. */
export const UnsavedChangesDangerActions: StoryObj<StoryProps> = {
  name: 'Revert from the panel',
  parameters: { scenario: '0206/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отказ от правок в пульте',
        en: 'Reverting edits in the unsaved changes panel',
      }}
      steps={DISCARD}
      args={guideArgs(DISCARD_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DISCARD[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(DISCARD[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(panelOpen()).toBe(true))
      await expect(entries()).toHaveLength(CELL_DRAFTS.length)
      await expect(
        byTestId('unsaved-changes')?.querySelector(
          '[data-action="discard-all"]',
        ),
      ).not.toBeNull()
      await settle()
    })
    await step(DISCARD[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(countOf()).toBe(CELL_DRAFTS.length - 1)
      await expect(
        canvas.querySelector(
          '.data-grid__body-row[data-row-id="item-id-2"] .data-grid__body-cell[data-column-id="city"] [data-cell-draft]',
        ),
      ).toBeNull()
    })
    await step(DISCARD[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(countOf()).toBe(0)
      await expect(entries()).toHaveLength(0)
      await settle()
    })
  },
}

// --- ADR 0224 S1 ----------------------------------------------------------------------

/** Полоса подсказки точки первой записи пульта. */
const markHintOf = () =>
  byTestId('unsaved-changes')?.querySelector<HTMLElement>(
    '[data-popup-entry-mark-hint]',
  ) ?? null
/** Текст открытой подсказки: не поповера, у которого тоже есть `data-side`. */
const hintText = () =>
  document.querySelector('[data-tooltip-popup]')?.textContent?.trim() ?? ''
/** Указатель на полосу — один раз: повтор перезапускал бы задержку подсказки. */
const pointed = new WeakSet<Element>()
const pointOnce = (element: HTMLElement | null) => {
  if (!element || pointed.has(element)) return
  pointed.add(element)
  pointAt(element)
}

const DOT_HINT: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Два условия не применены',
      en: 'Two conditions are not applied',
    },
    hint: {
      ru: 'Пользователь набрал условия фильтров двух колонок и не применил их. На кнопке пульта в тулбаре — число неприменённых изменений.',
      en: 'The user typed filter conditions for two columns and did not apply them. The unsaved changes button in the toolbar shows the number of unapplied changes.',
    },
    states: ['head.draft'],
  },
  {
    title: { ru: 'Пульт открыт', en: 'The unsaved changes panel is open' },
    hint: {
      ru: 'Пользователь открыл пульт. Слева у каждой записи — точка цвета неприменённого.',
      en: 'The user opened the unsaved changes panel. Each entry has a dot on the left in the unapplied color.',
    },
    states: ['overlay.unsavedChanges'],
    enter: stepAction((_root, { signal }) => openPanel(signal)),
  },
  {
    title: { ru: 'Подсказка точки', en: 'The dot hint' },
    hint: {
      ru: 'Пользователь навёл указатель на точку записи. Подсказка говорит, что значит точка: изменение не применено. На касаниях подсказку показывает удержание пальца.',
      en: "The user hovered over an entry's dot. A tooltip explains what the dot means: the change is not applied. On touch screens, a long press shows the tooltip.",
    },
    states: ['overlay.unsavedChanges', 'overlay.tooltip'],
    enter: stepAction(async (_root, { signal }) => {
      await openPanel(signal)
      await pollUntil(() => {
        pointOnce(markHintOf())
        return hintText() !== ''
      }, signal)
    }),
  },
]

/** ADR 0224, S1: пользователь узнаёт по подсказке, что значит точка записи пульта. */
export const UnsavedChangesDotHint: StoryObj<StoryProps> = {
  name: 'Dot hint',
  parameters: { scenario: '0224/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Подсказка точки', en: 'The dot hint' }}
      steps={DOT_HINT}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const own = unsavedChangesLabels(storyLabels(args.locale))
    await step(DOT_HINT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(countOf()).toBe(2))
    })
    await step(DOT_HINT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(entries()).toHaveLength(2)
    })
    await step(DOT_HINT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(hintText()).toBe(own.markHint))
      await settle()
    })
  },
}
