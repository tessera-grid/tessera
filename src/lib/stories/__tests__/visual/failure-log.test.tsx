import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import {
  applyAllDrafts,
  DRAFTS_KEY,
  setDraft,
} from '../../../core/drafts/drafts'
import type { Draft } from '../../../core/drafts/drafts'
import {
  type Failure,
  cellFailureKey,
} from '../../../core/failures/failuresFeature'
import type { RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnVisibility,
  failureLog,
  rowActions,
  serverRowModel,
  unsavedChanges,
} from '../../../plugins'
import type { CellEditBatch } from '../../../plugins/cellEditing/types'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { failureLogLabels } from '../../../plugins/failureLog/labels'
import { dataExportLabels } from '../../../plugins/dataExport/labels'
import { unsavedChangesLabels } from '../../../plugins/unsavedChanges/labels'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Журнал отказов (ADR 0177, этап 2; JR1–JR3, JR6): кнопка тулбара со счётчиком, поповер
// записей, переход к цели, повтор и закрытие. JR4–JR5 — модульные (`failureLog.dom`), JR7 —
// `check:tree-shaking`.

interface Item {
  id: string
  name: string
  city: string
}

const DATA: Item[] = Array.from({ length: 300 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  city: `City ${index}`,
}))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 240 },
]

interface LogTable {
  reportFailure: (report: Omit<Failure, 'key' | 'time'>) => string
  getFailures: () => Failure[]
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { retry?: () => unknown; label?: string },
  ) => Promise<unknown>
}

let table: LogTable
let refuseArchive = true

const archive: RowAction = {
  id: 'archive',
  slot: 'actionRowSlot',
  icon: () => <span aria-hidden>A</span>,
  label: () => 'Archive',
  onSelect: () =>
    refuseArchive
      ? Promise.reject(new Error('Row is locked'))
      : Promise.resolve(),
}
const probe = definePlugin()({ id: 'logProbe', slotActions: [archive] })

const Grid = ({ ssrm = false }: { ssrm?: boolean }) => {
  const created = useCreateTable({
    columns: COLUMNS as never,
    data: ssrm ? [] : DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      probe(),
      rowActions(),
      columnVisibility(),
      failureLog(),
      ...(ssrm
        ? [
            serverRowModel({
              blockSize: 50,
              maxBlocks: 2,
              getRows: ({ start, end }: { start: number; end: number }) => ({
                rows: DATA.slice(start, end),
                rowCount: DATA.length,
              }),
            }),
          ]
        : []),
    ] as never,
  })
  table = created as never
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid table={created as never} height={440} />
    </div>
  )
}

const mount = async (ssrm = false) => {
  refuseArchive = true
  const screen = await render(<Grid ssrm={ssrm} />)
  await waitForGrid()
  await expect
    .poll(() => document.querySelector('[role="toolbar"]'))
    .not.toBeNull()
  return screen
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const logButton = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log-button"]')
const log = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log"]')
const entries = () => [
  ...(log()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []),
]
/** Запись по ключу: ключ несёт нулевой символ, его не выразить селектором. */
const entryOf = (key: string) =>
  [...(log()?.querySelectorAll<HTMLElement>('[data-failure-key]') ?? [])].find(
    entry => entry.getAttribute('data-failure-key') === key,
  )
/** Кнопка записи: `show`, `retry` или `close`. */
const actionOf = (entry: HTMLElement, action: string) =>
  entry.querySelector<HTMLElement>(`button[data-action="${action}"]`)
const choose = async (entry: HTMLElement, action: string) => {
  await humanClick(actionOf(entry, action)!)
}
const tooltipShown = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
/** Кнопка внизу журнала: «Сбросить все правки» или «Закрыть все». */
const footerButton = () =>
  log()?.querySelector<HTMLElement>('[data-popup-footer] button') ?? null
const bubbleOf = (button: HTMLElement) =>
  button.querySelector<HTMLElement>('[data-active-indicator]')!
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellEl = (id: string, column = 'name') =>
  rowEl(id)?.querySelector<HTMLElement>(`[data-column-id="${column}"]`) ?? null
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const shown = () => bubbleOf(logButton()!).getAttribute('data-shown') === 'true'
const empty = () => document.querySelector('[data-testid="failure-log-empty"]')
const openLog = async () => {
  await expect.poll(logButton).not.toBeNull()
  if (log()) return
  await humanClick(logButton()!)
  await expect.poll(log).not.toBeNull()
}

const cellFailure = (row: string, reason = 'Server said no') =>
  table.reportFailure({
    label: cellEditingLabels(tableLabels).cellDraftKind,
    target: { cell: [row, 'name'] },
    reason,
  })

describe('Журнал отказов (ADR 0177)', () => {
  test('JR1: плагин failureLog() — кнопка тулбара видна всегда; пока в реестре есть записи — на ней красный бабл-счётчик, без записей — бабла нет, журнал показывает компактную заглушку: иллюстрацию, «Ошибок нет» и пояснение', async () => {
    const screen = await mount()
    try {
      // Без отказов: кнопка на месте, бабла нет, журнал пуст.
      await expect.poll(logButton).not.toBeNull()
      expect(shown()).toBe(false)
      expect(logButton()!.getAttribute('aria-label')).toBe(
        failureLogLabels(tableLabels).failureLog,
      )
      await openLog()
      const stub = empty()!
      expect(stub.getAttribute('data-size')).toBe('compact')
      expect(stub.textContent).toContain(
        failureLogLabels(tableLabels).failureLogEmpty,
      )
      expect(stub.textContent).toContain(
        failureLogLabels(tableLabels).failureLogEmptyDescription,
      )
      const media = stub.querySelector('svg')!
      expect(media.getBoundingClientRect().width).toBeGreaterThan(0)
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      cellFailure('r1')
      await expect.poll(shown).toBe(true)
      cellFailure('r2')
      await expect.poll(() => bubbleOf(logButton()!).textContent).toBe('2')
      expect(bubbleOf(logButton()!).getAttribute('data-shown')).toBe('true')
      expect(logButton()!.getAttribute('aria-label')).toBe(
        failureLogLabels(tableLabels).failureLogButton(2),
      )
      // Красный: тон бабла — цвет отказа темы, а не синий включённого действия.
      const bubble = toRgba(
        getComputedStyle(bubbleOf(logButton()!)).backgroundColor,
      )
      const probe = document.createElement('span')
      probe.style.color = 'var(--tsr-comp-action-error-color)'
      document.querySelector('.data-grid-theme')!.append(probe)
      const errorTone = toRgba(getComputedStyle(probe).color)
      probe.remove()
      expect(bubble).toEqual(errorTone)
      // Последняя справа в тулбаре.
      const buttons = [
        ...document.querySelectorAll<HTMLElement>('[role="toolbar"] button'),
      ]
      expect(buttons.at(-1)).toBe(logButton())

      // Последняя запись закрыта из журнала: кнопка и фокус на месте, журнал пуст.
      await openLog()
      for (let left = 2; left > 0; left--) await choose(entries()[0]!, 'close')
      await expect.poll(empty).not.toBeNull()
      await expect.poll(shown).toBe(false)
      expect(logButton()).not.toBeNull()
      expect(document.activeElement).not.toBe(document.body)
      expect(log()!.contains(document.activeElement)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('JR2: поповер журнала — записи с подписью действия, целью, причиной и временем: время — в строке подписи, цель — строкой под ней, причина — ниже; длинный список виртуализирован', async () => {
    const screen = await mount()
    try {
      const first = cellFailure('r3', 'First reason')
      await new Promise(resolve => setTimeout(resolve, 20))
      table.reportFailure({
        label: 'Archive',
        target: { row: 'r5' },
        reason: 'Row is locked',
      })
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await openLog()
      // Новые сверху; подпись, цель, причина, время.
      const [newest, , oldest] = entries()
      expect(newest!.textContent).toContain(
        dataExportLabels(tableLabels).export,
      )
      expect(newest!.textContent).toContain('Disk full')
      expect(entries()[1]!.textContent).toContain(
        tableLabels.failureTargetRow(6),
      )
      expect(oldest!.getAttribute('data-failure-key')).toBe(first)
      expect(oldest!.textContent).toContain('Name')
      expect(oldest!.textContent).toContain(
        tableLabels.failureTargetCell('Name', 4),
      )
      expect(oldest!.textContent).toContain('First reason')
      const time = oldest!.querySelector('time')!
      expect(time.textContent).toMatch(/\d{1,2}:\d{2}/)
      expect(new Date(time.dateTime).getTime()).toBeGreaterThan(0)
      // Время — в строке подписи, цель — строкой под ней, причина — ниже.
      const show = oldest!.querySelector<HTMLElement>('[data-action="show"]')!
      expect(show.textContent).toContain(
        tableLabels.failureTargetCell('Name', 4),
      )
      expect(show.textContent).not.toContain('First reason')
      const lineOf = (text: string) => {
        const node = [...oldest!.querySelectorAll<HTMLElement>('span')].find(
          span =>
            span.childElementCount === 0 && span.textContent?.includes(text),
        )!
        return node.getBoundingClientRect().top
      }
      const top = time.getBoundingClientRect().top
      const target = lineOf(tableLabels.failureTargetCell('Name', 4))
      expect(target).toBeGreaterThan(top + 8)
      expect(lineOf('First reason')).toBeGreaterThan(target + 8)
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      // 200 записей: в DOM — только окно списка.
      for (let i = 0; i < 200; i++) cellFailure(`r${i + 10}`, `Reason ${i}`)
      await openLog()
      await expect.poll(() => entries().length).toBeGreaterThan(0)
      expect(entries().length).toBeLessThan(40)
      const list = log()!.querySelector<HTMLElement>('[role="list"]')!
      expect(list.getBoundingClientRect().height).toBeGreaterThan(
        log()!.getBoundingClientRect().height,
      )
    } finally {
      await screen.unmount()
    }
  })

  test('JR3: кнопки записи — квадратные кнопки-иконки с тултипами; нажатие на запись закрывает журнал, прокручивает к цели записи и вспыхивает её — в том числе незагруженную строку серверной модели; «Повторить» — у записи, которая умеет, закрывает журнал и повторяет; «Закрыть» снимает запись и отметку ячейки, журнал остаётся открытым', async () => {
    let screen = await mount()
    try {
      // Отказ действия строки — запись с повтором.
      const row = rowEl('r1')!
      await userEvent.hover(row)
      await humanClick(
        row.querySelector<HTMLElement>('button[aria-label$="Archive"]')!,
      )
      await expect.poll(shown).toBe(true)
      // Строка уходит из окна; «Показать» возвращает её и вспыхивает.
      scroller().scrollTop = 6000
      await expect.poll(() => rowEl('r1')).toBeNull()
      await openLog()
      const rowEntry = entries()[0]!
      // Подпись и цель записи — переход к цели; кнопки — квадратные кнопки-иконки с подписью в тултипе.
      expect(actionOf(rowEntry, 'show')!.textContent).toBe(
        `Archive ${tableLabels.failureTargetRow(2)}`,
      )
      for (const [action, label] of [
        ['retry', tableLabels.failureRetry],
        ['close', failureLogLabels(tableLabels).failureClose],
      ] as const) {
        const button = actionOf(rowEntry, action)!
        expect(button.getAttribute('data-shape'), action).toBe('square')
        expect(button.getAttribute('aria-label'), action).toBe(label)
        expect(button.querySelector('svg'), action).not.toBeNull()
        await userEvent.hover(button)
        await expect
          .poll(() => tooltipShown(label), { timeout: 2000 })
          .toBe(true)
      }
      await choose(rowEntry, 'show')
      await expect.poll(log).toBeNull()
      await expect
        .poll(() => rowEl('r1')?.getAttribute('data-flash'))
        .toBe('reverted')
      // «Повторить» закрывает журнал; повтор успешен — запись уходит.
      refuseArchive = false
      await openLog()
      await choose(entries()[0]!, 'retry')
      await expect.poll(log).toBeNull()
      await expect.poll(() => table.getFailures().length).toBe(0)
      await openLog()
      await expect.poll(empty).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      // Без повтора — нет «Повторить»; «Закрыть» снимает запись и треугольник ячейки.
      cellFailure('r2')
      await expect
        .poll(() => cellEl('r2')?.querySelector('[data-cell-issue]'))
        .not.toBeNull()
      await openLog()
      expect(actionOf(entries()[0]!, 'retry')).toBeNull()
      await choose(entries()[0]!, 'close')
      await expect
        .poll(() => cellEl('r2')?.querySelector('[data-cell-issue]'))
        .toBeNull()
      expect(table.getFailures()).toEqual([])
      // «Закрыть» журнал не закрывает.
      expect(log()).not.toBeNull()
      await expect.poll(empty).not.toBeNull()
      await screen.unmount()

      // Серверная модель: строка вне загруженных блоков — переход по месту отказа.
      screen = await mount(true)
      await expect.poll(() => cellEl('r4')).not.toBeNull()
      cellFailure('r4')
      scroller().scrollTop = scroller().scrollHeight
      await expect.poll(() => cellEl('r4')).toBeNull()
      // Блок строки r4 вытеснен: загружены только блоки у конца.
      await expect
        .poll(() =>
          Math.max(
            ...[
              ...document.querySelectorAll('.data-grid__body-row[data-index]'),
            ].map(el => Number(el.getAttribute('data-index'))),
          ),
        )
        .toBeGreaterThan(200)
      await openLog()
      expect(entries()[0]!.textContent).toContain(
        tableLabels.failureTargetCell('Name', 5),
      )
      await choose(entries()[0]!, 'show')
      await expect
        .poll(() => cellEl('r4')?.getAttribute('data-flash'), { timeout: 4000 })
        .toBe('reverted')
    } finally {
      await screen.unmount()
    }
  })

  test('JR8: кнопка внизу журнала, пока в нём есть записи, решает все записи: сбрасывает отклонённые изменения, закрывает записи без правок и снимает отметки ячеек; журнал остаётся открытым и пишет, что отказов нет', async () => {
    const screen = await mount()
    try {
      // Пустой журнал — без кнопки.
      await openLog()
      expect(footerButton()).toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      const discarded: string[] = []
      for (const row of ['r1', 'r2'])
        table.reportFailure({
          label: cellEditingLabels(tableLabels).cellDraftKind,
          target: { cell: [row, 'name'] },
          reason: 'Server said no',
          discard: () => discarded.push(row),
        } as never)
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await expect
        .poll(() => cellEl('r2')?.querySelector('[data-cell-issue]'))
        .not.toBeNull()
      await openLog()
      expect(entries()).toHaveLength(3)
      expect(footerButton()!.textContent).toBe(
        failureLogLabels(tableLabels).failureDiscardAll,
      )
      await humanClick(footerButton()!)
      await expect.poll(empty).not.toBeNull()
      expect(log()).not.toBeNull()
      expect(table.getFailures()).toEqual([])
      expect(discarded.sort()).toEqual(['r1', 'r2'])
      expect(document.querySelector('[data-cell-issue]')).toBeNull()
      expect(footerButton()).toBeNull()
      // Кнопка ушла вместе с записями: фокус — в журнале, а не на странице.
      await expect
        .poll(() => log()!.contains(document.activeElement))
        .toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('JR6: журнал проходит axe с color-contrast в обеих темах и виден в forced-colors', async () => {
    const screen = await mount()
    try {
      cellFailure('r1')
      await expect.poll(shown).toBe(true)
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
        retry: () => {},
      })
      await openLog()
      const withContrast: axe.RunOptions = {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      }
      const failures = (result: axe.AxeResults) =>
        result.violations.map(
          v =>
            `${v.id}: ${v.nodes.map(n => `${n.target.join(' ')} — ${n.failureSummary}`).join(' | ')}`,
        )
      await inBothThemes(async () => {
        const result = await axe.run(log()!, withContrast)
        expect(failures(result)).toEqual([])
        // Стражи фокуса Base UI скрыты и фокусируемы намеренно: WebKit у axe их находит.
        const toolbar = await axe.run(
          {
            include: [['[role="toolbar"]']],
            exclude: [['[data-base-ui-focus-guard]']],
          },
          withContrast,
        )
        expect(failures(toolbar)).toEqual([])
        const bubble = bubbleOf(logButton()!)
        const ratio = contrast(
          toRgba(getComputedStyle(bubble).backgroundColor),
          effectiveBg(logButton()!),
        )
        expect(ratio).toBeGreaterThanOrEqual(3)
      })

      if (server.browser === 'webkit') return
      await commands.forcedColors(true)
      await expect
        .poll(() => getComputedStyle(bubbleOf(logButton()!)).forcedColorAdjust)
        .toBeDefined()
      const bubble = bubbleOf(logButton()!)
      expect(bubble.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(
        toRgba(getComputedStyle(bubble).backgroundColor)[3],
      ).toBeGreaterThan(0)
      expect(log()!.getBoundingClientRect().height).toBeGreaterThan(0)
      const reason = log()!.querySelector<HTMLElement>(
        '[role="listitem"] [data-failure-reason]',
      )!
      expect(toRgba(getComputedStyle(reason).color)).not.toEqual(
        toRgba(getComputedStyle(log()!).backgroundColor),
      )
    } finally {
      await screen.unmount()
    }
  })
})

// Группы журнала, второй уровень, действия записей и переход к цели (ADR 0227, этап 3; AO6–AO10,
// AO12): правки «Применить» отказаны ответом пакета.

interface EditTable extends LogTable {
  atoms: Record<
    string,
    { subscribe: (listener: () => void) => { unsubscribe: () => void } }
  >
  getDrafts: () => readonly Draft[]
  scrollToRow: (rowId: string, options?: unknown) => Promise<boolean>
}

const EDIT_DATA: Item[] = Array.from({ length: 1100 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  city: `City ${index}`,
}))

let edits: EditTable
/** Ответ пакета: отказ ячейки — по её строке, `undefined` — сохранена. */
let refusalOf: (rowId: string) => { reason: string } | undefined
const commits: CellEditBatch[] = []

const nameDraft = (rowId: string): Draft => ({
  kind: 'cellValue',
  target: { cell: [rowId, 'name'] },
  value: { value: `New ${rowId}`, text: `New ${rowId}` },
})

const EditGrid = ({ drafts }: { drafts: readonly Draft[] }) => {
  const created = useCreateTable({
    columns: COLUMNS as never,
    data: EDIT_DATA,
    getRowId: (row: Item) => row.id,
    initialDrafts: drafts,
    plugins: [
      cellEditing({
        saveMode: 'manual',
        onCommitEdits: (batch: CellEditBatch) => {
          commits.push(batch)
          const refused = batch.cells.flatMap(cell => {
            const refusal = refusalOf(cell.rowId)
            return refusal
              ? [{ rowId: cell.rowId, columnId: cell.columnId, ...refusal }]
              : []
          })
          return { refused }
        },
      } as never),
      unsavedChanges(),
      failureLog(),
    ] as never,
  } as never)
  edits = created as never
  table = created as never
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid table={created as never} height={440} />
    </div>
  )
}

/** Таблица с черновиками строк `rows`; «Применить всё» — ответ по `refusalOf`. */
const mountEdits = async (
  rows: readonly string[],
  refuse: typeof refusalOf = () => ({ reason: 'Row is locked' }),
) => {
  refusalOf = refuse
  commits.length = 0
  const screen = await render(<EditGrid drafts={rows.map(nameDraft)} />)
  await waitForGrid()
  await expect.poll(logButton).not.toBeNull()
  return screen
}

const applyAll = async () => {
  const before = commits.length
  applyAllDrafts(edits)
  await expect.poll(() => commits.length).toBe(before + 1)
}

const cellKey = (rowId: string) => cellFailureKey(rowId, 'name')
const editName = () => cellEditingLabels(tableLabels).cellDraftKind
const groups = () => [
  ...(log()?.querySelectorAll<HTMLElement>('[data-failure-group]') ?? []),
]
const backButton = () =>
  log()?.querySelector<HTMLElement>('[data-popup-level-back]') ?? null
const pultButton = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const pult = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes"]')
const announced = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(region => region.textContent)
    .join('|')
/** Уровни журнала сменились: снимок уходящего ушёл. */
const settledLevel = async () => {
  await expect
    .poll(() => log()?.querySelectorAll('[data-popup-level]').length)
    .toBe(1)
  await new Promise(resolve => setTimeout(resolve, 300))
}
const enterGroup = async (group: HTMLElement) => {
  await humanClick(actionOf(group, 'show')!)
  await expect.poll(backButton).not.toBeNull()
  await settledLevel()
}
const rows = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `r${from + i}`)
const groupFocused = () =>
  !!document.activeElement?.closest('[data-failure-group]')

describe('Группы журнала и сбрасывание правок (ADR 0227)', () => {
  test('AO6: отказы одного применения с одной причиной — одна запись журнала с подписью действия, числом целей и причиной; отказ с уникальной причиной — обычная запись; счётчик кнопки считает записи журнала', async () => {
    const screen = await mountEdits(rows(1, 4), rowId =>
      rowId === 'r4' ? { reason: 'Too long' } : { reason: 'Row is locked' },
    )
    try {
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(5)
      // Записей журнала три: группа, отказ с уникальной причиной, выгрузка.
      await expect.poll(() => bubbleOf(logButton()!).textContent).toBe('3')
      expect(logButton()!.getAttribute('aria-label')).toBe(
        failureLogLabels(tableLabels).failureLogButton(3),
      )
      await openLog()
      expect(entries()).toHaveLength(3)
      expect(groups()).toHaveLength(1)
      const group = groups()[0]!
      expect(group.getAttribute('data-failure-count')).toBe('3')
      expect(actionOf(group, 'show')!.textContent).toBe(
        `${editName()} ${failureLogLabels(tableLabels).failureGroupCells(3)}`,
      )
      expect(group.textContent).toContain('Row is locked')
      expect(group.querySelector('time')).not.toBeNull()
      // Уникальная причина — обычная запись с целью.
      const single = entryOf(cellKey('r4'))!
      expect(single.hasAttribute('data-failure-group')).toBe(false)
      expect(single.textContent).toContain('Too long')
      expect(single.textContent).toContain(
        tableLabels.failureTargetCell('Name', 5),
      )
    } finally {
      await screen.unmount()
    }
  })

  test('AO7: нажатие на группу, Enter и касание меняют содержимое журнала на список её отказов с кнопкой «назад»; фокус при входе — на первой записи, при выходе — на группе, Escape возвращает на первый уровень; список из 1000 отказов виртуализирован', async () => {
    const screen = await mountEdits(rows(0, 1000))
    try {
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(1000)
      await openLog()
      expect(entries()).toHaveLength(1)
      // Нажатие: второй уровень, фокус на первой записи.
      await enterGroup(groups()[0]!)
      expect(backButton()!.getAttribute('aria-label')).toBe(
        tableLabels.menuBack(
          `${editName()} · ${failureLogLabels(tableLabels).failureGroupCells(1000)}`,
        ),
      )
      expect(groups()).toHaveLength(0)
      await expect
        .poll(() =>
          document.activeElement
            ?.closest('[role="listitem"]')
            ?.getAttribute('data-index'),
        )
        .toBe('0')
      // 1000 отказов — в DOM только окно списка.
      expect(entries().length).toBeGreaterThan(0)
      expect(entries().length).toBeLessThan(40)
      const list = log()!.querySelector<HTMLElement>('[role="list"]')!
      expect(list.getBoundingClientRect().height).toBeGreaterThan(
        log()!.getBoundingClientRect().height,
      )
      // Escape — назад на первый уровень, журнал открыт, фокус на группе.
      await userEvent.keyboard('{Escape}')
      await expect.poll(backButton).toBeNull()
      await settledLevel()
      expect(log()).not.toBeNull()
      await expect.poll(groupFocused).toBe(true)
      // Enter на группе — снова второй уровень; «назад» — на первый, фокус на группе.
      await userEvent.keyboard('{Enter}')
      await expect.poll(backButton).not.toBeNull()
      await settledLevel()
      await humanClick(backButton()!)
      await expect.poll(backButton).toBeNull()
      await expect.poll(groupFocused).toBe(true)
      // Касание — тот же переход: подпись группы — кнопка.
      await settledLevel()
      await userEvent.click(actionOf(groups()[0]!, 'show')!)
      await expect.poll(backButton).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('AO8: «Повторить» группы применяет её правки одним вызовом onCommitEdits, «Сбросить правки» сбрасывает их одной записью в хранилище; у записи второго уровня — переход к цели, «Повторить» и «Сбросить правку»', async () => {
    const screen = await mountEdits(rows(1, 4))
    try {
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(4)
      await openLog()
      await enterGroup(groups()[0]!)
      // Запись второго уровня: переход, «Повторить», «Сбросить правку».
      const first = () => entryOf(cellKey('r1'))!
      expect(actionOf(first(), 'show')).not.toBeNull()
      expect(actionOf(first(), 'retry')).not.toBeNull()
      expect(actionOf(first(), 'discard')!.getAttribute('aria-label')).toBe(
        tableLabels.failureDiscard,
      )
      expect(actionOf(first(), 'close')).toBeNull()
      await choose(first(), 'show')
      await expect.poll(log).toBeNull()
      await expect
        .poll(() => cellEl('r1')?.getAttribute('data-flash'))
        .toBe('reverted')
      // «Повторить» записи — пакет из её ячейки.
      await openLog()
      await enterGroup(groups()[0]!)
      await choose(first(), 'retry')
      await expect.poll(log).toBeNull()
      await expect.poll(() => commits.length).toBe(2)
      expect(commits[1]!.cells.map(cell => cell.rowId)).toEqual(['r1'])
      // Повтор — новое применение: r1 — своей записью, в группе r2–r4.
      await expect.poll(() => table.getFailures().length).toBe(4)
      // «Сбросить правку» записи — в группе две, журнал открыт.
      await openLog()
      await enterGroup(groups()[0]!)
      await choose(entryOf(cellKey('r2'))!, 'discard')
      await expect.poll(() => table.getFailures().length).toBe(3)
      expect(edits.getDrafts()).toHaveLength(3)
      expect(log()).not.toBeNull()
      // «Повторить» группы — один вызов с её ячейками.
      await userEvent.keyboard('{Escape}')
      await expect.poll(backButton).toBeNull()
      await settledLevel()
      await choose(groups()[0]!, 'retry')
      await expect.poll(log).toBeNull()
      await expect.poll(() => commits.length).toBe(3)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(commits).toHaveLength(3)
      expect(commits[2]!.cells.map(cell => cell.rowId).sort()).toEqual([
        'r3',
        'r4',
      ])
      // «Сбросить правки» группы — одна запись в срез черновиков.
      await expect.poll(() => table.getFailures().length).toBe(3)
      await expect.poll(() => bubbleOf(logButton()!).textContent).toBe('2')
      await openLog()
      await settledLevel()
      let writes = 0
      const subscription = edits.atoms[DRAFTS_KEY]!.subscribe(() => writes++)
      try {
        const group = groups()[0]!
        expect(actionOf(group, 'discard')!.getAttribute('aria-label')).toBe(
          failureLogLabels(tableLabels).failureDiscardGroup,
        )
        await choose(group, 'discard')
        await expect.poll(() => edits.getDrafts().length).toBe(1)
      } finally {
        subscription.unsubscribe()
      }
      expect(writes).toBe(1)
      expect(table.getFailures().map(failure => failure.key)).toEqual([
        cellKey('r1'),
      ])
      expect(commits).toHaveLength(3)
    } finally {
      await screen.unmount()
    }
  })

  test('AO9: у записи с правкой нет «Закрыть»: её действия — «Повторить» и «Сбросить правку» в тоне опасного действия; у записи без правки — «Повторить» и «Закрыть»', async () => {
    const screen = await mountEdits(['r1', 'r2', 'r3'], rowId =>
      rowId === 'r1'
        ? { reason: 'Row is locked' }
        : { reason: 'Record not found' },
    )
    try {
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
        retry: () => {},
      })
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(4)
      await openLog()
      // С правкой: «Повторить» и «Сбросить правку» в тоне опасного действия, без «Закрыть».
      const edited = entryOf(cellKey('r1'))!
      expect(actionOf(edited, 'retry')).not.toBeNull()
      expect(actionOf(edited, 'close')).toBeNull()
      const discard = actionOf(edited, 'discard')!
      expect(discard.getAttribute('aria-label')).toBe(
        tableLabels.failureDiscard,
      )
      expect(discard.getAttribute('data-tone')).toBe('danger')
      // Без правки: «Повторить» и «Закрыть».
      const exported = entryOf('process\u0000export')!
      expect(actionOf(exported, 'retry')).not.toBeNull()
      expect(actionOf(exported, 'close')).not.toBeNull()
      expect(actionOf(exported, 'discard')).toBeNull()
      // Отказ правки с любой причиной сервера — те же действия: в группе и на её втором уровне.
      const group = groups()[0]!
      expect(actionOf(group, 'retry')).not.toBeNull()
      expect(actionOf(group, 'close')).toBeNull()
      expect(actionOf(group, 'discard')).not.toBeNull()
      await enterGroup(group)
      for (const row of ['r2', 'r3']) {
        const entry = entryOf(cellKey(row))!
        expect(actionOf(entry, 'show'), row).not.toBeNull()
        expect(actionOf(entry, 'retry'), row).not.toBeNull()
        expect(actionOf(entry, 'close'), row).toBeNull()
        expect(actionOf(entry, 'discard'), row).not.toBeNull()
      }
      await userEvent.keyboard('{Escape}')
      await expect.poll(backButton).toBeNull()
      await settledLevel()
      // «Сбросить правку» снимает запись и черновик; «Закрыть» — запись без правки.
      await choose(entryOf(cellKey('r1'))!, 'discard')
      await expect.poll(() => entryOf(cellKey('r1'))).toBeFalsy()
      expect(
        edits
          .getDrafts()
          .some(
            draft => 'cell' in draft.target && draft.target.cell[0] === 'r1',
          ),
      ).toBe(false)
      await choose(entryOf('process\u0000export')!, 'close')
      await expect.poll(() => entryOf('process\u0000export')).toBeFalsy()
      expect(log()).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('AO10: кнопка внизу журнала сбрасывает правки всех записей и закрывает записи без правок; от десяти правок спрашивает подтверждение с их числом, до десяти — нет; без записей с правками называется «Закрыть все»', async () => {
    const labels = failureLogLabels(tableLabels)
    const question = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="failure-log-question"]',
      )
    let screen = await mountEdits(rows(1, 12))
    try {
      table.reportFailure({
        label: dataExportLabels(tableLabels).export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(13)
      await openLog()
      // Двенадцать правок — вопрос с их числом, отказ — ничего не сброшено.
      expect(footerButton()!.textContent).toBe(labels.failureDiscardAll)
      expect(footerButton()!.getAttribute('data-tone')).toBe('danger')
      await humanClick(footerButton()!)
      await expect.poll(question).not.toBeNull()
      expect(question()!.textContent).toContain(
        labels.failureDiscardAllQuestion(12),
      )
      const decline = () =>
        question()!.querySelector<HTMLElement>('[data-question-decline]')!
      expect(decline().getAttribute('aria-label')).toBe(
        labels.failureDiscardAllDecline,
      )
      await humanClick(decline())
      await expect.poll(question).toBeNull()
      expect(table.getFailures()).toHaveLength(13)
      expect(edits.getDrafts()).toHaveLength(12)
      // Escape на вопросе — отказ, журнал открыт.
      await humanClick(footerButton()!)
      await expect.poll(question).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(question).toBeNull()
      expect(log()).not.toBeNull()
      expect(table.getFailures()).toHaveLength(13)
      // Согласие — правки сброшены, запись без правки закрыта.
      await humanClick(footerButton()!)
      await expect.poll(question).not.toBeNull()
      const confirm = question()!.querySelector<HTMLElement>(
        '[data-question-confirm]',
      )!
      expect(confirm.getAttribute('aria-label')).toBe(
        labels.failureDiscardAllConfirm,
      )
      await humanClick(confirm)
      await expect.poll(empty).not.toBeNull()
      expect(table.getFailures()).toEqual([])
      expect(edits.getDrafts()).toEqual([])
      expect(log()).not.toBeNull()
      await screen.unmount()

      // Девять правок — без вопроса.
      screen = await mountEdits(rows(1, 9))
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(9)
      await openLog()
      await humanClick(footerButton()!)
      await expect.poll(empty).not.toBeNull()
      expect(question()).toBeNull()
      expect(edits.getDrafts()).toEqual([])
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      // Без правок — «Закрыть все» без тона и вопроса.
      for (let i = 0; i < 12; i++)
        table.reportFailure({
          label: 'Archive',
          target: { row: `r${i}` },
          reason: 'Row is locked',
        })
      await openLog()
      expect(footerButton()!.textContent).toBe(labels.failureClearAll)
      expect(footerButton()!.getAttribute('data-tone')).toBeNull()
      await humanClick(footerButton()!)
      await expect.poll(empty).not.toBeNull()
      expect(question()).toBeNull()
      expect(table.getFailures()).toEqual([])
    } finally {
      await screen.unmount()
    }
  })

  test('AO12: переход к цели, прокрутка к которой не удалась, не вспыхивает и не закрывает журнал и пульт: у записи — «Не удалось найти строку», скринридеру — объявление', async () => {
    const screen = await mountEdits(['r1'])
    try {
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(1)
      // Вспышка отказа применения ушла: следующей вспышки быть не должно.
      await expect
        .poll(() => cellEl('r1')?.getAttribute('data-flash') ?? null, {
          timeout: 5000,
        })
        .toBeNull()
      // Пульту — свой черновик на строке r3.
      setDraft(edits, nameDraft('r3'))
      await expect.poll(() => edits.getDrafts().length).toBe(2)
      const scrolled: string[] = []
      edits.scrollToRow = async rowId => {
        scrolled.push(rowId)
        return false
      }
      // Журнал: запись остаётся со строкой ошибки, объявление, вспышки нет.
      await openLog()
      await choose(entryOf(cellKey('r1'))!, 'show')
      await expect
        .poll(
          () =>
            entryOf(cellKey('r1'))?.querySelector('[data-popup-entry-error]')
              ?.textContent,
        )
        .toBe(failureLogLabels(tableLabels).targetNotFound)
      expect(scrolled).toEqual(['r1'])
      // Уход поповера плавный: закрытие видно не сразу.
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(log()).not.toBeNull()
      await expect
        .poll(announced)
        .toContain(failureLogLabels(tableLabels).targetNotFound)
      expect(cellEl('r1')?.getAttribute('data-flash') ?? null).toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      // Пульт: то же.
      await humanClick(pultButton()!)
      await expect.poll(pult).not.toBeNull()
      const draftEntry = () =>
        [...pult()!.querySelectorAll<HTMLElement>('[role="listitem"]')].find(
          item =>
            item.textContent?.includes(
              tableLabels.failureTargetCell('Name', 4),
            ),
        )
      await expect.poll(draftEntry).toBeTruthy()
      await humanClick(actionOf(draftEntry()!, 'show')!)
      await expect
        .poll(
          () =>
            draftEntry()?.querySelector('[data-popup-entry-error]')
              ?.textContent,
        )
        .toBe(unsavedChangesLabels(tableLabels).targetNotFound)
      expect(scrolled).toEqual(['r1', 'r3'])
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(pult()).not.toBeNull()
      expect(cellEl('r3')?.getAttribute('data-flash') ?? null).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('AO16: плашка в тоне успеха и в нейтральном тоне (иконка не ниже 3:1, в forced-colors — обычный контур), группа, второй уровень и вопрос проходят axe с color-contrast в обеих темах и видны в forced-colors', async () => {
    const withContrast: axe.RunOptions = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const violations = async (root: Element) =>
      (await axe.run(root, withContrast)).violations.map(
        v => `${v.id}: ${v.nodes.map(n => n.failureSummary).join(' | ')}`,
      )
    const notice = () =>
      document.querySelector<HTMLElement>('[data-testid="table-notice"]')
    const question = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="failure-log-question"]',
      )
    const visibleInForcedColors = (el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
      expect(getComputedStyle(el).visibility).toBe('visible')
    }

    // Плашка в тоне успеха: все правки сохранены.
    let screen = await mountEdits(['r1', 'r2'], () => undefined)
    try {
      await applyAll()
      await expect
        .poll(() => notice()?.getAttribute('data-tone'))
        .toBe('success')
      // Фокус внутри держит плашку, пока идут проверки (AO1).
      notice()!.querySelector<HTMLElement>('[data-alert-dismiss]')!.focus()
      await inBothThemes(async () => {
        expect(await violations(notice()!)).toEqual([])
        // Иконка — не текст: не ниже 3:1 к фону плашки.
        const surface = effectiveBg(notice()!)
        const icon = notice()!.querySelector('svg')!
        expect(
          contrast(toRgba(getComputedStyle(icon).color), surface),
        ).toBeGreaterThanOrEqual(3)
      })
      if (server.browser !== 'webkit') {
        // В forced-colors — обычный контур плашки, как без тона.
        await commands.forcedColors(true)
        await expect
          .poll(() => getComputedStyle(notice()!).outlineStyle)
          .toBe('solid')
        expect(getComputedStyle(notice()!).outlineWidth).toBe('1px')
        visibleInForcedColors(notice()!)
        await commands.forcedColors(false)
      }
    } finally {
      await screen.unmount()
    }

    // Плашка в нейтральном тоне: сохранена часть правок.
    screen = await mountEdits(['r1', 'r2'], rowId =>
      rowId === 'r2' ? { reason: 'Row is locked' } : undefined,
    )
    try {
      await applyAll()
      await expect
        .poll(() => notice()?.getAttribute('data-tone'))
        .toBe('neutral')
      await inBothThemes(async () => {
        expect(await violations(notice()!)).toEqual([])
        const surface = effectiveBg(notice()!)
        const icon = notice()!.querySelector('svg')!
        expect(
          contrast(toRgba(getComputedStyle(icon).color), surface),
        ).toBeGreaterThanOrEqual(3)
      })
      if (server.browser !== 'webkit') {
        await commands.forcedColors(true)
        await expect
          .poll(() => getComputedStyle(notice()!).outlineStyle)
          .toBe('solid')
        visibleInForcedColors(notice()!)
        await commands.forcedColors(false)
      }
    } finally {
      await screen.unmount()
    }

    // Группа, второй уровень и вопрос: двенадцать отклонённых правок с одной причиной.
    screen = await mountEdits(rows(1, 12))
    try {
      await applyAll()
      await expect.poll(() => table.getFailures().length).toBe(12)
      await openLog()
      await settledLevel()
      expect(groups()).toHaveLength(1)
      const check = async () => {
        await inBothThemes(async () => {
          expect(await violations(log()!)).toEqual([])
        })
        if (server.browser === 'webkit') return
        await commands.forcedColors(true)
        visibleInForcedColors(log()!)
        await commands.forcedColors(false)
      }
      // Группа на первом уровне.
      await check()
      visibleInForcedColors(groups()[0]!)
      // Второй уровень.
      await enterGroup(groups()[0]!)
      await check()
      visibleInForcedColors(backButton()!)
      // Вопрос перед сбрасыванием всех правок.
      await userEvent.keyboard('{Escape}')
      await expect.poll(backButton).toBeNull()
      await settledLevel()
      await humanClick(footerButton()!)
      await expect.poll(question).not.toBeNull()
      await check()
      visibleInForcedColors(question()!)
    } finally {
      await screen.unmount()
    }
  })
})
