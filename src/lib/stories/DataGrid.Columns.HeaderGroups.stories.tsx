import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { groupedColumns } from './__mocks__/columns'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Группы колонок (ADR 0049): многоуровневая шапка — группы над колонками, колонки разной
 * глубины растянуты до низа шапки. `Playground` — песочница, S1 — сценарий.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Header groups',
} satisfies Meta<StoryProps>

export default meta

const NESTED_COLUMNS = 'Колонки задаёт вложенная шапка'

export const HeaderGroupsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    headerNesting: 'nested',
  },
  parameters: {
    ...vrStates('head.nested'),
    ...showControls(
      [
        'headerNesting',
        'enableRowSelection',
        'enableRowExpanding',
        'enableRowDragging',
        'enableRowActions',
        'dataNesting',
        'enableColumnVisibility',
      ],
      {
        columnCount: NESTED_COLUMNS,
        rowHeight: 'На шапку не влияет',
      },
    ),
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

// --- Чтение шапки в `play` и шагах -------------------------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const TITLE = '.data-grid__cell-wrapper-title'

const box = (element: Element) => element.getBoundingClientRect()
const headOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__head')!
const headCellsOf = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>(HEAD_CELL),
]
const headCellOf = (root: ParentNode, id: string) =>
  headCellsOf(root).find(cell => cell.dataset.columnId === id)
const headIdsOf = (root: ParentNode) =>
  headCellsOf(root).map(cell => cell.dataset.columnId ?? '')
/** Число строк шапки — по верхним краям её ячеек. */
const headRowsOf = (root: ParentNode) =>
  new Set(headCellsOf(root).map(cell => Math.round(box(cell).top))).size
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)

/** Ячейка шапки занимает всю её высоту. */
const expectFullHeight = (root: ParentNode, cell: HTMLElement) => {
  near(box(cell).top, box(headOf(root)).top)
  near(box(cell).bottom, box(headOf(root)).bottom)
}

// --- S1 ------------------------------------------------------------------------------

type ColumnDefs = NonNullable<StoryProps['columnsOverride']>
const leavesOf = (columns: ColumnDefs): ColumnDefs =>
  columns.flatMap(column =>
    'columns' in column && column.columns
      ? leavesOf([...column.columns])
      : [column],
  )
const FLAT_COLUMNS = leavesOf(groupedColumns)

const SERVICE_COLUMNS = [
  'actionColumn__rowSelection',
  'actionColumn__rowExpanding',
  'actionColumn__rowDragging',
  'actionColumn__rowActions',
]
const serviceCellsOf = (root: ParentNode, id: string) =>
  headCellsOf(root).filter(cell => cell.dataset.columnId?.startsWith(id))

const GROUPED: readonly GuideStoryStep[] = [
  {
    title: 'Шапка в одну строку',
    hint: 'Таблица отображает колонки без группировки. Все заголовки расположены в одну строку.',
    props: () => ({ columnsOverride: FLAT_COLUMNS }),
  },
  {
    title: 'Колонки сгруппированы',
    hint: 'Приложение объединило колонки в группы разной глубины. Заголовок группы расположен над её колонками, а колонка вне группы растягивается до низа шапки. Подписи всех колонок стоят на одной нижней линии.',
    props: () => ({ columnsOverride: groupedColumns }),
  },
  {
    title: 'Служебные колонки',
    hint: 'Приложение включило функции, которые добавляют служебные колонки: выбор, раскрытие и перетаскивание строк, действия строки. Заголовок каждой служебной колонки занимает всю высоту шапки.',
    props: () => ({
      enableRowSelection: true,
      enableRowExpanding: true,
      rowExpandingColumn: 'always',
      enableRowDragging: true,
      enableRowActions: true,
    }),
  },
]

/** ADR 0049, S1: приложение группирует колонки в многоуровневую шапку. */
export const HeaderGrouped: StoryObj<StoryProps> = {
  name: 'Grouped columns',
  parameters: {
    scenario: '0049/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Многоуровневая шапка"
      steps={GROUPED}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(GROUPED[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(headRowsOf(canvas)).toBe(1)
      await expect(headIdsOf(canvas)).not.toContain('name')
    })
    await step(GROUPED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(headRowsOf(canvas)).toBe(3))
      near(
        box(headCellOf(canvas, 'name')!).bottom,
        box(headCellOf(canvas, 'firstName')!).top,
      )
      expectFullHeight(canvas, headCellOf(canvas, 'country')!)
      const titleBottom = (id: string) =>
        box(headCellOf(canvas, id)!.querySelector(TITLE)!).bottom
      for (const id of ['firstName', 'visits', 'total'])
        near(titleBottom(id), titleBottom('age'))
      await settle()
    })
    await step(GROUPED[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          SERVICE_COLUMNS.every(id => serviceCellsOf(canvas, id).length > 0),
        ).toBe(true),
      )
      for (const id of SERVICE_COLUMNS) {
        const cells = serviceCellsOf(canvas, id)
        await expect(cells, id).toHaveLength(1)
        expectFullHeight(canvas, cells[0]!)
      }
      await settle()
    })
  },
}
