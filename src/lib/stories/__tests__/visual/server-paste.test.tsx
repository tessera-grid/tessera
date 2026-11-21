import { render } from 'vitest-browser-react'
import { commands } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { readFlashes } from '../../../core/flashes/flashFeature'
import { cellHighlightKey } from '../../../core/highlights/highlightFeature'
import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import type { CellEditBatch } from '../../../plugins/cellEditing/types'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'

// Вставка и протяжка в серверной модели строк через незагруженные строки (ADR 0219, этап 3):
// WR27, WR29. Догрузка, предел, отмена сменой выделения — модульный WR28 в `cellWrites.dom`.

interface Item {
  id: string
  name: string
  city: string
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

const rowsAnswer = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, i) => itemAt(start + i)),
})

/** «Сервер»: первый блок отвечает сразу, прочие ждут команды теста. */
const server = () => {
  const held: { request: ServerRowsRequest; answer: () => void }[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>(resolve => {
      if (request.start === 0) resolve(rowsAnswer(request))
      else held.push({ request, answer: () => resolve(rowsAnswer(request)) })
    })
  /** Ответить ждущим запросам мимо кэша окна — тем, что начинаются после `from`. */
  const answer = () => held.splice(0).forEach(call => call.answer())
  return { getRows, held, answer }
}

type Table = {
  store: { get: () => Record<string, unknown> }
}

const Grid = ({
  getRows,
  rowCount = 1000,
  onCommitEdits,
  handle,
  onTable,
}: {
  getRows: ReturnType<typeof server>['getRows']
  rowCount?: number
  onCommitEdits: (batch: CellEditBatch) => unknown
  handle?: { mode: 'fill' }
  onTable?: (table: Table) => void
}) => {
  const table = useCreateTable({
    rowCount,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK }),
      cellEditing({ onCommitEdits } as never),
      cellSelection(handle ? { handle } : {}),
    ] as never,
  })
  onTable?.(table as unknown as Table)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const cellAt = (index: number, column: string) =>
  q(
    `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const pendingBanner = () => q('[data-testid="pending-action-banner"]')
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

/** Событие `paste` на ячейке с текстом буфера. */
const pasteText = (target: HTMLElement, text: string) => {
  const data = new DataTransfer()
  data.setData('text/plain', text)
  const event = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: data,
  })
  if (event.clipboardData !== data)
    Object.defineProperty(event, 'clipboardData', { value: data })
  target.dispatchEvent(event)
}

const scrollTo = async (index: number) => {
  const height = Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
  scroller().scrollTop = index * height
  await expect.poll(() => cellAt(index, 'name')).not.toBeNull()
}

describe('Вставка и протяжка в серверной модели строк (ADR 0219)', () => {
  test('WR29: SSRM — вставка через незагруженные строки: ожидание на таблице с отменой, догрузка, запись, вспышка', async () => {
    const backend = server()
    const onCommitEdits = vi.fn()
    let table!: Table
    const screen = await render(
      <Grid
        getRows={backend.getRows}
        onCommitEdits={onCommitEdits}
        onTable={t => (table = t)}
      />,
    )
    try {
      // Последние строки первого блока: вставка уходит в незагруженный второй.
      await scrollTo(95)
      await humanClick(cellAt(97, 'name')!)
      const lines = Array.from({ length: 6 }, (_, i) => `P${i}`).join('\n')
      pasteText(cellAt(97, 'name')!, lines)
      // Ожидание — плашка таблицы с отменой; записи нет, пока строки не пришли.
      await expect
        .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
        .toContain(tableLabels.pendingPaste)
      expect(pendingBanner()!.textContent).toContain(tableLabels.cancel)
      expect(onCommitEdits).not.toHaveBeenCalled()
      await expect.poll(() => backend.held.length).toBeGreaterThan(0)
      backend.answer()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(batch.cells.map(cell => [cell.rowId, cell.value])).toEqual(
        Array.from({ length: 6 }, (_, i) => [`r${97 + i}`, `P${i}`]),
      )
      await expect.poll(pendingBanner).toBeNull()
      // Итог — вспышка принятых ячеек, и видимых в окне.
      await expect
        .poll(
          () =>
            readFlashes(table)[cellHighlightKey('r97', 'name')]?.outcome ?? '',
        )
        .toBe('accepted')

      // «Отмена» на плашке — ни записи, ни плашки. Буфер уходит за второй блок, уже пришедший
      // в кэш окна, — в незагруженный третий.
      await humanClick(cellAt(98, 'city')!)
      pasteText(
        cellAt(98, 'city')!,
        Array.from({ length: 110 }, (_, i) => `X${i}`).join('\n'),
      )
      await expect
        .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
        .toContain(tableLabels.pendingPaste)
      const cancel = [
        ...pendingBanner()!.querySelectorAll<HTMLElement>('button'),
      ].find(button => button.textContent?.includes(tableLabels.cancel))!
      await humanClick(cancel)
      await expect.poll(pendingBanner).toBeNull()
      backend.answer()
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await screen.unmount()
    }
  })

  test('WR27: протяжка у края в SSRM и растянутой области через незагруженные строки догружает их после отпускания и пишет', async () => {
    const backend = server()
    const onCommitEdits = vi.fn()
    const screen = await render(
      <Grid
        getRows={backend.getRows}
        rowCount={1_000_000}
        onCommitEdits={onCommitEdits}
        handle={{ mode: 'fill' }}
      />,
    )
    try {
      await expect.poll(() => cellAt(2, 'name')).not.toBeNull()
      expect(scrollLayer(scroller()).stretched).toBe(true)
      await humanClick(cellAt(2, 'name')!)
      const handle = () =>
        q('[data-range-handle="end"]:not([hidden])') as HTMLElement | null
      await expect.poll(handle).not.toBeNull()
      const box = scroller().getBoundingClientRect()
      // Квадрат — к краю тела: автопрокрутка уводит под указатель незагруженные строки.
      await pointer.realDragHold(centerOf(handle()!), {
        x: box.left + 100,
        y: box.bottom + 40,
      })
      // Под указателем у края — незагруженная строка.
      await expect
        .poll(
          () =>
            document
              .elementFromPoint(box.left + 100, box.bottom - 8)
              ?.closest('[data-pending-row]') ?? null,
          { timeout: 10_000 },
        )
        .not.toBeNull()
      await pointer.realMouseUp()
      // После отпускания — ожидание с догрузкой мимо кэша окна, записи ещё нет.
      await expect.poll(() => backend.held.length).toBeGreaterThan(0)
      expect(onCommitEdits).not.toHaveBeenCalled()
      backend.answer()
      await expect
        .poll(() => onCommitEdits.mock.calls.length, { timeout: 10_000 })
        .toBe(1)
      const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(batch.source).toBe('fill')
      // Копия значения третьей строки — во все строки от четвёртой до строки под указателем.
      // Последняя цель — в блоке, которого не было у грида при отпускании.
      expect(Number(batch.cells.at(-1)!.rowId.slice(1))).toBeGreaterThanOrEqual(
        BLOCK,
      )
      expect(batch.cells[0]).toMatchObject({ rowId: 'r3', value: 'N2' })
      expect(batch.cells.every(cell => cell.value === 'N2')).toBe(true)
      expect(batch.cells.map(cell => cell.rowId)).toEqual(
        batch.cells.map((_, i) => `r${3 + i}`),
      )
    } finally {
      await screen.unmount()
    }
  })
})
