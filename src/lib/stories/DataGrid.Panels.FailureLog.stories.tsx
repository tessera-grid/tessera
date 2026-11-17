import { useState } from 'react'
import { Archive } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { definePlugin } from '../core/definePlugin'
import type { Draft } from '../core/drafts/drafts'
import type { Failure } from '../core/failures/failuresFeature'
import type { RowAction } from '../core/headerActions'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'
import { failureLogLabels } from '../plugins/failureLog/labels'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { getData } from './__mocks__/data'
import { createHeldServer } from './__mocks__/heldServer'
import { seed } from './__mocks__/seed'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Журнал отказов (ADR 0177, §7): кнопка тулбара со счётчиком нерешённых отказов и поповер
 * записей. `Playground` — журнал с четырьмя отказами, один с длинными подписью и причиной; S6 — отказ действия строки, S7 — отказы
 * вне экрана; ADR 0227: S2 — отказ части правок и группа, S5 — сбросить все правки.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Failure log',
} satisfies Meta<StoryProps>

export default meta

const DATA_COUNT = 100
const ROWS = getData(DATA_COUNT)
const rowId = (index: number) => ROWS[index]!.id as string

interface LogTable {
  reportFailure: (report: Omit<Failure, 'key' | 'time'>) => string
  resolveFailure: (key: string) => void
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { label?: string },
  ) => Promise<unknown>
}

// --- Playground -----------------------------------------------------------------------

/**
 * Семя: четыре нерешённых отказа — значение ячейки, действие строки, выгрузка и действие
 * строки с длинными подписью и причиной и с повтором.
 */
const FAILURES_SEED = [
  seed<LogTable>('failureLogSeed', table => {
    table.reportFailure({
      label: 'Save value',
      target: { cell: [rowId(1), 'firstName'] },
      reason: 'The server refused the value',
    })
    table.reportFailure({
      label: 'Archive',
      target: { row: rowId(4) },
      reason: 'Row is locked by another user',
    })
    // Повтор в демо удаётся: запись уходит из журнала.
    const exportKey = table.reportFailure({
      label: 'Export',
      target: { process: 'export' },
      reason: 'The file is too large',
      retry: () => table.resolveFailure(exportKey),
    })
    const key = table.reportFailure({
      label:
        'Recalculate quarterly commission and sync it with the payroll system',
      target: { row: rowId(7) },
      reason:
        "The payroll service rejected the request: the employee's contract was changed after the commission period was closed, so the amount must be confirmed by the finance department before it can be synced again.",
      retry: () => table.resolveFailure(key),
    })
  }),
]

export const FailureLogPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Журнал с четырьмя отказами: откройте кнопку справа в тулбаре. Без отказов на ней нет счётчика.
  args: {
    enableFailureLog: true,
    enableColumnVisibility: true,
    columnCount: 6,
    dataCount: DATA_COUNT,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    extraPlugins: FAILURES_SEED,
  },
  parameters: {
    ...vrStates('panel.toolbar'),
    ...showControls(['enableFailureLog', 'enableColumnVisibility']),
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

// --- Действия шагов -------------------------------------------------------------------

const logButton = () => byTestId('failure-log-button')
const log = () => byTestId('failure-log')
const entries = () => [
  ...(log()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []),
]
/** Запись журнала, цель которой — строка `row`. */
const entryOf = (row: string) =>
  entries().find(entry =>
    entry.getAttribute('data-failure-key')?.includes(row),
  ) ?? null
/** Нажать кнопку действия записи; `false` — записи или кнопки нет. */
const chooseIn = (entry: HTMLElement | null, action: string) => {
  const button = entry?.querySelector<HTMLElement>(`[data-action="${action}"]`)
  button?.click()
  return !!button
}
const counter = () =>
  logButton()?.querySelector('[data-active-indicator]')?.textContent ?? ''
/** Нерешённые отказы есть: на кнопке журнала счётчик. */
const hasFailures = () => counter() !== ''
const scroller = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')
const rowEl = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const cellEl = (root: ParentNode, id: string) =>
  rowEl(root, id)?.querySelector<HTMLElement>('[data-column-id="firstName"]') ??
  null
const flashed = (el: HTMLElement | null) =>
  el?.getAttribute('data-flash') === 'reverted'

// --- ADR 0177 S6 ----------------------------------------------------------------------

const ARCHIVE_SERVER = createHeldServer()
const ARCHIVED = rowId(2)

const archive: RowAction = {
  id: 'archive',
  slot: 'actionRowSlot',
  icon: () => <Archive width={16} height={16} />,
  label: () => 'Archive',
  onSelect: () => ARCHIVE_SERVER.save(),
}
const ARCHIVE_PLUGINS = [
  definePlugin()({ id: 'archiveAction', slotActions: [archive] })(),
]

const archiveButton = (root: ParentNode) =>
  rowEl(root, ARCHIVED)?.querySelector<HTMLElement>(
    'button[aria-label$="Archive"]',
  ) ?? null

/** Дойти до отказа: «сервер» отказывает, пользователь архивирует строку. */
const reachArchiveRefusal = (root: HTMLElement) => {
  ARCHIVE_SERVER.answer(false)
  if (!hasFailures()) archiveButton(root)?.click()
}

const ROW_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Действия строк', en: 'Row actions' },
    hint: {
      ru: 'У строк есть действие архивации, его выполняет сервер. Кнопка журнала в тулбаре без счётчика: отказов пока не было.',
      en: 'Rows have an archive action that the server performs. The error log button in the toolbar has no counter: there have been no refusals yet.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь архивировал строку, но сервер отказал. Строка коротко вспыхнула тоном отката, на кнопке журнала появился счётчик отказов.',
      en: 'The user archived a row, but the server refused. The row flashed briefly in the revert tone, and a refusal counter appeared on the error log button.',
    },
    states: ['panel.toolbar'],
    immediate: true,
    enter: untilDone(
      root => hasFailures() && flashed(rowEl(root, ARCHIVED)),
      reachArchiveRefusal,
    ),
  },
  {
    title: { ru: 'Журнал открыт', en: 'The log is open' },
    hint: {
      ru: 'Пользователь прокрутил таблицу вниз и открыл журнал. Запись показывает действие, строку, причину отказа и время.',
      en: 'The user scrolled the table down and opened the error log. The entry shows the action, the row, the refusal reason, and the time.',
    },
    states: ['overlay.failureLog'],
    enter: untilDone(
      root => !!entryOf(ARCHIVED) && !rowEl(root, ARCHIVED),
      root => {
        if (!hasFailures()) return reachArchiveRefusal(root)
        const area = scroller(root)
        if (area && rowEl(root, ARCHIVED)) area.scrollTop = area.scrollHeight
        else if (!log()) logButton()!.click()
      },
    ),
  },
  {
    title: { ru: 'Переход к строке', en: 'Going to the row' },
    hint: {
      ru: 'Пользователь выбрал переход к строке. Таблица прокрутилась к ней, строка вспыхнула.',
      en: 'The user chose to go to the row. The table scrolled to it, and the row flashed.',
    },
    immediate: true,
    // Журнал закрывается после перехода анимацией выхода — шаг ждёт её конца.
    enter: untilDone(
      root =>
        !!rowEl(root, ARCHIVED) && flashed(rowEl(root, ARCHIVED)) && !log(),
      root => {
        if (!hasFailures()) return reachArchiveRefusal(root)
        if (!chooseIn(entryOf(ARCHIVED), 'show') && !log()) logButton()!.click()
      },
    ),
  },
]

/** ADR 0177, S6: отказ действия строки — запись журнала и переход к строке. */
export const FailureLogRow: StoryObj<StoryProps> = {
  name: 'Refused row action',
  parameters: { scenario: '0177/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ действия строки', en: 'Refused row action' }}
      steps={ROW_STEPS}
      args={guideArgs(
        {
          enableFailureLog: true,
          enableColumnVisibility: true,
          enableRowActions: true,
          actionsDemo: 'none',
          columnCount: 6,
          dataCount: DATA_COUNT,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          extraPlugins: ARCHIVE_PLUGINS,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(ROW_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(logButton()).not.toBeNull())
      expect(hasFailures()).toBe(false)
      await settle()
    })
    await step(ROW_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('1'))
    })
    await step(ROW_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(entryOf(ARCHIVED)).not.toBeNull())
      const entry = entryOf(ARCHIVED)!
      expect(entry.textContent).toContain('Archive')
      expect(entry.textContent).toContain('The server refused the value')
      expect(entry.textContent).toContain(labels.failureTargetRow(3))
      expect(entry.querySelector('time')).not.toBeNull()
      await settle()
    })
    await step(ROW_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(flashed(rowEl(canvas, ARCHIVED))).toBe(true))
      await until(() => expect(log()).toBeNull())
    })
  },
}

// --- ADR 0177 S7 ----------------------------------------------------------------------

let logTable: LogTable | undefined
const TABLE_SEED = [
  seed<LogTable>('failureLogTable', table => {
    logTable = table
  }),
]

/** Ячейки фонового сохранения: одна на экране, две ниже видимой области. */
const VISIBLE = rowId(1)
const FAR = rowId(70)
const LOWER = rowId(40)

/** Приложение сохраняет значения трёх ячеек в фоне; «сервер» отказывает. */
const saveInBackground = () => {
  for (const row of [LOWER, FAR, VISIBLE])
    void logTable
      ?.trackCellAction(
        { cell: [row, 'firstName'] },
        Promise.reject(new Error('The server refused the value')),
        { label: 'Save value' },
      )
      .catch(() => {})
}

const OFFSCREEN_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Журнал в тулбаре', en: 'The error log in the toolbar' },
    hint: {
      ru: 'Кнопка журнала стоит в тулбаре всегда; счётчик на ней появляется, когда есть нерешённые отказы. Сейчас их нет.',
      en: 'The error log button is always in the toolbar; a counter appears on it when there are unresolved refusals. There are none right now.',
    },
  },
  {
    title: { ru: 'Три отказа', en: 'Three refusals' },
    hint: {
      ru: 'Приложение сохранило три значения в фоне, сервер отказал во всех. На экране одна ячейка с отметкой отказа, счётчик журнала показывает все три.',
      en: 'The app saved three values in the background, and the server refused all of them. One cell on screen has a refusal mark, and the error log counter shows all three.',
    },
    states: ['body.error', 'panel.toolbar'],
    enter: untilDone(() => counter() === '3', saveInBackground),
  },
  {
    title: { ru: 'Журнал открыт', en: 'The log is open' },
    hint: {
      ru: 'Пользователь открыл журнал. Три записи, новые сверху: колонка и строка, причина и время.',
      en: 'The user opened the error log. There are three entries, newest first: the column and row, the reason, and the time.',
    },
    states: ['overlay.failureLog'],
    enter: untilDone(
      () => entries().length === 3,
      () => {
        if (counter() !== '3') saveInBackground()
        else if (!log()) logButton()?.click()
      },
    ),
  },
  {
    title: { ru: 'Переход к ячейке', en: 'Going to the cell' },
    hint: {
      ru: 'Пользователь выбрал переход к ячейке ниже видимой области. Таблица прокрутилась к ней, ячейка вспыхнула; в её углу — отметка отказа.',
      en: 'The user chose to go to a cell below the visible area. The table scrolled to it, and the cell flashed; a refusal mark sits in its corner.',
    },
    immediate: true,
    enter: untilDone(
      root => flashed(cellEl(root, FAR)) && !log(),
      () => {
        if (!hasFailures()) return saveInBackground()
        if (!chooseIn(entryOf(FAR), 'show') && !log()) logButton()!.click()
      },
    ),
  },
  {
    title: { ru: 'Запись закрыта', en: 'The entry is closed' },
    hint: {
      ru: 'Пользователь закрыл эту запись. Отметка ячейки ушла, счётчик журнала уменьшился.',
      en: 'The user closed this entry. The cell mark is gone, and the error log counter went down.',
    },
    enter: untilDone(
      root =>
        counter() === '2' &&
        !cellEl(root, FAR)?.querySelector('[data-cell-issue]'),
      () => {
        if (!hasFailures()) return saveInBackground()
        if (!chooseIn(entryOf(FAR), 'close') && !log()) logButton()!.click()
      },
    ),
  },
  {
    title: { ru: 'Отказ решён', en: 'The refusal is resolved' },
    hint: {
      ru: 'Приложение повторило одно сохранение, и сервер его принял. Запись ушла из журнала сама, счётчик снова уменьшился.',
      en: 'The app retried one save, and the server accepted it. The entry left the error log on its own, and the counter went down again.',
    },
    enter: untilDone(
      () => counter() === '1' && !!log(),
      () => {
        if (!hasFailures()) return saveInBackground()
        // По шагам гайда: запись дальней ячейки закрыта, затем повтор, затем журнал.
        if (counter() === '3') {
          if (!chooseIn(entryOf(FAR), 'close') && !log()) logButton()!.click()
        } else if (counter() === '2') {
          void logTable?.trackCellAction(
            { cell: [LOWER, 'firstName'] },
            Promise.resolve(),
            { label: 'Save value' },
          )
        } else if (!log()) logButton()!.click()
      },
    ),
  },
]

/** ADR 0177, S7: несколько отказов вне экрана — счётчик, переход, закрытие, уход решённых. */
export const FailureLogOffscreen: StoryObj<StoryProps> = {
  name: 'Failures off screen',
  parameters: { scenario: '0177/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказы вне экрана', en: 'Refusals off screen' }}
      steps={OFFSCREEN_STEPS}
      args={guideArgs(
        {
          enableFailureLog: true,
          enableColumnVisibility: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          extraPlugins: TABLE_SEED,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(OFFSCREEN_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(logButton()).not.toBeNull())
      await until(() => expect(hasFailures()).toBe(false))
      await settle()
    })
    await step(OFFSCREEN_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('3'))
      await until(() =>
        expect(
          cellEl(canvas, VISIBLE)!.querySelector('[data-cell-issue]'),
        ).not.toBeNull(),
      )
      await until(() => expect(rowEl(canvas, FAR)).toBeNull())
      await settle()
    })
    await step(OFFSCREEN_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(entries()).toHaveLength(3))
      await until(() =>
        expect(entries()[0]!.getAttribute('data-failure-key')).toContain(
          VISIBLE,
        ),
      )
      await until(() =>
        expect(entryOf(FAR)!.textContent).toContain(
          labels.failureTargetCell('First Name', 71),
        ),
      )
      await settle()
    })
    await step(OFFSCREEN_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(flashed(cellEl(canvas, FAR))).toBe(true))
      await until(() => expect(log()).toBeNull())
      await until(() =>
        expect(
          cellEl(canvas, FAR)!.querySelector('[data-cell-issue]'),
        ).not.toBeNull(),
      )
    })
    await step(OFFSCREEN_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('2'))
      // Со свежей таблицы ячейка вдали может быть вне окна — отметки на ней тогда нет.
      await until(() =>
        expect(
          cellEl(canvas, FAR)?.querySelector('[data-cell-issue]') ?? null,
        ).toBeNull(),
      )
      await settle()
    })
    await step(OFFSCREEN_STEPS[5]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('1'))
      await settle()
    })
  },
}

// --- ADR 0227 S2, S5 ------------------------------------------------------------------

const LOCKED = 'Row is locked by another user'
const ageDraft = (index: number): Draft => ({
  kind: 'cellValue',
  target: { cell: [rowId(index), 'age'] },
  value: { value: 40 + index, text: String(40 + index) },
})

/** «Сервер» пакета: отказывает строкам `refused` — они заблокированы другим пользователем. */
const commitRefusing =
  (refused: (row: string) => boolean) =>
  (batch: CellEditBatch): CellEditBatchResult => ({
    refused: batch.cells
      .filter(cell => refused(cell.rowId))
      .map(cell => ({
        rowId: cell.rowId,
        columnId: cell.columnId,
        reason: LOCKED,
      })),
  })

const applyArgs = (
  drafts: readonly Draft[],
  refused: (row: string) => boolean,
) =>
  ({
    enableFailureLog: true,
    enableCellEditing: true,
    cellEditingSaveMode: 'manual',
    enableUnsavedChanges: true,
    enableToolbar: true,
    columnCount: 6,
    dataCount: DATA_COUNT,
    // Строки — с первой отрисовки: черновики строк, которых в данных нет, таблица снимает.
    dataOverride: ROWS,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    initialDrafts: [...drafts],
    onCommitEdits: commitRefusing(refused),
  }) satisfies Partial<StoryProps>

const ageCell = (root: ParentNode, index: number) =>
  rowEl(root, rowId(index))?.querySelector<HTMLElement>(
    '[data-column-id="age"]',
  ) ?? null
const ageDrafted = (root: ParentNode, index: number) =>
  !!ageCell(root, index)?.querySelector('[data-cell-draft]')
const ageRefused = (root: ParentNode, index: number) =>
  !!ageCell(root, index)?.querySelector('[data-cell-issue]')
const pultButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const pultOpen = () => !!byTestId('unsaved-changes')
/** Пульт открыт — нажать «Применить всё»; закрыт — открыть. */
const applyAll = (root: HTMLElement) => {
  if (!pultOpen()) pultButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}
/** Плашка итога над таблицей, пока она не уходит. */
const notice = (root: ParentNode) => {
  const element = root.querySelector<HTMLElement>(
    '[data-testid="table-notice"]',
  )
  return element && !element.hasAttribute('data-leaving') ? element : null
}
const noticeTitle = (root: ParentNode) =>
  notice(root)?.querySelector('[id]')?.textContent ?? ''
const noticeAction = (root: ParentNode) =>
  notice(root)?.querySelector<HTMLElement>(
    '[data-testid="table-notice-action"]',
  ) ?? null
/** Плашка частичного итога: не в тоне успеха и с действием показа журнала. */
const partlyNotice = (root: ParentNode) =>
  !!noticeAction(root) && notice(root)?.getAttribute('data-tone') !== 'success'
const groups = () => [
  ...(log()?.querySelectorAll<HTMLElement>('[data-failure-group]') ?? []),
]
const backButton = () =>
  log()?.querySelector<HTMLElement>('[data-popup-level-back]') ?? null
/** Смена уровня журнала кончилась: снимок уходящего ушёл. */
const levelSettled = () =>
  log()?.querySelectorAll('[data-popup-level]').length === 1
/** Открыть журнал кнопкой плашки итога; плашка уже ушла — кнопкой тулбара. */
const showLog = (root: HTMLElement) => {
  if (log()) return
  const show = noticeAction(root)
  if (show) show.click()
  else
    root
      .querySelector<HTMLElement>('[data-testid="failure-log-button"]')
      ?.click()
}

// S2: пять правок, три строки заблокированы.

const PARTLY_DRAFTS = [0, 1, 2, 3, 4].map(ageDraft)
const PARTLY_REFUSED = new Set([1, 2, 3].map(rowId))

const partlyApplied = (root: ParentNode) =>
  partlyNotice(root) &&
  notice(root)?.getAttribute('data-tone') === 'neutral' &&
  [1, 2, 3].every(index => ageRefused(root, index)) &&
  [0, 4].every(index => !ageDrafted(root, index))
const reachPartly = (root: HTMLElement) => {
  if (!partlyApplied(root)) applyAll(root)
}
/** Отказы на месте — после «Показать» плашки уже нет. */
const partlyRefused = (root: ParentNode) =>
  [1, 2, 3].every(index => ageRefused(root, index)) &&
  [0, 4].every(index => !ageDrafted(root, index))
const reachPartlyLog = (root: HTMLElement) =>
  partlyRefused(root) ? showLog(root) : reachPartly(root)
const groupShown = () =>
  groups().length === 1 && entries().length === 1 && levelSettled()
const groupLevel = () =>
  !!backButton() && entries().length === 3 && levelSettled()

const PARTLY_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правки ждут сохранения', en: 'Edits waiting to be saved' },
    hint: {
      ru: 'Приложение сохраняет правки пакетом по кнопке пульта в тулбаре. Пользователь поправил возраст в пяти строках; три из этих строк на сервере сейчас заблокированы другим пользователем.',
      en: 'The app saves edits as a batch using the unsaved changes panel button in the toolbar. The user edited the age in five rows; three of those rows are currently locked on the server by another user.',
    },
    states: ['body.cellDraft'],
  },
  {
    title: { ru: 'Сервер отказал части', en: 'The server refused some' },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил две правки и отклонил три. Над таблицей плашка говорит, сколько изменений сохранено из общего числа, сама она не уходит; на отклонённых ячейках отметка отказа.',
      en: "The user applied everything from the unsaved changes panel. The server saved two edits and rejected three. Above the table, a notice says how many changes were saved out of the total, and it doesn't leave on its own; the rejected cells have a refusal mark.",
    },
    states: ['body.applyPartly', 'body.error'],
    enter: untilDone(partlyApplied, reachPartly),
  },
  {
    title: { ru: 'Журнал открыт', en: 'The log is open' },
    hint: {
      ru: 'Пользователь нажал на плашке кнопку показа: открылся журнал ошибок, а плашка ушла — разбор теперь в журнале. Три отказа одного применения с одной причиной стоят одной записью: действие, число ячеек и причина.',
      en: 'The user clicked the show button on the notice: the error log opened and the notice left, since the refusals are now handled in the log. The three refusals of one apply with the same reason are one entry: the action, the number of cells, and the reason.',
    },
    states: ['overlay.failureLog', 'overlay.failureGroup'],
    enter: untilDone(groupShown, reachPartlyLog),
  },
  {
    title: { ru: 'Отказы группы', en: 'The refusals of the group' },
    hint: {
      ru: 'Пользователь выбрал запись группы. Журнал на месте показал её отказы: у каждого ячейка, переход к ней, повтор и сбрасывание правки. Кнопка назад вверху возвращает к записям журнала.',
      en: 'The user chose the group entry. The log showed its refusals in place: each has its cell, a way to go to it, a retry, and a revert of the edit. The back button at the top returns to the log entries.',
    },
    states: ['overlay.failureGroupLevel'],
    enter: untilDone(groupLevel, root => {
      if (!log()) return reachPartlyLog(root)
      if (!backButton() && levelSettled()) chooseIn(groups()[0] ?? null, 'show')
    }),
  },
]

/** ADR 0227, S2: сервер отказал части правок — плашка с числами, журнал, группа и её отказы. */
export const FailureLogApplyGroup: StoryObj<StoryProps> = {
  name: 'Apply: partly refused',
  parameters: { scenario: '0227/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ части правок', en: 'Some edits refused' }}
      steps={PARTLY_STEPS}
      args={guideArgs(
        applyArgs(PARTLY_DRAFTS, row => PARTLY_REFUSED.has(row)),
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const own = cellEditingLabels(storyLabels(args.locale))
    await step(PARTLY_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect([0, 1, 2, 3, 4].every(index => ageDrafted(canvas, index))).toBe(
          true,
        ),
      )
      expect(notice(canvas)).toBeNull()
    })
    await step(PARTLY_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(partlyApplied(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(own.applyPartly(2, 5))
      expect(noticeAction(canvas)!.textContent).toBe(own.applyShow)
      await settle()
    })
    await step(PARTLY_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(groupShown()).toBe(true))
      expect(notice(canvas)).toBeNull()
      expect(groups()[0]!.getAttribute('data-failure-count')).toBe('3')
      expect(groups()[0]!.textContent).toContain(LOCKED)
      expect(counter()).toBe('1')
      await settle()
    })
    await step(PARTLY_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(groupLevel()).toBe(true))
      for (const entry of entries()) {
        for (const action of ['show', 'retry', 'discard'])
          expect(
            entry.querySelector(`[data-action="${action}"]`),
            action,
          ).not.toBeNull()
      }
      await settle()
    })
  },
}

// S5: двенадцать правок, сервер отказал всем.

const ALL_COUNT = 12
const ALL_DRAFTS = Array.from({ length: ALL_COUNT }, (_, index) =>
  ageDraft(index),
)
const question = () => byTestId('failure-log-question')
const footerButton = () =>
  log()?.querySelector<HTMLElement>('[data-popup-footer] button') ?? null

const allRefused = (root: ParentNode) =>
  partlyNotice(root) && counter() === '1' && ageRefused(root, 0)
const reachAllRefused = (root: HTMLElement) => {
  if (!allRefused(root)) applyAll(root)
}
const logWithGroup = () => groups().length === 1 && !question()
/** Дойти до журнала с группой: применить, затем показать журнал. */
const reachLog = (root: HTMLElement) =>
  ageRefused(root, 0) ? showLog(root) : reachAllRefused(root)
const asking = () => !!question()
const discarded = (root: ParentNode) =>
  !!byTestId('failure-log-empty') &&
  !hasFailures() &&
  !ageDrafted(root, 0) &&
  !ageRefused(root, 0) &&
  // Плашка ушла целиком, без уходящего кадра.
  !root.querySelector('[data-testid="table-notice"]')

const DISCARD_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Двенадцать правок', en: 'Twelve edits' },
    hint: {
      ru: 'Приложение сохраняет правки пакетом по кнопке пульта в тулбаре. Пользователь поправил возраст в двенадцати строках, но все они на сервере сейчас заблокированы другим пользователем.',
      en: 'The app saves edits as a batch using the unsaved changes panel button in the toolbar. The user edited the age in twelve rows, but all of them are currently locked on the server by another user.',
    },
    states: ['body.cellDraft'],
  },
  {
    title: { ru: 'Сервер отказал всем', en: 'The server refused all' },
    hint: {
      ru: 'Пользователь применил всё из пульта, и сервер отклонил все двенадцать правок. Плашка над таблицей говорит, что ничего не сохранено; на ячейках отметки отказа, правки остались несохранёнными.',
      en: 'The user applied everything from the unsaved changes panel, and the server rejected all twelve edits. The notice above the table says nothing was saved; the cells have refusal marks, and the edits stay unsaved.',
    },
    states: ['body.applyPartly', 'body.error'],
    enter: untilDone(allRefused, reachAllRefused),
  },
  {
    title: { ru: 'Журнал открыт', en: 'The log is open' },
    hint: {
      ru: 'Пользователь нажал на плашке кнопку показа: открылся журнал, а плашка ушла. В журнале одна запись на все двенадцать отказов, внизу кнопка, которая сбрасывает все отклонённые правки.',
      en: 'The user clicked the show button on the notice: the log opened and the notice left. The log has one entry for all twelve refusals, and at the bottom there is a button that reverts all rejected edits.',
    },
    states: ['overlay.failureLog', 'overlay.failureGroup'],
    enter: untilDone(logWithGroup, reachLog),
  },
  {
    title: { ru: 'Таблица спрашивает', en: 'The table asks' },
    hint: {
      ru: 'Пользователь нажал кнопку внизу журнала. Сбросить сразу двенадцать правок легко по ошибке, поэтому на месте кнопки вопрос с их числом: согласие сбрасывает, отказ оставляет всё как есть.',
      en: "The user clicked the button at the bottom of the log. Reverting twelve edits at once is easy to do by mistake, so in the button's place there is a question with their number: confirming reverts them, declining keeps everything as it is.",
    },
    states: ['overlay.failureQuestion'],
    enter: untilDone(asking, root => {
      if (!logWithGroup()) return reachLog(root)
      footerButton()?.click()
    }),
  },
  {
    title: { ru: 'Правки сброшены', en: 'The edits are reverted' },
    hint: {
      ru: 'Пользователь согласился. В ячейках снова значения из данных, отметок нет, на кнопке журнала больше нет счётчика, а открытый пульт пишет, что несохранённых изменений не осталось.',
      en: 'The user confirmed. The cells show the values from the data again, the marks are gone, the log button has no counter anymore, and the open unsaved changes panel says nothing is left unsaved.',
    },
    states: ['overlay.failureLog'],
    enter: untilDone(discarded, root => {
      if (asking())
        question()!
          .querySelector<HTMLElement>('[data-question-confirm]')
          ?.click()
      else if (logWithGroup()) footerButton()?.click()
      else reachLog(root)
    }),
  },
]

/** ADR 0227, S5: пользователь сбрасывает все отклонённые правки — таблица спрашивает. */
export const FailureLogDiscardAll: StoryObj<StoryProps> = {
  name: 'Revert all',
  parameters: { scenario: '0227/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Сбросить все правки',
        en: 'Reverting all edits',
      }}
      steps={DISCARD_STEPS}
      args={guideArgs(
        applyArgs(ALL_DRAFTS, () => true),
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const own = cellEditingLabels(labels)
    const logLabels = failureLogLabels(labels)
    await step(DISCARD_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(ageDrafted(canvas, 0)).toBe(true))
      expect(hasFailures()).toBe(false)
    })
    await step(DISCARD_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(allRefused(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(own.applyNone(ALL_COUNT))
      await settle()
    })
    await step(DISCARD_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(logWithGroup()).toBe(true))
      expect(notice(canvas)).toBeNull()
      expect(groups()[0]!.getAttribute('data-failure-count')).toBe(
        String(ALL_COUNT),
      )
      expect(footerButton()!.textContent).toBe(logLabels.failureDiscardAll)
      await settle()
    })
    await step(DISCARD_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(asking()).toBe(true))
      expect(question()!.textContent).toContain(
        logLabels.failureDiscardAllQuestion(ALL_COUNT),
      )
      // Пока вопрос не решён, правки на месте: в ячейке отметка отказа.
      expect(ageRefused(canvas, 0)).toBe(true)
      await settle()
    })
    await step(DISCARD_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(discarded(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0182 S1 ----------------------------------------------------------------------

/** Семя: отказы двух действий таблицы — поиска на сервере и сохранения ячейки. */
const NAMED_SEED = [
  seed<LogTable>('failureLogNamed', table => {
    table.reportFailure({
      action: { plugin: 'core', action: 'search' },
      target: { table: true },
      reason: 'The server is unavailable',
    })
    table.reportFailure({
      action: { plugin: 'core', action: 'save' },
      target: { cell: [rowId(1), 'firstName'] },
      reason: 'The server refused the value',
    })
  }),
]

const LANGUAGE_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Журнал закрыт', en: 'The log is closed' },
    hint: {
      ru: 'Поиск на сервере и сохранение ячейки не удались. Журнал отказов пока закрыт.',
      en: 'A server search and a cell save failed. The error log is still closed.',
    },
  },
  {
    title: { ru: 'Журнал на английском', en: 'The log in English' },
    hint: {
      ru: 'Поиск на сервере и сохранение ячейки не удались. Пользователь открыл журнал: записи называют действия на языке таблицы.',
      en: "A server search and a cell save failed. The user opened the error log: the entries name the actions in the table's language.",
    },
    states: ['overlay.failureLog'],
    enter: untilDone(
      () => entries().length === 2,
      () => {
        if (!log()) logButton()?.click()
      },
    ),
  },
  {
    title: { ru: 'Русский интерфейс', en: 'Russian interface' },
    hint: {
      ru: 'Приложение переключило язык. Те же записи называют действия по-русски, журнал и таблица не пересоздаются.',
      en: 'The app switched the language. The same entries name the actions in Russian, and neither the error log nor the table is recreated.',
    },
    states: ['overlay.failureLog'],
    props: () => ({ locale: 'ru' }),
    enter: untilDone(
      () => entries().length === 2,
      () => {
        if (!log()) logButton()?.click()
      },
    ),
  },
]

/** ADR 0182, S1: пользователь меняет язык таблицы — записи журнала переводятся на месте. */
export const FailureLogLanguageSwitch: StoryObj<StoryProps> = {
  name: 'Switch language',
  parameters: { scenario: '0182/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Смена языка у записей журнала',
        en: 'Switching the language of log entries',
      }}
      steps={LANGUAGE_STEPS}
      args={guideArgs(
        {
          enableFailureLog: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          extraPlugins: NAMED_SEED,
        },
        { colorMode: args.colorMode, locale: 'en' },
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const en = storyLabels('en')
    const ru = storyLabels('ru')
    await step(LANGUAGE_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(LANGUAGE_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(entries()).toHaveLength(2))
      expect(log()!.textContent).toContain(en.actionSearch)
      expect(log()!.textContent).toContain(en.actionSave)
      await settle()
    })
    await step(LANGUAGE_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(log()?.textContent).toContain(ru.actionSearch))
      expect(log()!.textContent).toContain(ru.actionSave)
      expect(log()!.textContent).not.toContain(en.actionSearch)
      await settle()
    })
  },
}
