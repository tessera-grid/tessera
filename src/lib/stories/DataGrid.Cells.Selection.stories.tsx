import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { expect } from 'storybook/test'
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
  centerOf,
  consoleText,
  guideNext,
  pollUntil,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Выделение ячеек (ADR 0029); выделение командой приложения без жестов (ADR 0120); выделение
 * едет с углами при сортировке (ADR 0180, S2); маркер в углу диапазона мышью и круги пальца
 * (ADR 0198, S3–S4).
 */
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
    'cellSelectionHandle',
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
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'Приложение включило выделение ячеек. Пользователь ещё ничего не выделял.',
      en: 'The app enabled cell selection. The user has not selected anything yet.',
    },
  },
  {
    title: { ru: 'Ячейка выделена', en: 'A cell is selected' },
    hint: {
      ru: 'Пользователь щёлкнул ячейку. Она выделена и стала активной.',
      en: 'The user clicked a cell. It is now selected and active.',
    },
    enter: untilDone(
      root => isSelected(at(root, FIRST)) && selectedCells(root) === 1,
      selectOne,
    ),
  },
  {
    title: { ru: 'Диапазон выделен', en: 'The range is selected' },
    hint: {
      ru: 'Пользователь щёлкнул другую ячейку с зажатым Shift. Выделен прямоугольник между ними, у него общий контур.',
      en: 'The user clicked another cell while holding Shift. The rectangle between them is selected and has a single outline.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedCells(root) === FIRST_CELLS,
      selectFirstRange,
    ),
  },
  {
    title: { ru: 'Второй диапазон', en: 'A second range' },
    hint: {
      ru: 'Пользователь протянул выделение по другим ячейкам с зажатым Ctrl (Cmd на Mac). Добавился второй диапазон, первый остался.',
      en: 'The user dragged a selection across other cells while holding Ctrl (Cmd on Mac). A second range was added, and the first one remains.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedCells(root) === BOTH_CELLS,
      selectBothRanges,
    ),
  },
  {
    title: { ru: 'Выделение скопировано', en: 'The selection is copied' },
    hint: {
      ru: 'Пользователь нажал Ctrl+C. Значения обоих диапазонов попали в буфер — таблицей и текстом через табуляцию, а в консоли появилась запись о копировании.',
      en: 'The user pressed Ctrl+C. The values of both ranges went to the clipboard, as a table and as tab-separated text, and a copy entry appeared in the console.',
    },
    states: ['body.cellRange'],
    enter: root => {
      const copied = { done: false }
      return untilDone(
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
      title={{ ru: 'Выделение и копирование', en: 'Selecting and copying' }}
      steps={RANGE}
      args={guideArgs({ enableCellSelection: true, ...GRID }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RANGE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(RANGE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(1))
      expect(isSelected(at(canvas, FIRST))).toBe(true)
    })
    await step(RANGE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(FIRST_CELLS))
    })
    await step(RANGE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(BOTH_CELLS))
    })
    await step(RANGE[4]!.title.ru, async () => {
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
    title: {
      ru: 'Колонку возраста выделять нельзя',
      en: 'The age column cannot be selected',
    },
    hint: {
      ru: 'Приложение запретило выделять ячейки возраста, и щелчок по ним выделения не даёт.',
      en: 'The app disallowed selecting age cells, so clicking them does not select anything.',
    },
  },
  {
    title: {
      ru: 'Диапазон через запрещённую колонку',
      en: 'A range across a disallowed column',
    },
    hint: {
      ru: 'Пользователь выделил с Shift диапазон поперёк таблицы. Ячейки возраста в него не вошли, остальные выделены.',
      en: 'The user selected a range across the table with Shift. The age cells were left out, and the rest are selected.',
    },
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
      title={{
        ru: 'Запрет выделения колонки',
        en: 'Disallowing selection in a column',
      }}
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
    await step(PREDICATE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      pressCell(age())
      await settle()
      expect(selectedCells(canvas)).toBe(0)
    })
    await step(PREDICATE[1]!.title.ru, async () => {
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
    title: { ru: 'Выделения нет', en: 'No selection' },
    hint: {
      ru: 'Приложение подключило подсветку выделения без жестов: мышью и клавишами выделить нельзя, копировать нечего.',
      en: 'The app enabled selection highlighting without gestures: nothing can be selected with the mouse or keys, and there is nothing to copy.',
    },
    props: () => ({
      enableCellSelectionModel: true,
      enableKeyboardNavigation: true,
    }),
  },
  {
    title: {
      ru: 'Приложение выделяет найденное',
      en: 'The app selects search results',
    },
    hint: {
      ru: 'Приложение нашло значения и выделило их своей командой. Найденные ячейки обведены общим контуром.',
      en: 'The app found some values and selected them with its own command. The found cells share a single outline.',
    },
    states: ['body.cellRange'],
    props: () => ({ cellSelectionModelCellSelection: FOUND }),
  },
  {
    title: {
      ru: 'Щелчок не меняет выделение',
      en: 'A click does not change the selection',
    },
    hint: {
      ru: 'Пользователь щёлкнул ячейку. Она стала активной, а выделение осталось тем, что задало приложение.',
      en: 'The user clicked a cell. It became active, and the selection remains as the app set it.',
    },
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
      title={{
        ru: 'Выделение командой приложения',
        en: 'Selection by an app command',
      }}
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
    await step(BY_COMMAND[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(selectedCellIds(canvas)).toEqual([])
    })
    await step(BY_COMMAND[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCellIds(canvas).sort()).toEqual(found))
    })
    await step(BY_COMMAND[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, CLICKED.row, CLICKED.column)).toHaveAttribute(
          'data-kn-active',
          'true',
        ),
      )
      expect(selectedCellIds(canvas).sort()).toEqual(found)
    })
    await settle()
  },
}

// --- ADR 0180, S2 --------------------------------------------------------------------

const CORNER_A = { row: 'item-id-1', column: 'firstName' }
const CORNER_B = { row: 'item-id-3', column: 'age' }

const cornersSelected = (root: HTMLElement) =>
  isSelected(at(root, CORNER_A)) && isSelected(at(root, CORNER_B))
const sortOf = (root: HTMLElement) =>
  root
    .querySelector('.data-grid__head-cell[data-column-id="firstName"]')
    ?.getAttribute('aria-sort') ?? 'none'
const rowIndexOf = (root: HTMLElement, rowId: string) =>
  root
    .querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${rowId}"]`)
    ?.getAttribute('aria-rowindex')

/** От одной выделенной ячейки — диапазон с Shift; иначе выделение начинается заново. */
const selectCorners = (root: HTMLElement) => {
  if (isSelected(at(root, CORNER_A)) && selectedCells(root) === 1)
    pressCell(at(root, CORNER_B), { shiftKey: true })
  else pressCell(at(root, CORNER_A))
}

const FOLLOWS_SORT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'Строки идут в исходном порядке. Пользователь ещё ничего не выделял.',
      en: 'The rows are in their original order. The user has not selected anything yet.',
    },
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: { ru: 'Диапазон выделен', en: 'The range is selected' },
    hint: {
      ru: 'Пользователь выделил прямоугольник между двумя ячейками. Строки идут в исходном порядке.',
      en: 'The user selected a rectangle between two cells. The rows are in their original order.',
    },
    states: ['body.cellRange'],
    enter: untilDone(cornersSelected, selectCorners),
  },
  {
    title: {
      ru: 'Пользователь отсортировал таблицу',
      en: 'The user sorted the table',
    },
    hint: {
      ru: 'Пользователь отсортировал таблицу по имени. Строки переехали, и выделение переехало вместе с ними: прямоугольник стоит между теми же строками-углами на их новых местах.',
      en: 'The user sorted the table by name. The rows moved, and the selection moved with them: the rectangle spans the same corner rows at their new positions.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => sortOf(root) !== 'none' && cornersSelected(root),
      root => {
        if (!cornersSelected(root)) return selectCorners(root)
        root
          .querySelector<HTMLElement>(
            '.data-grid__head-cell[data-column-id="firstName"] .column-sort__button',
          )
          ?.click()
      },
    ),
  },
]

/** ADR 0180, S2: пользователь выделил диапазон и отсортировал — выделение едет с углами. */
export const CellSelectionFollowsSort: StoryObj<StoryProps> = {
  name: 'Follows sorting',
  parameters: { scenario: '0180/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Выделение едет со строками',
        en: 'The selection moves with the rows',
      }}
      steps={FOLLOWS_SORT}
      // Все строки на экране: углы видны и после сортировки.
      args={guideArgs(
        { ...GRID, dataCount: 8, height: '460', enableCellSelection: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let before: (string | null | undefined)[] = []
    await step(FOLLOWS_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FOLLOWS_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(cornersSelected(canvas)).toBe(true))
      before = [CORNER_A.row, CORNER_B.row].map(id => rowIndexOf(canvas, id))
    })
    await step(FOLLOWS_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sortOf(canvas)).not.toBe('none'))
      await until(() => expect(cornersSelected(canvas)).toBe(true))
      // Углы переехали вместе со строками.
      expect(
        [CORNER_A.row, CORNER_B.row].map(id => rowIndexOf(canvas, id)),
      ).not.toEqual(before)
      await settle()
    })
  },
}

// --- ADR 0198 S3 ---------------------------------------------------------------------

/** Угол, к которому тянут маркер: ниже и правее прежнего диапазона, в виду и в окне 900px. */
const HANDLE_TO = { row: 'item-id-5', column: 'gender' }
/** Пять строк по четырём колонкам: от имени до пола. */
const HANDLE_CELLS = 20

const HANDLE = '[data-range-handle]:not([hidden])'
const handleOf = (root: ParentNode) => root.querySelector<HTMLElement>(HANDLE)

const firstRangeSelected = (root: HTMLElement) =>
  selectedCells(root) === FIRST_CELLS &&
  isSelected(at(root, FIRST)) &&
  isSelected(at(root, FIRST_END))

const handleRangeSelected = (root: HTMLElement) =>
  selectedCells(root) === HANDLE_CELLS &&
  isSelected(at(root, FIRST)) &&
  isSelected(at(root, HANDLE_TO))

/**
 * Протяжка маркера, которую держит шаг: нажатие и движение — события шага, указатель
 * человека её не ведёт и не отпускает; уход с шага отпускает маркер там, где его держали.
 */
const holdHandle = async (root: HTMLElement, step: StepRun) => {
  if (!firstRangeSelected(root)) {
    pressCell(at(root, FIRST))
    pressCell(at(root, FIRST_END), { shiftKey: true })
  }
  await pollUntil(
    () => firstRangeSelected(root) && !!handleOf(root),
    step.signal,
  )
  const marker = handleOf(root)!
  const from = centerOf(marker)
  const to = centerOf(at(root, HANDLE_TO))
  const ours = new WeakSet<Event>()
  let point = from
  const fire = (type: string, target: EventTarget) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
    })
    ours.add(event)
    target.dispatchEvent(event)
  }
  // Щит встаёт на окне раньше слушателей маркера: события человека до них не доходят.
  const shield = (event: Event) => {
    if (!ours.has(event)) event.stopImmediatePropagation()
  }
  const types = ['pointermove', 'pointerup', 'pointercancel']
  for (const type of types) window.addEventListener(type, shield, true)
  let released = false
  // Указатель держится на целевой ячейке, как у человека: панель гайда меняет высоту и
  // сдвигает грид под неподвижной точкой.
  const onTarget = () => {
    const cell = at(root, HANDLE_TO)
    if (!cell) return
    const center = centerOf(cell)
    if (
      Math.abs(center.x - point.x) < 0.5 &&
      Math.abs(center.y - point.y) < 0.5
    )
      return
    point = center
    fire('pointermove', document)
  }
  let keeping = 0
  const keep = () => {
    onTarget()
    keeping = requestAnimationFrame(keep)
  }
  step.onLeave(() => {
    if (released) return
    released = true
    cancelAnimationFrame(keeping)
    onTarget()
    fire('pointerup', document)
    for (const type of types) window.removeEventListener(type, shield, true)
  })
  fire('pointerdown', marker)
  for (let i = 1; i <= 8; i++) {
    step.signal.throwIfAborted()
    point = {
      x: from.x + ((to.x - from.x) * i) / 8,
      y: from.y + ((to.y - from.y) * i) / 8,
    }
    fire('pointermove', document)
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
  if (!released) keeping = requestAnimationFrame(keep)
  await pollUntil(() => handleRangeSelected(root), step.signal)
}

const RANGE_HANDLE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'Приложение включило выделение ячеек с маркером в углу диапазона. Пользователь ещё ничего не выделял.',
      en: 'The app enabled cell selection with a handle in the corner of the range. The user has not selected anything yet.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь выделил диапазон ячеек. В правом нижнем углу выделения — маркер: за него диапазон растягивают и сужают.',
      en: 'The user selected a range of cells. The bottom-right corner of the selection has a handle that you drag to grow or shrink the range.',
    },
    states: ['body.cellRange'],
    enter: untilDone(firstRangeSelected, selectFirstRange),
  },
  {
    title: { ru: 'Пользователь тянет маркер', en: 'The user drags the handle' },
    hint: {
      ru: 'Пользователь взял маркер и тянет его вниз и вправо. Диапазон растёт вслед за указателем, а левый верхний угол остаётся на месте.',
      en: 'The user grabbed the handle and is dragging it down and to the right. The range grows with the pointer, and the top-left corner stays in place.',
    },
    states: ['body.cellRange'],
    enter: stepAction(holdHandle),
  },
  {
    title: {
      ru: 'Пользователь отпустил маркер',
      en: 'The user released the handle',
    },
    hint: {
      ru: 'Пользователь отпустил маркер. Выделен новый диапазон, а маркер — в его правом нижнем углу.',
      en: 'The user released the handle. The new range is selected, with the handle in its bottom-right corner.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => handleRangeSelected(root) && !!handleOf(root),
      root => {
        if (selectedCells(root) === 1 && isSelected(at(root, FIRST)))
          pressCell(at(root, HANDLE_TO), { shiftKey: true })
        else if (!handleRangeSelected(root)) pressCell(at(root, FIRST))
      },
    ),
  },
]

/** Центр маркера — в правом нижнем углу ячейки. */
const expectHandleAtCorner = (root: HTMLElement, cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  const handle = centerOf(handleOf(root)!)
  expect(Math.abs(handle.x - box.right)).toBeLessThanOrEqual(1)
  expect(Math.abs(handle.y - box.bottom)).toBeLessThanOrEqual(1)
}

/** ADR 0198, S3: пользователь подправляет выделенный диапазон маркером мыши. */
export const CellSelectionHandle: StoryObj<StoryProps> = {
  name: 'Range handle',
  parameters: { scenario: '0198/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Маркер диапазона', en: 'The range handle' }}
      steps={RANGE_HANDLE}
      args={guideArgs({ enableCellSelection: true, ...GRID }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RANGE_HANDLE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(RANGE_HANDLE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(firstRangeSelected(canvas)).toBe(true))
      await until(() => expect(handleOf(canvas)).not.toBeNull())
      expectHandleAtCorner(canvas, at(canvas, FIRST_END))
    })
    await step(RANGE_HANDLE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(handleRangeSelected(canvas)).toBe(true))
      expect(handleOf(canvas)!.hasAttribute('data-dragging')).toBe(true)
    })
    await step(RANGE_HANDLE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(handleOf(canvas)!.hasAttribute('data-dragging')).toBe(false),
      )
      await until(() => expect(handleRangeSelected(canvas)).toBe(true))
      await until(() => expectHandleAtCorner(canvas, at(canvas, HANDLE_TO)))
      await settle()
    })
  },
}

// --- ADR 0198 S4 ---------------------------------------------------------------------

const TOUCHED = { row: 'item-id-3', column: 'firstName' }
/** Куда тянут правый нижний круг: та же колонка, ниже. */
const END_TO = { row: 'item-id-5', column: 'firstName' }
/** Куда тянут левый верхний круг: та же колонка, выше. */
const START_TO = { row: 'item-id-1', column: 'firstName' }

const circleOf = (root: ParentNode, corner: 'start' | 'end') =>
  root.querySelector<HTMLElement>(
    `[data-range-handle="${corner}"][data-selection-handle="circle"]:not([hidden])`,
  )
const circlesShown = (root: ParentNode) =>
  !!circleOf(root, 'start') && !!circleOf(root, 'end')

/** Выделены ячейки колонки от строки до строки и стоят круги. */
const touchRange = (root: HTMLElement, from: number, to: number) =>
  selectedCells(root) === to - from + 1 &&
  isSelected(at(root, { row: `item-id-${from}`, column: 'firstName' })) &&
  isSelected(at(root, { row: `item-id-${to}`, column: 'firstName' })) &&
  circlesShown(root)

const touchEvent = (
  type: string,
  target: EventTarget,
  point: { x: number; y: number },
) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 2,
    pointerType: 'touch',
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
  })
  target.dispatchEvent(event)
  return event
}

/** Тап пальцем по ячейке: указатель касания и мышиные события совместимости после него. */
const tapCell = (cell: HTMLElement) => {
  const point = centerOf(cell)
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: point.x,
    clientY: point.y,
  }
  touchEvent('pointerdown', cell, point)
  touchEvent('pointerup', cell, point)
  cell.dispatchEvent(new MouseEvent('mousedown', init))
  cell.focus()
  cell.dispatchEvent(new MouseEvent('mouseup', init))
  cell.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }))
}

/**
 * Протяжка круга пальцем к ячейке. С `step` шаг держит палец: касания человека её не ведут,
 * уход с шага отпускает круг там, где его держали; без `step` круг отпускается сразу.
 */
const dragCircle = async (
  root: HTMLElement,
  corner: 'start' | 'end',
  target: { row: string; column: string },
  step?: StepRun,
) => {
  const circle = circleOf(root, corner)!
  const from = centerOf(circle)
  const to = () => centerOf(at(root, target))
  const ours = new WeakSet<Event>()
  let point = from
  const fire = (type: string, on: EventTarget) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
    })
    ours.add(event)
    on.dispatchEvent(event)
  }
  // Щит встаёт на окне раньше слушателей круга: касания человека до них не доходят.
  const shield = (event: Event) => {
    if (!ours.has(event)) event.stopImmediatePropagation()
  }
  const types = ['pointermove', 'pointerup', 'pointercancel']
  for (const type of types) window.addEventListener(type, shield, true)
  let released = false
  let keeping = 0
  const release = () => {
    if (released) return
    released = true
    cancelAnimationFrame(keeping)
    point = to()
    fire('pointermove', document)
    fire('pointerup', document)
    for (const type of types) window.removeEventListener(type, shield, true)
  }
  step?.onLeave(release)
  fire('pointerdown', circle)
  const end = to()
  for (let i = 1; i <= 8; i++) {
    step?.signal.throwIfAborted()
    point = {
      x: from.x + ((end.x - from.x) * i) / 8,
      y: from.y + ((end.y - from.y) * i) / 8,
    }
    fire('pointermove', document)
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
  if (!step) return release()
  // Палец держится на ячейке, как у человека: панель гайда сдвигает грид под ним.
  const keep = () => {
    const now = to()
    if (Math.abs(now.x - point.x) > 0.5 || Math.abs(now.y - point.y) > 0.5) {
      point = now
      fire('pointermove', document)
    }
    keeping = requestAnimationFrame(keep)
  }
  if (!released) keeping = requestAnimationFrame(keep)
}

/** Ячейка выделена касанием и стоят круги. */
const touchOne = async (root: HTMLElement, signal?: AbortSignal) => {
  await pollUntil(() => !!cellOf(root, TOUCHED.row, TOUCHED.column), signal)
  if (!touchRange(root, 3, 3)) tapCell(at(root, TOUCHED))
  await pollUntil(() => touchRange(root, 3, 3), signal)
}

const TOUCH: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'Приложение включило выделение ячеек. Пользователь ещё не касался таблицы.',
      en: 'The app enabled cell selection. The user has not touched the table yet.',
    },
  },
  {
    title: {
      ru: 'Пользователь коснулся ячейки',
      en: 'The user touched a cell',
    },
    hint: {
      ru: 'Пользователь коснулся ячейки пальцем. Ячейка выделена, а в левом верхнем и правом нижнем углу выделения — круги: за них диапазон растягивают пальцем.',
      en: 'The user touched a cell with a finger. The cell is selected, and the top-left and bottom-right corners of the selection have circles that you drag with a finger to grow the range.',
    },
    states: ['body.cellRangeTouch'],
    enter: stepAction(async (root, step) => {
      await touchOne(root, step.signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь тянет нижний круг',
      en: 'The user drags the bottom circle',
    },
    hint: {
      ru: 'Пользователь тянет правый нижний круг вниз. Диапазон растёт вслед за пальцем, а левый верхний угол остаётся на месте.',
      en: 'The user is dragging the bottom-right circle down. The range grows with the finger, and the top-left corner stays in place.',
    },
    states: ['body.cellRangeTouch'],
    enter: stepAction(async (root, step) => {
      await touchOne(root, step.signal)
      await dragCircle(root, 'end', END_TO, step)
      await pollUntil(() => touchRange(root, 3, 5), step.signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь тянет верхний круг',
      en: 'The user drags the top circle',
    },
    hint: {
      ru: 'Пользователь отпустил нижний круг и тянет левый верхний вверх. Теперь на месте остаётся правый нижний угол, а верхняя граница диапазона следует за пальцем.',
      en: 'The user released the bottom circle and is dragging the top-left one up. Now the bottom-right corner stays in place, and the top edge of the range follows the finger.',
    },
    states: ['body.cellRangeTouch'],
    enter: stepAction(async (root, step) => {
      if (!touchRange(root, 3, 5)) {
        await touchOne(root, step.signal)
        await dragCircle(root, 'end', END_TO)
        await pollUntil(() => touchRange(root, 3, 5), step.signal)
      }
      await dragCircle(root, 'start', START_TO, step)
      await pollUntil(() => touchRange(root, 1, 5), step.signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отпустил круг',
      en: 'The user released the circle',
    },
    hint: {
      ru: 'Пользователь отпустил круг. Выделен новый диапазон, круги — в его углах. Движение пальца по таблице мимо кругов по-прежнему прокручивает её.',
      en: 'The user released the circle. The new range is selected, with circles in its corners. Moving a finger across the table away from the circles still scrolls it.',
    },
    states: ['body.cellRangeTouch'],
    enter: stepAction(async (root, step) => {
      if (touchRange(root, 1, 5)) return
      await touchOne(root, step.signal)
      await dragCircle(root, 'end', END_TO)
      await pollUntil(() => touchRange(root, 3, 5), step.signal)
      await dragCircle(root, 'start', START_TO)
      await pollUntil(() => touchRange(root, 1, 5), step.signal)
    }),
  },
]

const dragging = (root: ParentNode, corner: 'start' | 'end') =>
  circleOf(root, corner)?.hasAttribute('data-dragging') ?? false

/** ADR 0198, S4: пользователь выделяет диапазон пальцем, двигая круги в углах. */
export const CellSelectionTouch: StoryObj<StoryProps> = {
  name: 'Select by touch',
  parameters: { scenario: '0198/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Выделение пальцем', en: 'Selecting by touch' }}
      steps={TOUCH}
      args={guideArgs({ enableCellSelection: true, ...GRID }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TOUCH[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(TOUCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(touchRange(canvas, 3, 3)).toBe(true))
      expectHandleAtCorner(canvas, at(canvas, TOUCHED))
    })
    await step(TOUCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(touchRange(canvas, 3, 5)).toBe(true))
      await until(() => expect(dragging(canvas, 'end')).toBe(true))
    })
    await step(TOUCH[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(touchRange(canvas, 1, 5)).toBe(true))
      await until(() => expect(dragging(canvas, 'start')).toBe(true))
    })
    await step(TOUCH[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(dragging(canvas, 'start')).toBe(false))
      await until(() => expect(touchRange(canvas, 1, 5)).toBe(true))
      expectHandleAtCorner(canvas, at(canvas, END_TO))
      await settle()
    })
  },
}
