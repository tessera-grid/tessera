import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  contextMenu,
  keyboardNavigation,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS } from './a11y-helpers'

// Выделение ячеек и копирование в серверной модели строк (ADR 0146): мышь и клавиши по
// всему итогу, автопрокрутка, синхронное и асинхронное копирование, отказы, строки-группы,
// доступность.

interface Item {
  id: string
  name: string
  city: string
  count?: number
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_DATA: Item[] = []
const BLOCK = 100

const itemAt = (index: number): Item => ({
  id: `r${index}`,
  name: `N${index}`,
  city: `C${index % 7}`,
})

type Answer = ServerRowsResponse<Item> | Error

interface Call {
  request: ServerRowsRequest
  settle: (answer: Answer) => void
}

const rowsAnswer = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, i) => itemAt(start + i)),
})

/** «Сервер» по команде теста: `reply` отвечает сразу или ждёт (`undefined`). */
const server = (
  reply: (request: ServerRowsRequest) => Answer | undefined = rowsAnswer,
) => {
  const calls: Call[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const settle = (answer: Answer) =>
        answer instanceof Error ? reject(answer) : resolve(answer)
      calls.push({ request, settle })
      const now = reply(request)
      if (now) settle(now)
    })
  return { calls, getRows, starts: () => calls.map(c => c.request.start) }
}

interface GridTable {
  store: { get: () => Record<string, unknown> }
}

const Grid = ({
  getRows,
  rowCount = 1000,
  plugins = [],
  selection = {},
  colorMode,
  onTable,
}: {
  getRows: ReturnType<typeof server>['getRows']
  rowCount?: number
  plugins?: readonly TesseraFeatureEntry[]
  selection?: Parameters<typeof cellSelection>[0]
  colorMode?: 'light' | 'dark'
  onTable?: (table: GridTable) => void
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({
        getRows,
        rowCount,
        blockSize: BLOCK,
        getGroupChildCount: (row: Item) => row.count,
      }),
      cellSelection(selection),
      ...plugins,
    ] as never,
  })
  onTable?.(table as unknown as GridTable)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const nextFrame = () => new Promise(requestAnimationFrame)
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
const cellAt = (index: number, column: string) =>
  q(
    `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const isSelected = (element: Element | null) =>
  element?.getAttribute('data-cell-selected') === 'true'
const selectedCount = () =>
  document.querySelectorAll('[data-cell-selected="true"]').length
const selectedPending = () =>
  document.querySelectorAll('[data-pending-row] [data-cell-selected="true"]')
    .length
const banner = () => q('[data-testid="load-error-banner"]')
const liveRegion = () => q('[role="status"][aria-live="polite"]')!
const pointer = commands as unknown as {
  realDragHold: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps?: number,
  ) => Promise<void>
  realMouseUp: () => Promise<void>
}
const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}
const rangesOf = (table: GridTable) =>
  table.store.get().cellSelection as {
    anchorRowIndex: number
    focusRowIndex: number
    anchorColumnId: string
    focusColumnId: string
  }[]
/** Прокрутить тело к строке `index` и дождаться конца быстрой прокрутки. */
const scrollToIndex = async (index: number) => {
  scrollLayer(scroller()).scrollTo({ top: index * rowHeight() }, 'instant')
  await nextFrame()
  await expect
    .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
      timeout: 3000,
    })
    .toBe(false)
}
/**
 * Событие `copy` от ячейки, как Ctrl+C: что грид положил в буфер события.
 * Firefox кладёт в событие свою копию `DataTransfer` — читается она.
 */
const copyFrom = (element: Element) => {
  const event = new ClipboardEvent('copy', {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  })
  element.dispatchEvent(event)
  return event.clipboardData!
}
/** Асинхронный буфер: окно теста писать в буфер не вправе, запись подменяется. */
const stubClipboard = (fail = false) => {
  const written: { text: string; html?: string }[] = []
  vi.spyOn(navigator.clipboard, 'write').mockImplementation(async items => {
    if (fail) throw new DOMException('Denied', 'NotAllowedError')
    for (const item of items) {
      written.push({
        text: await (await item.getType('text/plain')).text(),
        html: await (await item.getType('text/html')).text(),
      })
    }
  })
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async text => {
    if (fail) throw new DOMException('Denied', 'NotAllowedError')
    written.push({ text })
  })
  return written
}

describe('Выделение ячеек в серверной модели строк (ADR 0146)', () => {
  test('XC2: клик, Shift+клик, Ctrl+клик и протяжка выделяют, как в клиентском режиме, в том числе через незагруженные строки; кромки и заливка те же', async () => {
    const { getRows } = server()
    let table!: GridTable
    const screen = await render(
      <Grid getRows={getRows} onTable={t => (table = t)} />,
    )
    try {
      await expect.poll(() => cellAt(3, 'city')).not.toBeNull()
      // Клик и Shift+клик — прямоугольник с общим контуром, начальная ячейка без заливки.
      await humanClick(cellAt(1, 'name')!)
      await userEvent.click(cellAt(3, 'city')!, { modifiers: ['Shift'] })
      await expect.poll(selectedCount).toBe(6)
      const anchor = cellAt(1, 'name')!
      expect(anchor.getAttribute('data-cell-focused')).toBe('true')
      const corner = getComputedStyle(cellAt(3, 'city')!)
      expect(corner.getPropertyValue('--tsr-sel-edge-bottom')).not.toBe(
        'transparent',
      )
      expect(
        getComputedStyle(cellAt(2, 'name')!).getPropertyValue(
          '--tsr-sel-edge-top',
        ),
      ).toBe('transparent')

      // Ctrl+клик — второй диапазон.
      await userEvent.click(cellAt(5, 'name')!, { modifiers: ['Control'] })
      await expect.poll(selectedCount).toBe(7)
      expect(rangesOf(table)).toHaveLength(2)

      // Протяжка настоящей мышью.
      await pointer.realDragHold(
        centerOf(cellAt(0, 'name')!),
        centerOf(cellAt(2, 'name')!),
      )
      await pointer.realMouseUp()
      await expect.poll(selectedCount).toBe(3)

      // Shift+клик через незагруженные строки: диапазон по местам в списке.
      await humanClick(cellAt(0, 'name')!)
      await scrollToIndex(500)
      await expect.poll(() => cellAt(503, 'city')).not.toBeNull()
      await userEvent.click(cellAt(503, 'city')!, { modifiers: ['Shift'] })
      await expect
        .poll(() => rangesOf(table))
        .toEqual([
          {
            anchorRowIndex: 0,
            focusRowIndex: 503,
            anchorColumnId: 'name',
            focusColumnId: 'city',
          },
        ])
      expect(isSelected(cellAt(500, 'name'))).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('XC3: Shift+стрелки, Shift+PageDown/PageUp и Ctrl+Shift+End/Home расширяют диапазон по всему итогу без загрузки промежуточных блоков; незагруженные строки внутри залиты', async () => {
    // Первый блок отвечает сразу, остальные ждут.
    const { getRows, starts } = server(request =>
      request.start === 0 ? rowsAnswer(request) : undefined,
    )
    let table!: GridTable
    const screen = await render(
      <Grid
        getRows={getRows}
        plugins={[keyboardNavigation()]}
        onTable={t => (table = t)}
      />,
    )
    try {
      await expect.poll(() => cellAt(1, 'name')).not.toBeNull()
      await humanClick(cellAt(1, 'name')!)
      await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}')
      await expect
        .poll(() => rangesOf(table)[0])
        .toMatchObject({
          anchorRowIndex: 1,
          focusRowIndex: 2,
          focusColumnId: 'city',
        })

      await userEvent.keyboard('{Shift>}{PageDown}{/Shift}')
      const paged = rangesOf(table)[0]!.focusRowIndex
      expect(paged).toBeGreaterThan(5)
      await userEvent.keyboard('{Shift>}{PageUp}{/Shift}')
      await expect.poll(() => rangesOf(table)[0]!.focusRowIndex).toBe(2)

      await userEvent.keyboard('{Control>}{Shift>}{End}{/Shift}{/Control}')
      await expect
        .poll(() => rangesOf(table)[0])
        .toMatchObject({
          anchorRowIndex: 1,
          focusRowIndex: 999,
          focusColumnId: 'city',
        })
      // Окно у конца ждёт ответа: его строки — скелеты внутри диапазона.
      await expect.poll(selectedPending).toBeGreaterThan(0)
      // Блоки между началом и концом не запрашивались.
      expect(starts().filter(start => start > 0 && start < 800)).toEqual([])

      await userEvent.keyboard('{Control>}{Shift>}{Home}{/Shift}{/Control}')
      await expect
        .poll(() => rangesOf(table)[0])
        .toMatchObject({
          anchorRowIndex: 1,
          focusRowIndex: 0,
          focusColumnId: 'name',
        })
    } finally {
      await screen.unmount()
    }
  })

  test('XC4: протяжка у края прокручивает и расширяет диапазон, в том числе в растянутой области', async () => {
    // Отвечает только первый блок: дальше под курсором — незагруженные строки.
    const { getRows } = server(request =>
      request.start === 0 ? rowsAnswer(request) : undefined,
    )
    let table!: GridTable
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1_000_000}
        onTable={t => (table = t)}
      />,
    )
    try {
      await expect.poll(() => cellAt(2, 'name')).not.toBeNull()
      expect(scrollLayer(scroller()).stretched).toBe(true)
      const box = scroller().getBoundingClientRect()
      await pointer.realDragHold(centerOf(cellAt(2, 'name')!), {
        x: box.left + 100,
        y: box.bottom + 40,
      })
      await expect
        .poll(() => rangesOf(table)[0]?.focusRowIndex ?? 0, { timeout: 10_000 })
        .toBeGreaterThan(BLOCK + 5)
      expect(document.querySelector('[data-pending-row]')).not.toBeNull()
      await pointer.realMouseUp()
      expect(rangesOf(table)[0]).toMatchObject({
        anchorRowIndex: 2,
        anchorColumnId: 'name',
      })
      expect(scrollLayer(scroller()).top()).toBeGreaterThan(0)
    } finally {
      await screen.unmount()
    }
  })

  test('XC5: весь диапазон загружен — Ctrl+C синхронно пишет TSV и HTML', async () => {
    const { getRows, calls } = server()
    const screen = await render(<Grid getRows={getRows} />)
    try {
      await expect.poll(() => cellAt(3, 'city')).not.toBeNull()
      await humanClick(cellAt(1, 'name')!)
      await userEvent.click(cellAt(3, 'city')!, { modifiers: ['Shift'] })
      const asked = calls.length
      const data = copyFrom(cellAt(1, 'name')!)
      expect(data.getData('text/plain')).toBe('N1\tC1\nN2\tC2\nN3\tC3')
      expect(data.getData('text/html')).toContain('<td>N2</td><td>C2</td>')
      expect(calls.length).toBe(asked)
    } finally {
      await screen.unmount()
    }
  })

  test('XC7: ожидание копирования объявляется; новый Ctrl+C или новое выделение прерывают прежний запрос', async () => {
    stubClipboard()
    const { getRows, calls } = server(request =>
      request.start === 0 ? rowsAnswer(request) : undefined,
    )
    let table!: GridTable
    const screen = await render(
      <Grid getRows={getRows} onTable={t => (table = t)} />,
    )
    try {
      await expect.poll(() => cellAt(1, 'name')).not.toBeNull()
      const select = (bottom: number) =>
        (
          table as unknown as {
            setCellSelection: (u: () => unknown[]) => void
          }
        ).setCellSelection(() => [
          {
            anchorRowIndex: 0,
            focusRowIndex: bottom,
            anchorColumnId: 'name',
            focusColumnId: 'city',
          },
        ])
      select(299)
      await nextFrame()
      const first = calls.length
      copyFrom(cellAt(1, 'name')!)
      await expect
        .poll(() => liveRegion().textContent)
        .toContain(tableLabels.announceCopyLoading(300))
      // Запросы догрузки уходят кусками, после уступки потока.
      await expect.poll(() => calls.length).toBeGreaterThan(first)
      const pending = calls.slice(first)

      // Новый Ctrl+C — прежний запрос прерван.
      copyFrom(cellAt(1, 'name')!)
      expect(pending.every(c => c.request.signal.aborted)).toBe(true)

      // Новое выделение — тоже.
      await expect
        .poll(() => calls.length)
        .toBeGreaterThan(first + pending.length)
      const second = calls.slice(first + pending.length)
      select(250)
      await nextFrame()
      expect(second.every(c => c.request.signal.aborted)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('CA6: копирование в SSRM в ожидании — та же плашка «Копирование…» и Escape', async () => {
    stubClipboard()
    const { getRows, calls } = server(request =>
      request.start === 0 ? rowsAnswer(request) : undefined,
    )
    let table!: GridTable
    const screen = await render(
      <Grid getRows={getRows} onTable={t => (table = t)} />,
    )
    const banner = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="pending-action-banner"]',
      )
    const copyAll = async () => {
      ;(
        table as unknown as {
          setCellSelection: (u: () => unknown[]) => void
        }
      ).setCellSelection(() => [
        {
          anchorRowIndex: 0,
          focusRowIndex: 299,
          anchorColumnId: 'name',
          focusColumnId: 'city',
        },
      ])
      await nextFrame()
      const first = calls.length
      copyFrom(cellAt(1, 'name')!)
      await expect.poll(() => calls.length).toBeGreaterThan(first)
      await expect
        .poll(() => banner()?.textContent ?? '', { timeout: 3000 })
        .toContain(tableLabels.pendingCopy)
      expect(banner()!.textContent).toContain(tableLabels.cancel)
      return calls.slice(first)
    }
    try {
      await expect.poll(() => cellAt(1, 'name')).not.toBeNull()

      // Escape в теле.
      const escaped = await copyAll()
      cellAt(1, 'name')!.focus()
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => escaped.every(c => c.request.signal.aborted))
        .toBe(true)
      await expect.poll(() => banner()).toBeNull()

      // Кнопка «Отменить» плашки.
      const cancelled = await copyAll()
      await humanClick(
        document.querySelector<HTMLElement>(
          '[data-testid="pending-action-cancel"]',
        )!,
      )
      await expect
        .poll(() => cancelled.every(c => c.request.signal.aborted))
        .toBe(true)
      await expect.poll(() => banner()).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('XC17: копирование, ждущее строк, бросается, когда таблица уходит со страницы: новых блоков не запрашивает, буфер не пишет', async () => {
    const written = stubClipboard()
    const { getRows, calls } = server(request =>
      request.start === 0 ? rowsAnswer(request) : undefined,
    )
    let table!: GridTable
    const screen = await render(
      <Grid getRows={getRows} onTable={t => (table = t)} />,
    )
    await expect.poll(() => cellAt(1, 'name')).not.toBeNull()
    ;(
      table as unknown as { setCellSelection: (u: () => unknown[]) => void }
    ).setCellSelection(() => [
      {
        anchorRowIndex: 0,
        focusRowIndex: 999,
        anchorColumnId: 'name',
        focusColumnId: 'city',
      },
    ])
    await nextFrame()
    const first = calls.length
    copyFrom(cellAt(1, 'name')!)
    await expect.poll(() => calls.length).toBeGreaterThan(first)
    const inFlight = calls.slice(first)
    // Девять блоков, а сразу уходят несколько: остальные ждут своей очереди.
    expect(inFlight.length).toBeLessThan(9)

    await screen.unmount()
    for (const call of inFlight) call.settle(rowsAnswer(call.request))
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(calls.length).toBe(first + inFlight.length)
    expect(written).toEqual([])
  })

  test('XC8: отказ getRows или Clipboard API — плашка с причиной и повтором, объявление, буфер не меняется', async () => {
    let fail = true
    const { getRows } = server(request =>
      request.start >= 100 && fail
        ? new Error('Server error: 503')
        : rowsAnswer(request),
    )
    let written = stubClipboard()
    let table!: GridTable
    const screen = await render(
      <Grid getRows={getRows} onTable={t => (table = t)} />,
    )
    try {
      await expect.poll(() => cellAt(1, 'name')).not.toBeNull()
      ;(
        table as unknown as {
          setCellSelection: (u: () => unknown[]) => void
        }
      ).setCellSelection(() => [
        {
          anchorRowIndex: 0,
          focusRowIndex: 199,
          anchorColumnId: 'name',
          focusColumnId: 'city',
        },
      ])
      await nextFrame()
      copyFrom(cellAt(1, 'name')!)
      await expect.poll(banner).not.toBeNull()
      expect(banner()!.textContent).toContain(
        tableLabels.serverActionFailedCopy,
      )
      expect(banner()!.textContent).toContain('Server error: 503')
      await expect
        .poll(() => liveRegion().textContent)
        .toContain(tableLabels.serverActionFailedCopy)
      expect(written).toEqual([])

      // Повтор с плашки — строки пришли, буфер записан, плашка ушла.
      fail = false
      await humanClick(q('[data-testid="load-error-retry"]')!)
      await expect.poll(() => written.length).toBe(1)
      expect(written[0]!.text.split('\n')).toHaveLength(200)
      await expect.poll(banner).toBeNull()

      // Отказ записи в буфер — своя причина.
      vi.restoreAllMocks()
      written = stubClipboard(true)
      copyFrom(cellAt(1, 'name')!)
      await expect.poll(banner).not.toBeNull()
      expect(banner()!.textContent).toContain(tableLabels.copyClipboardDenied)
      expect(written).toEqual([])
    } finally {
      vi.restoreAllMocks()
      await screen.unmount()
    }
  })

  test('XC12: строки-группы выделяются и копируются отображаемыми значениями; пункт «Копировать» контекстного меню — тем же путём', async () => {
    const written = stubClipboard()
    const groups: Item[] = ['C0', 'C1', 'C2'].map((city, i) => ({
      id: '',
      name: `${10 + i} names`,
      city,
      count: 10 + i,
    }))
    const { getRows } = server(request =>
      request.groupKeys.length === 0
        ? { rows: groups.slice(request.start, request.end), rowCount: 3 }
        : rowsAnswer(request),
    )
    const screen = await render(
      <Grid
        getRows={getRows}
        plugins={[
          rowGrouping({ initialGrouping: ['city'] }),
          rowExpanding(),
          contextMenu(),
        ]}
      />,
    )
    try {
      await expect.poll(() => cellAt(2, 'name')).not.toBeNull()
      await humanClick(cellAt(0, 'name')!)
      await userEvent.click(cellAt(2, 'city')!, { modifiers: ['Shift'] })
      await expect.poll(selectedCount).toBe(6)
      const data = copyFrom(cellAt(0, 'name')!)
      expect(data.getData('text/plain')).toBe(
        '10 names\tC0\n11 names\tC1\n12 names\tC2',
      )

      // Тот же текст — пунктом «Копировать».
      await userEvent.click(cellAt(1, 'name')!, { button: 'right' })
      const item = await vi.waitFor(
        () => {
          const found = [
            ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
          ].find(el => el.textContent?.includes(tableLabels.copy))
          if (!found) throw new Error('no copy item')
          return found
        },
        { timeout: 5000 },
      )
      await humanClick(item)
      await expect.poll(() => written.length).toBe(1)
      expect(written[0]!.text).toBe(data.getData('text/plain'))
    } finally {
      vi.restoreAllMocks()
      await screen.unmount()
    }
  })

  test('XC13: axe и color-contrast выделения в SSRM в обеих темах, в ролях grid и treegrid; у выделенных ячеек aria-selected', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      for (const tree of [false, true]) {
        const { getRows } = server(request =>
          request.start === 0 ? rowsAnswer(request) : undefined,
        )
        let table!: GridTable
        const screen = await render(
          <Grid
            getRows={getRows}
            colorMode={colorMode}
            plugins={[
              keyboardNavigation(),
              ...(tree ? [rowExpanding({ hasChildren: () => true })] : []),
            ]}
            onTable={t => (table = t)}
          />,
        )
        try {
          await expect.poll(() => cellAt(1, 'name')).not.toBeNull()
          expect(
            q('[role="grid"], [role="treegrid"]')!.getAttribute('role'),
          ).toBe(tree ? 'treegrid' : 'grid')
          ;(
            table as unknown as {
              setCellSelection: (u: () => unknown[]) => void
            }
          ).setCellSelection(() => [
            {
              anchorRowIndex: 95,
              focusRowIndex: 105,
              anchorColumnId: 'name',
              focusColumnId: 'city',
            },
          ])
          await scrollToIndex(95)
          await expect.poll(selectedPending).toBeGreaterThan(0)
          expect(cellAt(96, 'city')!.getAttribute('aria-selected')).toBe('true')
          const { violations } = await axe.run(q('.data-grid-theme')!, {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          })
          expect(violations, `${colorMode} ${tree}`).toEqual([])
        } finally {
          await screen.unmount()
        }
      }
    }
  })
})
