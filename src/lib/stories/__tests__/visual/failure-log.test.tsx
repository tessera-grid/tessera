import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { Failure } from '../../../core/failures/failuresFeature'
import type { RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnVisibility,
  failureLog,
  rowActions,
  serverRowModel,
} from '../../../plugins'
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
const entryOf = (key: string) =>
  log()?.querySelector<HTMLElement>(`[data-failure-key="${CSS.escape(key)}"]`)
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
const clearAll = () =>
  log()?.querySelector<HTMLElement>('[data-action="clear-all"]') ?? null
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
    label: tableLabels.cellDraftKind,
    target: { cell: [row, 'name'] },
    reason,
  })

describe('Журнал отказов (ADR 0177)', () => {
  test('JR1: плагин failureLog() — кнопка тулбара видна всегда; пока в реестре есть записи — на ней красный бабл-счётчик, без записей — бабла нет, журнал показывает компактную заглушку: иллюстрацию, «Отказов нет» и пояснение', async () => {
    const screen = await mount()
    try {
      // Без отказов: кнопка на месте, бабла нет, журнал пуст.
      await expect.poll(logButton).not.toBeNull()
      expect(shown()).toBe(false)
      expect(logButton()!.getAttribute('aria-label')).toBe(
        tableLabels.failureLog,
      )
      await openLog()
      const stub = empty()!
      expect(stub.getAttribute('data-size')).toBe('compact')
      expect(stub.textContent).toContain(tableLabels.failureLogEmpty)
      expect(stub.textContent).toContain(tableLabels.failureLogEmptyDescription)
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
        tableLabels.failureLogButton(2),
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
        label: tableLabels.export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await openLog()
      // Новые сверху; подпись, цель, причина, время.
      const [newest, , oldest] = entries()
      expect(newest!.textContent).toContain(tableLabels.export)
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
        ['close', tableLabels.failureClose],
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

  test('JR8: «Очистить всё» внизу журнала, пока в нём есть записи, закрывает все записи: снимает отметки ячеек и отбрасывает отклонённые изменения; журнал остаётся открытым и пишет, что отказов нет', async () => {
    const screen = await mount()
    try {
      // Пустой журнал — без кнопки.
      await openLog()
      expect(clearAll()).toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(log).toBeNull()

      const discarded: string[] = []
      for (const row of ['r1', 'r2'])
        table.reportFailure({
          label: tableLabels.cellDraftKind,
          target: { cell: [row, 'name'] },
          reason: 'Server said no',
          discard: () => discarded.push(row),
        } as never)
      table.reportFailure({
        label: tableLabels.export,
        target: { process: 'export' },
        reason: 'Disk full',
      })
      await expect
        .poll(() => cellEl('r2')?.querySelector('[data-cell-issue]'))
        .not.toBeNull()
      await openLog()
      expect(entries()).toHaveLength(3)
      await humanClick(clearAll()!)
      await expect.poll(empty).not.toBeNull()
      expect(log()).not.toBeNull()
      expect(table.getFailures()).toEqual([])
      expect(discarded.sort()).toEqual(['r1', 'r2'])
      expect(document.querySelector('[data-cell-issue]')).toBeNull()
      expect(clearAll()).toBeNull()
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
        label: tableLabels.export,
        target: { process: 'export' },
        reason: 'Disk full',
        retry: () => {},
      })
      await openLog()
      await inBothThemes(async () => {
        const result = await axe.run(log()!, AXE_OPTIONS)
        expect(result.violations.map(v => v.id)).toEqual([])
        const toolbar = await axe.run(
          document.querySelector('[role="toolbar"]')!,
          AXE_OPTIONS,
        )
        expect(toolbar.violations.map(v => v.id)).toEqual([])
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
        '[role="listitem"] [class*="reason"]',
      )!
      expect(toRgba(getComputedStyle(reason).color)).not.toEqual(
        toRgba(getComputedStyle(log()!).backgroundColor),
      )
    } finally {
      await screen.unmount()
    }
  })
})
