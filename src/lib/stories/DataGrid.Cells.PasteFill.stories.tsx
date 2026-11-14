import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { REFUSAL } from './__mocks__/heldServer'
import {
  cellOf,
  closeMenu,
  cutFrom,
  dragCells,
  isSelected,
  openMenu,
  pasteInto,
  pressCell,
  pressKey,
  rightClickCell,
  untilDone,
} from './__mocks__/cellGestures'
import {
  byTestId,
  centerOf,
  consoleText,
  expectPopupInCanvas,
  guideNext,
  pollUntil,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { typeInto } from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  type GuideApp,
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import type { TesseraFeatureEntry } from '../core/features'
import type { ContextMenuAction } from '../core/headerActions'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

/**
 * Вставка из буфера, очистка, вырезание, протяжка и массовая правка выделения (ADR 0219): блок
 * из таблицы, одно значение во весь диапазон, ошибки разбора, отказ сервера, черновики, свой
 * пункт приложения, подтверждение вставки, протяжка маркером, ряд, Ctrl+D и Ctrl+Enter.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Paste & fill',
} satisfies Meta<StoryProps>

export default meta

export const CellPastePlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Выделите ячейки возраста, пола или визитов и нажмите Ctrl/Cmd+V с текстом из таблицы;
  // Delete очищает выделение, Ctrl/Cmd+X вырезает. Без вставки — тумблер «paste».
  args: {
    enableCellEditing: true,
    enableCellSelection: true,
    enableKeyboardNavigation: true,
    enableContextMenu: true,
    columnCount: 6,
    dataCount: 20,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls([
    'enableCellEditing',
    'cellEditingSaveMode',
    'enableCellSelection',
    'cellSelectionPaste',
    'enableKeyboardNavigation',
    'enableContextMenu',
  ]),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- «Сервер» и действия шагов --------------------------------------------------------

/** «Сервер» пакетов: придерживает ответ и отказывает пакету целиком, если задано. */
const pasteServer = {
  held: false,
  refuse: false,
  waiting: [] as (() => void)[],
  reset: () => {
    pasteServer.held = false
    pasteServer.refuse = false
    pasteServer.waiting = []
  },
  release: () => {
    pasteServer.held = false
    pasteServer.waiting.splice(0).forEach(answer => answer())
  },
  save: (_batch: CellEditBatch) =>
    new Promise<CellEditBatchResult | void>((resolve, reject) => {
      const answer = () =>
        pasteServer.refuse ? reject(new Error(REFUSAL)) : resolve()
      if (pasteServer.held) pasteServer.waiting.push(answer)
      else answer()
    }),
}

const BASE_ARGS = {
  enableCellEditing: true,
  enableCellSelection: true,
  enableKeyboardNavigation: true,
  columnCount: 6,
  dataCount: 10,
  onCommitEdits: pasteServer.save,
} satisfies Partial<StoryProps>

/** Текст ячейки без кнопок и отметок. */
const textOf = (root: ParentNode, row: string, column: string) => {
  const copy = cellOf(root, row, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim()
}
const pendingAt = (root: ParentNode, row: string, column: string) =>
  cellOf(root, row, column)?.getAttribute('aria-busy') === 'true'
const issueAt = (root: ParentNode, row: string, column: string) =>
  !!cellOf(root, row, column)?.querySelector('[data-cell-issue]')
const draftAt = (root: ParentNode, row: string, column: string) =>
  !!cellOf(root, row, column)?.querySelector('[data-cell-draft]')
const selectedAt = (root: ParentNode, row: string, column: string) =>
  isSelected(cellOf(root, row, column))
const errorBanner = () => byTestId('load-error-banner')

/** Выбрать одну ячейку нажатием. */
const selectCell = (root: HTMLElement, row: string, column: string) => {
  const cell = cellOf(root, row, column)
  if (cell) pressCell(cell)
}

/** Протянуть выделение по колонке от строки `from` до строки `to`. */
const selectRows = (
  root: HTMLElement,
  column: string,
  rows: readonly string[],
) => {
  const from = cellOf(root, rows[0]!, column)
  const to = cellOf(root, rows.at(-1)!, column)
  if (from && to) dragCells(from, to)
}
const rangeSelected = (
  root: ParentNode,
  column: string,
  rows: readonly string[],
) => rows.every(row => selectedAt(root, row, column))

/** Вставка — один раз за проход шага: ответ сервера приходит не сразу. */
let pasted = false
const pasteOnce = (
  root: HTMLElement,
  row: string,
  column: string,
  data: string | DataTransfer,
) => {
  const cell = cellOf(root, row, column)
  if (!cell || pasted) return
  pasted = true
  pasteInto(cell, data)
}

// --- ADR 0219, S1 ---------------------------------------------------------------------

/** Три строки из таблицы: возраст и пол. */
const SHEET = '41\tmale\n42\tfemale\n43\tmale\n'
const SHEET_ROWS = [
  ['item-id-2', '41', 'male'],
  ['item-id-3', '42', 'female'],
  ['item-id-4', '43', 'male'],
] as const

const sheetPasted = (root: ParentNode) =>
  SHEET_ROWS.every(
    ([row, age, gender]) =>
      textOf(root, row, 'age') === age &&
      textOf(root, row, 'gender') === gender &&
      !pendingAt(root, row, 'age'),
  )

const FROM_SPREADSHEET: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов. Пользователь скопировал в другой таблице три строки: возраст и пол.',
      en: 'The app allowed editing the age, gender and visit count. The user copied three rows of age and gender from another table.',
    },
  },
  {
    title: { ru: 'Ячейка выбрана', en: 'A cell is active' },
    hint: {
      ru: 'Пользователь нажал на ячейку возраста во второй строке. С неё начнётся вставка.',
      en: 'The user clicked the age cell in the second row. The paste will start from it.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedAt(root, 'item-id-2', 'age'),
      root => selectCell(root, 'item-id-2', 'age'),
    ),
  },
  {
    title: { ru: 'Блок вставлен', en: 'A block was pasted' },
    hint: {
      ru: 'Пользователь нажал Ctrl+V. Три строки буфера легли в возраст и пол трёх строк подряд, начиная с выбранной ячейки, и вставленный блок выделен. Сервер принял изменения одним запросом, ячейки коротко вспыхнули тоном успеха.',
      en: 'The user pressed Ctrl+V. The three clipboard rows went into the age and gender of three consecutive rows, starting from the active cell, and the pasted block is selected. The server accepted the changes in one request, and the cells flashed briefly in the success tone.',
    },
    states: ['body.cellRange'],
    enter: untilDone(sheetPasted, root => {
      if (!selectedAt(root, 'item-id-2', 'age'))
        selectCell(root, 'item-id-2', 'age')
      else pasteOnce(root, 'item-id-2', 'age', SHEET)
    }),
  },
]

/** ADR 0219, S1: блок из таблицы ложится от выбранной ячейки размером буфера. */
export const PasteFromSpreadsheet: StoryObj<StoryProps> = {
  name: 'Paste from a spreadsheet',
  parameters: { scenario: '0219/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Вставка из таблицы', en: 'Pasting from a spreadsheet' }}
      steps={FROM_SPREADSHEET}
      reset={() => {
        pasteServer.reset()
        pasted = false
      }}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FROM_SPREADSHEET[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FROM_SPREADSHEET[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(selectedAt(canvas, 'item-id-2', 'age')).toBe(true),
      )
    })
    await step(FROM_SPREADSHEET[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sheetPasted(canvas)).toBe(true))
      expect(selectedAt(canvas, 'item-id-4', 'gender')).toBe(true)
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0219, S2 ---------------------------------------------------------------------

const RANGE_ROWS = ['item-id-1', 'item-id-2', 'item-id-3', 'item-id-4']
const ONE_VALUE = '30'
const onePasted = (root: ParentNode) =>
  RANGE_ROWS.every(
    row =>
      textOf(root, row, 'age') === ONE_VALUE && !pendingAt(root, row, 'age'),
  )

const ONE_INTO_RANGE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов. Пользователь скопировал одно число.',
      en: 'The app allowed editing the age, gender and visit count. The user copied a single number.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь протянул выделение по возрасту в четырёх строках.',
      en: 'The user dragged a selection across the age cells in four rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'age', RANGE_ROWS),
      root => selectRows(root, 'age', RANGE_ROWS),
    ),
  },
  {
    title: {
      ru: 'Одно значение во всём диапазоне',
      en: 'One value across the whole range',
    },
    hint: {
      ru: 'Пользователь нажал Ctrl+V. Одно значение из буфера легло во все выделенные ячейки — так правят много ячеек сразу.',
      en: 'The user pressed Ctrl+V. The single value from the clipboard went into all selected cells: this is how you edit many cells at once.',
    },
    states: ['body.cellRange'],
    enter: untilDone(onePasted, root => {
      if (!rangeSelected(root, 'age', RANGE_ROWS))
        selectRows(root, 'age', RANGE_ROWS)
      else pasteOnce(root, RANGE_ROWS[0]!, 'age', ONE_VALUE)
    }),
  },
]

/** ADR 0219, S2: одно значение буфера — во все ячейки выделенного диапазона. */
export const PasteOneIntoRange: StoryObj<StoryProps> = {
  name: 'One value into a range',
  parameters: { scenario: '0219/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Одно значение во весь диапазон',
        en: 'One value into the whole range',
      }}
      steps={ONE_INTO_RANGE}
      reset={() => {
        pasteServer.reset()
        pasted = false
      }}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ONE_INTO_RANGE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ONE_INTO_RANGE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'age', RANGE_ROWS)).toBe(true),
      )
    })
    await step(ONE_INTO_RANGE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(onePasted(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0219, S3 ---------------------------------------------------------------------

/** Фамилия и возраст: фамилию править нельзя, второй возраст — не число. */
const WITH_ERRORS = 'Smith\t31\nDoe\tforty\nRoe\t33'
const ERROR_ROW = 'item-id-2'
const errorsPasted = (root: ParentNode) =>
  textOf(root, 'item-id-1', 'age') === '31' &&
  textOf(root, 'item-id-3', 'age') === '33' &&
  issueAt(root, ERROR_ROW, 'age')

const WITH_ERRORS_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Что можно править', en: 'What can be edited' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов, а фамилию — нет. Пользователь скопировал три строки: фамилию и возраст, и в одной строке возраст записан словом.',
      en: 'The app allowed editing the age, gender and visit count, but not the last name. The user copied three rows of last name and age, and in one row the age is written as a word.',
    },
  },
  {
    title: { ru: 'Ячейка выбрана', en: 'A cell is active' },
    hint: {
      ru: 'Пользователь нажал на ячейку фамилии в первой строке. С неё начнётся вставка.',
      en: 'The user clicked the last name cell in the first row. The paste will start from it.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => selectedAt(root, 'item-id-1', 'lastName'),
      root => selectCell(root, 'item-id-1', 'lastName'),
    ),
  },
  {
    title: { ru: 'Вставлено, кроме ошибок', en: 'Pasted, except for errors' },
    hint: {
      ru: 'Пользователь нажал Ctrl+V. Фамилии не изменились: их править нельзя. Два числа легли в возраст. Слово не разобралось как число: эта ячейка не изменилась, в её углу отметка с причиной.',
      en: 'The user pressed Ctrl+V. The last names did not change because they cannot be edited. Two numbers went into the age. The word could not be parsed as a number: that cell did not change, and its corner has a mark with the reason.',
    },
    states: ['body.error'],
    enter: untilDone(errorsPasted, root => {
      if (!selectedAt(root, 'item-id-1', 'lastName'))
        selectCell(root, 'item-id-1', 'lastName')
      else pasteOnce(root, 'item-id-1', 'lastName', WITH_ERRORS)
    }),
  },
]

/** ADR 0219, S3: часть ячеек только для чтения, часть не разобрана — годные записаны. */
export const PasteWithErrors: StoryObj<StoryProps> = {
  name: 'Read-only and invalid cells',
  parameters: { scenario: '0219/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Вставка с ошибками', en: 'Pasting with errors' }}
      steps={WITH_ERRORS_STEPS}
      reset={() => {
        pasteServer.reset()
        pasted = false
      }}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let lastNames: (string | undefined)[] = []
    await step(WITH_ERRORS_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      lastNames = ['item-id-1', 'item-id-2', 'item-id-3'].map(row =>
        textOf(canvas, row, 'lastName'),
      )
    })
    await step(WITH_ERRORS_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(selectedAt(canvas, 'item-id-1', 'lastName')).toBe(true),
      )
    })
    await step(WITH_ERRORS_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(errorsPasted(canvas)).toBe(true))
      expect(
        ['item-id-1', 'item-id-2', 'item-id-3'].map(row =>
          textOf(canvas, row, 'lastName'),
        ),
      ).toEqual(lastNames)
      await settle()
    })
  },
}

// --- ADR 0219, S4 ---------------------------------------------------------------------

const REFUSED_ROWS = ['item-id-1', 'item-id-2', 'item-id-3']
const REFUSED_VALUE = '50'
let originals: (string | undefined)[] = []
/** Прежние значения — до первой вставки после открытия таблицы. */
const rememberOriginals = (root: ParentNode) => {
  if (originals.length === 0)
    originals = REFUSED_ROWS.map(row => textOf(root, row, 'age'))
}
const allPending = (root: ParentNode) =>
  REFUSED_ROWS.every(row => pendingAt(root, row, 'age'))
const refusedBack = (root: ParentNode) =>
  !!errorBanner() &&
  REFUSED_ROWS.every(
    (row, i) =>
      !pendingAt(root, row, 'age') && textOf(root, row, 'age') === originals[i],
  )
const retried = (root: ParentNode) =>
  !errorBanner() &&
  REFUSED_ROWS.every(
    row =>
      textOf(root, row, 'age') === REFUSED_VALUE &&
      !pendingAt(root, row, 'age'),
  )
const retryButton = () => byTestId('load-error-retry')

const REFUSED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сервер сохраняет вставку', en: 'The server saves the paste' },
    hint: {
      ru: 'Приложение сохраняет вставку на сервере одним запросом. Сейчас сервер отвечает не сразу и в первый раз откажет.',
      en: 'The app saves the paste on the server in one request. This time the server responds with a delay and will refuse the first attempt.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь протянул выделение по возрасту в трёх строках.',
      en: 'The user dragged a selection across the age cells in three rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'age', REFUSED_ROWS),
      root => selectRows(root, 'age', REFUSED_ROWS),
    ),
  },
  {
    title: { ru: 'Вставка ждёт сервера', en: 'The paste waits for the server' },
    hint: {
      ru: 'Пользователь нажал Ctrl+V. В ячейках уже новое значение, но сервер ещё не ответил: ячейки ждут.',
      en: 'The user pressed Ctrl+V. The cells already show the new value, but the server has not responded yet: the cells are waiting.',
    },
    states: ['body.pending'],
    enter: untilDone(allPending, root => {
      pasteServer.held = true
      pasteServer.refuse = true
      if (!rangeSelected(root, 'age', REFUSED_ROWS))
        selectRows(root, 'age', REFUSED_ROWS)
      else {
        rememberOriginals(root)
        pasteOnce(root, REFUSED_ROWS[0]!, 'age', REFUSED_VALUE)
      }
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер отказал всей вставке. В ячейках снова прежние значения. Причина отказа — одна плашка под шапкой таблицы с кнопкой повтора, а не отметки на каждой ячейке.',
      en: 'The server refused the whole paste. The cells show the previous values again. The refusal reason appears in a single banner below the table header with a retry button, not as marks on every cell.',
    },
    states: ['body.loadError'],
    enter: untilDone(refusedBack, root => {
      if (allPending(root)) pasteServer.release()
      else if (!errorBanner()) {
        pasteServer.held = true
        pasteServer.refuse = true
        if (!rangeSelected(root, 'age', REFUSED_ROWS))
          selectRows(root, 'age', REFUSED_ROWS)
        else {
          rememberOriginals(root)
          pasted = false
          pasteOnce(root, REFUSED_ROWS[0]!, 'age', REFUSED_VALUE)
        }
      }
    }),
  },
  {
    title: { ru: 'Повтор удался', en: 'The retry succeeded' },
    hint: {
      ru: 'Пользователь нажал кнопку повтора на плашке. Та же вставка ушла на сервер ещё раз, и теперь сервер её принял: плашка ушла, в ячейках новое значение.',
      en: 'The user clicked the retry button on the banner. The same paste went to the server once more, and this time the server accepted it: the banner is gone, and the cells show the new value.',
    },
    enter: (root, app) => {
      // Со свежей таблицы отказа ещё не было: сперва отклонённая вставка, затем повтор.
      let refused = false
      return untilDone(retried, root => {
        if (errorBanner()) refused = true
        if (!refused) {
          pasteServer.held = false
          pasteServer.refuse = true
          if (!rangeSelected(root, 'age', REFUSED_ROWS))
            selectRows(root, 'age', REFUSED_ROWS)
          else {
            rememberOriginals(root)
            pasteOnce(root, REFUSED_ROWS[0]!, 'age', REFUSED_VALUE)
          }
          return
        }
        pasteServer.refuse = false
        if (pasteServer.waiting.length > 0) pasteServer.release()
        else {
          const retry = retryButton()
          if (retry) retry.click()
        }
      })(root, app)
    },
  },
]

/** ADR 0219, S4: сервер отказал пакету вставки целиком — плашка с повтором. */
export const PasteRefusedByServer: StoryObj<StoryProps> = {
  name: 'Refused by the server',
  parameters: { scenario: '0219/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сервер отказал вставке', en: 'The server refused a paste' }}
      steps={REFUSED}
      reset={() => {
        pasteServer.reset()
        pasted = false
        originals = []
      }}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'age', REFUSED_ROWS)).toBe(true),
      )
    })
    await step(REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(allPending(canvas)).toBe(true))
      await until(() =>
        expect(textOf(canvas, REFUSED_ROWS[0]!, 'age')).toBe(REFUSED_VALUE),
      )
    })
    await step(REFUSED[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedBack(canvas)).toBe(true))
      await until(() =>
        expect(REFUSED_ROWS.some(row => issueAt(canvas, row, 'age'))).toBe(
          false,
        ),
      )
    })
    await step(REFUSED[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(retried(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0219, S5 ---------------------------------------------------------------------

const MANUAL_ARGS = {
  ...BASE_ARGS,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
  enableToolbar: true,
} satisfies Partial<StoryProps>

const DRAFT_CLIP = '61\n62\n63'
const DRAFT_ROWS = [
  ['item-id-1', '61'],
  ['item-id-2', '62'],
  ['item-id-3', '63'],
] as const
const panelButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const panelOpen = () =>
  !!document.querySelector('[data-testid="unsaved-changes"]')
const applyAll = (root: HTMLElement) => {
  if (!panelOpen()) panelButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}
const drafted = (root: ParentNode) =>
  DRAFT_ROWS.every(
    ([row, value]) =>
      draftAt(root, row, 'age') && textOf(root, row, 'age') === value,
  )
const applied = (root: ParentNode) =>
  !panelOpen() &&
  DRAFT_ROWS.every(
    ([row, value]) =>
      !draftAt(root, row, 'age') &&
      !pendingAt(root, row, 'age') &&
      textOf(root, row, 'age') === value,
  )

const MANUAL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сохранение по кнопке', en: 'Saving with a button' },
    hint: {
      ru: 'Приложение сохраняет изменения не сразу, а пакетом — по кнопке пульта в тулбаре.',
      en: 'The app does not save changes right away; it saves them in a batch from the unsaved changes button in the toolbar.',
    },
  },
  {
    title: { ru: 'Вставлено несохранённым', en: 'Pasted as unsaved' },
    hint: {
      ru: 'Пользователь выбрал ячейку возраста в первой строке и вставил три числа. Новые значения видны в ячейках, но ещё не сохранены: в углу каждой ячейки отметка несохранённого изменения, на кнопке пульта — их число.',
      en: 'The user picked the age cell in the first row and pasted three numbers. The new values show in the cells but are not saved yet: each cell has an unsaved change mark in its corner, and the unsaved changes button shows their count.',
    },
    states: ['body.cellDraft'],
    enter: untilDone(drafted, root => {
      if (!selectedAt(root, 'item-id-1', 'age'))
        selectCell(root, 'item-id-1', 'age')
      else pasteOnce(root, 'item-id-1', 'age', DRAFT_CLIP)
    }),
  },
  {
    title: { ru: 'Сохранено пакетом', en: 'Saved in a batch' },
    hint: {
      ru: 'Пользователь открыл пульт и нажал «Применить всё». Вставленные значения ушли на сервер одним запросом и сохранены: отметки исчезли.',
      en: 'The user opened the unsaved changes panel and clicked "Apply all". The pasted values went to the server in one request and are saved: the marks disappeared.',
    },
    enter: untilDone(applied, root => {
      if (!drafted(root)) {
        if (!selectedAt(root, 'item-id-1', 'age'))
          selectCell(root, 'item-id-1', 'age')
        else pasteOnce(root, 'item-id-1', 'age', DRAFT_CLIP)
      } else applyAll(root)
    }),
  },
]

/** ADR 0219, S5: вставка при сохранении по кнопке — черновики, затем «Применить всё». */
export const PasteManualSave: StoryObj<StoryProps> = {
  name: 'Paste, then save by button',
  parameters: { scenario: '0219/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Вставка с сохранением по кнопке',
        en: 'Pasting with manual saving',
      }}
      steps={MANUAL}
      reset={() => {
        pasteServer.reset()
        pasted = false
      }}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MANUAL[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(MANUAL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(drafted(canvas)).toBe(true))
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(MANUAL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(applied(canvas)).toBe(true))
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0219, S10 --------------------------------------------------------------------

const CLEAR_ROWS = ['item-id-1', 'item-id-2', 'item-id-3']
const CUT_ROW = 'item-id-5'
const CUT_TARGET = 'item-id-7'
let cutValue: string | undefined
let cutData: DataTransfer | undefined
const cleared = (root: ParentNode) =>
  CLEAR_ROWS.every(
    row =>
      textOf(root, row, 'visits') === '' && !pendingAt(root, row, 'visits'),
  )
const cutDone = (root: ParentNode) =>
  !!cutData &&
  textOf(root, CUT_ROW, 'age') === '' &&
  !pendingAt(root, CUT_ROW, 'age')
const moved = (root: ParentNode) =>
  cutDone(root) &&
  textOf(root, CUT_TARGET, 'age') === cutValue &&
  !pendingAt(root, CUT_TARGET, 'age')

/** Вырезать значение, запомнив его до вырезания. */
const cutOnce = (root: ParentNode) => {
  cutValue ??= textOf(root, CUT_ROW, 'age')
  cutData = cutFrom(cellOf(root, CUT_ROW, 'age')!)
}

const CLEAR_AND_CUT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов.',
      en: 'The app allowed editing the age, gender and visit count.',
    },
  },
  {
    title: { ru: 'Диапазон очищен', en: 'The range is cleared' },
    hint: {
      ru: 'Пользователь выделил число визитов в трёх строках и нажал Delete. Ячейки стали пустыми.',
      en: 'The user selected the visit count in three rows and pressed Delete. The cells became empty.',
    },
    states: ['body.cellRange'],
    keyboard: true,
    enter: untilDone(cleared, root => {
      if (!rangeSelected(root, 'visits', CLEAR_ROWS))
        selectRows(root, 'visits', CLEAR_ROWS)
      else pressKey(cellOf(root, CLEAR_ROWS[0]!, 'visits')!, 'Delete')
    }),
  },
  {
    title: { ru: 'Значение вырезано', en: 'The value is cut' },
    hint: {
      ru: 'Пользователь выбрал ячейку возраста и нажал Ctrl+X. Значение ушло в буфер, ячейка стала пустой.',
      en: 'The user picked an age cell and pressed Ctrl+X. The value went to the clipboard, and the cell became empty.',
    },
    states: ['body.cellRange'],
    enter: untilDone(cutDone, root => {
      if (!selectedAt(root, CUT_ROW, 'age')) selectCell(root, CUT_ROW, 'age')
      else if (!cutData) cutOnce(root)
    }),
  },
  {
    title: { ru: 'Вырезанное вставлено', en: 'The cut value is pasted' },
    hint: {
      ru: 'Пользователь выбрал ячейку возраста двумя строками ниже и нажал Ctrl+V. Значение переехало в неё.',
      en: 'The user picked the age cell two rows below and pressed Ctrl+V. The value moved into it.',
    },
    states: ['body.cellRange'],
    enter: untilDone(moved, root => {
      if (!cutDone(root)) {
        if (!selectedAt(root, CUT_ROW, 'age')) selectCell(root, CUT_ROW, 'age')
        else if (!cutData) cutOnce(root)
      } else if (!selectedAt(root, CUT_TARGET, 'age'))
        selectCell(root, CUT_TARGET, 'age')
      else pasteOnce(root, CUT_TARGET, 'age', cutData!)
    }),
  },
]

/** ADR 0219, S10: очистка диапазона клавишей Delete, вырезание и вставка вырезанного. */
export const ClearAndCut: StoryObj<StoryProps> = {
  name: 'Clear and cut',
  parameters: { scenario: '0219/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Очистка и вырезание', en: 'Clearing and cutting' }}
      steps={CLEAR_AND_CUT}
      reset={() => {
        pasteServer.reset()
        pasted = false
        cutData = undefined
        cutValue = undefined
      }}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CLEAR_AND_CUT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(CLEAR_AND_CUT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cleared(canvas)).toBe(true))
    })
    await step(CLEAR_AND_CUT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cutDone(canvas)).toBe(true))
    })
    await step(CLEAR_AND_CUT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(moved(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0219, S11 --------------------------------------------------------------------

/**
 * Пункт приложения в контекстном меню ячейки визитов: обнулить визиты в выделенных ячейках —
 * `table.writeCells`, по тем же правилам, что вставка.
 */
const resetVisitsAction: ContextMenuAction = {
  id: 'resetVisits',
  icon: () => <RotateCcw width={16} height={16} />,
  label: () => 'Reset visits',
  visible: ctx => ctx.selection.isInSelection && ctx.column.id === 'visits',
  // Итог — на самих ячейках: ожидание и вспышка пакета записи.
  target: () => false,
  onSelect: ({ table }) => {
    const source = table.getRowSource()
    const changes = table.getCellSelectionRanges().flatMap(range => {
      if (!range.columnIds.includes('visits')) return []
      const cells = []
      for (let i = range.minRowIndex; i <= range.maxRowIndex; i++) {
        const row = source.at(i)
        if (row) cells.push({ rowId: row.id, columnId: 'visits', value: 0 })
      }
      return cells
    })
    void table.writeCells(changes, { source: 'api' })
  },
}

const resetVisitsDemo: TesseraFeatureEntry = {
  id: 'resetVisitsGuide',
  contextMenuActions: [resetVisitsAction],
}

const OWN_ROWS = ['item-id-1', 'item-id-2', 'item-id-3', 'item-id-4']
const MENU_ROW = 'item-id-2'
const resetItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menu"][data-open] [data-action-id$="resetVisits"]',
  )
const zeroed = (root: ParentNode) =>
  OWN_ROWS.every(
    row =>
      textOf(root, row, 'visits') === '0' && !pendingAt(root, row, 'visits'),
  )

/** Выделить визиты в четырёх строках и открыть меню внутри выделения. */
const selectAndOpenMenu = (root: HTMLElement) => {
  if (!rangeSelected(root, 'visits', OWN_ROWS)) {
    if (openMenu()) closeMenu()
    else selectRows(root, 'visits', OWN_ROWS)
  } else if (!resetItem()) {
    if (openMenu()) closeMenu()
    else rightClickCell(cellOf(root, MENU_ROW, 'visits')!)
  }
}

const OWN_BULK: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Пункт меню приложения', en: "The app's menu item" },
    hint: {
      ru: 'Приложение добавило в меню ячейки визитов свой пункт: он обнуляет число визитов в выделенных ячейках. Записывает таблица — по тем же правилам, что и вставка.',
      en: 'The app added its own item to the visit cell menu: it resets the visit count to zero in the selected cells. The table writes the values following the same rules as a paste.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь протянул выделение по числу визитов в четырёх строках.',
      en: 'The user dragged a selection across the visit count cells in four rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'visits', OWN_ROWS) && !openMenu(),
      root => {
        if (openMenu()) closeMenu()
        else selectRows(root, 'visits', OWN_ROWS)
      },
    ),
  },
  {
    title: { ru: 'Меню открыто', en: 'The menu is open' },
    hint: {
      ru: 'Пользователь нажал правой кнопкой внутри выделения. В меню рядом с пунктами таблицы — пункт приложения.',
      en: "The user right-clicked inside the selection. The menu shows the app's item next to the table's items.",
    },
    states: ['overlay.contextMenu'],
    enter: untilDone(
      root => rangeSelected(root, 'visits', OWN_ROWS) && !!resetItem(),
      selectAndOpenMenu,
    ),
  },
  {
    title: { ru: 'Визиты обнулены', en: 'The visits are reset to zero' },
    hint: {
      ru: 'Пользователь выбрал пункт приложения. Меню закрылось, во всех выделенных ячейках ноль; сервер принял изменения одним запросом.',
      en: "The user chose the app's item. The menu closed, and all selected cells show zero; the server accepted the changes in one request.",
    },
    enter: untilDone(
      root => zeroed(root) && !openMenu(),
      root => {
        if (zeroed(root)) closeMenu()
        else if (resetItem()) resetItem()!.click()
        else selectAndOpenMenu(root)
      },
    ),
  },
]

/** ADR 0219, S11: пункт приложения в контекстном меню пишет значение в выделенные ячейки. */
export const OwnBulkEdit: StoryObj<StoryProps> = {
  name: 'Own action in the context menu',
  parameters: { scenario: '0219/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Своя массовая правка в меню',
        en: 'A custom bulk edit in the menu',
      }}
      steps={OWN_BULK}
      reset={() => pasteServer.reset()}
      args={guideArgs(
        {
          ...BASE_ARGS,
          enableContextMenu: true,
          actionsDemo: 'none',
          extraPlugins: [resetVisitsDemo],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_BULK[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(OWN_BULK[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'visits', OWN_ROWS)).toBe(true),
      )
    })
    await step(OWN_BULK[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(resetItem()).not.toBeNull())
      expectPopupInCanvas(canvas, openMenu()!)
    })
    await step(OWN_BULK[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(zeroed(canvas)).toBe(true))
      expect(openMenu()).toBeNull()
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0219, S12 --------------------------------------------------------------------

/** Своя разборка буфера приложения: перед вставкой таблица спрашивает пользователя. */
const parseWithConfirm = async (
  { text }: { text: string; html: string },
  { confirm }: { confirm: () => Promise<boolean> },
) => ((await confirm()) ? text.split('\n').map(line => line.split('\t')) : null)

const CONFIRM_ARGS = {
  ...BASE_ARGS,
  cellSelectionParseClipboard: parseWithConfirm,
} satisfies Partial<StoryProps>

const CONFIRM_ROW = 'item-id-2'
const CONFIRM_VALUE = '55'
let confirmOriginal: string | undefined
const question = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="paste-question"]')
const asking = (root: ParentNode) => !!question(root)
const declined = (root: ParentNode) =>
  !asking(root) && textOf(root, CONFIRM_ROW, 'age') === confirmOriginal
const accepted = (root: ParentNode) =>
  !asking(root) &&
  textOf(root, CONFIRM_ROW, 'age') === CONFIRM_VALUE &&
  !pendingAt(root, CONFIRM_ROW, 'age')

/** Выбрать ячейку и вставить, если вопрос ещё не задан. */
const askToPaste = (root: HTMLElement) => {
  if (!selectedAt(root, CONFIRM_ROW, 'age'))
    selectCell(root, CONFIRM_ROW, 'age')
  else if (!asking(root)) {
    confirmOriginal ??= textOf(root, CONFIRM_ROW, 'age')
    pasted = false
    pasteOnce(root, CONFIRM_ROW, 'age', CONFIRM_VALUE)
  }
}
/** Ответить на вопрос: галочка — вставить, крестик — не вставлять. */
const answerAsk = (root: HTMLElement, ok: boolean) => {
  const button = question(root)?.querySelector<HTMLElement>(
    ok ? '[data-testid="paste-confirm"]' : '[data-testid="paste-decline"]',
  )
  if (!button) return false
  button.click()
  return true
}

/**
 * Спросить и ответить один раз за шаг — дальше только ждать итога: пока ответ «Вставить» не
 * лёг в ячейку, повторной вставки и второго вопроса нет.
 */
const answerOnce =
  (ok: boolean, done: (root: HTMLElement) => boolean) =>
  (root: HTMLElement, app: GuideApp) => {
    let answered = false
    return untilDone(done, root => {
      if (asking(root)) answered = answerAsk(root, ok) || answered
      else if (!answered) askToPaste(root)
    })(root, app)
  }

const CONFIRM: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Вопрос перед вставкой', en: 'A question before pasting' },
    hint: {
      ru: 'Приложение разбирает буфер само и перед вставкой просит таблицу спросить пользователя.',
      en: 'The app parses the clipboard itself and asks the table to check with the user before pasting.',
    },
  },
  {
    title: { ru: 'Вопрос задан', en: 'The question is asked' },
    hint: {
      ru: 'Пользователь выбрал ячейку возраста и нажал Ctrl+V. Под шапкой таблицы плашка с вопросом, вставлять ли это значение, и двумя кнопками: галочка вставляет, крестик отменяет вставку.',
      en: 'The user picked an age cell and pressed Ctrl+V. Below the table header, a banner asks whether to paste this value and has two buttons: the check mark pastes, and the cross cancels the paste.',
    },
    enter: untilDone(asking, askToPaste),
  },
  {
    title: { ru: 'Вставка отменена', en: 'The paste is canceled' },
    hint: {
      ru: 'Пользователь нажал крестик. Вставка отменена: ячейка не изменилась, плашка ушла.',
      en: 'The user clicked the cross. The paste is canceled: the cell did not change, and the banner is gone.',
    },
    enter: answerOnce(false, declined),
  },
  {
    title: { ru: 'Вставка подтверждена', en: 'The paste is confirmed' },
    hint: {
      ru: 'Пользователь снова нажал Ctrl+V и ответил галочкой. Значение легло в ячейку, сервер его принял.',
      en: 'The user pressed Ctrl+V again and answered with the check mark. The value went into the cell, and the server accepted it.',
    },
    enter: answerOnce(true, accepted),
  },
]

/** ADR 0219, S12: таблица спрашивает перед вставкой; пользователь отказывается и подтверждает. */
export const PasteConfirm: StoryObj<StoryProps> = {
  name: 'Confirm before pasting',
  parameters: { scenario: '0219/S12', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Подтверждение вставки', en: 'Confirming a paste' }}
      steps={CONFIRM}
      reset={() => {
        pasteServer.reset()
        pasted = false
        confirmOriginal = undefined
      }}
      args={guideArgs(CONFIRM_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CONFIRM[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(CONFIRM[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(asking(canvas)).toBe(true))
      expect(
        canvas.querySelector('[data-testid="pending-action-banner"]'),
      ).toBeNull()
    })
    await step(CONFIRM[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(declined(canvas)).toBe(true))
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(CONFIRM[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(accepted(canvas)).toBe(true))
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0223: пределы записи ---------------------------------------------------------

/** Ответ на вопрос предела — один раз за проход шага, затем только ждать итога. */
const LIMIT_ROW = 'item-id-2'
let limitOriginal: string | undefined
const limitDeclined = (root: ParentNode) =>
  !asking(root) && textOf(root, LIMIT_ROW, 'age') === limitOriginal
const limitAccepted = (root: ParentNode) => !asking(root) && sheetPasted(root)

/** Выбрать ячейку и вставить три строки, если вопрос ещё не задан. */
const pasteSheet = (root: HTMLElement) => {
  if (!selectedAt(root, LIMIT_ROW, 'age')) selectCell(root, LIMIT_ROW, 'age')
  else if (!asking(root)) {
    limitOriginal ??= textOf(root, LIMIT_ROW, 'age')
    pasted = false
    pasteOnce(root, LIMIT_ROW, 'age', SHEET)
  }
}
const answerLimit =
  (ok: boolean, done: (root: HTMLElement) => boolean) =>
  (root: HTMLElement, app: GuideApp) => {
    let answered = false
    return untilDone(done, root => {
      if (asking(root)) answered = answerAsk(root, ok) || answered
      else if (!answered) pasteSheet(root)
    })(root, app)
  }

const LARGE_ARGS = {
  ...BASE_ARGS,
  writeLimits: { confirm: 4, max: 20 },
} satisfies Partial<StoryProps>

const LARGE_CONFIRM: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Вопрос перед большой правкой',
      en: 'A question before a large edit',
    },
    hint: {
      ru: 'Приложение просит таблицу спрашивать, прежде чем менять больше четырёх ячеек за раз, — чтобы большая вставка не прошла случайно.',
      en: 'The app asks the table to ask the user before changing more than four cells at once, so that a large paste does not happen by accident.',
    },
  },
  {
    title: { ru: 'Вопрос задан', en: 'The question is asked' },
    hint: {
      ru: 'Пользователь выбрал ячейку возраста во второй строке и вставил три строки буфера — шесть ячеек. Таблица ещё ничего не изменила: под шапкой вопрос, менять ли шесть ячеек.',
      en: 'The user picked the age cell in the second row and pasted three clipboard rows, which is six cells. The table has not changed anything yet: below the header, a question asks whether to change six cells.',
    },
    enter: untilDone(asking, pasteSheet),
  },
  {
    title: { ru: 'Вставка отменена', en: 'The paste is canceled' },
    hint: {
      ru: 'Пользователь нажал крестик. Ячейки не изменились, вопрос ушёл.',
      en: 'The user clicked the cross. The cells did not change, and the question is gone.',
    },
    enter: answerLimit(false, limitDeclined),
  },
  {
    title: { ru: 'Вставка подтверждена', en: 'The paste is confirmed' },
    hint: {
      ru: 'Пользователь вставил снова и ответил галочкой. Шесть ячеек изменились, сервер принял их одним запросом.',
      en: 'The user pasted again and answered with the check mark. Six cells changed, and the server accepted them in one request.',
    },
    enter: answerLimit(true, limitAccepted),
  },
]

/** ADR 0223, S1: вставка больше порога вопроса ждёт ответа; отказ и подтверждение. */
export const LargePasteConfirm: StoryObj<StoryProps> = {
  name: 'Confirm a large paste',
  parameters: { scenario: '0223/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Большая вставка', en: 'A large paste' }}
      steps={LARGE_CONFIRM}
      reset={() => {
        pasteServer.reset()
        pasted = false
        limitOriginal = undefined
      }}
      args={guideArgs(LARGE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LARGE_CONFIRM[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(LARGE_CONFIRM[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(asking(canvas)).toBe(true))
    })
    await step(LARGE_CONFIRM[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(limitDeclined(canvas)).toBe(true))
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(LARGE_CONFIRM[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(limitAccepted(canvas)).toBe(true))
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

/** Пять строк буфера — десять ячеек, больше предела. */
const BIG_SHEET = '41\tmale\n42\tfemale\n43\tmale\n44\tfemale\n45\tmale\n'

const OVER_ARGS = {
  ...BASE_ARGS,
  writeLimits: { confirm: 6, max: 6 },
} satisfies Partial<StoryProps>

let overOriginal: string | undefined
let overPasted = false
const overRefused = (root: ParentNode) =>
  !!errorBanner() && textOf(root, LIMIT_ROW, 'age') === overOriginal

/** Вставить пять строк — больше предела. */
const pasteBig = (root: HTMLElement) => {
  if (!selectedAt(root, LIMIT_ROW, 'age')) {
    selectCell(root, LIMIT_ROW, 'age')
    return
  }
  if (overPasted) return
  overOriginal ??= textOf(root, LIMIT_ROW, 'age')
  overPasted = true
  const cell = cellOf(root, LIMIT_ROW, 'age')
  if (cell) pasteInto(cell, BIG_SHEET)
}

const OVER_LIMIT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Предел правки', en: 'An edit limit' },
    hint: {
      ru: 'Приложение разрешает менять не больше шести ячеек за раз.',
      en: 'The app allows changing at most six cells at once.',
    },
  },
  {
    title: { ru: 'Вставка отклонена', en: 'The paste is rejected' },
    hint: {
      ru: 'Пользователь вставил пять строк буфера — десять ячеек. Таблица ничего не изменила: под шапкой плашка, что десять ячеек — больше шести за раз.',
      en: 'The user pasted five clipboard rows, which is ten cells. The table changed nothing: below the header, a banner says that ten cells are more than six at once.',
    },
    enter: untilDone(overRefused, pasteBig),
  },
  {
    title: { ru: 'Вставка в пределах', en: 'A paste within the limit' },
    hint: {
      ru: 'Пользователь закрыл плашку и вставил три строки — шесть ячеек. Они легли без вопроса, сервер их принял.',
      en: 'The user closed the banner and pasted three rows, which is six cells. They were pasted without a question, and the server accepted them.',
    },
    enter: untilDone(
      root => !errorBanner() && sheetPasted(root),
      root => {
        if (!overRefused(root) && !overPasted) {
          pasteBig(root)
          return
        }
        const dismiss = errorBanner()?.querySelector<HTMLElement>(
          '[data-alert-dismiss]',
        )
        if (dismiss) {
          dismiss.click()
          return
        }
        pasteOnce(root, LIMIT_ROW, 'age', SHEET)
      },
    ),
  },
]

/** ADR 0223, S2: вставка больше предела отклонена; вставка в пределах проходит. */
export const PasteOverLimit: StoryObj<StoryProps> = {
  name: 'Paste over the limit',
  parameters: { scenario: '0223/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Предел правки', en: 'An edit limit' }}
      steps={OVER_LIMIT}
      reset={() => {
        pasteServer.reset()
        pasted = false
        overPasted = false
        overOriginal = undefined
      }}
      args={guideArgs(OVER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVER_LIMIT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(OVER_LIMIT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(overRefused(canvas)).toBe(true))
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(OVER_LIMIT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sheetPasted(canvas)).toBe(true))
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0219, этап 2: протяжка и заполнение ------------------------------------------------

/** Квадрат маркера угла активного диапазона. */
const fillHandleOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    '[data-range-handle="end"][data-selection-handle="square"]:not([hidden])',
  )
const fillFrameShown = (root: ParentNode) =>
  !!root.querySelector('[data-fill-frame]:not([hidden])')

/** Событие указателя мыши в точке; `altKey` — с зажатым Alt. */
const handleEvent = (
  type: string,
  point: { x: number; y: number },
  altKey: boolean,
) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerType: 'mouse',
    isPrimary: true,
    altKey,
    clientX: point.x,
    clientY: point.y,
  })

/** Протянуть квадрат маркера к ячейке и отпустить; `alt` — с зажатым Alt. */
const fillTo = (
  root: HTMLElement,
  row: string,
  column: string,
  alt = false,
) => {
  const handle = fillHandleOf(root)
  const target = cellOf(root, row, column)
  if (!handle || !target) return false
  const from = centerOf(handle)
  const to = centerOf(target)
  handle.dispatchEvent(handleEvent('pointerdown', from, alt))
  for (let i = 1; i <= 4; i++)
    document.dispatchEvent(
      handleEvent(
        'pointermove',
        {
          x: from.x + ((to.x - from.x) * i) / 4,
          y: from.y + ((to.y - from.y) * i) / 4,
        },
        alt,
      ),
    )
  document.dispatchEvent(handleEvent('pointerup', to, alt))
  return true
}

/**
 * Взять квадрат маркера и держать над ячейкой, не отпуская (ADR 0117, SN36): события человека
 * до маркера не доходят; уход с шага отпускает маркер там, где его держали, — значения пишутся.
 */
const holdFill =
  (
    from: { row: string; column: string },
    to: { row: string; column: string },
  ) =>
  async (root: HTMLElement, step: StepRun) => {
    if (!selectedAt(root, from.row, from.column))
      selectCell(root, from.row, from.column)
    await pollUntil(
      () => selectedAt(root, from.row, from.column) && !!fillHandleOf(root),
      step.signal,
    )
    const handle = fillHandleOf(root)!
    const start = centerOf(handle)
    const ours = new WeakSet<Event>()
    let point = start
    // Своё событие — в списке до отправки: щит его пропускает.
    const fire = (type: string, target: EventTarget) => {
      const event = handleEvent(type, point, false)
      ours.add(event)
      target.dispatchEvent(event)
    }
    // Щит на окне раньше слушателей маркера: указатель человека жест не ведёт.
    const shield = (event: Event) => {
      if (!ours.has(event)) event.stopImmediatePropagation()
    }
    const types = ['pointermove', 'pointerup', 'pointercancel']
    for (const type of types) window.addEventListener(type, shield, true)
    let released = false
    const onTarget = () => {
      const cell = cellOf(root, to.row, to.column)
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
    fire('pointerdown', handle)
    const end = centerOf(cellOf(root, to.row, to.column)!)
    for (let i = 1; i <= 6; i++) {
      step.signal.throwIfAborted()
      point = {
        x: start.x + ((end.x - start.x) * i) / 6,
        y: start.y + ((end.y - start.y) * i) / 6,
      }
      fire('pointermove', document)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    if (!released) keeping = requestAnimationFrame(keep)
    await pollUntil(() => fillFrameShown(root), step.signal)
  }

/** Протяжка — один раз за проход шага: ответ сервера приходит не сразу. */
let filled = false
/** Место цели протяжки на прошлом проходе шага. */
let fillTargetTop: string | undefined
const fillOnce = (
  root: HTMLElement,
  from: { row: string; column: string },
  to: { row: string; column: string },
  alt = false,
) => {
  if (filled) return
  if (!selectedAt(root, from.row, from.column)) {
    selectCell(root, from.row, from.column)
    return
  }
  // Цель — в виду, и тянуть, когда она стоит: открытая заново таблица ещё встаёт на место.
  cellOf(root, to.row, to.column)?.scrollIntoView({ block: 'nearest' })
  const handle = fillHandleOf(root)?.getBoundingClientRect()
  const target = cellOf(root, to.row, to.column)?.getBoundingClientRect()
  const top =
    handle && target ? `${handle.top}:${handle.left}:${target.top}` : undefined
  if (top === undefined || top !== fillTargetTop) {
    fillTargetTop = top
    return
  }
  filled = fillTo(root, to.row, to.column, alt)
}

/** Протяжка значения маркером в историях этапа 2. */
const FILL_ARGS = {
  ...BASE_ARGS,
  cellSelectionHandle: 'fill',
} as unknown as Partial<StoryProps>

// --- ADR 0219, S6 ---------------------------------------------------------------------

const COPY_FROM = { row: 'item-id-2', column: 'age' }
const COPY_TO = { row: 'item-id-5', column: 'age' }
const COPY_ROWS = ['item-id-3', 'item-id-4', 'item-id-5']
/** Протягиваемое значение: исходная ячейка шаги не меняют. */
const copiedAge = (root: ParentNode) =>
  textOf(root, COPY_FROM.row, COPY_FROM.column)
const copyFilled = (root: ParentNode) =>
  !!copiedAge(root) &&
  COPY_ROWS.every(
    row =>
      textOf(root, row, 'age') === copiedAge(root) &&
      !pendingAt(root, row, 'age'),
  )

const FILL_COPY: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Протяжка значения включена', en: 'Fill by dragging is on' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов и включило протяжку значения маркером.',
      en: 'The app allowed editing the age, gender and visit count and enabled filling values with the fill handle.',
    },
  },
  {
    title: { ru: 'Ячейка выбрана', en: 'A cell is active' },
    hint: {
      ru: 'Пользователь нажал на ячейку возраста во второй строке. В правом нижнем углу ячейки — квадрат маркера.',
      en: 'The user clicked the age cell in the second row. The bottom-right corner of the cell has the square fill handle.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root =>
        selectedAt(root, COPY_FROM.row, COPY_FROM.column) &&
        !!fillHandleOf(root),
      root => selectCell(root, COPY_FROM.row, COPY_FROM.column),
    ),
  },
  {
    title: { ru: 'Пользователь тянет маркер', en: 'The user drags the handle' },
    hint: {
      ru: 'Пользователь взял квадрат и тянет его вниз. Пунктирная рамка показывает ячейки, куда ляжет значение; пока кнопка мыши нажата, данные не меняются.',
      en: 'The user grabbed the square and is dragging it down. A dashed frame shows the cells that will receive the value; the data does not change while the mouse button is held down.',
    },
    states: ['body.cellRange', 'body.fillFrame'],
    enter: stepAction(holdFill(COPY_FROM, COPY_TO)),
  },
  {
    title: { ru: 'Значение протянуто', en: 'The value is filled' },
    hint: {
      ru: 'Пользователь отпустил кнопку. Возраст из второй строки лёг в три ячейки ниже, сервер принял изменения одним запросом, ячейки коротко вспыхнули тоном успеха. Выделены исходная ячейка и заполненные.',
      en: 'The user released the button. The age from the second row went into the three cells below, the server accepted the changes in one request, and the cells flashed briefly in the success tone. The source cell and the filled cells are selected.',
    },
    states: ['body.cellRange'],
    enter: untilDone(copyFilled, root => fillOnce(root, COPY_FROM, COPY_TO)),
  },
]

/** ADR 0219, S6: значение ячейки тянут маркером вниз — копия в ячейки ниже. */
export const FillCopy: StoryObj<StoryProps> = {
  name: 'Drag a value down',
  parameters: { scenario: '0219/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Протяжка значения', en: 'Filling a value by dragging' }}
      steps={FILL_COPY}
      reset={() => {
        pasteServer.reset()
        filled = false
      }}
      args={guideArgs(FILL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FILL_COPY[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FILL_COPY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(fillHandleOf(canvas)).not.toBeNull())
    })
    await step(FILL_COPY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(fillFrameShown(canvas)).toBe(true))
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(FILL_COPY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(copyFilled(canvas)).toBe(true))
      expect(fillFrameShown(canvas)).toBe(false)
      expect(selectedAt(canvas, COPY_TO.row, COPY_TO.column)).toBe(true)
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}

// --- ADR 0219, S7 ---------------------------------------------------------------------

type Delivery = { id: string; name: string; price: number; delivery: string }

const SERIES_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Product', size: 180 },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    dataType: 'number',
    size: 120,
  },
  {
    id: 'delivery',
    accessorKey: 'delivery',
    header: 'Delivery',
    dataType: 'dateString',
    size: 150,
  },
]

const SERIES_ROWS: Delivery[] = [
  'Desk lamp',
  'Office chair',
  'Notebook',
  'Water bottle',
  'Headphones',
  'Backpack',
  'Keyboard',
  'Monitor',
].map((name, index) => ({
  id: `item-id-${index + 1}`,
  name,
  price: index === 0 ? 10 : index === 1 ? 20 : 5,
  delivery: '2026-11-02',
}))

const SERIES_ARGS = {
  ...FILL_ARGS,
  columnsOverride: SERIES_COLUMNS,
  dataOverride: SERIES_ROWS,
  editableColumns: ['price', 'delivery'],
} as unknown as Partial<StoryProps>

const PRICE_ROWS = ['item-id-1', 'item-id-2']
const PRICE_TO = { row: 'item-id-5', column: 'price' }
const pricesFilled = (root: ParentNode) =>
  ['30', '40', '50'].every(
    (price, i) =>
      textOf(root, `item-id-${i + 3}`, 'price') === price &&
      !pendingAt(root, `item-id-${i + 3}`, 'price'),
  )
const DATE_FROM = { row: 'item-id-6', column: 'delivery' }
const DATE_TO = { row: 'item-id-8', column: 'delivery' }
const datesFilled = (root: ParentNode) =>
  textOf(root, 'item-id-7', 'delivery') === '2026-11-03' &&
  textOf(root, 'item-id-8', 'delivery') === '2026-11-04' &&
  !pendingAt(root, 'item-id-8', 'delivery')

const FILL_SERIES: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Цены с шагом', en: 'Prices with a step' },
    hint: {
      ru: 'В первых двух строках цены 10 и 20. Приложение разрешило править цену и дату доставки и включило протяжку значения маркером.',
      en: 'The first two rows have prices of 10 and 20. The app allowed editing the price and delivery date and enabled filling values with the fill handle.',
    },
  },
  {
    title: { ru: 'Выделены две цены', en: 'Two prices are selected' },
    hint: {
      ru: 'Пользователь выделил цены в первых двух строках.',
      en: 'The user selected the prices in the first two rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'price', PRICE_ROWS) && !!fillHandleOf(root),
      root => selectRows(root, 'price', PRICE_ROWS),
    ),
  },
  {
    title: { ru: 'Ряд цен продолжен', en: 'The price series is continued' },
    hint: {
      ru: 'Пользователь протянул маркер на три строки вниз. Две цены с одинаковым шагом протяжка продолжила рядом: каждая следующая больше на тот же шаг.',
      en: 'The user dragged the fill handle three rows down. The fill continued the two evenly spaced prices as a series: each next price is larger by the same step.',
    },
    states: ['body.cellRange'],
    enter: untilDone(pricesFilled, root => {
      if (!rangeSelected(root, 'price', PRICE_ROWS))
        selectRows(root, 'price', PRICE_ROWS)
      else if (!filled) filled = fillTo(root, PRICE_TO.row, PRICE_TO.column)
    }),
  },
  {
    title: { ru: 'Выбрана дата', en: 'A date is active' },
    hint: {
      ru: 'Пользователь нажал на дату доставки в шестой строке.',
      en: 'The user clicked the delivery date in the sixth row.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root =>
        selectedAt(root, DATE_FROM.row, DATE_FROM.column) &&
        !!fillHandleOf(root),
      root => {
        filled = false
        selectCell(root, DATE_FROM.row, DATE_FROM.column)
      },
    ),
  },
  {
    title: { ru: 'Ряд дат с Alt', en: 'A date series with Alt' },
    hint: {
      ru: 'Пользователь протянул маркер на две строки вниз, удерживая Alt. Без него одна дата повторилась бы, а с ним протяжка ведёт ряд по дням.',
      en: 'The user dragged the fill handle two rows down while holding Alt. Without it, the single date would repeat; with it, the fill builds a series by day.',
    },
    states: ['body.cellRange'],
    enter: untilDone(datesFilled, root =>
      fillOnce(root, DATE_FROM, DATE_TO, true),
    ),
  },
]

/** ADR 0219, S7: протяжка продолжает ряд чисел, Alt ведёт ряд одной даты по дням. */
export const FillSeries: StoryObj<StoryProps> = {
  name: 'Continue a series',
  parameters: { scenario: '0219/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Ряд протяжкой', en: 'A series by dragging' }}
      steps={FILL_SERIES}
      reset={() => {
        pasteServer.reset()
        filled = false
      }}
      args={guideArgs(SERIES_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FILL_SERIES[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FILL_SERIES[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'price', PRICE_ROWS)).toBe(true),
      )
    })
    await step(FILL_SERIES[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pricesFilled(canvas)).toBe(true))
    })
    await step(FILL_SERIES[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(selectedAt(canvas, DATE_FROM.row, DATE_FROM.column)).toBe(true),
      )
    })
    await step(FILL_SERIES[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(datesFilled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0219, S8 ---------------------------------------------------------------------

const DOWN_ROWS = ['item-id-2', 'item-id-3', 'item-id-4', 'item-id-5']
/** Значения источников протяжки: их ячейки шаги не меняют. */
const downAge = (root: ParentNode) => textOf(root, DOWN_ROWS[0]!, 'age')
const downFilled = (root: ParentNode) =>
  !!downAge(root) &&
  DOWN_ROWS.slice(1).every(
    row =>
      textOf(root, row, 'age') === downAge(root) &&
      !pendingAt(root, row, 'age'),
  )
const RIGHT_ROW = 'item-id-7'
const rightName = (root: ParentNode) => textOf(root, RIGHT_ROW, 'firstName')
const rightSelected = (root: ParentNode) =>
  selectedAt(root, RIGHT_ROW, 'firstName') &&
  selectedAt(root, RIGHT_ROW, 'lastName')
const rightFilled = (root: ParentNode) =>
  !!rightName(root) &&
  textOf(root, RIGHT_ROW, 'lastName') === rightName(root) &&
  !pendingAt(root, RIGHT_ROW, 'lastName')

/** Ctrl+D или Ctrl+R на первой ячейке диапазона — по коду клавиши. */
const pressFill = (
  root: HTMLElement,
  row: string,
  column: string,
  code: 'KeyD' | 'KeyR',
) => {
  const cell = cellOf(root, row, column)
  if (cell) pressKey(cell, code === 'KeyD' ? 'd' : 'r', { code, ctrlKey: true })
}

const FILL_KEYBOARD: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править имя, фамилию, возраст, пол и число визитов.',
      en: 'The app allowed editing the first name, last name, age, gender and visit count.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь выделил возраст в четырёх строках.',
      en: 'The user selected the age in four rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'age', DOWN_ROWS),
      root => selectRows(root, 'age', DOWN_ROWS),
    ),
  },
  {
    title: { ru: 'Заполнено вниз', en: 'Filled down' },
    hint: {
      ru: 'Пользователь нажал Ctrl+D. Возраст из первой строки диапазона лёг в остальные его ячейки.',
      en: 'The user pressed Ctrl+D. The age from the first row of the range went into its other cells.',
    },
    states: ['body.cellRange'],
    keyboard: true,
    enter: untilDone(downFilled, root => {
      if (!rangeSelected(root, 'age', DOWN_ROWS))
        selectRows(root, 'age', DOWN_ROWS)
      else pressFill(root, DOWN_ROWS[0]!, 'age', 'KeyD')
    }),
  },
  {
    title: {
      ru: 'Выделены имя и фамилия',
      en: 'The first and last name are selected',
    },
    hint: {
      ru: 'Пользователь выделил имя и фамилию в седьмой строке.',
      en: 'The user selected the first and last name in the seventh row.',
    },
    states: ['body.cellRange'],
    enter: untilDone(rightSelected, root => {
      const first = cellOf(root, RIGHT_ROW, 'firstName')
      const last = cellOf(root, RIGHT_ROW, 'lastName')
      if (first && last) dragCells(first, last)
    }),
  },
  {
    title: { ru: 'Заполнено вправо', en: 'Filled right' },
    hint: {
      ru: 'Пользователь нажал Ctrl+R. Имя из первой колонки диапазона легло в фамилию.',
      en: 'The user pressed Ctrl+R. The first name from the first column of the range went into the last name.',
    },
    states: ['body.cellRange'],
    keyboard: true,
    enter: untilDone(rightFilled, root => {
      if (!rightSelected(root)) {
        const first = cellOf(root, RIGHT_ROW, 'firstName')
        const last = cellOf(root, RIGHT_ROW, 'lastName')
        if (first && last) dragCells(first, last)
      } else pressFill(root, RIGHT_ROW, 'firstName', 'KeyR')
    }),
  },
]

const KEYBOARD_ARGS = {
  ...BASE_ARGS,
  editableColumns: ['firstName', 'lastName', 'age', 'gender', 'visits'],
} as unknown as Partial<StoryProps>

/** ADR 0219, S8: Ctrl+D заполняет вниз, Ctrl+R — вправо. */
export const FillDownKeyboard: StoryObj<StoryProps> = {
  name: 'Fill down and right from the keyboard',
  parameters: { scenario: '0219/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Заполнение с клавиатуры', en: 'Filling from the keyboard' }}
      steps={FILL_KEYBOARD}
      reset={() => pasteServer.reset()}
      args={guideArgs(KEYBOARD_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FILL_KEYBOARD[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FILL_KEYBOARD[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'age', DOWN_ROWS)).toBe(true),
      )
    })
    await step(FILL_KEYBOARD[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(downFilled(canvas)).toBe(true))
    })
    await step(FILL_KEYBOARD[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rightSelected(canvas)).toBe(true))
    })
    await step(FILL_KEYBOARD[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rightFilled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0219, S9 ---------------------------------------------------------------------

const BULK_ROWS = ['item-id-2', 'item-id-3', 'item-id-4']
const BULK_VALUE = '35'
const bulkInput = (root: ParentNode) =>
  cellOf(root, BULK_ROWS[0]!, 'age')?.querySelector<HTMLInputElement>(
    'input',
  ) ?? null
const bulkFilled = (root: ParentNode) =>
  !bulkInput(root) &&
  BULK_ROWS.every(
    row =>
      textOf(root, row, 'age') === BULK_VALUE && !pendingAt(root, row, 'age'),
  )

const BULK_EDIT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править возраст, пол и число визитов.',
      en: 'The app allowed editing the age, gender and visit count.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь выделил возраст в трёх строках.',
      en: 'The user selected the age in three rows.',
    },
    states: ['body.cellRange'],
    enter: untilDone(
      root => rangeSelected(root, 'age', BULK_ROWS),
      root => selectRows(root, 'age', BULK_ROWS),
    ),
  },
  {
    title: { ru: 'Набрано значение', en: 'A value is typed' },
    hint: {
      ru: 'Пользователь нажал F2 и набрал новый возраст в первой ячейке диапазона. Выделение осталось.',
      en: 'The user pressed F2 and typed a new age in the first cell of the range. The selection remains.',
    },
    states: ['body.cellRange', 'body.editing'],
    keyboard: true,
    enter: untilDone(
      root =>
        bulkInput(root)?.value === BULK_VALUE &&
        rangeSelected(root, 'age', BULK_ROWS),
      root => {
        const input = bulkInput(root)
        if (input) typeInto(input, BULK_VALUE)
        else if (!rangeSelected(root, 'age', BULK_ROWS))
          selectRows(root, 'age', BULK_ROWS)
        else pressKey(cellOf(root, BULK_ROWS[0]!, 'age')!, 'F2')
      },
    ),
  },
  {
    title: {
      ru: 'Значение во всём диапазоне',
      en: 'The value across the whole range',
    },
    hint: {
      ru: 'Пользователь нажал Ctrl+Enter. Набранное значение легло во все ячейки диапазона одним запросом, правка закрылась.',
      en: 'The user pressed Ctrl+Enter. The typed value went into all cells of the range in one request, and the editor closed.',
    },
    states: ['body.cellRange'],
    keyboard: true,
    enter: untilDone(bulkFilled, root => {
      const input = bulkInput(root)
      if (input && input.value !== BULK_VALUE) typeInto(input, BULK_VALUE)
      else if (input) pressKey(input, 'Enter', { ctrlKey: true })
      else if (!rangeSelected(root, 'age', BULK_ROWS))
        selectRows(root, 'age', BULK_ROWS)
      else pressKey(cellOf(root, BULK_ROWS[0]!, 'age')!, 'F2')
    }),
  },
]

/** ADR 0219, S9: набранное в правке уходит во весь диапазон по Ctrl+Enter. */
export const BulkEditCtrlEnter: StoryObj<StoryProps> = {
  name: 'Edit the whole range',
  parameters: { scenario: '0219/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка всего диапазона', en: 'Editing the whole range' }}
      steps={BULK_EDIT}
      reset={() => pasteServer.reset()}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BULK_EDIT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(BULK_EDIT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rangeSelected(canvas, 'age', BULK_ROWS)).toBe(true),
      )
    })
    await step(BULK_EDIT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(bulkInput(canvas)?.value).toBe(BULK_VALUE))
    })
    await step(BULK_EDIT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(bulkFilled(canvas)).toBe(true))
      expect(consoleText()).toContain('onCommitEdits')
      await settle()
    })
  },
}
