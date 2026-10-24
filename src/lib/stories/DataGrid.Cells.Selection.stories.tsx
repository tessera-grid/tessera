import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { expect, userEvent } from 'storybook/test'
import {
  cellOf,
  copyFrom,
  dragCells,
  isSelected,
  pressCell,
  selectedCells,
  untilDone,
} from './__mocks__/cellGestures'
import {
  consoleText,
  guideNext,
  rowAt,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/** Выделение ячеек (ADR 0029); выделение командой приложения без жестов (ADR 0120). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Selection',
} satisfies Meta<StoryProps>

export default meta

export const CellSelectionPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
    'enableKeyboardNavigation',
  ]),
  args: {
    enableCellSelection: true,
    // Нажатие выделяет ячейку, с Shift и протяжкой — диапазон, с Ctrl/Cmd — ещё один
    // диапазон; Ctrl/Cmd+C копирует выделение, с клавиатурой Shift и стрелки расширяют.
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
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

const GRID = { columnCount: 8, dataCount: 40, height: '360' }

// --- ADR 0029 S1 ---------------------------------------------------------------------

const FIRST = { row: 'item-id-1', column: 'firstName' }
const FIRST_END = { row: 'item-id-3', column: 'age' }
const SECOND = { row: 'item-id-6', column: 'firstName' }
const SECOND_END = { row: 'item-id-7', column: 'age' }
/** Прямоугольник 3 × 3 и прямоугольник 2 × 3: колонки от имени до возраста. */
const FIRST_CELLS = 9
const BOTH_CELLS = 15

const at = (root: ParentNode, cell: { row: string; column: string }) =>
  cellOf(root, cell.row, cell.column)!

const selectOne = (root: HTMLElement) => {
  if (!isSelected(at(root, FIRST)) || selectedCells(root) !== 1)
    pressCell(at(root, FIRST))
}

/** От одной выделенной ячейки — диапазон с Shift; иначе выделение начинается заново. */
const selectFirstRange = (root: HTMLElement) => {
  if (selectedCells(root) === 1 && isSelected(at(root, FIRST)))
    pressCell(at(root, FIRST_END), { shiftKey: true })
  else pressCell(at(root, FIRST))
}

const selectBothRanges = (root: HTMLElement) => {
  if (selectedCells(root) === FIRST_CELLS)
    dragCells(at(root, SECOND), at(root, SECOND_END), { ctrlKey: true })
  else selectFirstRange(root)
}

const RANGE: readonly GuideStoryStep[] = [
  {
    title: 'Ячейка выделена',
    hint: 'Пользователь щёлкнул ячейку. Она выделена и стала активной.',
    enter: untilDone(
      root => isSelected(at(root, FIRST)) && selectedCells(root) === 1,
      selectOne,
    ),
  },
  {
    title: 'Диапазон выделен',
    hint: 'Пользователь щёлкнул другую ячейку с зажатым Shift. Выделен прямоугольник между ними, у него общий контур.',
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedCells(root) === FIRST_CELLS,
      selectFirstRange,
    ),
  },
  {
    title: 'Второй диапазон',
    hint: 'Пользователь протянул выделение по другим ячейкам с зажатым Ctrl (Cmd на Mac). Добавился второй диапазон, первый остался.',
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedCells(root) === BOTH_CELLS,
      selectBothRanges,
    ),
  },
  {
    title: 'Выделение скопировано',
    hint: 'Пользователь нажал Ctrl+C. Значения обоих диапазонов попали в буфер — таблицей и текстом через табуляцию, а в консоли появилась запись о копировании.',
    states: ['body.cellRange'],
    enter: root => {
      const copied = { done: false }
      untilDone(
        () => copied.done,
        () => {
          if (selectedCells(root) !== BOTH_CELLS) selectBothRanges(root)
          else {
            copyFrom(at(root, FIRST))
            copied.done = true
          }
        },
      )(root, undefined)
    },
  },
]

/** ADR 0029, S1: пользователь выделяет ячейку, диапазон, второй диапазон и копирует. */
export const CellSelectionRange: StoryObj<StoryProps> = {
  name: 'Select and copy',
  parameters: { scenario: '0029/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выделение и копирование"
      steps={RANGE}
      args={guideArgs({ enableCellSelection: true, ...GRID }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RANGE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(1))
      expect(isSelected(at(canvas, FIRST))).toBe(true)
    })
    await step(RANGE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(FIRST_CELLS))
    })
    await step(RANGE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(BOTH_CELLS))
    })
    await step(RANGE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(consoleText()).toContain('copy'))
      const data = copyFrom(at(canvas, FIRST))
      // Строки обоих диапазонов, ячейки строки — через табуляцию.
      expect(
        data.getData('text/plain').split('\n').length,
      ).toBeGreaterThanOrEqual(5)
      expect(data.getData('text/plain')).toContain('\t')
      expect(data.getData('text/html')).toContain('<table')
      expect(selectedCells(canvas)).toBe(BOTH_CELLS)
      await settle()
    })
  },
}

// --- ADR 0029 S2 ---------------------------------------------------------------------

const ACROSS = { row: 'item-id-3', column: 'visits' }
/** Три строки по колонкам от имени до визитов — четыре колонки без возраста. */
const ACROSS_CELLS = 12

const PREDICATE: readonly GuideStoryStep[] = [
  {
    title: 'Колонку возраста выделять нельзя',
    hint: 'Приложение запретило выделять ячейки возраста, и щелчок по ним выделения не даёт.',
  },
  {
    title: 'Диапазон через запрещённую колонку',
    hint: 'Пользователь выделил с Shift диапазон поперёк таблицы. Ячейки возраста в него не вошли, остальные выделены.',
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedCells(root) === ACROSS_CELLS,
      root => {
        if (!isSelected(at(root, FIRST))) pressCell(at(root, FIRST))
        else pressCell(at(root, ACROSS), { shiftKey: true })
      },
    ),
  },
]

/** ADR 0029, S2: приложение запрещает выделять колонку — диапазон её пропускает. */
export const CellSelectionPredicate: StoryObj<StoryProps> = {
  name: 'Forbidden column',
  parameters: { scenario: '0029/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Запрет выделения колонки"
      steps={PREDICATE}
      args={guideArgs(
        {
          enableCellSelection: true,
          cellSelectionCanSelectCell: cell => cell.column.id !== 'age',
          ...GRID,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const age = () => cellOf(canvas, FIRST.row, 'age')!
    await step(PREDICATE[0]!.title, async () => {
      await waitForRows(canvas)
      pressCell(age())
      await settle()
      expect(selectedCells(canvas)).toBe(0)
    })
    await step(PREDICATE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(ACROSS_CELLS))
      expect(isSelected(age())).toBe(false)
      expect(isSelected(cellOf(canvas, FIRST.row, 'visits'))).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0120, S7 --------------------------------------------------------------------

const FOUND = [
  {
    anchorRowId: 'item-id-1',
    anchorColumnId: 'firstName',
    focusRowId: 'item-id-3',
    focusColumnId: 'lastName',
  },
]

const CLICKED = { row: 'item-id-6', column: 'country' }

const selectedCellIds = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      ".data-grid__body-cell[data-cell-selected='true']",
    ),
  ].map(
    cell =>
      `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}/${cell.dataset.columnId}`,
  )

const BY_COMMAND: readonly GuideStoryStep[] = [
  {
    title: 'Выделения нет',
    hint: 'Приложение подключило подсветку выделения без жестов: мышью и клавишами выделить нельзя, копировать нечего.',
    props: () => ({
      enableCellSelectionModel: true,
      enableKeyboardNavigation: true,
    }),
  },
  {
    title: 'Приложение выделяет найденное',
    hint: 'Приложение нашло значения и выделило их своей командой. Найденные ячейки обведены общим контуром.',
    states: ['body.cellRange'],
    props: () => ({ cellSelectionModelCellSelection: FOUND }),
  },
  {
    title: 'Щелчок не меняет выделение',
    hint: 'Пользователь щёлкнул ячейку. Она стала активной, а выделение осталось тем, что задало приложение.',
    states: ['body.cellRange'],
    enter: untilDone(
      root =>
        cellOf(root, CLICKED.row, CLICKED.column)?.getAttribute(
          'data-kn-active',
        ) === 'true',
      root => pressCell(cellOf(root, CLICKED.row, CLICKED.column)!),
    ),
  },
]

/** ADR 0120, S7: приложение выделяет диапазон своей командой — модель без жестов мыши. */
export const CellSelectionByCommand: StoryObj<StoryProps> = {
  name: 'By command',
  parameters: {
    scenario: '0120/S7',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выделение командой приложения"
      steps={BY_COMMAND}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const found = [
      'item-id-1/firstName',
      'item-id-1/lastName',
      'item-id-2/firstName',
      'item-id-2/lastName',
      'item-id-3/firstName',
      'item-id-3/lastName',
    ]
    await step(BY_COMMAND[0]!.title, async () => {
      await waitForRows(canvas)
      expect(selectedCellIds(canvas)).toEqual([])
    })
    await step(BY_COMMAND[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCellIds(canvas).sort()).toEqual(found))
    })
    await step(BY_COMMAND[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, CLICKED.row, CLICKED.column)).toHaveAttribute(
          'data-kn-active',
          'true',
        ),
      )
      await userEvent.click(
        rowAt(canvas, 7).querySelector<HTMLElement>(
          '[data-column-id="country"]',
        )!,
      )
      expect(selectedCellIds(canvas).sort()).toEqual(found)
    })
    await settle()
  },
}
