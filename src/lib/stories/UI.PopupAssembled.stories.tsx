import {
  openViewSettingsSection,
  viewSettingsPopover,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
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
import type { StoryText } from './__mocks__/storyText'
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
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
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
  enableEditHistory: true,
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
  title: StoryText
  hint: StoryText
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
    title: { ru: 'Меню колонки', en: 'The column menu' },
    hint: {
      ru: 'Пользователь открыл меню колонки. Кнопки заголовка свёрнуты в него, поповер собран из поверхности, групп и пунктов.',
      en: 'The user opened the column menu. The header buttons are collapsed into it, and the popover is assembled from a surface, groups and items.',
    },
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
    title: { ru: 'Мини-меню кнопки заголовка', en: 'Header button mini menu' },
    hint: {
      ru: 'Пользователь нажал кнопку закрепления: сторону надо выбрать. Мини-меню собрано из тех же поверхности и пунктов, что и меню колонки.',
      en: 'The user pressed the pin button, and a side has to be chosen. The mini menu is assembled from the same surface and items as the column menu.',
    },
    sources: ['grid/headerActions/ActionInlineMenu'],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) => openByButton(() => pinButton(root), signal),
  },
  {
    id: 'filterText',
    title: { ru: 'Панель фильтра текста', en: 'Text filter panel' },
    hint: {
      ru: 'Пользователь открыл фильтр текстовой колонки. Панель собрана из поверхности, заголовка с кнопкой сброса, кнопки списка условий и поля ввода.',
      en: 'The user opened the filter of a text column. The panel is assembled from a surface, a title with a reset button, a condition list button and an input field.',
    },
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
    title: { ru: 'Список условий', en: 'Condition list' },
    hint: {
      ru: 'Пользователь открыл список условий фильтра. Список собран из поверхности и пунктов с отметкой выбранного.',
      en: 'The user opened the list of filter conditions. The list is assembled from a surface and items, with the selected one checked.',
    },
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
    title: { ru: 'Панель фильтра вариантов', en: 'Option filter panel' },
    hint: {
      ru: 'Пользователь открыл фильтр колонки с вариантами. Панель собрана из поверхности, поля поиска и списка вариантов с флажками и счётчиками.',
      en: 'The user opened the filter of a column with options. The panel is assembled from a surface, a search field and a list of options with checkboxes and counters.',
    },
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
    title: { ru: 'Панель фильтра даты', en: 'Date filter panel' },
    hint: {
      ru: 'Пользователь открыл фильтр даты. Панель собрана из поверхности, кнопки списка условий и календаря.',
      en: 'The user opened the date filter. The panel is assembled from a surface, a condition list button and a calendar.',
    },
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
    id: 'view',
    title: { ru: 'Настройки вида', en: 'View settings' },
    hint: {
      ru: 'Приложение задало фильтр, пользователь открыл настройки вида и раздел фильтров. Панель собрана из поверхности, строки возврата, записей условий и кнопки сброса внизу.',
      en: 'The app set a filter, and the user opened the view settings and then the filters section. The panel is assembled from a surface, a back row, condition entries and a reset button at the bottom.',
    },
    sources: ['grid/ViewSettings/ViewSettingsPopover'],
    shown: () =>
      viewSettingsSectionOpen('filter') ? viewSettingsPopover() : null,
    parts: [
      '[data-testid="view-settings-reset"]',
      '[data-testid="view-settings-remove"]',
    ],
    open: async (root, { signal, onLeave }) => {
      await pollUntil(() => !!gridTable, signal)
      onLeave(() => gridTable?.setColumnFilters([]))
      gridTable!.setColumnFilters([{ id: 'name', value: FILTER_VALUE }])
      await pollUntil(() => openViewSettingsSection(root, 'filter'), signal)
    },
  },
  {
    id: 'contextMenu',
    title: { ru: 'Контекстное меню', en: 'Context menu' },
    hint: {
      ru: 'Пользователь нажал правой кнопкой на ячейку. Поповер собран из поверхности и пунктов, как меню колонки.',
      en: 'The user right-clicked a cell. The popover is assembled from a surface and items, like the column menu.',
    },
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
    title: { ru: 'Меню ручки строки', en: 'Row drag handle menu' },
    hint: {
      ru: 'Пользователь нажал ручку строки: перенести её можно и без перетаскивания. Меню собрано из поверхности и пунктов.',
      en: "The user pressed a row's drag handle: the row can also be moved without dragging. The menu is assembled from a surface and items.",
    },
    sources: [],
    shown: openedMenu,
    parts: [ITEM],
    open: (root, { signal }) => openByButton(() => rowHandle(root), signal),
  },
  {
    id: 'columns',
    title: { ru: 'Выбор колонок', en: 'Column picker' },
    hint: {
      ru: 'Пользователь открыл раздел колонок в настройках вида. Панель собрана из поверхности, заголовка со счётчиком, поля поиска и дерева пунктов с флажками.',
      en: 'The user opened the columns section in the view settings. The panel is assembled from a surface, a title with a counter, a search field and a tree of items with checkboxes.',
    },
    sources: [],
    states: ['overlay.columns'],
    shown: () => byTestId('column-visibility-menu'),
    parts: ['[data-testid="column-visibility-count"]', FIELD, CHECKBOX],
    open: (root, { signal }) =>
      pollUntil(() => openViewSettingsSection(root, 'columns'), signal),
  },
  {
    id: 'export',
    title: { ru: 'Настройки выгрузки', en: 'Export settings' },
    hint: {
      ru: 'Пользователь открыл настройки выгрузки. Панель собрана из поверхности, групп с подписью и кнопки внизу.',
      en: 'The user opened the export settings. The panel is assembled from a surface, labeled groups and a button at the bottom.',
    },
    sources: ['plugins/dataExport/ExportPanel'],
    states: ['overlay.export'],
    shown: exportPanel,
    parts: ['[data-testid="export-run"]'],
    open: (root, { signal }) => openExportPanel(root, signal),
  },
  {
    id: 'pageSize',
    title: { ru: 'Размер страницы', en: 'Page size' },
    hint: {
      ru: 'Пользователь открыл список размеров страницы. Кнопка списка та же, что у условий фильтра, список собран из поверхности и пунктов с отметкой выбранного.',
      en: 'The user opened the list of page sizes. The list button is the same as for filter conditions, and the list is assembled from a surface and items, with the selected one checked.',
    },
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
    title: { ru: 'Правка даты', en: 'Date editing' },
    hint: {
      ru: 'Пользователь нажал кнопку правки даты. Поповер собран из поверхности, календаря и кнопки очистки внизу.',
      en: 'The user pressed the edit button on a date. The popover is assembled from a surface, a calendar and a clear button at the bottom.',
    },
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
    title: { ru: 'Правка варианта', en: 'Option editing' },
    hint: {
      ru: 'Пользователь нажал кнопку правки статуса. Поповер собран из поверхности, поля поиска, пунктов с отметкой выбранного и кнопки очистки внизу.',
      en: 'The user pressed the edit button on a status. The popover is assembled from a surface, a search field, items with the selected one checked, and a clear button at the bottom.',
    },
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
    title: { ru: 'Отметка ячейки', en: 'Cell mark' },
    hint: {
      ru: 'Пользователь нажал отметку ошибки в ячейке. Панель собрана из поверхности, заголовка и текста причины.',
      en: 'The user pressed the error mark in a cell. The panel is assembled from a surface, a title and the reason text.',
    },
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
    title: { ru: 'Журнал ошибок', en: 'Error log' },
    hint: {
      ru: 'Пользователь открыл журнал ошибок. Панель собрана из поверхности, заголовка и записей отказов.',
      en: 'The user opened the error log. The panel is assembled from a surface, a title and the failure entries.',
    },
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
    title: { ru: 'Несохранённые изменения', en: 'Unsaved changes' },
    hint: {
      ru: 'Пользователь открыл список несохранённых изменений. Панель собрана из поверхности, заголовка, записей и кнопок внизу.',
      en: 'The user opened the list of unsaved changes. The panel is assembled from a surface, a title, entries and buttons at the bottom.',
    },
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
  {
    id: 'editHistory',
    title: { ru: 'История изменений', en: 'Change history' },
    hint: {
      ru: 'Пользователь открыл историю изменений. Панель собрана из поверхности, заголовка и заглушки: правок ещё не было.',
      en: 'The user opened the change history. The panel is assembled from a surface, a title and a placeholder, since there have been no edits yet.',
    },
    sources: ['plugins/editHistory/HistoryPopover'],
    shown: () => byTestId('edit-history'),
    parts: [],
    open: (_root, { signal }) =>
      openToolbarPopover(
        'edit-history-button',
        () => byTestId('edit-history'),
        signal,
      ),
  },
  {
    id: 'shortcuts',
    title: { ru: 'Сочетания клавиш', en: 'Keyboard shortcuts' },
    hint: {
      ru: 'Пользователь открыл сводку сочетаний из настроек вида. Панель собрана из поверхности, заголовка, поля поиска и записей действий.',
      en: 'The user opened the keyboard shortcuts from view settings. The panel is assembled from a surface, a title, a search field and action entries.',
    },
    sources: ['grid/Shortcuts/Shortcuts'],
    states: ['overlay.shortcuts'],
    shown: () => byTestId('keyboard-shortcuts'),
    parts: ['[data-shortcuts-list]'],
    open: async (_root, { signal }) => {
      await openToolbarPopover(
        'view-settings-button',
        viewSettingsPopover,
        signal,
      )
      await repeat(
        () => !!byTestId('keyboard-shortcuts'),
        () =>
          document
            .querySelector<HTMLElement>(
              '[data-view-settings-section="shortcuts"]',
            )
            ?.click(),
        signal,
      )
    },
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

const OWN_TABLE = 'The section sets up the table, which has every popover'
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
      description: 'Popover',
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

const STEPS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица', en: 'The table' },
    hint: {
      ru: 'На таблице включены все функции, у которых есть поповер. Дальше — по шагу на каждый поповер таблицы и то, из каких блоков он собран.',
      en: 'Every feature that has a popover is turned on in the table. Next comes one step for each popover of the table, showing which blocks it is assembled from.',
    },
  },
  ...POPUPS.map((popup): DemoStoryStep => ({
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
    <DemoStory
      title={{ ru: 'Поповеры таблицы', en: 'Table popovers' }}
      steps={STEPS}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(openMenu()).toBeNull()
      await settle()
    })
    await step(STEPS[1]!.title.ru, () => expectPopup(canvas, 'columnMenu'))
    await step(STEPS[2]!.title.ru, () => expectPopup(canvas, 'inlineMenu'))
    await step(STEPS[3]!.title.ru, () => expectPopup(canvas, 'filterText'))
    await step(STEPS[4]!.title.ru, () => expectPopup(canvas, 'operatorSelect'))
    await step(STEPS[5]!.title.ru, () => expectPopup(canvas, 'filterOptions'))
    await step(STEPS[6]!.title.ru, () => expectPopup(canvas, 'filterDate'))
    await step(STEPS[7]!.title.ru, () => expectPopup(canvas, 'view'))
    await step(STEPS[8]!.title.ru, () => expectPopup(canvas, 'contextMenu'))
    await step(STEPS[9]!.title.ru, () => expectPopup(canvas, 'handleMenu'))
    await step(STEPS[10]!.title.ru, () => expectPopup(canvas, 'columns'))
    await step(STEPS[11]!.title.ru, () => expectPopup(canvas, 'export'))
    await step(STEPS[12]!.title.ru, () => expectPopup(canvas, 'pageSize'))
    await step(STEPS[13]!.title.ru, () => expectPopup(canvas, 'dateEdit'))
    await step(STEPS[14]!.title.ru, () => expectPopup(canvas, 'optionEdit'))
    await step(STEPS[15]!.title.ru, () => expectPopup(canvas, 'cellIssue'))
    await step(STEPS[16]!.title.ru, () => expectPopup(canvas, 'failureLog'))
    await step(STEPS[17]!.title.ru, () => expectPopup(canvas, 'unsavedChanges'))
    await step(STEPS[18]!.title.ru, () => expectPopup(canvas, 'editHistory'))
    await step(STEPS[19]!.title.ru, () => expectPopup(canvas, 'shortcuts'))
  },
}
