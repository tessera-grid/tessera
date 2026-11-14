import { useState } from 'react'
import { Archive } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { definePlugin } from '../core/definePlugin'
import type { Failure } from '../core/failures/failuresFeature'
import type { RowAction } from '../core/headerActions'
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
 * вне экрана.
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
      en: 'Rows have an archive action that the server performs. The failure log button in the toolbar has no counter: there have been no refusals yet.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь архивировал строку, но сервер отказал. Строка коротко вспыхнула тоном отката, на кнопке журнала появился счётчик отказов.',
      en: 'The user archived a row, but the server refused. The row flashed briefly in the revert tone, and a refusal counter appeared on the failure log button.',
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
      en: 'The user scrolled the table down and opened the failure log. The entry shows the action, the row, the refusal reason, and the time.',
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
    title: { ru: 'Журнал в тулбаре', en: 'The failure log in the toolbar' },
    hint: {
      ru: 'Кнопка журнала стоит в тулбаре всегда; счётчик на ней появляется, когда есть нерешённые отказы. Сейчас их нет.',
      en: 'The failure log button is always in the toolbar; a counter appears on it when there are unresolved refusals. There are none right now.',
    },
  },
  {
    title: { ru: 'Три отказа', en: 'Three refusals' },
    hint: {
      ru: 'Приложение сохранило три значения в фоне, сервер отказал во всех. На экране одна ячейка с отметкой отказа, счётчик журнала показывает все три.',
      en: 'The app saved three values in the background, and the server refused all of them. One cell on screen has a refusal mark, and the failure log counter shows all three.',
    },
    states: ['body.error', 'panel.toolbar'],
    enter: untilDone(() => counter() === '3', saveInBackground),
  },
  {
    title: { ru: 'Журнал открыт', en: 'The log is open' },
    hint: {
      ru: 'Пользователь открыл журнал. Три записи, новые сверху: колонка и строка, причина и время.',
      en: 'The user opened the failure log. There are three entries, newest first: the column and row, the reason, and the time.',
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
      en: 'The user closed this entry. The cell mark is gone, and the failure log counter went down.',
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
      en: 'The app retried one save, and the server accepted it. The entry left the failure log on its own, and the counter went down again.',
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
      en: 'A server search and a cell save failed. The failure log is still closed.',
    },
  },
  {
    title: { ru: 'Журнал на английском', en: 'The log in English' },
    hint: {
      ru: 'Поиск на сервере и сохранение ячейки не удались. Пользователь открыл журнал: записи называют действия на языке таблицы.',
      en: "A server search and a cell save failed. The user opened the failure log: the entries name the actions in the table's language.",
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
      en: 'The app switched the language. The same entries name the actions in Russian, and neither the failure log nor the table is recreated.',
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
