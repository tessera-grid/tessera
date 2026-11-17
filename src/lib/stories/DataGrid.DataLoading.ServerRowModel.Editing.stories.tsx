import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './__mocks__/filteringData'
import { untilDone } from './__mocks__/cellGestures'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import type { CellEditCommit } from '../plugins'
import type { CellEditBatch } from '../plugins/cellEditing/types'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import type { Draft } from '../core/drafts/drafts'
import { storyLabels } from './__mocks__/storyLabels'
import { layout, hasRow, serverProps } from './__mocks__/serverRowModelGuide'

/**
 * Правка ячейки в серверной модели (ADR 0139): `Playground` — строки с «сервера» с правкой
 * ячеек, время ответа сохранения — контролом; S1 — сервер возвращает сохранённую строку;
 * ADR 0227, S4 — строку удалили на сервере, пока её правка ждала сохранения.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Editing',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface EditingPlaygroundArgs extends StoryProps {
  saveDelayMs: number
}

export const ServerEditingPlayground: StoryObj<EditingPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['saveDelayMs'], {
    dataCount: 'the demo server provides the rows',
    columnCount: 'the demo sets the columns',
  }),
  // «Сервер» сохраняет правку и возвращает строку: числа — числами.
  args: { ...layout, saveDelayMs: 800 },
  argTypes: {
    saveDelayMs: {
      description: 'Server response time for a save, ms',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
  },
  render: ({ saveDelayMs, ...args }) => (
    <StoryComponent
      {...normalizeArgs(args)}
      {...serverProps({ total: 1000, knownTotal: true, blockSize: 50 })!(
        AT_REST,
      )}
      enableCellEditing
      onCellEdit={({ rowId, columnId, value, original }: CellEditCommit) =>
        new Promise<FilteringItem>(resolve =>
          setTimeout(
            () =>
              resolve({
                ...filteringItemAt(Number(rowId.split('-').at(-1))),
                [columnId]:
                  typeof original === 'number' ? Number(value) : value,
              }),
            saveDelayMs,
          ),
        )
      }
    />
  ),
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(hasRow(canvas, 0)).toBe(true))
    await settle()
  },
}

// --- ADR 0139 S1 ---------------------------------------------------------------------

const EDIT_TOTAL = 1000
const EDIT_BLOCK = 50
const EDIT_ROW = 'item-id-1'
const TYPED_AGE = '33.6'
const SAVED_AGE = '34'

/** Сохранение на «сервере» ждёт шага гайда. */
const edit = { save: undefined as (() => void) | undefined }

const ageCellOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${EDIT_ROW}"] .data-grid__body-cell[data-column-id="age"]`,
  )
const ageInput = (root: ParentNode) =>
  ageCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
const ageEditButton = (root: ParentNode) =>
  ageCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null
/** Значение в ячейке — без кнопки правки. */
const ageText = (root: ParentNode) => {
  const copy = ageCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
/** Ожидание сохранения — на ячейке (ADR 0177, §1). */
const agePending = (root: ParentNode) =>
  ageCellOf(root)?.getAttribute('aria-busy') === 'true'

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeAge = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Пользователь открывает правку возраста, набирает число и сохраняет клавишей Enter. */
const saveAge = (root: HTMLElement) => {
  const input = ageInput(root)
  if (!input) ageEditButton(root)?.click()
  else if (input.value !== TYPED_AGE) typeAge(input, TYPED_AGE)
  else
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
}

const editProps: GuideStoryStep['props'] = context => ({
  ...serverProps({
    total: EDIT_TOTAL,
    knownTotal: true,
    blockSize: EDIT_BLOCK,
  })!(context),
  enableCellEditing: true,
  // «Сервер» округляет возраст до целого и отдаёт сохранённую строку.
  onCellEdit: ({ rowId, value }: CellEditCommit) =>
    new Promise<FilteringItem>(resolve => {
      edit.save = () =>
        resolve({
          ...filteringItemAt(Number(rowId.split('-').at(-1))),
          age: Math.round(Number(value)),
        })
    }),
})

const EDIT_CELL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки с сервера', en: 'Rows from the server' },
    hint: {
      ru: 'Сервер отдаёт строки блоками, данные строк держит таблица. Возраст можно править: у ячеек колонки при наведении появляется кнопка правки.',
      en: 'The server sends rows in blocks, and the table holds the row data. Age can be edited: hovering a cell in that column shows an edit button.',
    },
    props: editProps,
  },
  {
    title: { ru: 'Пользователь сохранил правку', en: 'The user saved an edit' },
    hint: {
      ru: 'Пользователь поправил возраст и сохранил. Пока сервер отвечает, в ячейке — введённое значение, ячейка чуть темнеет и по ней проходит светлый блик.',
      en: 'The user edited the age and saved it. While the server is responding, the cell shows the entered value, darkens slightly, and a light shimmer runs across it.',
    },
    states: ['body.pending'],
    enter: untilDone(agePending, saveAge),
  },
  {
    title: { ru: 'Сервер сохранил запись', en: 'The server saved the record' },
    hint: {
      ru: 'Сервер сохранил запись и вернул её: возраст округлён до целого. Таблица показывает сохранённое значение, ячейка коротко вспыхнула.',
      en: 'The server saved the record and returned it with the age rounded to a whole number. The table shows the saved value, and the cell flashed briefly.',
    },
    immediate: true,
    enter: untilDone(
      root => ageText(root) === SAVED_AGE && !agePending(root),
      root => (agePending(root) ? edit.save?.() : saveAge(root)),
    ),
  },
]

/** ADR 0139, S1: пользователь правит число, сервер возвращает сохранённую строку. */
export const ServerRowModelEditCell: StoryObj<StoryProps> = {
  name: 'Edit a cell',
  parameters: { scenario: '0139/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка на сервере', en: 'Editing on the server' }}
      steps={EDIT_CELL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_CELL[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(ageText(canvas)).toBe('25'))
    })
    // Шаги правки идут таймером до своего состояния — ждём само состояние.
    await step(EDIT_CELL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(agePending(canvas)).toBe(true))
      await expect(ageText(canvas)).toBe(TYPED_AGE)
    })
    await step(EDIT_CELL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ageText(canvas)).toBe(SAVED_AGE))
      await settle()
    })
  },
}

// --- ADR 0222, S7 ---------------------------------------------------------------------

/** «Сервер» помнит сохранённые возрасты: окно, пришедшее после правки, их несёт. */
const savedAges = new Map<string, unknown>()
const ORIGINAL_AGE = '25'
const indexOfRow = (rowId: string) => Number(rowId.split('-').at(-1))
const rowAt = (i: number): FilteringItem => {
  const row = filteringItemAt(i)
  return savedAges.has(row.id)
    ? { ...row, age: savedAges.get(row.id) as number }
    : row
}

const undoProps: GuideStoryStep['props'] = () => ({
  columnsOverride: filteringColumns,
  dataOverride: [],
  enableServerRowModel: true,
  serverRowModelBlockSize: EDIT_BLOCK,
  serverRowModelMaxBlocks: 2,
  rowCount: EDIT_TOTAL,
  serverRowModelGetRows: ({ start, end }: { start: number; end: number }) =>
    Promise.resolve({
      rows: Array.from({ length: end - start }, (_, k) => rowAt(start + k)),
    }),
  enableCellEditing: true,
  // Без активной ячейки: её блок кэш не вытесняет (ADR 0138, SD9).
  enableCellSelection: false,
  enableKeyboardNavigation: false,
  enableEditHistory: true,
  onCellEdit: ({ rowId, value }: CellEditCommit) => {
    savedAges.set(rowId, value)
    return { ...rowAt(indexOfRow(rowId)) }
  },
  onCommitEdits: (batch: CellEditBatch) => {
    for (const cell of batch.cells) savedAges.set(cell.rowId, cell.value)
  },
})

const scroller = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')
/** Прокрутка: доля высоты от 0 до 1. */
const scrollTo = (root: ParentNode, at: number) => {
  const element = scroller(root)
  if (element)
    element.scrollTop = (element.scrollHeight - element.clientHeight) * at
}
/** Строка последнего блока на экране: таблица дошла до конца. */
const atEnd = (root: HTMLElement) => hasRow(root, EDIT_TOTAL - 1)
const atMiddle = (root: HTMLElement) => hasRow(root, EDIT_TOTAL / 2)

const ageSaved = (root: HTMLElement) =>
  savedAges.get(EDIT_ROW) === Number(TYPED_AGE) &&
  ageText(root) === TYPED_AGE &&
  !agePending(root)
/** Через середину в конец: три блока при пределе в два — первый уходит из памяти. */
let passedMiddle = false
const scrolledAway = (root: HTMLElement) =>
  savedAges.get(EDIT_ROW) === Number(TYPED_AGE) &&
  passedMiddle &&
  atEnd(root) &&
  !ageCellOf(root)
const undoneOnServer = () =>
  savedAges.get(EDIT_ROW) === Number(ORIGINAL_AGE) &&
  !document.querySelector('[data-testid="load-error-banner"]')
const backAtTop = (root: HTMLElement) =>
  undoneOnServer() && ageText(root) === ORIGINAL_AGE && !agePending(root)

/** Правка, затем прокрутка вниз: блок с правленой строкой уходит из кэша. */
const awayAfterEdit = (root: HTMLElement) => {
  if (savedAges.get(EDIT_ROW) !== Number(TYPED_AGE)) saveAge(root)
  else if (!passedMiddle) {
    if (atMiddle(root)) passedMiddle = true
    else scrollTo(root, 0.5)
  } else scrollTo(root, 1)
}

let undoPressed = false
const undoAway = (root: HTMLElement) => {
  if (!scrolledAway(root) && !undoPressed) {
    awayAfterEdit(root)
    return
  }
  if (undoPressed) return
  undoPressed = true
  document.querySelector<HTMLElement>('[data-testid="undo-button"]')?.click()
}

const SERVER_UNDO: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки с сервера', en: 'Rows from the server' },
    hint: {
      ru: 'Сервер отдаёт строки блоками, таблица держит в памяти только два блока. Возраст можно править, над таблицей — кнопки отмены и повтора.',
      en: 'The server sends rows in blocks, and the table keeps only two blocks in memory. Age can be edited, and undo and redo buttons are above the table.',
    },
    props: undoProps,
  },
  {
    title: { ru: 'Возраст поправлен', en: 'The age was edited' },
    hint: {
      ru: 'Пользователь поправил возраст во второй строке и сохранил. Сервер принял правку.',
      en: 'The user edited the age in the second row and saved it. The server accepted the edit.',
    },
    states: ['body.pending'],
    enter: untilDone(ageSaved, saveAge),
  },
  {
    title: { ru: 'Таблица прокручена вниз', en: 'The table is scrolled down' },
    hint: {
      ru: 'Пользователь прокрутил таблицу в конец. Блок с поправленной строкой ушёл из памяти таблицы.',
      en: "The user scrolled the table to the end. The block with the edited row was dropped from the table's memory.",
    },
    enter: untilDone(scrolledAway, awayAfterEdit),
  },
  {
    title: { ru: 'Отмена вернула возраст', en: 'Undo restored the age' },
    hint: {
      ru: 'Пользователь нажал кнопку отмены. Строки в памяти таблицы уже не было: таблица запросила её у сервера, проверила, что возраст в ней прежний после правки, отправила прежнее значение и прокрутила к строке.',
      en: "The user pressed the undo button. The row was no longer in the table's memory: the table requested it from the server, checked that its age had not changed since the edit, sent the previous value, and scrolled to the row.",
    },
    enter: untilDone(backAtTop, undoAway),
  },
]

/** ADR 0222, S7: отмена правки, чья строка ушла из кэша окна, — догрузка строки и запись. */
export const ServerUndo: StoryObj<StoryProps> = {
  name: 'Undo an edit off the window',
  parameters: { scenario: '0222/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отмена ушедшей правки', en: 'Undoing an edit out of view' }}
      steps={SERVER_UNDO}
      reset={() => {
        savedAges.clear()
        undoPressed = false
        passedMiddle = false
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVER_UNDO[0]!.title.ru, async () => {
      await until(() => expect(ageText(canvas)).toBe(ORIGINAL_AGE))
    })
    await step(SERVER_UNDO[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ageSaved(canvas)).toBe(true))
    })
    await step(SERVER_UNDO[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(scrolledAway(canvas)).toBe(true))
    })
    await step(SERVER_UNDO[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(backAtTop(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0227, S4 ---------------------------------------------------------------------

/** Строка, которую удалили на сервере, пока её правка ждала сохранения. */
const GONE_ROW = 'item-id-2'
/** Ответ «сервера» своими словами: таблица показывает его как есть. */
const GONE_REASON = `Record ${GONE_ROW} not found`
const KEPT_AGE = '40'
const GONE_AGE = '41'
const GONE_DRAFTS: Draft[] = [
  [EDIT_ROW, KEPT_AGE],
  [GONE_ROW, GONE_AGE],
].map(([row, age]) => ({
  kind: 'cellValue',
  target: { cell: [row!, 'age'] },
  value: { value: Number(age), text: age! },
}))

const goneProps: GuideStoryStep['props'] = () => ({
  columnsOverride: filteringColumns,
  dataOverride: [],
  enableServerRowModel: true,
  serverRowModelBlockSize: EDIT_BLOCK,
  rowCount: EDIT_TOTAL,
  serverRowModelGetRows: ({ start, end }: { start: number; end: number }) =>
    Promise.resolve({
      rows: Array.from({ length: end - start }, (_, k) => rowAt(start + k)),
    }),
  enableCellEditing: true,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
  enableFailureLog: true,
  enableToolbar: true,
  initialDrafts: GONE_DRAFTS,
  // «Сервер» сохраняет правки, а правке удалённой строки отказывает своим текстом.
  onCommitEdits: (batch: CellEditBatch) => {
    for (const cell of batch.cells)
      if (cell.rowId !== GONE_ROW) savedAges.set(cell.rowId, cell.value)
    return {
      refused: batch.cells
        .filter(cell => cell.rowId === GONE_ROW)
        .map(cell => ({
          rowId: cell.rowId,
          columnId: cell.columnId,
          reason: GONE_REASON,
        })),
    }
  },
})

const ageCellAt = (root: ParentNode, row: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="age"]`,
  )
const drafted = (root: ParentNode, row: string) =>
  !!ageCellAt(root, row)?.querySelector('[data-cell-draft]')
/** Значение в ячейке — без кнопки правки и отметок. */
const ageTextAt = (root: ParentNode, row: string) => {
  const copy = ageCellAt(root, row)?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const pultButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const pultOpen = () =>
  !!document.querySelector('[data-testid="unsaved-changes"]')
/** Пульт открыт — нажать «Применить всё»; закрыт — открыть. */
const applyAll = (root: HTMLElement) => {
  if (!pultOpen()) pultButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}
const notice = (root: ParentNode) => {
  const element = root.querySelector<HTMLElement>(
    '[data-testid="table-notice"]',
  )
  return element && !element.hasAttribute('data-leaving') ? element : null
}
const noticeAction = (root: ParentNode) =>
  notice(root)?.querySelector<HTMLElement>(
    '[data-testid="table-notice-action"]',
  ) ?? null
const goneLog = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log"]')
const goneEntry = () =>
  [
    ...(goneLog()?.querySelectorAll<HTMLElement>('[data-failure-key]') ?? []),
  ].find(entry => entry.getAttribute('data-failure-key')?.includes(GONE_ROW)) ??
  null
const logBubble = (root: ParentNode) =>
  root
    .querySelector('[data-testid="failure-log-button"]')
    ?.querySelector('[data-active-indicator]')

const refused = (root: ParentNode, row: string) =>
  !!ageCellAt(root, row)?.querySelector('[data-cell-issue]')
/** Одна правка сохранена, правка удалённой строки осталась в ячейке с отметкой отказа. */
const goneApplied = (root: ParentNode) =>
  !!noticeAction(root) &&
  !drafted(root, EDIT_ROW) &&
  ageTextAt(root, EDIT_ROW) === KEPT_AGE &&
  refused(root, GONE_ROW) &&
  ageTextAt(root, GONE_ROW) === GONE_AGE
const reachGone = (root: HTMLElement) => {
  if (!goneApplied(root)) applyAll(root)
}
const goneShown = () => !!goneEntry()
/** Журнал — кнопкой плашки; плашка уже ушла, а отказ на месте — кнопкой тулбара. */
const reachGoneLog = (root: HTMLElement) => {
  if (goneLog()) return
  const show = noticeAction(root)
  if (show) return show.click()
  if (!refused(root, GONE_ROW)) return reachGone(root)
  root.querySelector<HTMLElement>('[data-testid="failure-log-button"]')?.click()
}
const goneDiscarded = (root: ParentNode) =>
  !drafted(root, GONE_ROW) &&
  !refused(root, GONE_ROW) &&
  ageTextAt(root, GONE_ROW) === String(filteringItemAt(2).age) &&
  logBubble(root)?.getAttribute('data-shown') !== 'true' &&
  ageTextAt(root, EDIT_ROW) === KEPT_AGE &&
  // Плашка ушла целиком, без уходящего кадра.
  !root.querySelector('[data-testid="table-notice"]')

const ROW_GONE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правки ждут сохранения', en: 'Edits waiting to be saved' },
    hint: {
      ru: 'Сервер отдаёт строки блоками, правки сохраняются пакетом по кнопке пульта в тулбаре. Пользователь поправил возраст в двух строках, а одну из них тем временем удалили на сервере.',
      en: 'The server sends rows in blocks, and edits are saved as a batch using the unsaved changes panel button in the toolbar. The user edited the age in two rows, and meanwhile one of them was deleted on the server.',
    },
    props: goneProps,
    states: ['body.cellDraft'],
  },
  {
    title: {
      ru: 'Сервер отказал одной правке',
      en: 'The server refused one edit',
    },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил одну правку, а другой отказал: её строки у него больше нет, и он ответил своим текстом ошибки. Плашка над таблицей говорит, сколько изменений сохранено из общего числа; отказанная правка осталась в ячейке с отметкой отказа.',
      en: 'The user applied everything from the unsaved changes panel. The server saved one edit and refused the other: it no longer has that row, and it replied with its own error text. The notice above the table says how many changes were saved out of the total; the refused edit stays in the cell with a refusal mark.',
    },
    states: ['body.applyPartly'],
    enter: untilDone(goneApplied, reachGone),
  },
  {
    title: { ru: 'Запись в журнале', en: 'The entry in the log' },
    hint: {
      ru: 'Пользователь нажал на плашке кнопку показа: открылся журнал, а плашка ушла — разбор отказа теперь в журнале. Запись в журнале — как у любого отказа: действие, колонка и номер строки, ниже — ответ сервера его словами. Почему сервер отказал, таблица знает только из этого ответа. У записи есть переход к строке, повтор и кнопка, которая сбрасывает правку.',
      en: 'The user clicked the show button on the notice: the log opened and the notice left, since the refusal is now handled in the log. The log entry looks like any other refusal: the action, the column and the row number, and below them the server reply in its own words. The table knows why the server refused only from this reply. The entry has a way to go to the row, a retry button and a button that reverts the edit.',
    },
    states: ['overlay.failureLog'],
    enter: untilDone(goneShown, reachGoneLog),
  },
  {
    title: { ru: 'Правка сброшена', en: 'The edit is reverted' },
    hint: {
      ru: 'Пользователь сбросил правку из журнала. Запись ушла, в ячейке снова значение из данных, несохранённых изменений не осталось.',
      en: 'The user reverted the edit from the log. The entry is gone, the cell shows the value from the data again, and no unsaved changes are left.',
    },
    enter: untilDone(goneDiscarded, root => {
      const discard = goneEntry()?.querySelector<HTMLElement>(
        '[data-action="discard"]',
      )
      if (discard) discard.click()
      else if (drafted(root, GONE_ROW) || refused(root, GONE_ROW))
        reachGoneLog(root)
    }),
  },
]

/** ADR 0227, S4: строку удалили на сервере — сервер отказывает своим текстом, правку сбрасывают. */
export const ServerEditingRowGone: StoryObj<StoryProps> = {
  name: 'Row is gone',
  parameters: { scenario: '0227/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Строку удалили', en: 'The row was deleted' }}
      steps={ROW_GONE}
      reset={() => savedAges.clear()}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const own = cellEditingLabels(storyLabels(args.locale))
    await step(ROW_GONE[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 2)).toBe(true))
      await until(() => expect(drafted(canvas, GONE_ROW)).toBe(true))
      expect(notice(canvas)).toBeNull()
    })
    await step(ROW_GONE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(goneApplied(canvas)).toBe(true))
      expect(notice(canvas)!.querySelector('[id]')!.textContent).toBe(
        own.applyPartly(1, 2),
      )
      expect(ageTextAt(canvas, GONE_ROW)).toBe(GONE_AGE)
      await settle()
    })
    await step(ROW_GONE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(goneShown()).toBe(true))
      expect(notice(canvas)).toBeNull()
      const entry = goneEntry()!
      const labels = storyLabels(args.locale)
      expect(
        entry.querySelector('[data-failure-target]')!.textContent!.trim(),
      ).toBe(labels.failureTargetCell('Age', 3))
      expect(entry.querySelector('[data-failure-reason]')!.textContent).toBe(
        GONE_REASON,
      )
      expect(entry.querySelector('[data-action="retry"]')).not.toBeNull()
      expect(entry.querySelector('[data-action="show"]')).not.toBeNull()
      expect(entry.querySelector('[data-action="discard"]')).not.toBeNull()
      await settle()
    })
    await step(ROW_GONE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(goneDiscarded(canvas)).toBe(true))
      await settle()
    })
  },
}
