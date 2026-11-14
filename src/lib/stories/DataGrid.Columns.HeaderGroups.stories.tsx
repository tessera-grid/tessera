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

const NESTED_COLUMNS = 'The nested header defines the columns'

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
        rowHeight: 'Does not affect the header',
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
    title: { ru: 'Шапка в одну строку', en: 'A single-row header' },
    hint: {
      ru: 'Таблица отображает колонки без группировки. Все заголовки расположены в одну строку.',
      en: 'The table shows the columns without grouping. All headers sit in one row.',
    },
    props: () => ({ columnsOverride: FLAT_COLUMNS }),
  },
  {
    title: { ru: 'Колонки сгруппированы', en: 'Columns are grouped' },
    hint: {
      ru: 'Приложение объединило колонки в группы разной глубины. Заголовок группы расположен над её колонками, а колонка вне группы растягивается до низа шапки. Подписи всех колонок стоят на одной нижней линии.',
      en: "The app combined the columns into groups of different depths. A group's header sits above its columns, and a column outside any group stretches to the bottom of the header. The labels of all columns sit on the same bottom line.",
    },
    props: () => ({ columnsOverride: groupedColumns }),
  },
  {
    title: { ru: 'Служебные колонки', en: 'Service columns' },
    hint: {
      ru: 'Приложение включило функции, которые добавляют служебные колонки: выбор, раскрытие и перетаскивание строк, действия строки. Заголовок каждой служебной колонки занимает всю высоту шапки.',
      en: "The app turned on features that add service columns: row selection, expanding and dragging, and row actions. Each service column's header cell spans the full height of the header.",
    },
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
      title={{ ru: 'Многоуровневая шапка', en: 'Multi-level header' }}
      steps={GROUPED}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(GROUPED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(headRowsOf(canvas)).toBe(1)
      await expect(headIdsOf(canvas)).not.toContain('name')
    })
    await step(GROUPED[1]!.title.ru, async () => {
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
    await step(GROUPED[2]!.title.ru, async () => {
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

// --- ADR 0207 S1 ---------------------------------------------------------------------

const WIDE_SIZE = 150
const WIDE_LEAVES = 8
/** Широкие группы: неделя из восьми колонок шире видимой части таблицы. */
const WIDE_GROUPS: ColumnDefs = Array.from({ length: 6 }, (_, week) => ({
  id: `week${week + 1}`,
  header: `Week ${week + 1}`,
  columns: Array.from({ length: WIDE_LEAVES }, (_, day) => ({
    id: `week${week + 1}_${day + 1}`,
    header: `Day ${day + 1}`,
    size: WIDE_SIZE,
    accessorFn: (_row: unknown, index: number) =>
      `${(index * 7 + week * 13 + day * 5) % 100}`,
  })),
})) as ColumnDefs
const WEEK = WIDE_SIZE * WIDE_LEAVES

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const scrollColumns = (root: HTMLElement, left: number) => {
  scrollerOf(root).scrollLeft = left
}
const weekTitle = (root: ParentNode, id: string) =>
  headCellOf(root, id)?.querySelector<HTMLElement>(TITLE)

const WIDE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Широкие группы', en: 'Wide groups' },
    hint: {
      ru: 'Колонки сгруппированы по неделям, и каждая неделя шире видимой части таблицы. Подпись группы стоит в начале своей группы.',
      en: "Columns are grouped by week, and each week is wider than the visible part of the table. A group's label sits at the start of its group.",
    },
  },
  {
    title: { ru: 'Прокрутка вбок', en: 'Horizontal scroll' },
    hint: {
      ru: 'Пользователь прокрутил таблицу вправо: начало второй недели ушло за левый край. Подпись группы осталась на экране — у левого края видимой части.',
      en: "The user scrolled the table to the right, and the start of the second week went past the left edge. The group's label stayed on screen, at the left edge of the visible part.",
    },
    enter: root => scrollColumns(root, WEEK + 3 * WIDE_SIZE),
  },
  {
    title: { ru: 'Конец группы', en: 'End of the group' },
    hint: {
      ru: 'Пользователь прокрутил дальше, к концу второй недели. Подпись не выходит за свою группу: она уходит вместе с концом группы, а рядом видна подпись следующей недели.',
      en: "The user scrolled further, to the end of the second week. The label does not leave its group: it moves away with the end of the group, and the next week's label appears beside it.",
    },
    enter: root => scrollColumns(root, 2 * WEEK - 2 * WIDE_SIZE),
  },
]

/** ADR 0207, S1: широкая таблица с группами колонок — прокрутка вбок, подпись группы на экране. */
export const HeaderGroupsWideGroups: StoryObj<StoryProps> = {
  name: 'Wide groups',
  parameters: {
    scenario: '0207/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Широкие группы', en: 'Wide groups' }}
      steps={WIDE}
      args={guideArgs(
        { dataCount: 30, height: '360', columnsOverride: WIDE_GROUPS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WIDE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      // Подпись — в начале группы: от её левого края только отступ ячейки.
      const offset =
        box(weekTitle(canvas, 'week1')!).left -
        box(headCellOf(canvas, 'week1')!).left
      await until(() => expect(offset).toBeGreaterThanOrEqual(0))
      await until(() => expect(offset).toBeLessThanOrEqual(24))
      await settle()
    })
    await step(WIDE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(scrollerOf(canvas).scrollLeft).toBe(WEEK + 3 * WIDE_SIZE),
      )
      await until(() => expect(headCellOf(canvas, 'week1_1')).toBeUndefined())
      const edge = box(scrollerOf(canvas)).left
      await until(() =>
        expect(
          Math.abs(box(weekTitle(canvas, 'week2')!).left - edge),
        ).toBeLessThanOrEqual(1),
      )
      await settle()
    })
    await step(WIDE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(scrollerOf(canvas).scrollLeft).toBe(2 * WEEK - 2 * WIDE_SIZE),
      )
      const group = box(headCellOf(canvas, 'week2')!)
      await until(() =>
        expect(box(weekTitle(canvas, 'week2')!).right).toBeLessThanOrEqual(
          group.right + 1,
        ),
      )
      await until(() => expect(weekTitle(canvas, 'week3')).toBeTruthy())
      await settle()
    })
  },
}
