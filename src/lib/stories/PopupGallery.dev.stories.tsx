/**
 * Временная галерея поповеров (замечание автора 2026-11-09): все поповеры грида, плагинов и кита
 * сразу открытыми на одной странице — для сравнения вида глазами. Грид не рисуется: таблица — только
 * модель (`useCreateTable`), поповеры плагинов получают её пропом; якоря невидимы. Истории кита —
 * их собственные рендеры. Только `storybook dev`, удаляется после приёмки вида.
 */
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import { composeStories, type Meta, type StoryObj } from '@storybook/react'

import type { Draft } from '../core/drafts/drafts'
import type { Failure } from '../core/failures/failuresFeature'
import { resolveVisibleActions, type SlotAction } from '../core/headerActions'
import { useLocalization } from '../core/localization'
import { useTableState } from '../core/reactivity'
import { useCreateTable } from '../core/useCreateTable'
import { ActionInlineMenu } from '../grid/headerActions/ActionInlineMenu'
import { ActionMenu } from '../grid/headerActions/ActionMenu'
import { ActionPanel } from '../grid/headerActions/ActionPanel'
import { useKebabState } from '../grid/headerActions/useKebabState'
import { DateEditor } from '../plugins/cellEditing/DateEditor'
import {
  MultiSelectEditor,
  SelectEditor,
} from '../plugins/cellEditing/OptionEditors'
import type { CellEditorProps } from '../plugins/cellEditing/types'
import { FilterSummaryPopover } from '../plugins/columnFiltering/FilterSummaryPopover'
import { filterSummaryOf } from '../plugins/columnFiltering/filterSummary'
import { ColumnVisibilityPopover } from '../plugins/columnVisibility/ColumnVisibilityPopover'
import { ContextMenuPopup } from '../plugins/contextMenu/ContextMenuPopup'
import { ExportPanel } from '../plugins/dataExport/ExportPanel'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import { FailureLogPopover } from '../plugins/failureLog/FailureLogPopover'
import { PageSizeSelect } from '../plugins/pagination/PageSizeSelect'
import { UnsavedChangesPopover } from '../plugins/unsavedChanges/UnsavedChangesPopover'
import { UiCanvas } from './__mocks__/UiCanvas'
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
import * as PanelStories from './UI.PopupPanel.stories'
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
} as FeatureToggles

const noop = () => {}

/** Фильтры, запись журнала и скрытая колонка с сортировкой — до первого показа поповеров. */
const GALLERY_SEED = seed<AnyTable>('popupGallerySeed', table => {
  table.setColumnFilters([
    { id: 'name', value: { operator: 'contains', value: 'a' } },
    { id: 'status', value: { operator: 'anyOf', value: ['active'] } },
  ])
  table.reportFailure(FAILURE)
  // Скрытая отсортированная колонка — пункт «Колонок» с ластиком (ADR 0204).
  table.setSorting([{ id: 'price', desc: false }])
  table.setColumnVisibility({ price: false })
})

/**
 * Ячейка галереи: подпись и место под поповер; якорь поповера невидим. Якорь — у края ячейки, к
 * которому поповер выровнен: у правого (`align="end"`, их большинство) или у левого.
 */
const Cell = ({
  title,
  align = 'end',
  width = 340,
  height = 420,
  children,
}: {
  title: string
  align?: 'start' | 'end'
  width?: number
  height?: number
  children: ReactNode
}) => (
  <figure style={{ margin: 0, width, height, flex: 'none' }}>
    <figcaption
      style={{ font: '600 12px system-ui', margin: '0 0 4px', opacity: 0.7 }}
    >
      {title}
    </figcaption>
    <div
      data-gallery-anchor=""
      style={{
        visibility: 'hidden',
        display: 'flex',
        justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
      }}
    >
      {children}
    </div>
  </figure>
)

const KIT_INSET = 280

/** Ячейка истории кита: её рендер целиком, кнопка-якорь холста невидима. */
const KitCell = ({
  title,
  story,
  width = 660,
  height = 420,
}: {
  title: string
  story: () => ReactNode
  width?: number
  height?: number
}) => {
  const Story = story
  return (
    <figure style={{ margin: 0, width, height, flex: 'none' }}>
      <figcaption
        style={{ font: '600 12px system-ui', margin: '0 0 4px', opacity: 0.7 }}
      >
        {title}
      </figcaption>
      {/* Якорь холста — правее: поповер, выровненный по концу якоря, не заходит в соседнюю ячейку. */}
      <div data-gallery-kit="" style={{ paddingLeft: KIT_INSET }}>
        <Story />
      </div>
    </figure>
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

const FilterSummary = ({ table }: { table: AnyTable }) => {
  useTableState(table, state => state.columnFilters)
  return (
    <FilterSummaryPopover
      table={table}
      items={filterSummaryOf(table)}
      label="Filters"
      icon={<span />}
      open
      onOpenChange={noop}
    />
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

/** Контекстное меню открывается в точке окна: точка — место ячейки галереи, следует за прокруткой. */
const AtPoint = ({
  children,
}: {
  children: (x: number, y: number) => ReactNode
}) => {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const track = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const measure = () => {
      const { left: x, top: y } = node.getBoundingClientRect()
      setPoint(last => (last?.x === x && last.y === y ? last : { x, y }))
    }
    measure()
    window.addEventListener('scroll', measure, true)
    return () => window.removeEventListener('scroll', measure, true)
  }, [])
  return <div ref={track}>{point && children(point.x, point.y)}</div>
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
      <Cell title="Меню колонки" height={360}>
        <KebabMenu table={table} columnId="tags" />
      </Cell>
      <Cell title="Мини-меню кнопки заголовка" height={140}>
        <HeaderAction table={table} columnId="name" actionId="columnPinning" />
      </Cell>
      <Cell title="Панель фильтра: текст" height={220}>
        <HeaderAction
          table={table}
          columnId="name"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell title="Панель фильтра: варианты" height={360}>
        <HeaderAction
          table={table}
          columnId="status"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell title="Панель фильтра: дата" height={480}>
        <HeaderAction
          table={table}
          columnId="released"
          actionId="columnFiltering"
        />
      </Cell>
      <Cell title="Сводка фильтров" height={300}>
        <FilterSummary table={table} />
      </Cell>
      <Cell title="Контекстное меню" align="start" height={360}>
        <AtPoint>{(x, y) => <ContextMenu table={table} x={x} y={y} />}</AtPoint>
      </Cell>
      <Cell title="«Колонки»" height={480}>
        <ColumnVisibilityPopover
          table={table}
          label="Columns"
          icon={icon}
          count={0}
          active={false}
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell title="Выгрузка" height={420}>
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
      <Cell title="Размер страницы" height={240}>
        <PageSizeSelect
          label="Rows per page"
          pageSize={20}
          pageSizes={[10, 20, 50, 100]}
          onChange={noop}
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell title="Правка даты" align="start" height={480}>
        <Editor table={table} columnId="released" editor={DateEditor} />
      </Cell>
      <Cell title="Правка варианта" align="start" height={360}>
        <Editor table={table} columnId="status" editor={SelectEditor} />
      </Cell>
      <Cell title="Правка нескольких вариантов" align="start" height={420}>
        <Editor table={table} columnId="tags" editor={MultiSelectEditor} />
      </Cell>
      <Cell title="Журнал отказов" height={300}>
        <FailureLogPopover
          table={table}
          label="Failures"
          icon={icon}
          count={1}
          open
          onOpenChange={noop}
        />
      </Cell>
      <Cell title="Несохранённые изменения" height={300}>
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
  ['Entry', EntryStories],
  ['MenuItems', MenuItemsStories],
  ['MenuSections', MenuSectionsStories],
  ['HandleMenu', HandleMenuStories],
  ['Checklist', ChecklistStories],
  ['Calendar', CalendarStories],
  ['CellIssue', CellIssueStories],
] as const

const KitPopups = () =>
  KIT_MODULES.flatMap(([name, module]) =>
    Object.entries(composeStories(module as never)).map(([key, Story]) => (
      <KitCell
        key={`${name}-${key}`}
        title={`Кит ${name} — ${(Story as { storyName?: string }).storyName ?? key}`}
        story={Story as () => ReactNode}
      />
    )),
  )

/*
 * Якоря невидимы — кнопки-триггеры холстов кита (поповеры в портале этим не задеты). Поповер,
 * чей якорь ушёл из окна, Base UI прижимает к краю окна — такой скрыт, пока якорь не вернётся.
 * Модальный список запирает прокрутку страницы — галерея её возвращает.
 */
const GALLERY_STYLE = [
  '[data-gallery-kit] [aria-haspopup], [data-gallery-kit] [aria-expanded] { visibility: hidden; }',
  '[data-anchor-hidden] { visibility: hidden !important; }',
  'html, body { overflow: auto !important; }',
].join(' ')

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
