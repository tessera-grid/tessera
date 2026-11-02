import { useState } from 'react'
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
 * записей. `Playground` — журнал с тремя отказами; S6 — отказ действия строки, S7 — отказы
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
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { label?: string },
  ) => Promise<unknown>
}

// --- Playground -----------------------------------------------------------------------

/** Семя: три нерешённых отказа — значение ячейки, действие строки и выгрузка. */
const FAILURES_SEED = [
  seed<LogTable>('failureLogSeed', table => {
    table.reportFailure({
      label: 'First Name',
      target: { cell: [rowId(1), 'firstName'] },
      reason: 'The server refused the value',
    })
    table.reportFailure({
      label: 'Archive',
      target: { row: rowId(4) },
      reason: 'Row is locked by another user',
    })
    table.reportFailure({
      label: 'Export',
      target: { process: 'export' },
      reason: 'The file is too large',
    })
  }),
]

export const FailureLogPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Журнал с тремя отказами: откройте кнопку справа в тулбаре. Без отказов кнопки нет.
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
const actionIn = (entry: HTMLElement | null, action: string) =>
  entry?.querySelector<HTMLElement>(`[data-action="${action}"]`) ?? null
const counter = () =>
  logButton()?.querySelector('[data-active-indicator]')?.textContent ?? ''
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
  icon: () => <span aria-hidden>⌫</span>,
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
  if (!logButton()) archiveButton(root)?.click()
}

const ROW_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Действия строк',
    hint: 'У строк есть действие архивации, его выполняет сервер. Журнала в тулбаре нет: отказов пока не было.',
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь архивировал строку, но сервер отказал. Строка коротко вспыхнула тоном отката, в тулбаре появилась кнопка журнала с числом отказов.',
    states: ['panel.toolbar'],
    immediate: true,
    enter: untilDone(
      root => !!logButton() && flashed(rowEl(root, ARCHIVED)),
      reachArchiveRefusal,
    ),
  },
  {
    title: 'Журнал открыт',
    hint: 'Пользователь прокрутил таблицу вниз и открыл журнал. Запись показывает действие, строку, причину отказа и время.',
    states: ['overlay.failureLog'],
    enter: untilDone(
      root => !!entryOf(ARCHIVED) && !rowEl(root, ARCHIVED),
      root => {
        if (!logButton()) return reachArchiveRefusal(root)
        const area = scroller(root)
        if (area && rowEl(root, ARCHIVED)) area.scrollTop = area.scrollHeight
        else if (!log()) logButton()!.click()
      },
    ),
  },
  {
    title: 'Переход к строке',
    hint: 'Пользователь выбрал переход к строке. Таблица прокрутилась к ней, строка вспыхнула.',
    immediate: true,
    enter: untilDone(
      root => !!rowEl(root, ARCHIVED) && flashed(rowEl(root, ARCHIVED)),
      root => {
        if (!logButton()) return reachArchiveRefusal(root)
        if (actionIn(entryOf(ARCHIVED), 'show'))
          actionIn(entryOf(ARCHIVED), 'show')!.click()
        else if (!log()) logButton()!.click()
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
      title="Отказ действия строки"
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
    await step(ROW_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(logButton()).toBeNull()
      await settle()
    })
    await step(ROW_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(logButton()).not.toBeNull())
      expect(counter()).toBe('1')
    })
    await step(ROW_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(entryOf(ARCHIVED)).not.toBeNull())
      const entry = entryOf(ARCHIVED)!
      expect(entry.textContent).toContain('Archive')
      expect(entry.textContent).toContain('The server refused the value')
      expect(entry.textContent).toContain(labels.failureTargetRow(3))
      expect(entry.querySelector('time')).not.toBeNull()
      await settle()
    })
    await step(ROW_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashed(rowEl(canvas, ARCHIVED))).toBe(true))
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
        { label: 'First Name' },
      )
      .catch(() => {})
}

const OFFSCREEN_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Журнал в тулбаре',
    hint: 'Кнопка журнала появляется в тулбаре, только пока есть нерешённые отказы. Сейчас их нет.',
  },
  {
    title: 'Три отказа',
    hint: 'Приложение сохранило три значения в фоне, сервер отказал во всех. На экране одна ячейка с отметкой отказа, счётчик журнала показывает все три.',
    states: ['body.error', 'panel.toolbar'],
    enter: untilDone(() => counter() === '3', saveInBackground),
  },
  {
    title: 'Журнал открыт',
    hint: 'Пользователь открыл журнал. Три записи, новые сверху: колонка и строка, причина и время.',
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
    title: 'Переход к ячейке',
    hint: 'Пользователь выбрал переход к ячейке ниже видимой области. Таблица прокрутилась к ней, ячейка вспыхнула; в её углу — отметка отказа.',
    immediate: true,
    enter: untilDone(
      root => flashed(cellEl(root, FAR)),
      () => {
        if (!logButton()) return saveInBackground()
        if (actionIn(entryOf(FAR), 'show'))
          actionIn(entryOf(FAR), 'show')!.click()
        else if (!log()) logButton()!.click()
      },
    ),
  },
  {
    title: 'Запись закрыта',
    hint: 'Пользователь закрыл эту запись. Отметка ячейки ушла, счётчик журнала уменьшился.',
    enter: untilDone(
      root =>
        counter() === '2' &&
        !cellEl(root, FAR)?.querySelector('[data-cell-issue]'),
      () => {
        if (!logButton()) return saveInBackground()
        if (actionIn(entryOf(FAR), 'close'))
          actionIn(entryOf(FAR), 'close')!.click()
        else if (!log()) logButton()!.click()
      },
    ),
  },
  {
    title: 'Отказ решён',
    hint: 'Приложение повторило одно сохранение, и сервер его принял. Запись ушла из журнала сама, счётчик снова уменьшился.',
    enter: untilDone(
      () => counter() === '1' && !!log(),
      () => {
        if (!logButton()) return saveInBackground()
        // По шагам гайда: запись дальней ячейки закрыта, затем повтор, затем журнал.
        if (counter() === '3') {
          if (actionIn(entryOf(FAR), 'close'))
            actionIn(entryOf(FAR), 'close')!.click()
          else if (!log()) logButton()!.click()
        } else if (counter() === '2') {
          void logTable?.trackCellAction(
            { cell: [LOWER, 'firstName'] },
            Promise.resolve(),
            { label: 'First Name' },
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
      title="Отказы вне экрана"
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
    await step(OFFSCREEN_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(logButton()).toBeNull()
      await settle()
    })
    await step(OFFSCREEN_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('3'))
      expect(
        cellEl(canvas, VISIBLE)!.querySelector('[data-cell-issue]'),
      ).not.toBeNull()
      expect(rowEl(canvas, FAR)).toBeNull()
      await settle()
    })
    await step(OFFSCREEN_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(entries()).toHaveLength(3))
      expect(entries()[0]!.getAttribute('data-failure-key')).toContain(VISIBLE)
      expect(entryOf(FAR)!.textContent).toContain(
        labels.failureTargetCell('First Name', 71),
      )
      await settle()
    })
    await step(OFFSCREEN_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashed(cellEl(canvas, FAR))).toBe(true))
      expect(
        cellEl(canvas, FAR)!.querySelector('[data-cell-issue]'),
      ).not.toBeNull()
    })
    await step(OFFSCREEN_STEPS[4]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('2'))
      expect(cellEl(canvas, FAR)!.querySelector('[data-cell-issue]')).toBeNull()
      await settle()
    })
    await step(OFFSCREEN_STEPS[5]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(counter()).toBe('1'))
      await settle()
    })
  },
}
