import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  guideNext,
  rowAt,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/** Выделение ячеек (ADR 0029); выделение командой приложения без жестов (ADR 0120). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Selection',
} satisfies Meta<StoryProps>

export default meta

export const CellSelection: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls([
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
  ]),
  args: {
    enableCellSelection: true,
    // Умеренный грид (обе оси в окне): клик выделяет ячейку, shift-клик/drag —
    // прямоугольный диапазон, ctrl/cmd-клик — мульти-диапазон, Ctrl/Cmd+C копирует
    // выделение в буфер (TSV + HTML). См. ADR 0029.
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

export const CellSelectionPredicate: StoryObj<StoryProps> = {
  name: 'Predicate',
  parameters: showControls([
    'enableCellSelection',
    'cellSelectionRangeSelection',
    'cellSelectionDragSelection',
    'cellSelectionMultiRange',
  ]),
  args: {
    ...CellSelection.args,
    // `canSelectCell` запрещает выделять колонку Age: клик по ней не выделяет, а
    // диапазон через неё её пропускает. Служебные колонки закрыты всегда, предикат
    // только сужает. Функцию в панели не задать — контрола нет.
    cellSelectionCanSelectCell: cell => cell.column.id !== 'age',
  },
}

/** Выделенный диапазон ячеек (ADR 0093, VR4): нажатие и нажатие с Shift. */
export const CellSelectionStateRange: StoryObj<StoryProps> = {
  name: 'State: cell range',
  parameters: {
    ...vrStates('body.cellRange'),
    ...showControls([
      'enableCellSelection',
      'cellSelectionRangeSelection',
      'cellSelectionDragSelection',
      'cellSelectionMultiRange',
    ]),
  },
  args: {
    enableCellSelection: true,
    columnCount: 6,
    dataCount: 20,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const cell = (row: number, column: number) =>
      rowAt(canvasElement, row).querySelectorAll<HTMLElement>(
        '.data-grid__body-cell',
      )[column]!
    const press = (target: HTMLElement, shiftKey = false) => {
      const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
      target.dispatchEvent(new MouseEvent('mousedown', init))
      target.dispatchEvent(new MouseEvent('mouseup', init))
    }
    press(cell(2, 1))
    press(cell(4, 3), true)
    await until(() =>
      expect(
        canvasElement.querySelectorAll('[data-cell-selected="true"]'),
      ).toHaveLength(9),
    )
    await settle()
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
    hint: 'Плагин cellSelectionModel без cellSelection: мышью и клавишами выделить нельзя, Ctrl/Cmd+C ничего не копирует.',
    props: () => ({
      enableCellSelectionModel: true,
      enableKeyboardNavigation: true,
    }),
  },
  {
    title: 'Приложение выделяет найденное',
    hint: 'Команда приложения задаёт срез cellSelection аргументом модели — диапазон подсвечен контуром.',
    props: () => ({ cellSelectionModelCellSelection: FOUND }),
  },
  {
    title: 'Щелчок не меняет выделение',
    hint: 'Пользователь щёлкает ячейку — она становится активной, выделение остаётся тем, что задало приложение.',
  },
]

/** ADR 0120, S7: приложение выделяет диапазон своей командой — модель без жестов мыши. */
export const CellSelectionByCommand: StoryObj<StoryProps> = {
  name: 'By command',
  parameters: {
    scenario: '0120/S7',
    ...showControls(['enableCellSelectionModel']),
  },
  args: {
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  render: args => (
    <GuideStory
      title="Выделение командой приложения"
      steps={BY_COMMAND}
      args={normalizeArgs(args)}
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
    await step(BY_COMMAND[0].title, async () => {
      await waitForRows(canvas)
      expect(selectedCellIds(canvas)).toEqual([])
    })
    await step(BY_COMMAND[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCellIds(canvas).sort()).toEqual(found))
    })
    await step(BY_COMMAND[2].title, async () => {
      await guideNext(canvas)
      await userEvent.click(
        rowAt(canvas, 6).querySelector<HTMLElement>(
          '[data-column-id="country"]',
        )!,
      )
      expect(selectedCellIds(canvas).sort()).toEqual(found)
    })
    await settle()
  },
}
