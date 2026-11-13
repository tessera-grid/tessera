import axe from 'axe-core'
import { useState } from 'react'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  columnFilteringModel,
  contextMenu,
  editHistory,
  serverRowModel,
  valueChangeFlash,
  type EditHistoryOptions,
} from '../../../plugins'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../../../plugins/cellEditing/types'
import { editHistoryLabels } from '../../../plugins/editHistory/labels'
import { ENGLISH_LABELS } from '../../../core/localization'
import { humanClick } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { rightClick } from './lazy-helpers'

// История правок на настоящих событиях (ADR 0222, этап 1): UD1, UD7, UD10, UD12, UD13, UD16–UD20,
// UD22. Логика стека — модульный `editHistory.dom`.

const pointer = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

type Row = { id: string; name: string; price: number; stock: number }

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
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
const ROWS: Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  price: 10 + i,
  stock: i,
}))

const labels = editHistoryLabels(ENGLISH_LABELS)
let api: any
let answer: (batch: CellEditBatch) => unknown = () => undefined

interface GridProps {
  history?: EditHistoryOptions | false
  role?: 'table' | 'grid' | 'treegrid'
}

const Grid = ({ history = {}, role = 'grid' }: GridProps) => {
  const [rows, setRows] = useState(ROWS)
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: rows,
    getRowId: (row: Row) => row.id,
    enableKeyboardNavigation: role !== 'table',
    plugins: [
      cellEditing({
        onCellEdit: () => {},
        onCommitEdits: (batch: CellEditBatch) => {
          const write = (result: CellEditBatchResult | void) => {
            const refused = new Set(
              (result?.refused ?? []).map(item => item.rowId),
            )
            setRows(prev =>
              prev.map(row => {
                const cells = batch.cells.filter(
                  cell => cell.rowId === row.id && !refused.has(row.id),
                )
                return cells.reduce(
                  (next, cell) => ({ ...next, [cell.columnId]: cell.value }),
                  row,
                )
              }),
            )
            return result
          }
          const result = answer(batch)
          return result instanceof Promise
            ? result.then(write)
            : write(result as CellEditBatchResult | void)
        },
      } as never),
      cellSelection(),
      contextMenu(),
      columnFilteringModel(),
      valueChangeFlash(),
      ...(history === false ? [] : [editHistory(history)]),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 640, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

const initialViewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1100, 800))
afterAll(() => page.viewport(initialViewport.width, initialViewport.height))
afterEach(async () => {
  answer = () => undefined
  await userEvent.keyboard('{Escape}')
  await pointer.forcedColors(false)
  document.documentElement.classList.remove('dark')
})

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

const cell = (rowId: string, column = 'price') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const priceOf = (rowId: string) =>
  api.getRowSource().byId(rowId)?.getValue('price') as number
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const deferred = () => {
  let resolve!: (value?: CellEditBatchResult) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<CellEditBatchResult | void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const write = async (rowId: string, value: number, column = 'price') => {
  await api.writeCells([{ rowId, columnId: column, value }], {
    source: 'paste',
  })
  await expect
    .poll(() => api.getRowSource().byId(rowId)?.getValue(column))
    .toBe(value)
}
const focusCell = async (rowId: string) => {
  await humanClick(cell(rowId)!)
}
const menuItem = (action: string) =>
  document.querySelector<HTMLElement>(
    `[role="menuitem"][data-action-id$="${action}"]`,
  )

describe('История правок на настоящих событиях (ADR 0222)', () => {
  test('UD20: список истории виртуализирован, длинная подпись переносится без прокрутки вбок', async () => {
    await mount({ history: { limit: 40 } })
    for (let i = 0; i < 30; i++)
      act(() =>
        api.pushHistory({
          label: `Action ${i}`,
          undo: () => {},
          redo: () => {},
        }),
      )
    act(() =>
      api.pushHistory({
        label: 'A'.repeat(200),
        undo: () => {},
        redo: () => {},
      }),
    )
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(() => byTestId('edit-history')).not.toBeNull()
    const rendered = document.querySelectorAll('[data-history-entry]').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(31)
    const scroller = byTestId('edit-history')!.querySelector<HTMLElement>(
      '[data-popup-scroller]',
    )!
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
  })

  test('UD1: без плагина и с enabled false Ctrl+Z ничего не делает, кнопок и пунктов нет', async () => {
    for (const history of [false, { enabled: false }] as const) {
      const screen = await mount({ history })
      await write('1', 99)
      await focusCell('1')
      await userEvent.keyboard('{Control>}z{/Control}')
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(priceOf('1')).toBe(99)
      expect(byTestId('undo-button')).toBeNull()
      expect(byTestId('edit-history-button')).toBeNull()
      rightClick(cell('1')!)
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .not.toBeNull()
      expect(menuItem('undo')).toBeNull()
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
    }
  })

  test('UD7: ждущая отмена — ожидание на ячейках; «стоп» прерывает её, запись остаётся; отказ — плашка, позиция не двигается, следующий Ctrl+Z пробует снова; при частичном отказе в записи остаются отказанные ячейки', async () => {
    await mount()
    await write('1', 91)
    let gate = deferred()
    answer = () => gate.promise
    await focusCell('1')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => cell('1')!.getAttribute('aria-busy')).toBe('true')
    // «Стоп» занятой кнопки отмены.
    await expect
      .poll(() => byTestId('undo-button')?.getAttribute('aria-busy'))
      .toBe('true')
    // «Стоп» взводится через --tsr-comp-cancel-arm-delay: двойной клик не отменяет сразу.
    await new Promise(resolve => setTimeout(resolve, 700))
    await humanClick(byTestId('undo-button')!)
    await expect.poll(() => api.getHistory().busy).toBe(false)
    expect(api.getHistory().position).toBe(1)
    // Отказ пакета — плашка, запись на месте; следующий Ctrl+Z пробует снова.
    gate = deferred()
    answer = () => gate.promise
    await focusCell('1')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => cell('1')!.getAttribute('aria-busy')).toBe('true')
    gate.reject(new Error('locked'))
    await expect.poll(() => byTestId('load-error-banner')).not.toBeNull()
    expect(api.getHistory().position).toBe(1)
    answer = () => undefined
    await focusCell('1')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => priceOf('1')).toBe(11)
    expect(api.getHistory().position).toBe(0)
    // Отказ повтора — плашка с именем действия; «Повторить» на ней двигает позицию. Прежнюю
    // плашку отказа отмены новая операция не снимает — её закрывают.
    await humanClick(
      byTestId('load-error-banner')!.querySelector<HTMLElement>(
        `[aria-label="${ENGLISH_LABELS.loadErrorDismiss}"]`,
      )!,
    )
    await expect.poll(() => byTestId('load-error-banner')).toBeNull()
    answer = () => Promise.reject(new Error('locked'))
    await api.redo()
    await expect
      .poll(() => byTestId('load-error-banner')?.textContent)
      .toContain(labels.redo)
    expect(api.getHistory().position).toBe(0)
    answer = () => undefined
    await humanClick(byTestId('load-error-retry')!)
    await expect.poll(() => priceOf('1')).toBe(91)
    await expect.poll(() => api.getHistory().position).toBe(1)
    await api.undo()
    await expect.poll(() => priceOf('1')).toBe(11)
    // Частичный отказ: в записи остаётся отказанная ячейка.
    await api.writeCells(
      [
        { rowId: '2', columnId: 'price', value: 92 },
        { rowId: '3', columnId: 'price', value: 93 },
      ],
      { source: 'paste' },
    )
    await expect.poll(() => priceOf('3')).toBe(93)
    answer = () => ({
      refused: [{ rowId: '3', columnId: 'price', reason: 'no' }],
    })
    await api.undo()
    await expect.poll(() => priceOf('2')).toBe(12)
    expect(priceOf('3')).toBe(93)
    const { entries, position } = api.getHistory()
    expect(entries[position - 1].cells).toBe(1)
  })

  test('UD12: после отмены и повтора выделение — ячейки записи, область прокручена к первой; скрытая фильтром ячейка объявляется без прокрутки; вспышки смены значения нет', async () => {
    await mount()
    await api.writeCells(
      [
        { rowId: '50', columnId: 'price', value: 150 },
        { rowId: '51', columnId: 'stock', value: 151 },
      ],
      { source: 'paste' },
    )
    await expect.poll(() => priceOf('50')).toBe(150)
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = 0
    await api.undo()
    await expect.poll(() => cell('50')).not.toBeNull()
    expect(cell('50')!.getAttribute('data-cell-selected')).toBe('true')
    expect(cell('51', 'stock')!.getAttribute('data-cell-selected')).toBe('true')
    expect(cell('50')!.getAttribute('data-flash')).not.toBe('changed')
    await api.redo()
    await expect.poll(() => priceOf('50')).toBe(150)
    expect(cell('50')!.getAttribute('data-flash')).not.toBe('changed')
    // Скрыта фильтром: объявление, прокрутки нет.
    api.setColumnFilters([
      { id: 'name', value: { operator: 'equals', value: 'Name 1' } },
    ])
    await expect.poll(() => cell('50')).toBeNull()
    const live = () =>
      [...document.querySelectorAll('[aria-live]')]
        .map(el => el.textContent)
        .join('|')
    await api.undo()
    await expect.poll(live).toContain(labels.announceHidden)
  })

  test('UD13: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z и Ctrl+Y по коду клавиши отменяют и повторяют при фокусе в таблице; в открытом редакторе не перехватываются', async () => {
    await mount()
    await write('1', 91)
    await focusCell('1')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => priceOf('1')).toBe(11)
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await expect.poll(() => priceOf('1')).toBe(91)
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => priceOf('1')).toBe(11)
    await userEvent.keyboard('{Control>}y{/Control}')
    await expect.poll(() => priceOf('1')).toBe(91)
    // Другая раскладка: буква — по коду клавиши.
    cell('1')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'я',
        code: 'KeyZ',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    await expect.poll(() => priceOf('1')).toBe(11)
    // Открытый редактор держит свою отмену.
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await expect.poll(() => priceOf('1')).toBe(91)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => cell('1')!.querySelector('input')).not.toBeNull()
    await userEvent.keyboard('{Control>}z{/Control}')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(priceOf('1')).toBe(91)
    expect(cell('1')!.querySelector('input')).not.toBeNull()
  })

  test('UD16: кнопки «Отменить» и «Повторить» — подсказка с подписью записи, выключены без записи, нажимаются мышью и клавиатурой; toolbar false их убирает', async () => {
    let screen = await mount()
    const undo = () => byTestId('undo-button')!
    const redo = () => byTestId('redo-button')!
    expect(
      undo().hasAttribute('disabled') ||
        undo().getAttribute('aria-disabled') === 'true',
    ).toBe(true)
    await write('1', 91)
    const name = api.getHistory().entries[0].label
    await expect
      .poll(() => undo().getAttribute('aria-label'))
      .toBe(labels.undoEntry(name))
    await humanClick(undo())
    await expect.poll(() => priceOf('1')).toBe(11)
    await expect
      .poll(() => redo().getAttribute('aria-label'))
      .toBe(labels.redoEntry(name))
    redo().focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => priceOf('1')).toBe(91)
    await screen.unmount()
    screen = await mount({ history: { toolbar: false } })
    expect(byTestId('undo-button')).toBeNull()
    expect(byTestId('edit-history-button')).not.toBeNull()
    await screen.unmount()
  })

  test('UD17: пункты контекстного меню «Отменить» и «Повторить» с подписью записи, выключены без записи; contextMenu false их убирает', async () => {
    let screen = await mount()
    rightClick(cell('1')!)
    await expect.poll(() => menuItem('undo')).not.toBeNull()
    expect(menuItem('undo')!.getAttribute('aria-disabled')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await write('1', 91)
    const name = api.getHistory().entries[0].label
    rightClick(cell('1')!)
    await expect
      .poll(() => menuItem('undo')?.textContent)
      .toContain(labels.undoEntry(name))
    await humanClick(menuItem('undo')!)
    await expect.poll(() => priceOf('1')).toBe(11)
    rightClick(cell('1')!)
    await expect
      .poll(() => menuItem('redo')?.textContent)
      .toContain(labels.redoEntry(name))
    await userEvent.keyboard('{Escape}')
    await screen.unmount()
    screen = await mount({ history: { contextMenu: false } })
    rightClick(cell('1')!)
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    expect(menuItem('undo')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await screen.unmount()
  })

  test('UD18: «История» — записи новые сверху с подписью, временем и числом ячеек, отметка «вы здесь», откаченные приглушены; «Показать» выделяет без отката; historyPanel false её убирает', async () => {
    let screen = await mount()
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
      ['3', 93],
    ] as const)
      await write(row, value)
    await api.undo()
    await expect.poll(() => priceOf('3')).toBe(13)
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(() => byTestId('edit-history')).not.toBeNull()
    const entries = () => [
      ...document.querySelectorAll<HTMLElement>('[data-history-entry]'),
    ]
    await expect.poll(() => entries().length).toBe(3)
    const { entries: history } = api.getHistory()
    expect(entries().map(entry => entry.dataset.historyEntry)).toEqual(
      [...history].reverse().map((entry: { id: string }) => entry.id),
    )
    expect(entries()[0]!.hasAttribute('data-undone')).toBe(true)
    expect(entries()[1]!.hasAttribute('data-undone')).toBe(false)
    expect(entries()[0]!.querySelector('time')).not.toBeNull()
    expect(entries()[1]!.textContent).toContain(history[1].label)
    const here = document.querySelector<HTMLElement>('[data-history-here]')!
    expect(here.textContent).toBe(labels.historyHere)
    // Отметка — между откаченной и выполненными.
    expect(entries()[0]!.getBoundingClientRect().top).toBeLessThan(
      here.getBoundingClientRect().top,
    )
    expect(here.getBoundingClientRect().top).toBeLessThan(
      entries()[1]!.getBoundingClientRect().top,
    )
    const color = (el: Element) =>
      getComputedStyle(el.querySelector('[data-history-label]')!).color
    expect(color(entries()[0]!)).not.toBe(color(entries()[1]!))
    // «Показать» — выделение без отката.
    // Кнопка записи проявляется наведением: нажатие по месту попало бы в само облачко.
    entries()[2]!.querySelector<HTMLElement>('[data-action="reveal"]')!.click()
    await expect
      .poll(() => api.store.get().cellSelection)
      .toMatchObject([{ anchorRowId: '1', focusRowId: '1' }])
    expect(api.getHistory().position).toBe(2)
    await screen.unmount()
    screen = await mount({ history: { historyPanel: false } })
    expect(byTestId('edit-history-button')).toBeNull()
    expect(byTestId('undo-button')).not.toBeNull()
    await screen.unmount()
  })

  test('UD19: нажатие на выполненную запись откатывает к ней по очереди и останавливается на первом отказе; на откаченную — повторяет до неё; стрелки и Enter делают то же с клавиатуры', async () => {
    await mount()
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
      ['3', 93],
    ] as const)
      await write(row, value)
    await humanClick(byTestId('edit-history-button')!)
    const entries = () => [
      ...document.querySelectorAll<HTMLElement>('[data-history-entry]'),
    ]
    const main = (index: number) =>
      entries()[index]!.querySelector<HTMLElement>('button')!
    await expect.poll(() => entries().length).toBe(3)
    await humanClick(main(2))
    await expect.poll(() => api.getHistory().position).toBe(1)
    expect([priceOf('1'), priceOf('2'), priceOf('3')]).toEqual([91, 12, 13])
    await humanClick(main(1))
    await expect.poll(() => api.getHistory().position).toBe(2)
    expect(priceOf('2')).toBe(92)
    // Клавиатура: стрелка к первой записи (откаченной) и Enter — повтор до неё.
    main(1).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(main(0))
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => api.getHistory().position).toBe(3)
    // Отказ на пути отката: остановка на нём.
    answer = () => Promise.reject(new Error('locked'))
    await humanClick(main(2))
    await expect.poll(() => api.getHistory().busy).toBe(false)
    expect(api.getHistory().position).toBe(3)
  })

  test('UD22: axe с color-contrast у кнопок, пунктов меню и попапа истории в обеих темах и ролях table, grid, treegrid; в forced-colors отметка и приглушение видны системными цветами', async () => {
    for (const role of ['table', 'grid', 'treegrid'] as const) {
      const screen = await mount({ role })
      await api.writeCells([{ rowId: '1', columnId: 'price', value: 91 }], {
        source: 'paste',
      })
      await api.writeCells([{ rowId: '2', columnId: 'price', value: 92 }], {
        source: 'paste',
      })
      await api.undo()
      await humanClick(byTestId('edit-history-button')!)
      await expect.poll(() => byTestId('edit-history')).not.toBeNull()
      await inBothThemes(async () => {
        const result = await axe.run(document.body, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(result.violations.map(v => v.id)).toEqual([])
      })
      await userEvent.keyboard('{Escape}')
      rightClick(cell('3')!)
      await expect.poll(() => menuItem('undo')).not.toBeNull()
      const menu = await axe.run(document.querySelector('[role="menu"]')!, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(menu.violations.map(v => v.id)).toEqual([])
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
    }
    await mount()
    await write('1', 91)
    await write('2', 92)
    await api.undo()
    await pointer.forcedColors(true)
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(() => byTestId('edit-history')).not.toBeNull()
    const here = document.querySelector<HTMLElement>('[data-history-here]')!
    const undone = document.querySelector('[data-undone] [data-history-label]')!
    const done = document.querySelector(
      '[data-history-entry]:not([data-undone]) [data-history-label]',
    )!
    expect(getComputedStyle(here).color).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(undone).color).not.toBe(
      getComputedStyle(done).color,
    )
  })
})

const act = (run: () => void) => run()

// --- Серверная модель (UD10) ----------------------------------------------------------

const SERVER_ROWS = 400
let rowsGate: (() => Promise<void>) | undefined
const serverBatches: CellEditBatch[] = []
const serverRow = (i: number): Row => ({
  id: `s${i}`,
  name: `Server ${i}`,
  price: 10 + i,
  stock: i,
})

const ServerGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: [],
    getRowId: (row: Row) => row.id,
    rowCount: SERVER_ROWS,
    plugins: [
      cellEditing({
        onCellEdit: () => {},
        onCommitEdits: (batch: CellEditBatch) => {
          serverBatches.push(batch)
        },
      } as never),
      serverRowModel({
        blockSize: 20,
        maxBlocks: 2,
        getRows: async ({ start, end }: { start: number; end: number }) => {
          await rowsGate?.()
          return {
            rows: Array.from({ length: end - start }, (_, k) =>
              serverRow(start + k),
            ),
          }
        },
      } as never),
      editHistory(),
    ] as never,
  } as never)
  api = table
  return (
    <div style={{ width: 640, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

describe('История правок в серверной модели (ADR 0222)', () => {
  test('UD10: строки записи, ушедшие из кэша, догружаются под отмену по месту при записи — ожидание на плашке с отменой, отказ блока — плашка с повтором, запись на месте', async () => {
    await render(<ServerGrid />)
    await expect.poll(() => cell('s1')).not.toBeNull()
    await api.writeCells([{ rowId: 's1', columnId: 'price', value: 999 }], {
      source: 'paste',
    })
    await expect.poll(() => api.getHistory().position).toBe(1)
    // Через середину в конец: три блока при пределе в два — первый уходит.
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = scroller.scrollHeight / 2
    await expect.poll(() => cell('s200')).not.toBeNull()
    scroller.scrollTop = scroller.scrollHeight
    await expect.poll(() => cell(`s${SERVER_ROWS - 1}`)).not.toBeNull()
    expect(api.getRowSource().byId('s1')).toBeUndefined()
    // Догрузка ждёт: плашка с отменой; отмена — запись на месте.
    let release!: () => void
    rowsGate = () => new Promise<void>(resolve => (release = resolve))
    const cancelled = api.undo()
    await expect.poll(() => byTestId('pending-action-cancel')).not.toBeNull()
    await humanClick(byTestId('pending-action-cancel')!)
    expect(await cancelled).toBe(false)
    release()
    expect(api.getHistory().position).toBe(1)
    // Отказ блока — плашка с повтором, запись на месте.
    rowsGate = () => Promise.reject(new Error('down'))
    expect(await api.undo()).toBe(false)
    await expect.poll(() => byTestId('load-error-banner')).not.toBeNull()
    expect(api.getHistory().position).toBe(1)
    // Блок пришёл — обратная запись по догруженной строке.
    rowsGate = undefined
    serverBatches.length = 0
    expect(await api.undo()).toBe(true)
    expect(serverBatches.at(-1)).toMatchObject({
      source: 'undo',
      cells: [{ rowId: 's1', columnId: 'price', value: 11 }],
    })
    expect(api.getHistory().position).toBe(0)
    // Таблица прокручена к строке по её месту при записи.
    await expect.poll(() => cell('s1')).not.toBeNull()
  })
})
