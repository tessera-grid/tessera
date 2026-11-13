import { useState } from 'react'
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
import { seed } from './__mocks__/seed'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  type GuideApp,
  GuideStory,
  type GuideStoryStep,
  guideArgs,
} from './demos/GuideStory'
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
 * возврат к исходному виду.
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

/** Ctrl+Z или Ctrl+Shift+Z на активной ячейке. */
const pressUndo = (root: HTMLElement, redo = false) => {
  const cell = first(root)
  if (cell)
    pressKey(cell, redo ? 'Z' : 'z', {
      code: 'KeyZ',
      ctrlKey: true,
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

const UNDO_PASTE: readonly GuideStoryStep[] = [
  {
    title: 'Цены можно править',
    hint: 'Приложение разрешило править цену и остаток. Над таблицей — кнопки отмены, повтора и истории изменений; правок ещё не было, отменять нечего.',
  },
  {
    title: 'Блок вставлен',
    hint: 'Пользователь выбрал цену во второй строке и вставил три числа. Цены трёх строк изменились, сервер их сохранил. Кнопка отмены теперь называет вставку.',
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: 'Вставка отменена',
    hint: 'Пользователь нажал Ctrl+Z. Таблица вернула прежние цены тем же путём, каким сохраняет правки, — сервер получил прежние значения. Отменённые ячейки выделены.',
    states: ['body.cellRange'],
    enter: untilDone(undoneCheck, root =>
      afterPaste(root, () => once('undo', () => pressUndo(root))),
    ),
  },
  {
    title: 'Вставка повторена',
    hint: 'Пользователь нажал кнопку повтора над таблицей. Вставленные цены вернулись, и вставку снова можно отменить.',
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
    <GuideStory
      title="Отмена вставки"
      steps={UNDO_PASTE}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_PASTE[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_PASTE[1]!.title, () => next(canvasElement, pastedCheck))
    await step(UNDO_PASTE[2]!.title, () => next(canvasElement, undoneCheck))
    await step(UNDO_PASTE[3]!.title, () => next(canvasElement, redoneCheck))
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

const UNDO_ON_SERVER: readonly GuideStoryStep[] = [
  {
    title: 'Правки сохраняет сервер',
    hint: 'Каждая правка цены уходит на сервер. Отмена — тоже правка: таблица отправляет прежние значения и ждёт ответа.',
  },
  {
    title: 'Блок вставлен',
    hint: 'Пользователь вставил три цены, сервер их сохранил.',
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: 'Отмена ждёт сервера',
    hint: 'Пользователь нажал Ctrl+Z. Таблица отправила прежние цены, сервер ещё не ответил: ячейки ждут ответа.',
    states: ['body.cellRange'],
    enter: untilDone(undoWaitsCheck, heldUndo),
  },
  {
    title: 'Сервер принял отмену',
    hint: 'Сервер сохранил прежние цены. Ожидание закончилось, отмена сделана.',
    states: ['body.cellRange'],
    enter: untilDone(undoSavedCheck, root => {
      if (!undoWaitsCheck(root)) heldUndo(root)
      else once('release', () => server.release())
    }),
  },
  {
    title: 'Сервер отклонил повтор',
    hint: 'Пользователь нажал кнопку повтора, а сервер отказал. Цены остались прежними, над таблицей — плашка с причиной и кнопкой повтора; в истории повтор остался на месте.',
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
    <GuideStory
      title="Отмена на сервере"
      steps={UNDO_ON_SERVER}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ON_SERVER[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ON_SERVER[1]!.title, () => next(canvasElement, pastedCheck))
    await step(UNDO_ON_SERVER[2]!.title, () =>
      next(canvasElement, undoWaitsCheck),
    )
    await step(UNDO_ON_SERVER[3]!.title, () =>
      next(canvasElement, undoSavedCheck),
    )
    await step(UNDO_ON_SERVER[4]!.title, () =>
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

const UNDO_WHILE_PENDING: readonly GuideStoryStep[] = [
  {
    title: 'Сервер отвечает не сразу',
    hint: 'Правки цены уходят на сервер, ответ задерживается.',
  },
  {
    title: 'Вставка ждёт сервера',
    hint: 'Пользователь вставил три цены. Сервер ещё не ответил: ячейки ждут.',
    states: ['body.cellRange'],
    enter: untilDone(pasteWaitsCheck, heldPaste),
  },
  {
    title: 'Отмена встала в очередь',
    hint: 'Пользователь сразу нажал Ctrl+Z. Отменять ещё нечего наверняка: неизвестно, сохранит ли сервер вставку. Отмена встала в очередь — кнопка отмены над таблицей ждёт вместе с ячейками, и её можно остановить.',
    states: ['body.cellRange'],
    enter: untilDone(queuedCheck, root => {
      if (!pasteWaitsCheck(root)) heldPaste(root)
      else once('undo', () => pressUndo(root))
    }),
  },
  {
    title: 'Сервер ответил — вставка отменена',
    hint: 'Сервер сохранил вставку, и сразу за ней ушла отмена: цены вернулись к прежним.',
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
    <GuideStory
      title="Отмена во время сохранения"
      steps={UNDO_WHILE_PENDING}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_WHILE_PENDING[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_WHILE_PENDING[1]!.title, () =>
      next(canvasElement, pasteWaitsCheck),
    )
    await step(UNDO_WHILE_PENDING[2]!.title, () =>
      next(canvasElement, queuedCheck),
    )
    await step(UNDO_WHILE_PENDING[3]!.title, () =>
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

const UNDO_CONFLICT: readonly GuideStoryStep[] = [
  {
    title: 'Таблицу правят двое',
    hint: 'Цены правит пользователь, а данные таблицы обновляются и правками коллеги.',
  },
  {
    title: 'Блок вставлен',
    hint: 'Пользователь вставил три цены, сервер их сохранил.',
    states: ['body.cellRange'],
    enter: untilDone(pastedCheck, paste),
  },
  {
    title: 'Коллега изменил цену',
    hint: 'Пришли новые данные: коллега поставил свою цену в первую из вставленных ячеек.',
    enter: untilDone(changedCheck, (root, app: GuideApp) =>
      afterPaste(root, () => colleagueChanges(app)),
    ),
  },
  {
    title: 'Отмена не тронула чужую правку',
    hint: 'Пользователь нажал Ctrl+Z. Две цены вернулись к прежним, а цену коллеги отмена пропустила: чужая правка не пропала молча. Скринридер слышит, сколько ячеек пропущено.',
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
    <GuideStory
      title="Чужая правка"
      steps={UNDO_CONFLICT}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_CONFLICT[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_CONFLICT[1]!.title, () => next(canvasElement, pastedCheck))
    await step(UNDO_CONFLICT[2]!.title, () => next(canvasElement, changedCheck))
    await step(UNDO_CONFLICT[3]!.title, () => next(canvasElement, skippedCheck))
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

const historyOpen = () => !!byTestId('edit-history')
const entries = () =>
  [...document.querySelectorAll<HTMLElement>('[data-history-entry]')].map(
    entry => entry.querySelector<HTMLElement>('button'),
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

/** Нажать облачко записи: новые сверху, последняя в списке — первая правка. */
const pressEntry = (fromBottom: number) => {
  const list = entries()
  list[list.length - 1 - fromBottom]?.click()
}

const rewindTo = (root: HTMLElement) => {
  if (!openCheck(root)) {
    openHistory(root)
    return
  }
  once('rewind', () => pressEntry(0))
}

const HISTORY_REWIND: readonly GuideStoryStep[] = [
  {
    title: 'История изменений',
    hint: 'Над таблицей — кнопка истории: она показывает правки по порядку и возвращает таблицу к любой из них.',
  },
  {
    title: 'Три правки',
    hint: 'Пользователь поменял по очереди три цены — в первой, второй и третьей строках.',
    enter: untilDone(editsCheck, editNext),
  },
  {
    title: 'История открыта',
    hint: 'Пользователь открыл историю: три правки, новые сверху, ни одна не отменена. У каждой — время и кнопка, которая показывает её ячейки.',
    enter: untilDone(openCheck, openHistory),
  },
  {
    title: 'Откат к первой правке',
    hint: 'Пользователь нажал на первую правку. Таблица отменила две правки над ней по очереди; они в списке приглушены, а первая правка выделена как текущая.',
    enter: untilDone(rewoundCheck, rewindTo),
  },
  {
    title: 'Повтор до второй правки',
    hint: 'Пользователь нажал на приглушённую вторую правку. Таблица повторила её, третья осталась отменённой.',
    enter: untilDone(forwardCheck, root => {
      if (!rewoundCheck(root)) {
        rewindTo(root)
        return
      }
      once('forward', () => pressEntry(1))
    }),
  },
]

/** ADR 0222, S5: история правок — откат к шагу и повтор до шага. */
export const HistoryRewind: StoryObj<StoryProps> = {
  name: 'Rewind with the history',
  parameters: { scenario: '0222/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title="История изменений"
      steps={HISTORY_REWIND}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HISTORY_REWIND[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(HISTORY_REWIND[1]!.title, () => next(canvasElement, editsCheck))
    await step(HISTORY_REWIND[2]!.title, () => next(canvasElement, openCheck))
    await step(HISTORY_REWIND[3]!.title, () =>
      next(canvasElement, rewoundCheck),
    )
    await step(HISTORY_REWIND[4]!.title, () =>
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

const UNDO_DRAFTS: readonly GuideStoryStep[] = [
  {
    title: 'Правки копятся',
    hint: 'Приложение сохраняет правки по кнопке: изменённые ячейки ждут, пока пользователь не применит их.',
  },
  {
    title: 'Вставка — неприменённая',
    hint: 'Пользователь вставил три цены. На сервер ничего не ушло: ячейки отмечены как неприменённые.',
    states: ['body.cellRange'],
    enter: untilDone(draftsCheck, paste),
  },
  {
    title: 'Отмена без сервера',
    hint: 'Пользователь нажал Ctrl+Z. Неприменённые цены ушли, вернулись прежние — без запроса на сервер.',
    states: ['body.cellRange'],
    enter: untilDone(draftsUndoneCheck, undoDrafts),
  },
  {
    title: 'Повтор вернул неприменённое',
    hint: 'Пользователь нажал Ctrl+Shift+Z. Вставленные цены снова ждут применения.',
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
    <GuideStory
      title="Отмена неприменённого"
      steps={UNDO_DRAFTS}
      reset={resetGuide}
      args={guideArgs(DRAFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_DRAFTS[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_DRAFTS[1]!.title, () => next(canvasElement, draftsCheck))
    await step(UNDO_DRAFTS[2]!.title, () =>
      next(canvasElement, draftsUndoneCheck),
    )
    await step(UNDO_DRAFTS[3]!.title, () =>
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

const APP_ENTRY: readonly GuideStoryStep[] = [
  {
    title: 'Действие приложения',
    hint: 'Приложение умеет архивировать товар своей кнопкой и кладёт это действие в историю таблицы, чтобы его тоже можно было отменить.',
  },
  {
    title: 'Товар в архиве',
    hint: 'Приложение пометило товар архивным и положило действие в историю.',
    enter: untilDone(archivedCheck, (_root, app: GuideApp) => archive(app)),
  },
  {
    title: 'Отмена ждёт сервера',
    hint: 'Пользователь нажал Ctrl+Z. Приложение отправило запрос на возврат товара из архива, ответа ещё нет.',
    enter: untilDone(appWaitsCheck, appUndo),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер отклонил возврат: товар остался в архиве, отказ записан в журнал отказов, действие осталось в истории.',
    enter: untilDone(appRefusedCheck, refuse),
  },
  {
    title: 'Повтор отмены принят',
    hint: 'Пользователь снова нажал Ctrl+Z, и сервер принял возврат: товар больше не в архиве.',
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
    <GuideStory
      title="Своё действие в истории"
      steps={APP_ENTRY}
      reset={resetGuide}
      args={guideArgs(APP_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(APP_ENTRY[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(APP_ENTRY[1]!.title, () => next(canvasElement, archivedCheck))
    await step(APP_ENTRY[2]!.title, () => next(canvasElement, appWaitsCheck))
    await step(APP_ENTRY[3]!.title, () => next(canvasElement, appRefusedCheck))
    await step(APP_ENTRY[4]!.title, () => next(canvasElement, appUndoneCheck))
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
// Пульт после «Применить всё» закрывается сам.
const deleteAppliedCheck = (root: HTMLElement) =>
  !rowOf(root, DELETED) && !panelOpen()
const restoredCheck = (root: HTMLElement) =>
  done.has('undo') && rowDraftOf(root, DELETED) === 'inserted'
const savedAgainCheck = (root: HTMLElement) =>
  done.has('undo') &&
  !!rowOf(root, DELETED) &&
  rowDraftOf(root, DELETED) === undefined &&
  !panelOpen()

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
  if (!deleteAppliedCheck(root)) {
    applyDelete(root)
    return
  }
  once('undo', () => pressToolbar('undo-button'))
}

const UNDO_ROW_DELETE: readonly GuideStoryStep[] = [
  {
    title: 'Удаление по кнопке',
    hint: 'Приложение сохраняет изменения по кнопке пульта и даёт удалить товар кнопкой в строке.',
  },
  {
    title: 'Строка удалена',
    hint: 'Пользователь удалил бутылку для воды. Строка приглушена и ждёт применения.',
    states: ['body.rowDraft'],
    enter: untilDone(deletedCheck, deleteRowStep),
  },
  {
    title: 'Удаление применено',
    hint: 'Пользователь применил изменения из пульта. Сервер удалил товар, строки больше нет.',
    enter: untilDone(deleteAppliedCheck, applyDelete),
  },
  {
    title: 'Отмена вернула строку',
    hint: 'Пользователь нажал кнопку отмены над таблицей. Товар вернулся на прежнее место новой строкой: на сервере его уже нет, поэтому строка ждёт применения.',
    states: ['body.rowDraft'],
    enter: untilDone(restoredCheck, restoreRow),
  },
  {
    title: 'Товар снова сохранён',
    hint: 'Пользователь применил изменения из пульта. Сервер снова сохранил товар под прежним id, строка стала обычной.',
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
    <GuideStory
      title="Отмена удаления строки"
      steps={UNDO_ROW_DELETE}
      reset={resetGuide}
      args={guideArgs(ROW_DRAFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ROW_DELETE[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ROW_DELETE[1]!.title, () =>
      next(canvasElement, deletedCheck),
    )
    await step(UNDO_ROW_DELETE[2]!.title, () =>
      next(canvasElement, deleteAppliedCheck),
    )
    await step(UNDO_ROW_DELETE[3]!.title, () =>
      next(canvasElement, restoredCheck),
    )
    await step(UNDO_ROW_DELETE[4]!.title, () =>
      next(canvasElement, savedAgainCheck),
    )
    await settle()
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

const UNDO_ROW_MOVE: readonly GuideStoryStep[] = [
  {
    title: 'Порядок товаров',
    hint: 'Приложение даёт переставлять товары ручкой строки и сохраняет порядок на сервере.',
  },
  {
    title: 'Строка перенесена',
    hint: 'Пользователь опустил офисное кресло на строку ниже пунктом меню ручки. Сервер сохранил новый порядок, и перенос можно отменить.',
    enter: untilDone(movedCheck, moveDown),
  },
  {
    title: 'Отмена ждёт сервера',
    hint: 'Пользователь нажал кнопку отмены над таблицей. Кресло вернулось на прежнее место и ждёт ответа сервера.',
    enter: untilDone(moveWaitsCheck, undoMove),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер не принял возврат: кресло вернулось на новое место и коротко вспыхнуло, перенос остался в истории.',
    enter: untilDone(moveRefusedCheck, refuseMove),
  },
  {
    title: 'Повтор отмены принят',
    hint: 'Пользователь снова нажал кнопку отмены, и сервер принял возврат: кресло на прежнем месте.',
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
    <GuideStory
      title="Отмена переноса строки"
      steps={UNDO_ROW_MOVE}
      reset={resetGuide}
      args={guideArgs(MOVE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNDO_ROW_MOVE[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(UNDO_ROW_MOVE[1]!.title, () => next(canvasElement, movedCheck))
    await step(UNDO_ROW_MOVE[2]!.title, () =>
      next(canvasElement, moveWaitsCheck),
    )
    await step(UNDO_ROW_MOVE[3]!.title, () =>
      next(canvasElement, moveRefusedCheck),
    )
    await step(UNDO_ROW_MOVE[4]!.title, () =>
      next(canvasElement, moveUndoneCheck),
    )
    await settle()
  },
}

// --- ADR 0222, S11 --------------------------------------------------------------------

const originalButton = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="edit-history"] [data-action="back-to-original"]',
  )
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
  if (!openCheck(root)) {
    openHistory(root)
    return
  }
  once('original', () => originalButton()?.click())
}

const BACK_TO_ORIGINAL: readonly GuideStoryStep[] = [
  {
    title: 'История изменений',
    hint: 'Над таблицей — кнопка истории: она показывает правки по порядку и возвращает таблицу к любой из них или к виду до первой правки.',
  },
  {
    title: 'Три правки',
    hint: 'Пользователь поменял по очереди три цены — в первой, второй и третьей строках.',
    enter: untilDone(editsCheck, editNext),
  },
  {
    title: 'История открыта',
    hint: 'Пользователь открыл историю: три правки, новые сверху, последняя выделена как текущая. Внизу — кнопка возврата к исходному виду.',
    enter: untilDone(openCheck, openHistory),
  },
  {
    title: 'Исходный вид',
    hint: 'Пользователь нажал кнопку возврата к исходному виду. Таблица отменила правки по очереди, начиная с последней: цены прежние, а правки остались в списке приглушёнными — к ним можно вернуться.',
    enter: untilDone(originalCheck, backToOriginal),
  },
  {
    title: 'Всё возвращено',
    hint: 'Пользователь нажал на верхнюю, самую новую правку. Таблица повторила все три правки по очереди.',
    enter: untilDone(allBackCheck, root => {
      if (!originalCheck(root)) {
        backToOriginal(root)
        return
      }
      once('redoAll', () => pressEntry(EDITS.length - 1))
    }),
  },
]

/** ADR 0222, S11: таблица одной кнопкой возвращается к виду до первой правки и обратно нажатием на запись. */
export const HistoryBackToOriginal: StoryObj<StoryProps> = {
  name: 'Back to original',
  parameters: { scenario: '0222/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title="Исходный вид"
      steps={BACK_TO_ORIGINAL}
      reset={resetGuide}
      args={guideArgs(BASE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BACK_TO_ORIGINAL[0]!.title, async () => {
      await waitForRows(canvasElement)
    })
    await step(BACK_TO_ORIGINAL[1]!.title, () =>
      next(canvasElement, editsCheck),
    )
    await step(BACK_TO_ORIGINAL[2]!.title, () => next(canvasElement, openCheck))
    await step(BACK_TO_ORIGINAL[3]!.title, () =>
      next(canvasElement, originalCheck),
    )
    await step(BACK_TO_ORIGINAL[4]!.title, () =>
      next(canvasElement, allBackCheck),
    )
    await settle()
  },
}
