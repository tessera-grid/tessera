import { useState } from 'react'
import { mod } from './__mocks__/platformKeys'
import { Trash2 } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { REFUSAL } from './__mocks__/heldServer'
import {
  cellOf,
  clickByMouse,
  isSelected,
  pasteInto,
  pressCell,
  pressKey,
  untilDone,
} from './__mocks__/cellGestures'
import {
  byTestId,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import {
  applyNotice,
  applyNoticeEntered,
  applySavedNotice,
} from './__mocks__/applyNotice'
import { seed } from './__mocks__/seed'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  type GuideApp,
  DemoStory,
  type DemoStoryStep,
  guideArgs,
} from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'
import type { AppHistoryEntry as AppEntry } from '../plugins/editHistory'
import { definePlugin } from '../core/definePlugin'
import type { Draft } from '../core/drafts/drafts'
import type { RowAction } from '../core/headerActions'

/**
 * Отмена и повтор правок (ADR 0222): Ctrl+Z после вставки, отмена на сервере с ответом и
 * отказом, отмена ждущей правки, пропуск ячейки, изменённой извне, история с откатом к шагу,
 * отмена черновиков, своё действие приложения в истории, отмена удаления и переноса строки,
 * возврат к исходному виду, отмена сбрасывания и неприменённое в истории.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Undo & redo',
} satisfies Meta<StoryProps>

export default meta

type Product = { id: string; name: string; price: number; stock: number }

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Product', size: 180 },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    dataType: 'number',
    size: 120,
  },
  {
    id: 'stock',
    accessorKey: 'stock',
    header: 'Stock',
    dataType: 'number',
    size: 120,
  },
]

const ROWS: Product[] = [
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
  price: (index + 1) * 10,
  stock: 5 + index,
}))

export const UndoRedoPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Выделите цену, нажмите Ctrl/Cmd+V с числами или Delete, затем Ctrl/Cmd+Z; кнопки и история —
  // в тулбаре. Варианты — предел записей, конфликт, кнопки и пункты меню.
  args: {
    enableCellEditing: true,
    enableCellSelection: true,
    enableKeyboardNavigation: true,
    enableContextMenu: true,
    enableEditHistory: true,
    columnCount: 6,
    dataCount: 20,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls([
    'enableEditHistory',
    'editHistoryLimit',
    'editHistorySources',
    'editHistoryConflict',
    'editHistoryContextMenu',
    'editHistoryToolbar',
    'editHistoryHistoryPanel',
    'enableCellEditing',
    'cellEditingSaveMode',
    'enableCellSelection',
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

/** «Сервер» пакетов: придерживает ответ и отказывает, если задано. */
const server = {
  held: false,
  refuse: false,
  waiting: [] as (() => void)[],
  reset: () => {
    server.held = false
    server.refuse = false
    server.waiting = []
  },
  release: () => {
    server.held = false
    server.waiting.splice(0).forEach(answer => answer())
  },
  answer: <T,>(value: T, reason = REFUSAL) =>
    new Promise<T>((resolve, reject) => {
      const answer = () =>
        server.refuse ? reject(new Error(reason)) : resolve(value)
      if (server.held) server.waiting.push(answer)
      else answer()
    }),
  save: (_batch: CellEditBatch) =>
    server.answer<CellEditBatchResult | void>(undefined),
}

const BASE_ARGS = {
  enableCellEditing: true,
  enableCellSelection: true,
  enableKeyboardNavigation: true,
  enableContextMenu: true,
  enableEditHistory: true,
  columnsOverride: COLUMNS,
  dataOverride: ROWS,
  editableColumns: ['price', 'stock'],
  onCommitEdits: server.save,
  containerHeight: '520',
  height: '420',
  maxHeight: '420',
} as unknown as Partial<StoryProps>

/** Действия шагов — один раз за проход: ответ сервера приходит не сразу. */
const done = new Set<string>()
const once = (key: string, run: () => void) => {
  if (done.has(key)) return
  done.add(key)
  run()
}
const resetGuide = () => {
  server.reset()
  done.clear()
}

/** Текст ячейки без кнопок и отметок. */
const textOf = (root: ParentNode, row: string, column: string) => {
  const copy = cellOf(root, row, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim()
}
const pendingAt = (root: ParentNode, row: string) =>
  cellOf(root, row, 'price')?.getAttribute('aria-busy') === 'true'
const draftAt = (root: ParentNode, row: string) =>
  !!cellOf(root, row, 'price')?.querySelector('[data-cell-draft]')

/** Три цены подряд, куда ложится вставка. */
const ROWS_PASTED = ['item-id-2', 'item-id-3', 'item-id-4']
const PASTED = ['91', '92', '93']
const ORIGINAL = ['20', '30', '40']
const pricesAre = (root: ParentNode, values: readonly string[]) =>
  ROWS_PASTED.every(
    (row, i) =>
      textOf(root, row, 'price') === values[i] && !pendingAt(root, row),
  )

const first = (root: HTMLElement) => cellOf(root, ROWS_PASTED[0]!, 'price')

/** Выбрать первую цену и вставить три числа. */
const paste = (root: HTMLElement) => {
  const cell = first(root)
  if (!cell) return
  if (!isSelected(cell)) {
    pressCell(cell)
    return
  }
  once('paste', () => pasteInto(cell, PASTED.join('\n')))
}

/** Отмена или повтор модификатором платформы на активной ячейке. */
const pressUndo = (root: HTMLElement, redo = false) => {
  const cell = first(root)
  if (cell)
    pressKey(cell, redo ? 'Z' : 'z', {
      code: 'KeyZ',
      ...mod(),
      shiftKey: redo,
    })
}

const pressToolbar = (id: string) => {
  const button = byTestId(id)
  if (button) clickByMouse(button)
}

/** Сначала вставка, затем — `next`, когда вставка сохранена. */
const afterPaste = (root: HTMLElement, next: () => void) => {
  if (!done.has('paste') || !pricesAre(root, PASTED)) {
    if (!done.has('paste')) paste(root)
    return
  }
  next()
}

/** Следующий шаг кнопкой панели и проверка его состояния. */
const next = async (
  canvas: HTMLElement,
  check: (root: HTMLElement) => boolean,
) => {
  await guideNext(canvas)
  await until(() => expect(check(canvas)).toBe(true))
}

// --- ADR 0222, S1 ---------------------------------------------------------------------

const pastedCheck = (root: HTMLElement) =>
  done.has('paste') && pricesAre(root, PASTED)
const undoneCheck = (root: HTMLElement) =>
  done.has('undo') && pricesAre(root, ORIGINAL)
const redoneCheck = (root: HTMLElement) =>
  done.has('redo') && pricesAre(root, PASTED)

const UNDO_PASTE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Цены можно править', en: 'Prices are editable' },
    hint: {
      ru: 'Приложение разрешило править цену и остаток. Над таблицей — кнопки отмены, повтора и истории изменений; правок ещё не было, отменять нечего.',
      en: 'The app allowed editing the price and the stock. Above the table are the undo, redo, and change history buttons; there have been no edits yet, so there is nothing to undo.',
    },
  },
  {
    title: { ru: 'Блок вставлен', en: 'A block was pasted' },
    hint: {
      ru: 'Пользователь выбрал цену во второй строке и вставил три числа. Цены трёх строк изменились, сервер их сохранил. Кнопка отмены теперь называет вставку.',
      en: 'The user selected the price in the second row and pasted three numbers. The prices of three rows changed, and the server saved them. The undo button now names the paste.',
    },
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: { ru: 'Вставка отменена', en: 'Paste undone' },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Таблица вернула прежние цены тем же путём, каким сохраняет правки, — сервер получил прежние значения. Отменённые ячейки выделены.',
      en: 'The user pressed Ctrl+Z. The table restored the previous prices the same way it saves edits: the server received the previous values. The undone cells are selected.',
    },
    states: ['body.cellRange'],
    enter: untilDone(undoneCheck, root =>
      afterPaste(root, () => once('undo', () => pressUndo(root))),
    ),
  },
  {
    title: { ru: 'Вставка повторена', en: 'Paste redone' },
    hint: {
      ru: 'Пользователь нажал кнопку повтора над таблицей. Вставленные цены вернулись, и вставку снова можно отменить.',
      en: 'The user pressed the redo button above the table. The pasted prices came back, and the paste can be undone again.',
    },
    states: ['body.cellRange'],
    enter: untilDone(redoneCheck, root => {
      if (!done.has('undo')) {
        afterPaste(root, () => once('undo', () => pressUndo(root)))
        return
      }
      if (pricesAre(root, ORIGINAL))
        once('redo', () => pressToolbar('redo-button'))
    }),
  },
]

/** ADR 0222, S1: вставку отменяют Ctrl+Z и повторяют кнопкой над таблицей. */
export const UndoPaste: StoryObj<StoryProps> = {
  name: 'Undo a paste',
  parameters: { scenario: '0222/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена вставки', en: 'Undoing a paste' }}
      steps={UNDO_PASTE}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_PASTE[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_PASTE[1]!.title.ru, () => next(canvasElement, pastedCheck))
    await step(UNDO_PASTE[2]!.title.ru, () => next(canvasElement, undoneCheck))
    await step(UNDO_PASTE[3]!.title.ru, () => next(canvasElement, redoneCheck))
    await settle()
  },
}

// --- ADR 0222, S2 ---------------------------------------------------------------------

const undoWaitsCheck = (root: HTMLElement) =>
  done.has('undo') && ROWS_PASTED.every(row => pendingAt(root, row))
const undoSavedCheck = (root: HTMLElement) =>
  done.has('release') && pricesAre(root, ORIGINAL)
const redoRefusedCheck = (root: HTMLElement) =>
  done.has('redo') &&
  !!byTestId('load-error-banner') &&
  pricesAre(root, ORIGINAL)

/** Отмена, которую сервер придерживает. */
const heldUndo = (root: HTMLElement) =>
  afterPaste(root, () =>
    once('undo', () => {
      server.held = true
      pressUndo(root)
    }),
  )

const UNDO_ON_SERVER: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Правки сохраняет сервер', en: 'The server saves edits' },
    hint: {
      ru: 'Каждая правка цены уходит на сервер. Отмена — тоже правка: таблица отправляет прежние значения и ждёт ответа.',
      en: 'Every price edit goes to the server. An undo is an edit too: the table sends the previous values and waits for a response.',
    },
  },
  {
    title: { ru: 'Блок вставлен', en: 'A block was pasted' },
    hint: {
      ru: 'Пользователь вставил три цены, сервер их сохранил.',
      en: 'The user pasted three prices, and the server saved them.',
    },
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: { ru: 'Отмена ждёт сервера', en: 'The undo waits for the server' },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Таблица отправила прежние цены, сервер ещё не ответил: ячейки ждут ответа.',
      en: 'The user pressed Ctrl+Z. The table sent the previous prices, and the server has not responded yet: the cells are waiting for a response.',
    },
    states: ['body.cellRange'],
    enter: untilDone(undoWaitsCheck, heldUndo),
  },
  {
    title: { ru: 'Сервер принял отмену', en: 'The server accepted the undo' },
    hint: {
      ru: 'Сервер сохранил прежние цены. Ожидание закончилось, отмена сделана.',
      en: 'The server saved the previous prices. The waiting is over, and the undo is done.',
    },
    states: ['body.cellRange'],
    enter: untilDone(undoSavedCheck, root => {
      if (!undoWaitsCheck(root)) heldUndo(root)
      else once('release', () => server.release())
    }),
  },
  {
    title: { ru: 'Сервер отклонил повтор', en: 'The server rejected the redo' },
    hint: {
      ru: 'Пользователь нажал кнопку повтора, а сервер отказал. Цены остались прежними, над таблицей — плашка с причиной и кнопкой повтора; в истории повтор остался на месте.',
      en: 'The user pressed the redo button, but the server refused. The prices stayed as they were; above the table is a banner with the reason and a retry button, and the redo stays in place in the history.',
    },
    enter: untilDone(redoRefusedCheck, root => {
      if (!undoSavedCheck(root)) {
        if (!undoWaitsCheck(root)) heldUndo(root)
        else once('release', () => server.release())
        return
      }
      once('redo', () => {
        server.refuse = true
        pressToolbar('redo-button')
      })
    }),
  },
]

/** ADR 0222, S2: отмена сохранённой правки — новый запрос: ожидание, ответ, отказ повтора. */
export const UndoOnServer: StoryObj<StoryProps> = {
  name: 'Undo saved on the server',
  parameters: { scenario: '0222/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена на сервере', en: 'Undo on the server' }}
      steps={UNDO_ON_SERVER}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ON_SERVER[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ON_SERVER[1]!.title.ru, () =>
      next(canvasElement, pastedCheck),
    )
    await step(UNDO_ON_SERVER[2]!.title.ru, () =>
      next(canvasElement, undoWaitsCheck),
    )
    await step(UNDO_ON_SERVER[3]!.title.ru, () =>
      next(canvasElement, undoSavedCheck),
    )
    await step(UNDO_ON_SERVER[4]!.title.ru, () =>
      next(canvasElement, redoRefusedCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S3 ---------------------------------------------------------------------

const pasteWaitsCheck = (root: HTMLElement) =>
  done.has('paste') && ROWS_PASTED.every(row => pendingAt(root, row))
const queuedCheck = (root: HTMLElement) =>
  done.has('undo') && pasteWaitsCheck(root)
const settledCheck = (root: HTMLElement) =>
  done.has('release') && pricesAre(root, ORIGINAL)

const heldPaste = (root: HTMLElement) => {
  server.held = true
  paste(root)
}

const UNDO_WHILE_PENDING: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Сервер отвечает не сразу',
      en: 'The server responds with a delay',
    },
    hint: {
      ru: 'Правки цены уходят на сервер, ответ задерживается.',
      en: 'Price edits go to the server, and the response is delayed.',
    },
  },
  {
    title: { ru: 'Вставка ждёт сервера', en: 'The paste waits for the server' },
    hint: {
      ru: 'Пользователь вставил три цены. Сервер ещё не ответил: ячейки ждут.',
      en: 'The user pasted three prices. The server has not responded yet: the cells are waiting.',
    },
    states: ['body.cellRange'],
    enter: untilDone(pasteWaitsCheck, heldPaste),
  },
  {
    title: { ru: 'Отмена встала в очередь', en: 'The undo is queued' },
    hint: {
      ru: 'Пользователь сразу нажал Ctrl+Z. Отменять ещё нечего наверняка: неизвестно, сохранит ли сервер вставку. Отмена встала в очередь — кнопка отмены над таблицей ждёт вместе с ячейками, и её можно остановить.',
      en: 'The user pressed Ctrl+Z right away. There is nothing to undo for sure yet: it is not known whether the server will save the paste. The undo is queued: the undo button above the table waits along with the cells, and it can be stopped.',
    },
    states: ['body.cellRange'],
    enter: untilDone(queuedCheck, root => {
      if (!pasteWaitsCheck(root)) heldPaste(root)
      else once('undo', () => pressUndo(root))
    }),
  },
  {
    title: {
      ru: 'Сервер ответил — вставка отменена',
      en: 'The server responded, and the paste is undone',
    },
    hint: {
      ru: 'Сервер сохранил вставку, и сразу за ней ушла отмена: цены вернулись к прежним.',
      en: 'The server saved the paste, and the undo went right after it: the prices returned to their previous values.',
    },
    states: ['body.cellRange'],
    enter: untilDone(settledCheck, root => {
      if (!queuedCheck(root)) {
        if (!pasteWaitsCheck(root)) heldPaste(root)
        else once('undo', () => pressUndo(root))
        return
      }
      once('release', () => server.release())
    }),
  },
]

/** ADR 0222, S3: Ctrl+Z, пока правка ждёт сервера, — отмена ждёт её итога. */
export const UndoWhilePending: StoryObj<StoryProps> = {
  name: 'Undo while saving',
  parameters: { scenario: '0222/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена во время сохранения', en: 'Undo while saving' }}
      steps={UNDO_WHILE_PENDING}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_WHILE_PENDING[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_WHILE_PENDING[1]!.title.ru, () =>
      next(canvasElement, pasteWaitsCheck),
    )
    await step(UNDO_WHILE_PENDING[2]!.title.ru, () =>
      next(canvasElement, queuedCheck),
    )
    await step(UNDO_WHILE_PENDING[3]!.title.ru, () =>
      next(canvasElement, settledCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S4 ---------------------------------------------------------------------

const COLLEAGUE_PRICE = '99'
const changedCheck = (root: HTMLElement) =>
  done.has('colleague') &&
  textOf(root, ROWS_PASTED[0]!, 'price') === COLLEAGUE_PRICE
const skippedCheck = (root: HTMLElement) =>
  done.has('undo') &&
  textOf(root, ROWS_PASTED[0]!, 'price') === COLLEAGUE_PRICE &&
  textOf(root, ROWS_PASTED[1]!, 'price') === ORIGINAL[1] &&
  textOf(root, ROWS_PASTED[2]!, 'price') === ORIGINAL[2]

/** Коллега меняет первую вставленную цену: новые данные приложения. */
const colleagueChanges = (app: GuideApp) =>
  once('colleague', () =>
    app.update(props => ({
      ...props,
      dataOverride: ROWS.map(row => {
        const at = ROWS_PASTED.indexOf(row.id)
        if (at === 0) return { ...row, price: Number(COLLEAGUE_PRICE) }
        return at > 0 ? { ...row, price: Number(PASTED[at]) } : row
      }),
    })),
  )

const UNDO_CONFLICT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблицу правят двое', en: 'Two people edit the table' },
    hint: {
      ru: 'Цены правит пользователь, а данные таблицы обновляются и правками коллеги.',
      en: "The user edits prices, and the table's data is also updated with a colleague's edits.",
    },
  },
  {
    title: { ru: 'Блок вставлен', en: 'A block was pasted' },
    hint: {
      ru: 'Пользователь вставил три цены, сервер их сохранил.',
      en: 'The user pasted three prices, and the server saved them.',
    },
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: { ru: 'Коллега изменил цену', en: 'A colleague changed a price' },
    hint: {
      ru: 'Пришли новые данные: коллега поставил свою цену в первую из вставленных ячеек.',
      en: 'New data arrived: a colleague put their own price in the first of the pasted cells.',
    },
    enter: untilDone(changedCheck, (root, app: GuideApp) =>
      afterPaste(root, () => colleagueChanges(app)),
    ),
  },
  {
    title: {
      ru: 'Отмена не тронула чужую правку',
      en: "The undo left someone else's edit alone",
    },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Две цены вернулись к прежним, а цену коллеги отмена пропустила: чужая правка не пропала молча. Скринридер слышит, сколько ячеек пропущено.',
      en: "The user pressed Ctrl+Z. Two prices returned to their previous values, but the undo skipped the colleague's price: someone else's edit did not silently disappear. Screen reader users hear how many cells were skipped.",
    },
    states: ['body.cellRange'],
    enter: untilDone(skippedCheck, (root, app: GuideApp) => {
      if (!changedCheck(root)) {
        afterPaste(root, () => colleagueChanges(app))
        return
      }
      once('undo', () => pressUndo(root))
    }),
  },
]

/** ADR 0222, S4: ячейку, изменённую извне после правки, отмена пропускает. */
export const UndoConflict: StoryObj<StoryProps> = {
  name: 'Changed by someone else',
  parameters: { scenario: '0222/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Чужая правка', en: "Someone else's edit" }}
      steps={UNDO_CONFLICT}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_CONFLICT[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_CONFLICT[1]!.title.ru, () =>
      next(canvasElement, pastedCheck),
    )
    await step(UNDO_CONFLICT[2]!.title.ru, () =>
      next(canvasElement, changedCheck),
    )
    await step(UNDO_CONFLICT[3]!.title.ru, () =>
      next(canvasElement, skippedCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S5 ---------------------------------------------------------------------

/** Три правки по одной цене: вставка числа в строки 1–3. */
const EDITS = [
  { row: 'item-id-1', value: '11' },
  { row: 'item-id-2', value: '22' },
  { row: 'item-id-3', value: '33' },
]
const editsCheck = (root: HTMLElement) =>
  EDITS.every(({ row, value }) => textOf(root, row, 'price') === value) &&
  EDITS.every(({ row }) => !pendingAt(root, row))

/** Следующая из трёх правок: выбрать цену и вставить число. */
const editNext = (root: HTMLElement) => {
  const next = EDITS.find(
    ({ row, value }) => textOf(root, row, 'price') !== value,
  )
  if (!next) return
  const cell = cellOf(root, next.row, 'price')
  if (!cell || pendingAt(root, next.row)) return
  if (!isSelected(cell)) pressCell(cell)
  else pasteInto(cell, next.value)
}

const historyPopup = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-history"][data-open]')
const historyOpen = () => !!historyPopup()
const historyItemAt = (index: number) =>
  historyPopup()?.querySelector<HTMLElement>(
    `[role="listitem"][data-index="${index}"] [data-history-item]`,
  )
const openHistory = (root: HTMLElement) => {
  if (!editsCheck(root)) {
    editNext(root)
    return
  }
  if (!historyOpen()) once('open', () => pressToolbar('edit-history-button'))
}
const openCheck = (root: HTMLElement) => editsCheck(root) && historyOpen()
const rewoundCheck = (root: HTMLElement) =>
  done.has('rewind') &&
  historyOpen() &&
  textOf(root, 'item-id-1', 'price') === '11' &&
  textOf(root, 'item-id-2', 'price') === '20' &&
  textOf(root, 'item-id-3', 'price') === '30'
const forwardCheck = (root: HTMLElement) =>
  done.has('forward') &&
  textOf(root, 'item-id-2', 'price') === '22' &&
  textOf(root, 'item-id-3', 'price') === '30'

/** Список виртуальный. Индекс относится ко всей истории, даже если часть узлов ещё не появилась. */
const pressEntry = (key: string, index: number) => {
  const entry = historyItemAt(index)
  if (entry) once(key, () => entry.click())
}

const rewindTo = (root: HTMLElement) => {
  // При последовательной отмене цены меняются по одной. После нажатия ждём
  // результата вместо повторного восстановления трёх исходных правок.
  if (done.has('rewind')) return
  if (!openCheck(root)) {
    openHistory(root)
    return
  }
  pressEntry('rewind', EDITS.length - 1)
}

const HISTORY_REWIND: readonly DemoStoryStep[] = [
  {
    title: { ru: 'История изменений', en: 'Change history' },
    hint: {
      ru: 'Над таблицей — кнопка истории: она показывает правки по порядку и возвращает таблицу к любой из них.',
      en: 'Above the table is the history button: it shows the edits in order and returns the table to any of them.',
    },
  },
  {
    title: { ru: 'Три правки', en: 'Three edits' },
    hint: {
      ru: 'Пользователь поменял по очереди три цены — в первой, второй и третьей строках.',
      en: 'The user changed three prices one after another, in the first, second, and third rows.',
    },
    enter: untilDone(editsCheck, editNext),
  },
  {
    title: { ru: 'История открыта', en: 'The history is open' },
    hint: {
      ru: 'Пользователь открыл историю: три правки, новые сверху, ни одна не отменена. У каждой — время; синяя точка отмечает текущую, последнюю.',
      en: 'The user opened the history: three edits, newest first, none undone. Each has a time; a blue dot marks the current, latest one.',
    },
    enter: untilDone(openCheck, openHistory),
  },
  {
    title: { ru: 'Откат к первой правке', en: 'Back to the first edit' },
    hint: {
      ru: 'Пользователь нажал на первую правку. Таблица отменила две правки над ней по очереди; они в списке приглушены, а первая правка выделена как текущая.',
      en: 'The user clicked the first edit. The table undid the two edits above it one by one; they are dimmed in the list, and the first edit is highlighted as the current one.',
    },
    enter: untilDone(rewoundCheck, rewindTo),
  },
  {
    title: { ru: 'Повтор до второй правки', en: 'Redo up to the second edit' },
    hint: {
      ru: 'Пользователь нажал на приглушённую вторую правку. Таблица повторила её, третья осталась отменённой.',
      en: 'The user clicked the dimmed second edit. The table redid it, and the third stayed undone.',
    },
    enter: untilDone(forwardCheck, root => {
      if (!rewoundCheck(root)) {
        rewindTo(root)
        return
      }
      pressEntry('forward', EDITS.length - 2)
    }),
  },
]

/** ADR 0222, S5: история правок — откат к шагу и повтор до шага. */
export const HistoryRewind: StoryObj<StoryProps> = {
  name: 'Rewind with the history',
  parameters: { scenario: '0222/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'История изменений', en: 'Change history' }}
      steps={HISTORY_REWIND}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HISTORY_REWIND[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(HISTORY_REWIND[1]!.title.ru, () =>
      next(canvasElement, editsCheck),
    )
    await step(HISTORY_REWIND[2]!.title.ru, () =>
      next(canvasElement, openCheck),
    )
    await step(HISTORY_REWIND[3]!.title.ru, () =>
      next(canvasElement, rewoundCheck),
    )
    await step(HISTORY_REWIND[4]!.title.ru, () =>
      next(canvasElement, forwardCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S6 ---------------------------------------------------------------------

const DRAFT_ARGS = {
  ...BASE_ARGS,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
} as unknown as Partial<StoryProps>

const draftsCheck = (root: HTMLElement) =>
  done.has('paste') &&
  ROWS_PASTED.every(row => draftAt(root, row)) &&
  ROWS_PASTED.every((row, i) => textOf(root, row, 'price') === PASTED[i])
const draftsUndoneCheck = (root: HTMLElement) =>
  done.has('undo') &&
  ROWS_PASTED.every(row => !draftAt(root, row)) &&
  pricesAre(root, ORIGINAL)
const draftsBackCheck = (root: HTMLElement) =>
  done.has('redo') && draftsCheck(root)

const undoDrafts = (root: HTMLElement) => {
  if (!draftsCheck(root)) {
    paste(root)
    return
  }
  once('undo', () => pressUndo(root))
}

const UNDO_DRAFTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Правки копятся', en: 'Edits pile up' },
    hint: {
      ru: 'Приложение сохраняет правки по кнопке: изменённые ячейки ждут, пока пользователь не применит их.',
      en: 'The app saves edits when a button is pressed: changed cells wait until the user applies them.',
    },
  },
  {
    title: { ru: 'Вставка — неприменённая', en: 'The paste is unapplied' },
    hint: {
      ru: 'Пользователь вставил три цены. На сервер ничего не ушло: ячейки отмечены как неприменённые.',
      en: 'The user pasted three prices. Nothing went to the server: the cells are marked as unapplied.',
    },
    states: ['body.cellRange'],
    enter: untilDone(draftsCheck, paste),
  },
  {
    title: { ru: 'Отмена без сервера', en: 'Undo without the server' },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Неприменённые цены ушли, вернулись прежние — без запроса на сервер.',
      en: 'The user pressed Ctrl+Z. The unapplied prices went away, and the previous ones came back, with no request to the server.',
    },
    states: ['body.cellRange'],
    enter: untilDone(draftsUndoneCheck, undoDrafts),
  },
  {
    title: {
      ru: 'Повтор вернул неприменённое',
      en: 'The redo brought back the unapplied edits',
    },
    hint: {
      ru: 'Пользователь нажал Ctrl+Shift+Z. Вставленные цены снова ждут применения.',
      en: 'The user pressed Ctrl+Shift+Z. The pasted prices are waiting to be applied again.',
    },
    states: ['body.cellRange'],
    enter: untilDone(draftsBackCheck, root => {
      if (!draftsUndoneCheck(root)) {
        undoDrafts(root)
        return
      }
      once('redo', () => pressUndo(root, true))
    }),
  },
]

/** ADR 0222, S6: при сохранении по кнопке отмена и повтор меняют неприменённое без сервера. */
export const UndoDrafts: StoryObj<StoryProps> = {
  name: 'Undo unsaved changes',
  parameters: { scenario: '0222/S6', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена неприменённого', en: 'Undoing unapplied edits' }}
      steps={UNDO_DRAFTS}
      reset={resetGuide}
      args={guideArgs(DRAFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_DRAFTS[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_DRAFTS[1]!.title.ru, () => next(canvasElement, draftsCheck))
    await step(UNDO_DRAFTS[2]!.title.ru, () =>
      next(canvasElement, draftsUndoneCheck),
    )
    await step(UNDO_DRAFTS[3]!.title.ru, () =>
      next(canvasElement, draftsBackCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S8 ---------------------------------------------------------------------

/** Таблица для действия приложения: своя запись истории. */
let appTable: { pushHistory: (entry: AppEntry) => string } | null = null
const APP_SEED = seed<typeof appTable & object>('undoAppSeed', table => {
  appTable = table
})

const ARCHIVED_ROW = 'item-id-5'
const ARCHIVED = ' (archived)'
const nameOf = (root: ParentNode) => textOf(root, ARCHIVED_ROW, 'name') ?? ''

/** Приложение помечает товар архивным и кладёт своё действие в историю. */
const archive = (app: GuideApp) =>
  once('archive', () => {
    const setName = (suffix: string) =>
      app.update(props => ({
        ...props,
        dataOverride: ROWS.map(row =>
          row.id === ARCHIVED_ROW ? { ...row, name: row.name + suffix } : row,
        ),
      }))
    setName(ARCHIVED)
    appTable?.pushHistory({
      label: 'Archive a product',
      target: { row: ARCHIVED_ROW },
      undo: () => server.answer(undefined).then(() => setName('')),
      redo: () => server.answer(undefined).then(() => setName(ARCHIVED)),
    })
  })

const archivedCheck = (root: HTMLElement) =>
  done.has('archive') && nameOf(root).endsWith(ARCHIVED)
const appWaitsCheck = (root: HTMLElement) =>
  done.has('undo') && archivedCheck(root) && server.waiting.length > 0
const appRefusedCheck = (root: HTMLElement) =>
  done.has('refused') &&
  server.waiting.length === 0 &&
  nameOf(root).endsWith(ARCHIVED)
const appUndoneCheck = (root: HTMLElement) =>
  done.has('retry') && !nameOf(root).endsWith(ARCHIVED)

const appUndo = (root: HTMLElement, app: GuideApp) => {
  if (!archivedCheck(root)) {
    archive(app)
    return
  }
  once('undo', () => {
    server.held = true
    server.refuse = true
    pressUndo(root)
  })
}

const refuse = (root: HTMLElement, app: GuideApp) => {
  if (!appWaitsCheck(root)) {
    appUndo(root, app)
    return
  }
  once('refused', () => server.release())
}

const APP_ENTRY: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Действие приложения', en: 'An app action' },
    hint: {
      ru: 'Приложение умеет архивировать товар своей кнопкой и кладёт это действие в историю таблицы, чтобы его тоже можно было отменить.',
      en: 'The app can archive a product with its own button and puts this action into the table history so that it can be undone too.',
    },
  },
  {
    title: { ru: 'Товар в архиве', en: 'The product is archived' },
    hint: {
      ru: 'Приложение пометило товар архивным и положило действие в историю.',
      en: 'The app marked the product as archived and put the action into the history.',
    },
    enter: untilDone(archivedCheck, (_root, app: GuideApp) => archive(app)),
  },
  {
    title: { ru: 'Отмена ждёт сервера', en: 'The undo waits for the server' },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Приложение отправило запрос на возврат товара из архива, ответа ещё нет.',
      en: 'The user pressed Ctrl+Z. The app sent a request to restore the product from the archive, and there is no response yet.',
    },
    enter: untilDone(appWaitsCheck, appUndo),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер отклонил возврат: товар остался в архиве, отказ записан в журнал ошибок, действие осталось в истории.',
      en: 'The server rejected the restore: the product stayed archived, the refusal went into the error log, and the action stayed in the history.',
    },
    enter: untilDone(appRefusedCheck, refuse),
  },
  {
    title: { ru: 'Повтор отмены принят', en: 'The repeated undo was accepted' },
    hint: {
      ru: 'Пользователь снова нажал Ctrl+Z, и сервер принял возврат: товар больше не в архиве.',
      en: 'The user pressed Ctrl+Z again, and the server accepted the restore: the product is no longer archived.',
    },
    enter: untilDone(appUndoneCheck, (root, app: GuideApp) => {
      if (!appRefusedCheck(root)) {
        refuse(root, app)
        return
      }
      once('retry', () => {
        server.refuse = false
        pressUndo(root)
      })
    }),
  },
]

const APP_ARGS = {
  ...BASE_ARGS,
  enableFailureLog: true,
  extraPlugins: [APP_SEED],
} as unknown as Partial<StoryProps>

/** ADR 0222, S8: приложение кладёт своё действие в историю; отмена ждёт, отказ, повтор. */
export const AppHistoryEntry: StoryObj<StoryProps> = {
  name: 'Own action in the history',
  parameters: { scenario: '0222/S8', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Своё действие в истории',
        en: "The app's own action in the history",
      }}
      steps={APP_ENTRY}
      reset={resetGuide}
      args={guideArgs(APP_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(APP_ENTRY[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(APP_ENTRY[1]!.title.ru, () => next(canvasElement, archivedCheck))
    await step(APP_ENTRY[2]!.title.ru, () => next(canvasElement, appWaitsCheck))
    await step(APP_ENTRY[3]!.title.ru, () =>
      next(canvasElement, appRefusedCheck),
    )
    await step(APP_ENTRY[4]!.title.ru, () =>
      next(canvasElement, appUndoneCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S9 ---------------------------------------------------------------------

/** Действие приложения «Удалить» в колонке действий строки. */
const deleteRow: RowAction = {
  id: 'deleteRow',
  slot: 'actionRowSlot',
  icon: () => <Trash2 width={16} height={16} />,
  label: () => 'Delete',
  tone: 'danger',
  // У строки с черновиком строки — откат, а не удаление.
  visible: ({ table, row }) =>
    !(table as unknown as { getDrafts: () => readonly Draft[] })
      .getDrafts()
      .some(draft => 'row' in draft.target && draft.target.row === row.id),
  onSelect: ({ table, row }) =>
    (table as unknown as { removeRow: (id: string) => void }).removeRow(row.id),
}
const DELETE_PLUGIN = definePlugin()({
  id: 'undoDeleteRowAction',
  slotActions: [deleteRow],
})()

const ROW_DRAFT_ARGS = {
  ...DRAFT_ARGS,
  enableRowActions: true,
  actionsDemo: 'none',
  extraPlugins: [DELETE_PLUGIN],
} as unknown as Partial<StoryProps>

const DELETED = 'item-id-4'
const rowOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const rowDraftOf = (root: ParentNode, id: string) =>
  rowOf(root, id)?.getAttribute('data-row-draft') ?? undefined
const panelButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const panelOpen = () => !!byTestId('unsaved-changes')
/** Пульт закрыт — открыть, открыт — «Применить всё». */
const applyAll = (root: HTMLElement) => {
  if (!panelOpen()) panelButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}

const deletedCheck = (root: HTMLElement) =>
  rowDraftOf(root, DELETED) === 'deleted'
/** Плашки итога над таблицей нет совсем — и уходящей. */
const noNotice = (root: ParentNode) =>
  !root.querySelector('[data-testid="table-notice"]')
// Пульт после «Применить всё» закрывается сам.
const deleteAppliedCheck = (root: HTMLElement) =>
  !rowOf(root, DELETED) && !panelOpen() && applySavedNotice(root)
const restoredCheck = (root: HTMLElement) =>
  done.has('undo') && rowDraftOf(root, DELETED) === 'inserted' && noNotice(root)
const savedAgainCheck = (root: HTMLElement) =>
  done.has('undo') &&
  !!rowOf(root, DELETED) &&
  rowDraftOf(root, DELETED) === undefined &&
  !panelOpen() &&
  applySavedNotice(root)

const deleteRowStep = (root: HTMLElement) => {
  if (deletedCheck(root)) return
  rowOf(root, DELETED)
    ?.querySelector<HTMLElement>('button[aria-label^="Delete"]')
    ?.click()
}

/** «Применить всё» — до ответа сервера: нажатие посреди открытия пульта тот пропускает. */
const applyDelete = (root: HTMLElement) => {
  if (!deletedCheck(root)) deleteRowStep(root)
  else applyAll(root)
}

const restoreRow = (root: HTMLElement) => {
  if (!done.has('undo') && (rowOf(root, DELETED) || panelOpen())) {
    applyDelete(root)
    return
  }
  // Плашка итога удаления закрыта крестиком, затем отмена.
  const notice = applyNotice(root)
  if (notice) {
    notice.querySelector<HTMLElement>('[data-alert-dismiss]')?.click()
    return
  }
  once('undo', () => pressToolbar('undo-button'))
}

const UNDO_ROW_DELETE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Удаление по кнопке', en: 'Deleting with a button' },
    hint: {
      ru: 'Приложение сохраняет изменения по кнопке пульта и даёт удалить товар кнопкой в строке.',
      en: 'The app saves changes when a button in the unsaved changes panel is pressed and lets the user delete a product with a button in its row.',
    },
  },
  {
    title: { ru: 'Строка удалена', en: 'The row was deleted' },
    hint: {
      ru: 'Пользователь удалил бутылку для воды. Строка приглушена и ждёт применения.',
      en: 'The user deleted the water bottle. The row is dimmed and waits to be applied.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(deletedCheck, deleteRowStep),
  },
  {
    title: { ru: 'Удаление применено', en: 'The deletion is applied' },
    hint: {
      ru: 'Пользователь применил изменения из пульта. Сервер удалил товар, строки больше нет. Над таблицей плашка говорит, что изменение сохранено, и через несколько секунд уходит сама.',
      en: 'The user applied the changes from the unsaved changes panel. The server deleted the product, and the row is gone. A notice above the table says the change was saved and leaves on its own in a few seconds.',
    },
    states: ['body.applySaved'],
    immediate: true,
    enter: untilDone(deleteAppliedCheck, applyDelete),
  },
  {
    title: { ru: 'Отмена вернула строку', en: 'The undo brought the row back' },
    hint: {
      ru: 'Пользователь закрыл плашку итога и нажал кнопку отмены над таблицей. Товар вернулся на прежнее место новой строкой: на сервере его уже нет, поэтому строка ждёт применения.',
      en: 'The user closed the result notice and pressed the undo button above the table. The product returned to its previous place as a new row: it is no longer on the server, so the row is waiting to be applied.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(restoredCheck, restoreRow),
  },
  {
    title: { ru: 'Товар снова сохранён', en: 'The product is saved again' },
    hint: {
      ru: 'Пользователь применил изменения из пульта. Сервер снова сохранил товар под прежним id, строка стала обычной. Над таблицей снова плашка о сохранённом изменении, она уходит сама.',
      en: 'The user applied the changes from the unsaved changes panel. The server saved the product again under its previous id, and the row became a regular one. A notice about the saved change shows above the table again and leaves on its own.',
    },
    states: ['body.applySaved'],
    immediate: true,
    enter: untilDone(savedAgainCheck, root => {
      if (restoredCheck(root)) applyAll(root)
      // Строка сохранена — ждём, пока пульт закроется.
      else if (!done.has('undo')) restoreRow(root)
    }),
  },
]

/** ADR 0222, S9: применённое удаление отмена возвращает строкой, ждущей применения. */
export const UndoRowDelete: StoryObj<StoryProps> = {
  name: 'Undo a row delete',
  parameters: { scenario: '0222/S9', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена удаления строки', en: 'Undoing a row deletion' }}
      steps={UNDO_ROW_DELETE}
      reset={resetGuide}
      args={guideArgs(ROW_DRAFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ROW_DELETE[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ROW_DELETE[1]!.title.ru, () =>
      next(canvasElement, deletedCheck),
    )
    await step(UNDO_ROW_DELETE[2]!.title.ru, async () => {
      await next(canvasElement, deleteAppliedCheck)
      await applyNoticeEntered(canvasElement)
    })
    await step(UNDO_ROW_DELETE[3]!.title.ru, () =>
      next(canvasElement, restoredCheck),
    )
    await step(UNDO_ROW_DELETE[4]!.title.ru, async () => {
      await next(canvasElement, savedAgainCheck)
      await applyNoticeEntered(canvasElement)
    })
  },
}

// --- ADR 0222, S10 --------------------------------------------------------------------

const MOVED = 'item-id-2'
const BELOW = 'item-id-3'

const MOVE_ARGS = {
  ...BASE_ARGS,
  enableRowDragging: true,
  onRowDragEnd: () =>
    server.answer(undefined, 'The server refused to change the order'),
} as unknown as Partial<StoryProps>

const rowIndexOf = (root: ParentNode, id: string) =>
  Number(rowOf(root, id)?.getAttribute('aria-rowindex') ?? -1)
const isBelow = (root: ParentNode) =>
  rowIndexOf(root, MOVED) > rowIndexOf(root, BELOW)
const busy = (root: ParentNode) =>
  rowOf(root, MOVED)?.getAttribute('aria-busy') === 'true'

const movedCheck = (root: HTMLElement) =>
  done.has('move') && isBelow(root) && !busy(root)
const moveWaitsCheck = (root: HTMLElement) =>
  done.has('undo') && !isBelow(root) && busy(root)
const moveRefusedCheck = (root: HTMLElement) =>
  done.has('refused') && isBelow(root) && !busy(root)
const moveUndoneCheck = (root: HTMLElement) =>
  done.has('retry') && !isBelow(root) && !busy(root)

/** Опустить кресло на строку ниже пунктом меню ручки. */
const moveDown = (root: HTMLElement) => {
  const item = document.querySelector<HTMLElement>('[data-item-id="moveDown"]')
  if (item) once('move', () => item.click())
  else if (!done.has('move'))
    rowOf(root, MOVED)
      ?.querySelector<HTMLElement>('.drag__handler--column')
      ?.click()
}

const undoMove = (root: HTMLElement) => {
  if (!movedCheck(root)) {
    moveDown(root)
    return
  }
  once('undo', () => {
    server.held = true
    server.refuse = true
    pressToolbar('undo-button')
  })
}

const refuseMove = (root: HTMLElement) => {
  if (!moveWaitsCheck(root)) {
    undoMove(root)
    return
  }
  once('refused', () => server.release())
}

const UNDO_ROW_MOVE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Порядок товаров', en: 'Product order' },
    hint: {
      ru: 'Приложение даёт переставлять товары ручкой строки и сохраняет порядок на сервере.',
      en: "The app lets the user reorder products with the row's drag handle and saves the order on the server.",
    },
  },
  {
    title: { ru: 'Строка перенесена', en: 'The row was moved' },
    hint: {
      ru: 'Пользователь опустил офисное кресло на строку ниже пунктом меню ручки. Сервер сохранил новый порядок, и перенос можно отменить.',
      en: 'The user moved the office chair one row down with a drag handle menu item. The server saved the new order, and the move can be undone.',
    },
    enter: untilDone(movedCheck, moveDown),
  },
  {
    title: { ru: 'Отмена ждёт сервера', en: 'The undo waits for the server' },
    hint: {
      ru: 'Пользователь нажал кнопку отмены над таблицей. Кресло вернулось на прежнее место и ждёт ответа сервера.',
      en: "The user pressed the undo button above the table. The chair returned to its previous place and is waiting for the server's response.",
    },
    enter: untilDone(moveWaitsCheck, undoMove),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не принял возврат: кресло вернулось на новое место и коротко вспыхнуло, перенос остался в истории.',
      en: 'The server did not accept the move back: the chair returned to its new place and flashed briefly, and the move stayed in the history.',
    },
    enter: untilDone(moveRefusedCheck, refuseMove),
  },
  {
    title: { ru: 'Повтор отмены принят', en: 'The repeated undo was accepted' },
    hint: {
      ru: 'Пользователь снова нажал кнопку отмены, и сервер принял возврат: кресло на прежнем месте.',
      en: 'The user pressed the undo button again, and the server accepted the move back: the chair is in its previous place.',
    },
    enter: untilDone(moveUndoneCheck, root => {
      if (!moveRefusedCheck(root)) {
        refuseMove(root)
        return
      }
      once('retry', () => {
        server.refuse = false
        pressToolbar('undo-button')
      })
    }),
  },
]

/** ADR 0222, S10: перенос строки отменяют; отмена ждёт сервера, отказ, повтор. */
export const UndoRowMove: StoryObj<StoryProps> = {
  name: 'Undo a row move',
  parameters: { scenario: '0222/S10', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена переноса строки', en: 'Undoing a row move' }}
      steps={UNDO_ROW_MOVE}
      reset={resetGuide}
      args={guideArgs(MOVE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ROW_MOVE[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ROW_MOVE[1]!.title.ru, () =>
      next(canvasElement, movedCheck),
    )
    await step(UNDO_ROW_MOVE[2]!.title.ru, () =>
      next(canvasElement, moveWaitsCheck),
    )
    await step(UNDO_ROW_MOVE[3]!.title.ru, () =>
      next(canvasElement, moveRefusedCheck),
    )
    await step(UNDO_ROW_MOVE[4]!.title.ru, () =>
      next(canvasElement, moveUndoneCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S11 --------------------------------------------------------------------

const originalButton = () =>
  historyPopup()?.querySelector<HTMLElement>('[data-action="back-to-original"]')
const pricesOf = (root: HTMLElement) =>
  EDITS.map(({ row }) => textOf(root, row, 'price'))
const settled = (root: HTMLElement) =>
  EDITS.every(({ row }) => !pendingAt(root, row))

const originalCheck = (root: HTMLElement) =>
  done.has('original') &&
  historyOpen() &&
  settled(root) &&
  pricesOf(root).join() === '10,20,30' &&
  originalButton()?.hasAttribute('data-disabled') === true
const allBackCheck = (root: HTMLElement) =>
  done.has('redoAll') &&
  settled(root) &&
  pricesOf(root).join() === EDITS.map(({ value }) => value).join()

const backToOriginal = (root: HTMLElement) => {
  if (done.has('original')) return
  if (!openCheck(root)) {
    openHistory(root)
    return
  }
  const button = originalButton()
  if (button) once('original', () => button.click())
}

const BACK_TO_ORIGINAL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'История изменений', en: 'Change history' },
    hint: {
      ru: 'Над таблицей — кнопка истории: она показывает правки по порядку и возвращает таблицу к любой из них или к виду до первой правки.',
      en: 'Above the table is the history button: it shows the edits in order and returns the table to any of them or to how it looked before the first edit.',
    },
  },
  {
    title: { ru: 'Три правки', en: 'Three edits' },
    hint: {
      ru: 'Пользователь поменял по очереди три цены — в первой, второй и третьей строках.',
      en: 'The user changed three prices one after another, in the first, second, and third rows.',
    },
    enter: untilDone(editsCheck, editNext),
  },
  {
    title: { ru: 'История открыта', en: 'The history is open' },
    hint: {
      ru: 'Пользователь открыл историю: три правки, новые сверху, последняя выделена как текущая. Внизу — кнопка возврата к исходному виду.',
      en: 'The user opened the history: three edits, newest first, with the latest highlighted as the current one. At the bottom is a button that returns to the original view.',
    },
    enter: untilDone(openCheck, openHistory),
  },
  {
    title: { ru: 'Исходный вид', en: 'The original view' },
    hint: {
      ru: 'Пользователь нажал кнопку возврата к исходному виду. Таблица отменила правки по очереди, начиная с последней: цены прежние, а правки остались в списке приглушёнными — к ним можно вернуться.',
      en: 'The user pressed the button that returns to the original view. The table undid the edits one by one, starting with the latest: the prices are back to their previous values, and the edits stay dimmed in the list, so the user can return to them.',
    },
    enter: untilDone(originalCheck, backToOriginal),
  },
  {
    title: { ru: 'Всё возвращено', en: 'Everything is restored' },
    hint: {
      ru: 'Пользователь нажал на верхнюю, самую новую правку. Таблица повторила все три правки по очереди.',
      en: 'The user clicked the top, newest edit. The table redid all three edits one by one.',
    },
    enter: untilDone(allBackCheck, root => {
      if (!originalCheck(root)) {
        backToOriginal(root)
        return
      }
      const newest = historyItemAt(0)
      if (newest?.closest('[data-undone]')) {
        once('redoAll', () => newest.click())
      }
    }),
  },
]

/** ADR 0222, S11: таблица одной кнопкой возвращается к виду до первой правки и обратно нажатием на запись. */
export const HistoryBackToOriginal: StoryObj<StoryProps> = {
  name: 'Back to original',
  parameters: { scenario: '0222/S11', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Исходный вид', en: 'The original view' }}
      steps={BACK_TO_ORIGINAL}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BACK_TO_ORIGINAL[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(BACK_TO_ORIGINAL[1]!.title.ru, () =>
      next(canvasElement, editsCheck),
    )
    await step(BACK_TO_ORIGINAL[2]!.title.ru, () =>
      next(canvasElement, openCheck),
    )
    await step(BACK_TO_ORIGINAL[3]!.title.ru, () =>
      next(canvasElement, originalCheck),
    )
    await step(BACK_TO_ORIGINAL[4]!.title.ru, async () => {
      await guideNext(canvasElement)
      await until(() => {
        expect(pricesOf(canvasElement)).toEqual(EDITS.map(({ value }) => value))
        expect(settled(canvasElement)).toBe(true)
        expect(done.has('redoAll')).toBe(true)
      })
    })
    await settle()
  },
}

// --- ADR 0222, S12 --------------------------------------------------------------------

const discardAllButton = () =>
  document.querySelector<HTMLElement>('[data-action="discard-all"]')
const noDrafts = (root: HTMLElement) =>
  ROWS_PASTED.every(row => !draftAt(root, row))

const discardedCheck = (root: HTMLElement) =>
  done.has('discardAll') && noDrafts(root) && pricesAre(root, ORIGINAL)
const discardUndoneCheck = (root: HTMLElement) =>
  done.has('undoDiscard') && draftsCheck(root)

/** Открыть пульт и сбросить всё; нажатие посреди открытия пульт пропускает — до итога. */
const discardEverything = (root: HTMLElement) => {
  if (!done.has('discardAll') && !draftsCheck(root)) {
    paste(root)
    return
  }
  if (!panelOpen()) {
    if (!noDrafts(root)) panelButton(root)?.click()
    return
  }
  done.add('discardAll')
  discardAllButton()?.click()
}

const UNDO_DISCARD: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Правки копятся', en: 'Edits pile up' },
    hint: {
      ru: 'Приложение сохраняет правки по кнопке: изменённые ячейки ждут применения, а пульт над таблицей собирает их и умеет сбросить.',
      en: 'The app saves edits when a button is pressed: changed cells wait to be applied, and the unsaved changes panel above the table collects them and can revert them.',
    },
  },
  {
    title: { ru: 'Вставка — неприменённая', en: 'The paste is unapplied' },
    hint: {
      ru: 'Пользователь вставил три цены. На сервер ничего не ушло: ячейки отмечены как неприменённые.',
      en: 'The user pasted three prices. Nothing went to the server: the cells are marked as unapplied.',
    },
    states: ['body.cellRange'],
    enter: untilDone(draftsCheck, paste),
  },
  {
    title: { ru: 'Всё сброшено', en: 'Everything is reverted' },
    hint: {
      ru: 'Пользователь открыл пульт и сбросил все изменения. Пульт пуст, цены прежние, а в истории изменений появилась запись об сбрасывании.',
      en: 'The user opened the unsaved changes panel and reverted all changes. The panel is empty, the prices are back to their previous values, and the change history has an entry for the revert.',
    },
    enter: untilDone(discardedCheck, discardEverything),
  },
  {
    title: { ru: 'Сбрасывание отменено', en: 'The revert is undone' },
    hint: {
      ru: 'Пользователь нажал Ctrl+Z. Сначала отменяется последнее действие — сбрасывание: три цены вернулись неприменёнными и снова в пульте.',
      en: 'The user pressed Ctrl+Z. The latest action, the revert, is undone first: the three prices came back unapplied and are in the panel again.',
    },
    states: ['body.cellRange'],
    enter: untilDone(discardUndoneCheck, root => {
      if (!discardedCheck(root)) {
        discardEverything(root)
        return
      }
      once('undoDiscard', () => pressUndo(root))
    }),
  },
]

/** ADR 0222, S12: сброшенные в пульте изменения возвращает Ctrl+Z. */
export const UndoDiscard: StoryObj<StoryProps> = {
  name: 'Undo a revert',
  parameters: { scenario: '0222/S12', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена сбрасывания', en: 'Undoing a revert' }}
      steps={UNDO_DISCARD}
      reset={resetGuide}
      args={guideArgs(DRAFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_DISCARD[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_DISCARD[1]!.title.ru, () =>
      next(canvasElement, draftsCheck),
    )
    await step(UNDO_DISCARD[2]!.title.ru, () =>
      next(canvasElement, discardedCheck),
    )
    await step(UNDO_DISCARD[3]!.title.ru, () =>
      next(canvasElement, discardUndoneCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S13 --------------------------------------------------------------------

const historyEntry = () =>
  document.querySelector<HTMLElement>('[data-history-entry]')
const appliedMark = () =>
  document.querySelector<HTMLElement>('[data-history-applied]')

const unsavedShownCheck = (root: HTMLElement) =>
  draftsCheck(root) &&
  historyOpen() &&
  historyEntry()?.hasAttribute('data-unsaved') === true
const appliedShownCheck = (root: HTMLElement) =>
  done.has('apply') &&
  historyOpen() &&
  !!appliedMark() &&
  historyEntry()?.hasAttribute('data-unsaved') === false &&
  pricesAre(root, PASTED) &&
  applySavedNotice(root)

const showUnsaved = (root: HTMLElement) => {
  if (!draftsCheck(root)) {
    paste(root)
    return
  }
  if (!historyOpen()) once('open', () => pressToolbar('edit-history-button'))
}

/** «Применить всё» в пульте, затем снова открыть историю: пульт её закрыл. */
const applyAndShow = (root: HTMLElement) => {
  if (!done.has('apply')) {
    if (!draftsCheck(root)) {
      paste(root)
      return
    }
    if (panelOpen()) {
      done.add('apply')
      applyAll(root)
    } else panelButton(root)?.click()
    return
  }
  if (!pricesAre(root, PASTED) || panelOpen()) return
  if (!historyOpen()) once('reopen', () => pressToolbar('edit-history-button'))
}

const HISTORY_APPLIED: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Правки копятся', en: 'Edits pile up' },
    hint: {
      ru: 'Приложение сохраняет правки по кнопке. История изменений отмечает правки, которые ещё не ушли на сервер, и момент, когда их применили.',
      en: 'The app saves edits when a button is pressed. The change history marks the edits that have not gone to the server yet and the moment they were applied.',
    },
  },
  {
    title: { ru: 'Вставка — неприменённая', en: 'The paste is unapplied' },
    hint: {
      ru: 'Пользователь вставил три цены. На сервер ничего не ушло: ячейки отмечены как неприменённые.',
      en: 'The user pasted three prices. Nothing went to the server: the cells are marked as unapplied.',
    },
    states: ['body.cellRange'],
    enter: untilDone(draftsCheck, paste),
  },
  {
    title: {
      ru: 'Неприменённое в истории',
      en: 'Unapplied changes in the history',
    },
    hint: {
      ru: 'Пользователь открыл историю изменений. Точка у вставки — тона неприменённого: эти правки ещё не отправлены.',
      en: 'The user opened the change history. The dot next to the paste is in the unapplied tone: these edits have not been sent yet.',
    },
    enter: untilDone(unsavedShownCheck, showUnsaved),
  },
  {
    title: { ru: 'Изменения применены', en: 'The changes are applied' },
    hint: {
      ru: 'Пользователь применил изменения из пульта и снова открыл историю. Сервер сохранил три цены: точка у вставки синяя, а над вставкой — отметка, сколько изменений применено и когда. Над таблицей плашка говорит, сколько изменений сохранено, и через несколько секунд уходит сама.',
      en: 'The user applied the changes from the unsaved changes panel and opened the history again. The server saved the three prices: the dot next to the paste is blue, and above the paste is a mark showing how many changes were applied and when. A notice above the table says how many changes were saved and leaves on its own in a few seconds.',
    },
    states: ['body.applySaved'],
    immediate: true,
    enter: untilDone(appliedShownCheck, applyAndShow),
  },
]

/** ADR 0222, S13: история показывает неприменённое и момент применения. */
export const HistoryApplied: StoryObj<StoryProps> = {
  name: 'Unsaved and applied in the history',
  parameters: { scenario: '0222/S13', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Неприменённое в истории',
        en: 'Unapplied changes in the history',
      }}
      steps={HISTORY_APPLIED}
      reset={resetGuide}
      args={guideArgs(
        {
          ...DRAFT_ARGS,
          containerHeight: '340',
          height: '240',
          maxHeight: '240',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HISTORY_APPLIED[0]!.title.ru, async () => {
      await waitForRows(canvasElement)
    })
    await step(HISTORY_APPLIED[1]!.title.ru, () =>
      next(canvasElement, draftsCheck),
    )
    const historyVisible = () =>
      until(() => {
        const popup = historyPopup()
        expect(popup).toBeTruthy()
        expect(getComputedStyle(popup!).opacity).toBe('1')
      })
    await step(HISTORY_APPLIED[2]!.title.ru, async () => {
      await next(canvasElement, unsavedShownCheck)
      await historyVisible()
    })
    await step(HISTORY_APPLIED[3]!.title.ru, async () => {
      await next(canvasElement, appliedShownCheck)
      await applyNoticeEntered(canvasElement)
      await historyVisible()
    })
  },
}
