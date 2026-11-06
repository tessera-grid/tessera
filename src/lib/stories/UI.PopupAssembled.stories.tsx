import { useEffect, useRef, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { Draft } from '../core/drafts/drafts'
import type { HeaderAction } from '../core/headerActions'
import type { Failure } from '../core/failures/failuresFeature'
import type { CellComponentProps } from '../core/createSlots'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import type { CatalogState } from './__mocks__/catalog'
import {
  byTestId,
  guideNext,
  headCell,
  headKebab,
  openMenuBy,
  pollUntil,
  pressEscape,
  repeat,
  rowAt,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { openMenu, rightClickCell } from './__mocks__/cellGestures'
import { productColumns, productRows } from './__mocks__/dataTypesData'
import { exportPanel, openExportPanel } from './__mocks__/exportGuide'
import { openPanel, panel } from './__mocks__/filterGuide'
import { seed } from './__mocks__/seed'
import {
  datePopup,
  openDateEdit,
  openOptionEdit,
  optionsPopup,
} from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Собранные поповеры (ADR 0183, §3): каждый поповер грида и плагинов на маленькой таблице.
 * `Playground` — поповер на выбор контролом, `PopupAssembled` — по шагу на поповер с блоками
 * кита, из которых он собран.
 */
interface AssembledArgs extends StoryProps {
  popup: string
}

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/UI/Popup/Assembled',
} satisfies Meta<StoryProps>

export default meta

const ROWS = productRows(50)
const ISSUE_ROW = 'product-2'
const MENU_COLUMN = 'tags'
const DRAFT_ROW = 'product-3'
const FILTER_VALUE = { operator: 'contains', value: 'a' }

/** Колонки шире кнопок заголовка: иначе они уходят в меню колонки. */
const COLUMNS = productColumns()
  .filter(column => ['name', 'status', 'tags', 'released'].includes(column.id!))
  .map(column => ({ ...column, size: 215 }))

interface AssembledTable {
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  reportFailure: (report: Omit<Failure, 'key' | 'time'>) => string
}

/** Таблица для действий шагов: фильтр ставит приложение, запись журнала — семя. */
let gridTable: AssembledTable | null = null

const GRID_SEED = seed<AssembledTable>('popupAssembledSeed', table => {
  gridTable = table
  table.reportFailure({
    label: 'Archive',
    target: { row: 'product-5' },
    reason: 'Row is locked by another user',
  })
})

/** Пятая кнопка заголовка: у этой колонки кнопки сворачиваются в меню, у прочих стоят в ряд. */
const noteAction: HeaderAction = {
  id: 'popupAssembledNote',
  slot: 'rightHeaderSlot',
  icon: () => <StickyNote width={16} height={16} />,
  label: () => 'Add note',
  visible: context => context.column.id === MENU_COLUMN,
  onSelect: () => undefined,
}
const NOTE_PLUGIN = definePlugin()({
  id: 'popupAssembledNote',
  slotActions: [noteAction],
})()

const DRAFTS: Draft[] = [
  {
    kind: 'cellValue',
    target: { cell: [DRAFT_ROW, 'name'] },
    value: { value: 'Renamed', text: 'Renamed' },
  },
]

const issueOf = (context: CellComponentProps) =>
  context.row.id === ISSUE_ROW && context.column.id === 'name'
    ? 'The name is already taken'
    : undefined

const GRID = {
  columnsOverride: COLUMNS,
  dataOverride: ROWS,
  editableColumns: ['name', 'status', 'released'],
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  timeZone: 'UTC',
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnPinning: true,
  enableColumnVisibility: true,
  enableHeaderActionMenu: true,
  headerActionMenuThreshold: 5,
  enableContextMenu: true,
  enableCellSelection: true,
  enableRowDragging: true,
  enableCellEditing: true,
  cellEditingSaveMode: 'manual',
  enableCellErrors: true,
  cellErrorsGetCellError: issueOf,
  enableDataExport: true,
  enablePagination: true,
  enableFailureLog: true,
  enableUnsavedChanges: true,
  initialDrafts: DRAFTS,
  extraPlugins: [GRID_SEED, NOTE_PLUGIN],
} satisfies Partial<StoryProps>

interface StepLife {
  signal: AbortSignal
  onLeave: (undo: () => void) => void
}

interface AssembledPopup {
  /** Имя в контроле `Playground`. */
  id: string
  title: string
  hint: string
  /** Файлы `grid/` и `plugins/` с попапом Base UI, который показывает шаг (PK9). */
  sources: readonly string[]
  states?: CatalogState[]
  /** Открытый поповер. */
  shown: () => HTMLElement | null
  /** Блоки кита: каждый селектор находит узел в поповере. */
  parts: readonly string[]
  open: (root: HTMLElement, life: StepLife) => Promise<unknown>
}

const ITEM = '[data-popup-item-label]'
const FOOTER = '[data-popup-footer]'
const FIELD = 'input'
const CHECKBOX = '[role="checkbox"]'

const openedMenu = () => openMenu()
/** Открытый список: закрытый Base UI держит в DOM. */
const openedList = () =>
  document.querySelector<HTMLElement>('[data-open] [role="listbox"]')
const issuePopover = () => byTestId('cell-issue-popover')
const issueButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${ISSUE_ROW}"] button[data-cell-issue]`,
  )
const pinButton = (root: HTMLElement) =>
  headCell(root, 'name')?.querySelector<HTMLElement>('.column-pin__button')
const rowHandle = (root: HTMLElement) =>
  rowAt(root, 0)?.querySelector<HTMLElement>('.drag__handler--column')
const firstCell = (root: HTMLElement) =>
  rowAt(root, 0)?.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="status"]',
  )

/** Открыть меню кнопкой и дождаться его. */
const openByButton = async (
  button: () => HTMLElement | null | undefined,
  signal: AbortSignal,
) => {
  openMenuBy(button, signal)
  await pollUntil(() => !!openedMenu(), signal)
}

const openToolbarPopover = (
  button: string,
  popover: () => HTMLElement | null,
  signal: AbortSignal,
) =>
  repeat(
    () => !!popover(),
    () => byTestId(button)?.click(),
    signal,
  )

const POPUPS: readonly AssembledPopup[] = [
  {
    id: 'columnMenu',
    title: 'Меню колонки',
    hint: 'Пользователь открыл меню колонки. Кнопки заголовка свёрнуты в него, поповер собран из поверхности, групп и пунктов.',
    sources: [
      'grid/headerActions/ActionMenu',
      'grid/headerActions/ActionMenuPopup',
    ],
    states: ['overlay.menu'],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) =>
      openByButton(() => headKebab(root, MENU_COLUMN), signal),
  },
  {
    id: 'inlineMenu',
    title: 'Мини-меню кнопки заголовка',
    hint: 'Пользователь нажал кнопку закрепления: сторону надо выбрать. Мини-меню собрано из тех же поверхности и пунктов, что и меню колонки.',
    sources: ['grid/headerActions/ActionInlineMenu'],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) => openByButton(() => pinButton(root), signal),
  },
  {
    id: 'filterText',
    title: 'Панель фильтра текста',
    hint: 'Пользователь открыл фильтр текстовой колонки. Панель собрана из поверхности, заголовка с кнопкой сброса, кнопки списка условий и поля ввода.',
    sources: [
      'grid/headerActions/ActionPanel',
      'grid/headerActions/ActionPanelPopup',
    ],
    states: ['overlay.filterText'],
    shown: panel,
    parts: [
      '[data-testid="filter-reset"]',
      '[data-testid="filter-operator"]',
      FIELD,
    ],
    open: (root, { signal }) => openPanel(root, 'name', signal),
  },
  {
    id: 'operatorSelect',
    title: 'Список условий',
    hint: 'Пользователь открыл список условий фильтра. Список собран из поверхности и пунктов с отметкой выбранного.',
    sources: ['plugins/columnFiltering/OperatorSelect'],
    shown: openedList,
    parts: [ITEM],
    open: async (root, { signal }) => {
      await openPanel(root, 'name', signal)
      await repeat(
        () => !!openedList(),
        () => byTestId('filter-operator')?.click(),
        signal,
      )
    },
  },
  {
    id: 'filterOptions',
    title: 'Панель фильтра вариантов',
    hint: 'Пользователь открыл фильтр колонки с вариантами. Панель собрана из поверхности, поля поиска и списка вариантов с флажками и счётчиками.',
    sources: [],
    states: ['overlay.filterOptions'],
    shown: panel,
    parts: [
      '[data-option-label]',
      '[data-testid="filter-options-search"]',
      CHECKBOX,
    ],
    open: (root, { signal }) => openPanel(root, 'status', signal),
  },
  {
    id: 'filterDate',
    title: 'Панель фильтра даты',
    hint: 'Пользователь открыл фильтр даты. Панель собрана из поверхности, кнопки списка условий и календаря.',
    sources: [],
    states: ['overlay.filterDate'],
    shown: panel,
    parts: [
      '[data-testid="filter-operator"]',
      '[data-testid="filter-calendar"]',
    ],
    open: (root, { signal }) => openPanel(root, 'released', signal),
  },
  {
    id: 'filterSummary',
    title: 'Сводка фильтров',
    hint: 'Приложение задало фильтр, пользователь открыл сводку. Панель собрана из поверхности, заголовка, записей условий и кнопки сброса внизу.',
    sources: ['plugins/columnFiltering/FilterSummaryPopover'],
    shown: () => byTestId('filter-summary'),
    parts: [
      '[data-testid="filter-summary-reset"]',
      '[data-testid="filter-summary-remove"]',
    ],
    open: async (_root, { signal, onLeave }) => {
      await pollUntil(() => !!gridTable, signal)
      onLeave(() => gridTable?.setColumnFilters([]))
      gridTable!.setColumnFilters([{ id: 'name', value: FILTER_VALUE }])
      await openToolbarPopover(
        'filter-summary-button',
        () => byTestId('filter-summary'),
        signal,
      )
    },
  },
  {
    id: 'contextMenu',
    title: 'Контекстное меню',
    hint: 'Пользователь нажал правой кнопкой на ячейку. Поповер собран из поверхности и пунктов, как меню колонки.',
    sources: ['plugins/contextMenu/ContextMenuPopup'],
    states: ['overlay.contextMenu'],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) =>
      repeat(
        () => !!openedMenu(),
        () => {
          const cell = firstCell(root)
          if (cell) rightClickCell(cell)
        },
        signal,
      ),
  },
  {
    id: 'handleMenu',
    title: 'Меню ручки строки',
    hint: 'Пользователь нажал ручку строки: перенести её можно и без перетаскивания. Меню собрано из поверхности и пунктов.',
    sources: [],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) => openByButton(() => rowHandle(root), signal),
  },
  {
    id: 'columns',
    title: 'Выбор колонок',
    hint: 'Пользователь открыл выбор колонок. Панель собрана из поверхности, заголовка со счётчиком, поля поиска и дерева пунктов с флажками.',
    sources: ['plugins/columnVisibility/ColumnVisibilityPopover'],
    states: ['overlay.columns'],
    shown: () => byTestId('column-visibility-menu'),
    parts: ['[data-testid="column-visibility-count"]', FIELD, CHECKBOX],
    open: (_root, { signal }) =>
      openToolbarPopover(
        'column-visibility-button',
        () => byTestId('column-visibility-menu'),
        signal,
      ),
  },
  {
    id: 'export',
    title: 'Настройки выгрузки',
    hint: 'Пользователь открыл настройки выгрузки. Панель собрана из поверхности, групп с подписью и кнопки внизу.',
    sources: ['plugins/dataExport/ExportPanel'],
    states: ['overlay.export'],
    shown: exportPanel,
    parts: ['[data-testid="export-run"]'],
    open: (root, { signal }) => openExportPanel(root, signal),
  },
  {
    id: 'pageSize',
    title: 'Размер страницы',
    hint: 'Пользователь открыл список размеров страницы. Кнопка списка та же, что у условий фильтра, список собран из поверхности и пунктов с отметкой выбранного.',
    sources: ['plugins/pagination/PageSizeSelect'],
    shown: openedList,
    parts: [ITEM],
    open: (_root, { signal }) =>
      repeat(
        () => !!openedList(),
        () => byTestId('page-size-select')?.click(),
        signal,
      ),
  },
  {
    id: 'dateEdit',
    title: 'Правка даты',
    hint: 'Пользователь нажал кнопку правки даты. Поповер собран из поверхности, календаря и кнопки очистки внизу.',
    sources: ['plugins/cellEditing/EditPopover'],
    states: ['body.editing', 'overlay.dateEditor'],
    shown: datePopup,
    parts: ['[data-testid="edit-clear-value"]', '[data-day] button'],
    open: (root, { signal }) =>
      repeat(
        () => !!datePopup(),
        () => openDateEdit(root, 'released'),
        signal,
      ),
  },
  {
    id: 'optionEdit',
    title: 'Правка варианта',
    hint: 'Пользователь нажал кнопку правки статуса. Поповер собран из поверхности, поля поиска, пунктов с отметкой выбранного и кнопки очистки внизу.',
    sources: ['plugins/cellEditing/OptionEditors'],
    states: ['body.editing', 'overlay.optionEditor'],
    shown: optionsPopup,
    parts: ['[data-testid="edit-clear-value"]', '[data-value]'],
    open: (root, { signal }) =>
      repeat(
        () => !!optionsPopup(),
        () => openOptionEdit(root, 'status'),
        signal,
      ),
  },
  {
    id: 'cellIssue',
    title: 'Отметка ячейки',
    hint: 'Пользователь нажал отметку ошибки в ячейке. Панель собрана из поверхности, заголовка и текста причины.',
    sources: [],
    states: ['overlay.cellIssue'],
    shown: issuePopover,
    parts: [],
    open: (root, { signal }) =>
      repeat(
        () => !!issuePopover(),
        () => issueButton(root)?.click(),
        signal,
      ),
  },
  {
    id: 'failureLog',
    title: 'Журнал отказов',
    hint: 'Пользователь открыл журнал отказов. Панель собрана из поверхности, заголовка и записей отказов.',
    sources: ['plugins/failureLog/FailureLogPopover'],
    states: ['overlay.failureLog'],
    shown: () => byTestId('failure-log'),
    parts: ['[role="listitem"]'],
    open: (_root, { signal }) =>
      openToolbarPopover(
        'failure-log-button',
        () => byTestId('failure-log'),
        signal,
      ),
  },
  {
    id: 'unsavedChanges',
    title: 'Несохранённые изменения',
    hint: 'Пользователь открыл список несохранённых изменений. Панель собрана из поверхности, заголовка, записей и кнопок внизу.',
    sources: ['plugins/unsavedChanges/UnsavedChangesPopover'],
    states: ['overlay.unsavedChanges'],
    shown: () => byTestId('unsaved-changes'),
    parts: [FOOTER],
    open: (_root, { signal }) =>
      openToolbarPopover(
        'unsaved-changes-button',
        () => byTestId('unsaved-changes'),
        signal,
      ),
  },
]

const popupById = (id: string) => POPUPS.find(popup => popup.id === id)!

/** Открыть поповер из любого состояния: открытый прежде закрывается нажатием Escape. */
const reach = async (
  root: HTMLElement,
  popup: AssembledPopup,
  life: StepLife,
) => {
  await pollUntil(
    () => !!root.querySelector('.data-grid__body-row'),
    life.signal,
  )
  for (const other of POPUPS) {
    await repeat(() => !other.shown(), pressEscape, life.signal)
  }
  await popup.open(root, life)
}

// --- Playground -----------------------------------------------------------------------

const OWN_TABLE = 'Таблицу задаёт раздел: на ней есть все поповеры'
const OWN_CONTROLS = {
  columnCount: OWN_TABLE,
  dataCount: OWN_TABLE,
  containerHeight: OWN_TABLE,
  rowHeight: OWN_TABLE,
  headerHeight: OWN_TABLE,
  defaultColumn: OWN_TABLE,
  height: OWN_TABLE,
  maxHeight: OWN_TABLE,
}

export const AssembledPlayground: StoryObj<AssembledArgs> = {
  name: 'Playground',
  // Поповер на выбор: контрол открывает его на таблице, прежний закрывается.
  args: { popup: POPUPS[0]!.id },
  argTypes: {
    popup: {
      control: 'select',
      options: POPUPS.map(popup => popup.id),
      description: 'Поповер',
    },
  },
  parameters: showControls(['popup'], OWN_CONTROLS),
  render: function Render({ popup: popupId, ...storybook }) {
    const [consoleLog] = useState(createConsoleLog)
    const args = guideArgs(GRID, storybook)
    const root = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const controller = new AbortController()
      const undo: (() => void)[] = []
      reach(root.current!, popupById(popupId), {
        signal: controller.signal,
        onLeave: fn => undo.push(fn),
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) console.error(error)
      })
      return () => {
        controller.abort()
        for (const fn of undo.reverse()) fn()
      }
    }, [popupId])
    return (
      <div ref={root}>
        <WithConsole log={consoleLog} args={args}>
          <StoryComponent {...args} />
        </WithConsole>
      </div>
    )
  },
  play: async ({ args, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(popupById(args.popup).shown()).not.toBeNull())
    await settle()
  },
}

// --- ADR 0183, S1 ---------------------------------------------------------------------

const STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица',
    hint: 'На таблице включены все функции, у которых есть поповер. Дальше — по шагу на каждый поповер таблицы и то, из каких блоков он собран.',
  },
  ...POPUPS.map((popup): GuideStoryStep => ({
    title: popup.title,
    hint: popup.hint,
    ...(popup.states ? { states: popup.states } : {}),
    enter: stepAction((root, life) => reach(root, popup, life)),
  })),
]

/** Шаг дошёл: поповер открыт, блоки кита на месте. */
const expectPopup = async (canvas: HTMLElement, id: string) => {
  const popup = popupById(id)
  await guideNext(canvas)
  await stepDone(canvas)
  await until(() => expect(popup.shown()).not.toBeNull())
  // Панели ленивые: блоки приходят после поверхности.
  for (const part of popup.parts) {
    await until(() =>
      expect(popup.shown()!.querySelector(part), part).not.toBeNull(),
    )
  }
  await settle()
}

/** ADR 0183, S1: контрибьютор смотрит, из каких блоков кита собран каждый поповер. */
export const PopupAssembled: StoryObj<StoryProps> = {
  name: 'Popups assembled',
  parameters: { scenario: '0183/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Поповеры таблицы"
      steps={STEPS}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(openMenu()).toBeNull()
      await settle()
    })
    await step(STEPS[1]!.title, () => expectPopup(canvas, 'columnMenu'))
    await step(STEPS[2]!.title, () => expectPopup(canvas, 'inlineMenu'))
    await step(STEPS[3]!.title, () => expectPopup(canvas, 'filterText'))
    await step(STEPS[4]!.title, () => expectPopup(canvas, 'operatorSelect'))
    await step(STEPS[5]!.title, () => expectPopup(canvas, 'filterOptions'))
    await step(STEPS[6]!.title, () => expectPopup(canvas, 'filterDate'))
    await step(STEPS[7]!.title, () => expectPopup(canvas, 'filterSummary'))
    await step(STEPS[8]!.title, () => expectPopup(canvas, 'contextMenu'))
    await step(STEPS[9]!.title, () => expectPopup(canvas, 'handleMenu'))
    await step(STEPS[10]!.title, () => expectPopup(canvas, 'columns'))
    await step(STEPS[11]!.title, () => expectPopup(canvas, 'export'))
    await step(STEPS[12]!.title, () => expectPopup(canvas, 'pageSize'))
    await step(STEPS[13]!.title, () => expectPopup(canvas, 'dateEdit'))
    await step(STEPS[14]!.title, () => expectPopup(canvas, 'optionEdit'))
    await step(STEPS[15]!.title, () => expectPopup(canvas, 'cellIssue'))
    await step(STEPS[16]!.title, () => expectPopup(canvas, 'failureLog'))
    await step(STEPS[17]!.title, () => expectPopup(canvas, 'unsavedChanges'))
  },
}
