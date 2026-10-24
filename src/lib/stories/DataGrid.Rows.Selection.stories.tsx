import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { makeData } from './__mocks__/data'
import { pressCell } from './__mocks__/cellGestures'
import { expect, waitFor, userEvent } from 'storybook/test'
import {
  bodyRow,
  guideNext,
  pollUntil,
  releaseFocus,
  settle,
  stepDone,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, stepAction } from './demos/GuideStory'

/** Выбор строк (ADR 0014): флажки, пакетный тулбар, дочерние строки; выбор щелчком без флажков (ADR 0120). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Selection',
} satisfies Meta<StoryProps>

export default meta

// Детерминированное дерево для истории SubRow Selection (генератор, а не
// захардкоженные данные) — 4 родителя × 3 ребёнка, наглядный каскад выбора.
const subRowSelectionTree = makeData({
  shape: 'tree',
  count: 4,
  depth: 2,
  breadth: 3,
})

export const RowSelectionPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
  ]),
  args: {
    enableRowSelection: true,
    // Небольшой набор, целиком помещающийся в вьюпорт: требования «выбрать все
    // на странице» (RS8–RS10, RS12) сверяются со всеми отрисованными строками,
    // поэтому вертикальная виртуализация не должна прятать часть строк.
    dataCount: 10,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

export const BatchRowSelection: StoryObj<StoryProps> = {
  name: 'Batch toolbar',
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enablePagination',
    'paginationInitialPageSize',
    'paginationPageSizes',
    'paginationRevertOnReject',
    'showBatchToolbar',
    'isAllRowsSelected',
  ]),
  args: {
    // Пакетный выбор «все строки» (BatchToolbar) поверх пагинации плагином: выбор
    // живёт по id и переживает смену страницы.
    enableRowSelection: true,
    showBatchToolbar: true,
    isAllRowsSelected: false,
    enablePagination: true,
    paginationInitialPageSize: 5,
    dataCount: 50,
  },
}

export const SubRowSelection: StoryObj<StoryProps> = {
  name: 'Sub-rows',
  args: {
    // Реальное дерево из генератора (раскрыто), чтобы каскад выбора
    // родитель↔дети был нагляден — не на захардкоженных 5 строках.
    dataOverride: subRowSelectionTree,
    initialExpanded: true,

    enableRowSelection: true,
    rowSelectionSubRows: true,
    enableRowExpanding: true,
  },
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
  ]),
}

/** Выбранные строки (ADR 0093, VR4): две строки отмечены флажками. */
export const RowSelectionStateSelected: StoryObj<StoryProps> = {
  name: 'State: selected rows',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes(vrStates('body.selection')),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
    ]),
  },
  args: {
    enableRowSelection: true,
    dataCount: 10,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    for (const row of ['item-id-1', 'item-id-2']) {
      await userEvent.click(
        bodyRow(canvasElement, row).querySelector<HTMLElement>(
          '[role="checkbox"]',
        )!,
      )
    }
    const checked = () =>
      expect(
        bodyRow(canvasElement, 'item-id-2').querySelector('[role="checkbox"]'),
      ).toHaveAttribute('aria-checked', 'true')
    await waitFor(checked)
    // Выбор без кольца фокуса нажатого флажка.
    await releaseFocus()
    checked()
    await settle()
  },
}

// --- ADR 0120, S5 --------------------------------------------------------------------

const rowClickData = makeData({ shape: 'flat', count: 20 })
const rowIdAt = (index: number) => (rowClickData[index] as { id: string }).id
const FIRST_CLICKED = rowIdAt(2)
const SECOND_CLICKED = rowIdAt(5)

const rowSelected = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-selected') === 'true'

/** Действие шага: пользователь щёлкает строку `id`, пока приложение её не выберет. */
const clickRow = (id: string) =>
  stepAction(async (root, { signal }) => {
    await pollUntil(() => !!bodyRow(root, id), signal)
    pressCell(
      bodyRow(root, id).querySelector<HTMLElement>('[role="gridcell"]')!,
    )
    await pollUntil(() => rowSelected(root, id), signal)
  })

const ROW_CLICK: readonly GuideStoryStep[] = [
  {
    title: 'Выбора нет',
    hint: 'Плагин rowSelectionModel без rowSelection: колонки флажков нет. Приложение выбирает строку, которую щёлкнул пользователь, — по колбэку onActiveCellChange клавиатурной навигации — и хранит выбор срезом rowSelection.',
    // Приложение: выбор строки по щелчку, срез выбора — у него до нового открытия грида.
    props: ({ app }) => ({
      enableRowSelectionModel: true,
      enableKeyboardNavigation: true,
      onActiveCellChange: ({ rowIndex }) => {
        if (rowIndex >= 0)
          app.update(() => ({
            rowSelectionModelRowSelection: { [rowIdAt(rowIndex)]: true },
          }))
      },
    }),
  },
  {
    title: 'Щёлкните строку',
    hint: 'Щёлкнутая строка залита выбором и объявлена выбранной (aria-selected).',
    enter: clickRow(FIRST_CLICKED),
  },
  {
    title: 'Щёлкните другую строку',
    hint: 'Выбор переходит на неё: приложение заменяет срез.',
    enter: clickRow(SECOND_CLICKED),
  },
]

/** ADR 0120, S5: пользователь выбирает строку щелчком — модель без колонки флажков. */
export const SelectionByRowClick: StoryObj<StoryProps> = {
  name: 'By row click',
  parameters: {
    scenario: '0120/S5',
    ...showControls(['enableRowSelectionModel', 'rowSelectionModelSubRows']),
  },
  args: {
    dataOverride: rowClickData,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  render: args => (
    <GuideStory
      title="Выбор щелчком по строке"
      steps={ROW_CLICK}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(ROW_CLICK[0].title, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('[role="columnheader"] input')).toBeNull()
      expect(rowSelected(canvas, FIRST_CLICKED)).toBe(false)
    })
    await step(ROW_CLICK[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(bodyRow(canvas, FIRST_CLICKED).getAttribute('aria-selected')).toBe(
        'true',
      )
    })
    await step(ROW_CLICK[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(rowSelected(canvas, FIRST_CLICKED)).toBe(false)
    })
    await settle()
  },
}
