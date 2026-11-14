/**
 * Галерея поповеров (просьба автора 2026-11-14): все поповеры грида, плагинов и кита сразу открытыми
 * на одной странице — для сравнения вида глазами. Грид не рисуется: таблица — только модель
 * (`useCreateTable`), поповеры плагинов получают её пропом; якоря и кнопки невидимы. Истории кита —
 * их собственные рендеры. Только `storybook dev` (`*.dev`), вне тестов и снимков.
 */
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import type { Meta, StoryObj } from '@storybook/react'
import { composeStories } from '@storybook/react-vite'

import type { Draft } from '../core/drafts/drafts'
import type { Failure } from '../core/failures/failuresFeature'
import { resolveVisibleActions, type SlotAction } from '../core/headerActions'
import { useLocalization } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import { ActionInlineMenu } from '../grid/headerActions/ActionInlineMenu'
import { ActionMenu } from '../grid/headerActions/ActionMenu'
import { ActionPanel } from '../grid/headerActions/ActionPanel'
import { useKebabState } from '../grid/headerActions/useKebabState'
import { ViewSettingsPopover } from '../grid/ViewSettings/ViewSettingsPopover'
import { DateEditor } from '../plugins/cellEditing/DateEditor'
import {
  MultiSelectEditor,
  SelectEditor,
} from '../plugins/cellEditing/OptionEditors'
import type { CellEditorProps } from '../plugins/cellEditing/types'
import { ContextMenuPopup } from '../plugins/contextMenu/ContextMenuPopup'
import { ExportPanel } from '../plugins/dataExport/ExportPanel'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import { HistoryPopover } from '../plugins/editHistory/HistoryPopover'
import { FailureLogPopover } from '../plugins/failureLog/FailureLogPopover'
import { PageSizeSelect } from '../plugins/pagination/PageSizeSelect'
import { UnsavedChangesPopover } from '../plugins/unsavedChanges/UnsavedChangesPopover'
import { StaticPopupsContext } from '../ui/Popup/staticPopups'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryText } from './__mocks__/storyLocale'
import type { StoryText } from './__mocks__/storyText'
import { seed } from './__mocks__/seed'
import { productColumns, productRows } from './__mocks__/dataTypesData'
import {
  argsToPlugins,
  type FeatureToggles,
} from './__mocks__/utils/argsToPlugins'
import * as CalendarStories from './UI.Calendar.stories'
import * as CellIssueStories from './UI.CellIssue.stories'
import * as ChecklistStories from './UI.Checklist.stories'
import * as HandleMenuStories from './UI.HandleMenuPopup.stories'
import * as MenuItemsStories from './UI.MenuItems.stories'
import * as MenuSectionsStories from './UI.MenuSections.stories'
import * as EntryStories from './UI.PopupEntry.stories'
import * as GroupStories from './UI.PopupGroup.stories'
import * as ItemStories from './UI.PopupItem.stories'
import * as LevelsStories from './UI.PopupLevels.stories'
import * as NavItemStories from './UI.PopupNavItem.stories'
import * as PanelStories from './UI.PopupPanel.stories'
import * as SkeletonRowsStories from './UI.PopupSkeletonRows.stories'
import * as SurfaceStories from './UI.PopupSurface.stories'

const meta = {
  title: 'Tessera/Common/Popup gallery',
  tags: ['!test', '!autodocs'],
  parameters: { layout: 'fullscreen', chromatic: { disableSnapshot: true } },
} satisfies Meta

export default meta

/* eslint-disable @typescript-eslint/no-explicit-any -- галерея кормит поповеры моделью таблицы без грида */
type AnyTable = any

const ROWS = productRows(30)
const COLUMNS = productColumns()
const DRAFT_ROW = 'product-3'
const DRAFTS: Draft[] = [
  {
    kind: 'cellValue',
    target: { cell: [DRAFT_ROW, 'name'] },
    value: { value: 'Renamed', text: 'Renamed' },
  },
]
const FAILURE: Omit<Failure, 'key' | 'time'> = {
  label: 'Archive',
  target: { row: 'product-5' },
  reason: 'Row is locked by another user',
}

const TOGGLES = {
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnPinning: true,
  enableColumnVisibility: true,
  enableHeaderActionMenu: true,
  enableContextMenu: true,
  enableCellSelection: true,
  enableRowDragging: true,
  enableCellEditing: true,
  cellEditingSaveMode: 'manual',
  enableDataExport: true,
  enablePagination: true,
  enableFailureLog: true,
  enableUnsavedChanges: true,
  enableEditHistory: true,
} as FeatureToggles

const noop = () => {}

/**
 * Фильтры, запись журнала, скрытая колонка с сортировкой и две правки для истории — до первого
 * показа поповеров.
 */
/** Таблицы, которым семя уже записало правки истории. */
const EDITED = new WeakSet<object>()

const GALLERY_SEED = seed<AnyTable>('popupGallerySeed', table => {
  table.setColumnFilters([
    { id: 'name', value: { operator: 'contains', value: 'a' } },
    { id: 'status', value: { operator: 'anyOf', value: ['active'] } },
  ])
  table.reportFailure(FAILURE)
  // Скрытая отсортированная колонка — пункт «Колонок» с ластиком (ADR 0204).
  table.setSorting([{ id: 'price', desc: false }])
  table.setColumnVisibility({ price: false })
  // Семя бежит дважды в StrictMode, правки пишутся асинхронно — один раз на таблицу.
  if (EDITED.has(table)) return
  EDITED.add(table)
  void table.writeCells(
    [{ rowId: 'product-1', columnId: 'name', value: 'Lamp' }],
    { source: 'paste' },
  )
  void table.writeCells(
    [
      { rowId: 'product-2', columnId: 'name', value: 'Chair' },
      { rowId: 'product-4', columnId: 'name', value: 'Bottle' },
    ],
    { source: 'fill' },
  )
})

const CAPTION_STYLE: CSSProperties = {
  font: '600 12px system-ui',
  margin: '0 0 4px',
  opacity: 0.7,
}

/** Кнопки и холсты поповеров не занимают места и не видны: поповеры в портале этим не задеты. */
const HIDDEN_STYLE: CSSProperties = {
  height: 0,
  overflow: 'hidden',
  visibility: 'hidden',
}

/**
 * Ячейка галереи: подпись и поповер под ней — левым верхним углом у начала подписи (якорь поповеров
 * ячейки — подпись, `StaticPopupsContext`); кнопки, открывающие поповер, скрыты.
 */
const Cell = ({
  title,
  width = 340,
  height = 420,
  children,
}: {
  title: StoryText | string
  width?: number
  height?: number
  children: ReactNode
}) => {
  const t = useStoryText()
  const caption = useRef<HTMLElement>(null)
  const anchor = useMemo(() => ({ anchor: caption }), [])
  return (
    <figure style={{ margin: 0, width, height, flex: 'none' }}>
      <figcaption ref={caption} style={CAPTION_STYLE}>
        {t(title)}
      </figcaption>
      <StaticPopupsContext.Provider value={anchor}>
        <div data-gallery-anchor="" style={HIDDEN_STYLE}>
          {children}
        </div>
      </StaticPopupsContext.Provider>
    </figure>
  )
}

/**
 * Ячейка истории кита: её рендер целиком под подписью, холст и кнопки холста скрыты. История, чей
 * поповер открывает нажатие (`press`), открывается нажатием на свою кнопку после монтирования.
 */
const KitCell = ({
  title,
  story,
  press,
  height = 420,
}: {
  title: StoryText
  story: () => ReactNode
  press?: string
  height?: number
}) => {
  const Story = story
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!press) return
    const timer = window.setInterval(() => {
      const button = ref.current?.querySelector<HTMLElement>(press)
      if (!button) return
      button.click()
      window.clearInterval(timer)
    }, 100)
    return () => window.clearInterval(timer)
  }, [press])
  return (
    <Cell title={title} height={height}>
      <div ref={ref} data-gallery-kit="">
        <Story />
      </div>
    </Cell>
  )
}

const headerContext = (table: AnyTable, columnId: string) =>
  table
    .getHeaderGroups()[0]
    .headers.find((header: AnyTable) => header.column.id === columnId)
    .getContext()

const headerActions = (table: AnyTable, context: unknown): SlotAction[] =>
  (table.getSlotActions()?.rightHeaderSlot ?? []).filter(
    (action: SlotAction) => action.visible?.(context as never) ?? true,
  )

const KebabMenu = ({
  table,
  columnId,
}: {
  table: AnyTable
  columnId: string
}) => {
  const labels = useLocalization()
  const context = headerContext(table, columnId)
  const actions = headerActions(table, context)
  const kebab = useKebabState(
    actions as never,
    context,
    { label: labels.headerMenu, ariaLabel: labels.headerMenu },
    true,
    noop,
  )
  return (
    <ActionMenu
      actions={actions}
      context={context}
      open
      onOpenChange={noop}
      kebab={kebab}
    />
  )
}

const HeaderAction = ({
  table,
  columnId,
  actionId,
}: {
  table: AnyTable
  columnId: string
  actionId: string
}) => {
  const context = headerContext(table, columnId)
  const action = headerActions(table, context).find(
    item => item.id === actionId,
  )
  if (!action) return null
  return action.panel ? (
    <ActionPanel action={action} context={context} open onOpenChange={noop} />
  ) : (
    <ActionInlineMenu
      action={action}
      context={context}
      open
      onOpenChange={noop}
    />
  )
}

const cellOf = (table: AnyTable, rowIndex: number, columnId: string) =>
  table
    .getRowModel()
    .rows[rowIndex].getAllCells()
    .find((cell: AnyTable) => cell.column.id === columnId)

const Editor = ({
  table,
  columnId,
  editor: EditorComponent,
}: {
  table: AnyTable
  columnId: string
  editor: (props: CellEditorProps) => ReactNode
}) => {
  const cell = cellOf(table, 1, columnId)
  const value = cell.getValue()
  return (
    <EditorComponent
      value={value}
      text={String(value ?? '')}
      label={`Edit ${columnId}`}
      commit={noop}
      commitText={noop}
      cancel={noop}
      setDraft={noop}
      setText={noop}
      cell={cell.getContext()}
    />
  )
}

/**
 * «Настройки вида»: первый уровень или раздел — раздел открывается нажатием на его строку, как у
 * пользователя: снаружи поповер раздел не открывает. Поповер находим по его кнопке в ячейке.
 */
const ViewSettingsAt = ({
  table,
  section,
}: {
  table: AnyTable
  section?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!section) return
    const timer = window.setInterval(() => {
      const trigger = ref.current?.querySelector('[aria-controls]')
      const id = trigger?.getAttribute('aria-controls')
      const row = (
        id ? document.getElementById(id) : null
      )?.querySelector<HTMLElement>(`[data-view-settings-section="${section}"]`)
      if (!row) return
      row.click()
      window.clearInterval(timer)
    }, 100)
    return () => window.clearInterval(timer)
  }, [section])
  return (
    <div ref={ref}>
      <ViewSettingsPopover
        table={table}
        label="View settings"
        icon={<span />}
        count={3}
        open
        onOpenChange={noop}
      />
    </div>
  )
}

const ContextMenu = ({
  table,
  x,
  y,
}: {
  table: AnyTable
  x: number
  y: number
}) => {
  const labels = useLocalization()
  // Ячейка с черновиком: в меню — опасный «Roll back» (ADR 0206).
  const cell = table
    .getRow(DRAFT_ROW)
    .getAllCells()
    .find((item: AnyTable) => item.column.id === 'name')
  const context = {
    ...cell.getContext(),
    selection: {
      count: 1,
      isSingle: true,
      isMultiple: false,
      isInSelection: true,
    },
  }
  const actions = resolveVisibleActions(
    table.getContextMenuActions?.() ?? [],
    context,
  )
  return (
    <ContextMenuPopup
      x={x}
      y={y}
      actions={actions}
      context={context}
      labels={labels}
      onClose={noop}
    />
  )
}

const GridPopups = () => {
  const plugins = useMemo(() => [...argsToPlugins(TOGGLES), GALLERY_SEED], [])
  const table: AnyTable = useCreateTable({
    columns: COLUMNS,
    data: ROWS,
    plugins,
    timeZone: 'UTC',
    initialDrafts: DRAFTS,
  } as never)
  const icon = <span />
  return (
    <>
      <Cell title={{ ru: 'Меню колонки', en: 'Column menu' }} height={360}>
        <KebabMenu table={table} columnId="tags" />
      </Cell>
      <Cell
        title={{
          ru: 'Мини-меню кнопки заголовка',
          en: 'Header button mini menu',
        }}
        height={140}
      >
        <HeaderAction table={table} columnId="name" actionId="columnPinning" />
      </Cell>
      <Cell
        title={{ ru: 'Панель фильтра: текст', en: 'Filter panel: text' }}
        height={220}
      >
        <HeaderAction
          table={table}
          columnId="name"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell
        title={{ ru: 'Панель фильтра: варианты', en: 'Filter panel: options' }}
        height={360}
      >
        <HeaderAction
          table={table}
          columnId="status"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell
        title={{ ru: 'Панель фильтра: дата', en: 'Filter panel: date' }}
        height={480}
      >
        <HeaderAction
          table={table}
          columnId="released"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell title={{ ru: 'Контекстное меню', en: 'Context menu' }} height={360}>
        {/* Точку меню заменяет якорь ячейки — её подпись. */}
        <ContextMenu table={table} x={0} y={0} />
      </Cell>
      <Cell title={{ ru: 'Настройки вида', en: 'View settings' }} height={260}>
        <ViewSettingsAt table={table} />
      </Cell>
      <Cell
        title={{ ru: 'Настройки вида: фильтры', en: 'View settings: filters' }}
        height={300}
      >
        <ViewSettingsAt table={table} section="filter" />
      </Cell>
      <Cell
        title={{
          ru: 'Настройки вида: сортировка',
          en: 'View settings: sorting',
        }}
        height={260}
      >
        <ViewSettingsAt table={table} section="sorting" />
      </Cell>
      <Cell
        title={{ ru: 'Настройки вида: колонки', en: 'View settings: columns' }}
        height={480}
      >
        <ViewSettingsAt table={table} section="columns" />
      </Cell>
      <Cell title={{ ru: 'Выгрузка', en: 'Export' }} height={420}>
        <ExportPanel
          table={table}
          axes={resolveAxes(table)!}
          busy={false}
          pending={false}
          open
          onOpenChange={noop}
          onRun={noop}
        />
      </Cell>
      <Cell title={{ ru: 'Размер страницы', en: 'Page size' }} height={240}>
        <PageSizeSelect
          label="Rows per page"
          pageSize={20}
          pageSizes={[10, 20, 50, 100]}
          onChange={noop}
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell title={{ ru: 'Правка даты', en: 'Date editing' }} height={480}>
        <Editor table={table} columnId="released" editor={DateEditor} />
      </Cell>
      <Cell
        title={{ ru: 'Правка варианта', en: 'Option editing' }}
        height={360}
      >
        <Editor table={table} columnId="status" editor={SelectEditor} />
      </Cell>
      <Cell
        title={{
          ru: 'Правка нескольких вариантов',
          en: 'Multiple option editing',
        }}
        height={420}
      >
        <Editor table={table} columnId="tags" editor={MultiSelectEditor} />
      </Cell>
      <Cell title={{ ru: 'Журнал отказов', en: 'Failure log' }} height={300}>
        <FailureLogPopover
          table={table}
          label="Failures"
          icon={icon}
          count={1}
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell
        title={{ ru: 'История изменений', en: 'Change history' }}
        height={300}
      >
        <HistoryPopover
          table={table}
          label="Change history"
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell
        title={{ ru: 'Несохранённые изменения', en: 'Unsaved changes' }}
        height={300}
      >
        <UnsavedChangesPopover
          table={table}
          label="Unsaved changes"
          icon={icon}
          count={1}
          open
          onOpenChange={noop}
        />
      </Cell>
    </>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const KIT_MODULES = [
  ['Surface', SurfaceStories],
  ['Item', ItemStories],
  ['Group', GroupStories],
  ['Panel', PanelStories],
  ['Levels', LevelsStories],
  ['NavItem', NavItemStories],
  ['SkeletonRows', SkeletonRowsStories],
  ['Entry', EntryStories],
  ['MenuItems', MenuItemsStories],
  ['MenuSections', MenuSectionsStories],
  ['HandleMenu', HandleMenuStories],
  ['Checklist', ChecklistStories],
  ['Calendar', CalendarStories],
  ['CellIssue', CellIssueStories, 'button[aria-describedby]'],
] as const

const KitPopups = () =>
  KIT_MODULES.flatMap(([name, module, press]) =>
    Object.entries(composeStories(module as never)).map(([key, Story]) => (
      <KitCell
        key={`${name}-${key}`}
        title={{
          ru: `Кит ${name} — ${(Story as { storyName?: string }).storyName ?? key}`,
          en: `Kit ${name} — ${(Story as { storyName?: string }).storyName ?? key}`,
        }}
        story={Story as () => ReactNode}
        press={press}
      />
    )),
  )

/*
 * Модальный список запирает прокрутку страницы — галерея её возвращает.
 */
const GALLERY_STYLE = ['html, body { overflow: auto !important; }'].join(' ')

const pageStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 24,
}

/** Начальный фокус открытых поповеров прокручивает страницу к себе — галерея начинается сверху. */
const useStartAtTop = () =>
  useEffect(() => {
    const timers = [100, 600, 1500, 3000].map(delay =>
      window.setTimeout(() => window.scrollTo(0, 0), delay),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [])

const Gallery = () => {
  useStartAtTop()
  return (
    <UiCanvas>
      <style>{GALLERY_STYLE}</style>
      <Toolbar.Root style={pageStyle}>
        <GridPopups />
        <KitPopups />
      </Toolbar.Root>
    </UiCanvas>
  )
}

/** Все поповеры разом: грид, плагины и кит. */
export const PopupGallery: StoryObj = {
  name: 'All popups',
  render: () => <Gallery />,
}
