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
  unsavedChanges,
  valueChangeFlash,
  type EditHistoryOptions,
} from '../../../plugins'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../../../plugins/cellEditing/types'
import { commitAllDrafts } from '../../../plugins/cellEditing/session'
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
  /** Сохранение по кнопке (ADR 0178); `pult` — с пультом несохранённого. */
  manual?: boolean
  pult?: boolean
}

const Grid = ({
  history = {},
  role = 'grid',
  manual = false,
  pult = false,
}: GridProps) => {
  const [rows, setRows] = useState(ROWS)
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: rows,
    getRowId: (row: Row) => row.id,
    enableKeyboardNavigation: role !== 'table',
    plugins: [
      cellEditing({
        ...(manual ? { saveMode: 'manual' } : {}),
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
      ...(pult ? [unsavedChanges()] : []),
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

  test('UD18: «История» — записи новые сверху: действие первой строкой, цель — ячейка, строка или число ячеек — второй, время справа; записи — пункты списка: текущая на серой подложке выбранного пункта с точкой и подсказкой по наведению, прочие приглушены; нажатие на текущую запись выделяет её ячейки, прокручивает к ним и вспыхивает их областью без отката; historyPanel false её убирает', async () => {
    let screen = await mount()
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
      ['3', 93],
    ] as const)
      await write(row, value)
    await api.undo()
    await expect.poll(() => priceOf('3')).toBe(13)
    // Кнопка истории — из ленивого модуля.
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
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
    // Действие — первой строкой, цель — второй, отдельным блоком ниже.
    const action = entries()[1]!.querySelector<HTMLElement>(
      '[data-history-label]',
    )!
    const detail = entries()[1]!.querySelector<HTMLElement>(
      '[data-history-detail]',
    )!
    expect(action.textContent).toBe(history[1].action)
    expect(detail.textContent).toBe(history[1].detail)
    expect(detail.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      action.getBoundingClientRect().bottom - 1,
    )
    // Текущая — последняя действующая запись: выделена и отмечена для скринридера.
    const currentOf = (entry: HTMLElement) =>
      entry.querySelector('[aria-current="step"]') !== null
    expect(entries().map(currentOf)).toEqual([false, true, false])
    const fill = (entry: HTMLElement) =>
      getComputedStyle(entry.querySelector('[data-history-item]')!)
        .backgroundColor
    expect(fill(entries()[1]!)).not.toBe(fill(entries()[2]!))
    // Признак текущей — точка: у остальных записей точек нет.
    const dot = (entry: HTMLElement) =>
      entry.querySelector<HTMLElement>('[data-history-dot]')
    expect(entries().map(entry => !!dot(entry))).toEqual([false, true, false])
    // Подсказка точки по наведению.
    await userEvent.hover(
      entries()[1]!.querySelector<HTMLElement>('[data-history-dot]')!,
    )
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === labels.historyCurrent,
        ),
      )
      .toBe(true)
    await userEvent.unhover(
      entries()[1]!.querySelector<HTMLElement>('[data-history-dot]')!,
    )
    // Подпись «Отменено» — только для скринридера.
    expect(entries()[0]!.textContent).toContain(labels.historyUndone)
    expect(
      [...entries()[0]!.querySelectorAll('span')].some(
        span =>
          span.textContent?.trim() === labels.historyUndone &&
          span.getBoundingClientRect().width > 1,
      ),
    ).toBe(false)
    const color = (el: Element) =>
      getComputedStyle(el.querySelector('[data-history-label]')!).color
    expect(color(entries()[0]!)).not.toBe(color(entries()[1]!))
    // Нажатие на текущую запись — по месту её точки, как по облачку, — её ячейки без отката:
    // выделение, прокрутка и вспышка.
    await humanClick(
      entries()[1]!.querySelector<HTMLElement>('[data-history-dot]')!,
    )
    await expect
      .poll(() => api.store.get().cellSelection)
      .toMatchObject([{ anchorRowId: '2', focusRowId: '2' }])
    // Вспышка показывает, куда смотреть: выделение одной ячейки — лишь рамка.
    await expect
      .poll(() => cell('2')!.getAttribute('data-flash'), { interval: 20 })
      .toBe('arrived')
    expect(api.getHistory().position).toBe(2)
    await screen.unmount()
    screen = await mount({ history: { historyPanel: false } })
    expect(byTestId('edit-history-button')).toBeNull()
    expect(byTestId('undo-button')).not.toBeNull()
    await screen.unmount()
  })

  test('UD33: «К исходному виду» в подвале попапа истории откатывает все выполненные записи по очереди и останавливается на первом отказе; без выполненных записей недоступна; пока откат идёт — ожидание на кнопке, «стоп» кнопки отмены прерывает его', async () => {
    await mount()
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
      ['3', 93],
    ] as const)
      await write(row, value)
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    const original = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="edit-history"] [data-action="back-to-original"]',
      )
    await expect.poll(original).not.toBeNull()
    expect(original()!.textContent).toBe(labels.historyOriginal)
    // Ожидание и «стоп»: первый шаг ждёт ответа сервера.
    const gate = deferred()
    answer = () => gate.promise
    await humanClick(original()!)
    await expect.poll(() => original()!.getAttribute('aria-busy')).toBe('true')
    await expect
      .poll(() => byTestId('undo-button')?.getAttribute('aria-busy'))
      .toBe('true')
    // «Стоп» взводится через --tsr-comp-cancel-arm-delay.
    await new Promise(resolve => setTimeout(resolve, 700))
    await humanClick(byTestId('undo-button')!)
    await expect.poll(() => api.getHistory().busy).toBe(false)
    await expect.poll(() => original()!.hasAttribute('aria-busy')).toBe(false)
    expect(api.getHistory().position).toBe(3)
    // Нажатие на кнопку тулбара закрыло попап — открываем снова.
    await expect.poll(original).toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(original).not.toBeNull()
    // Отказ второй записи останавливает откат на ней.
    answer = batch =>
      batch.cells.some(item => item.rowId === '2')
        ? Promise.reject(new Error('locked'))
        : undefined
    await humanClick(original()!)
    await expect.poll(() => api.getHistory().position).toBe(2)
    await expect.poll(() => api.getHistory().busy).toBe(false)
    expect([priceOf('2'), priceOf('3')]).toEqual([92, 13])
    // Без отказов — все записи по очереди, затем кнопка недоступна.
    answer = () => undefined
    await humanClick(original()!)
    await expect.poll(() => api.getHistory().position).toBe(0)
    expect([priceOf('1'), priceOf('2'), priceOf('3')]).toEqual([11, 12, 13])
    await expect
      .poll(
        () =>
          original()!.hasAttribute('disabled') ||
          original()!.getAttribute('aria-disabled') === 'true',
      )
      .toBe(true)
  })

  test('UD19: нажатие на выполненную запись откатывает к ней по очереди и останавливается на первом отказе; на откаченную — повторяет до неё; после перехода изменённое вспыхивает; стрелки и Enter делают то же с клавиатуры', async () => {
    const auto = await mount()
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
      ['3', 93],
    ] as const)
      await write(row, value)
    // Кнопка истории — из ленивого модуля.
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    const entries = () => [
      ...document.querySelectorAll<HTMLElement>('[data-history-entry]'),
    ]
    const main = (index: number) =>
      entries()[index]!.querySelector<HTMLElement>('button')!
    await expect.poll(() => entries().length).toBe(3)
    const flashed = () =>
      ['1', '2', '3'].filter(row => cell(row)?.hasAttribute('data-flash'))
    await humanClick(main(2))
    await expect.poll(() => api.getHistory().position).toBe(1)
    expect([priceOf('1'), priceOf('2'), priceOf('3')]).toEqual([91, 12, 13])
    // Изменённое переходом — вторая и третья цены — вспыхивает сохранением шагов.
    await expect.poll(flashed, { interval: 20 }).toEqual(['2', '3'])
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
    await auto.unmount()
    // Режим «Применить»: шаги — черновики без вспышки сохранения, область вспыхивает приходом.
    const manual = await mount({ manual: true })
    for (const [row, value] of [
      ['1', 91],
      ['2', 92],
    ] as const) {
      await api.writeCells([{ rowId: row, columnId: 'price', value }], {
        source: 'paste',
      })
      await expect
        .poll(() => !!cell(row)?.querySelector('[data-cell-draft]'))
        .toBe(true)
    }
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(() => entries().length).toBe(2)
    await humanClick(main(1))
    await expect.poll(() => api.getHistory().position).toBe(1)
    await expect
      .poll(() => cell('2')?.getAttribute('data-flash'), { interval: 20 })
      .toBe('arrived')
    await manual.unmount()
  })

  test('UD22: axe с color-contrast у кнопок, пунктов меню и попапа истории в обеих темах и ролях table, grid, treegrid; в forced-colors текущая запись и приглушение видны системными цветами', async () => {
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
    const undone = document.querySelector('[data-undone] [data-history-label]')!
    const done = document.querySelector(
      '[data-history-entry]:not([data-undone]) [data-history-label]',
    )!
    // Текущая запись — кромкой системного выделения, толще кромок остальных облачков.
    const edge = (selector: string) =>
      getComputedStyle(document.querySelector(selector)!).outlineWidth
    expect(edge('[data-history-item][data-selected]')).toBe('2px')
    expect(edge('[data-undone] [data-history-item]')).not.toBe('2px')
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

  /** Запись в режиме «Применить»: ячейка получает черновик, данные прежние. */
  const writeDraft = async (rowId: string, value: number) => {
    await api.writeCells([{ rowId, columnId: 'price', value }], {
      source: 'paste',
    })
    await expect
      .poll(() => !!cell(rowId)?.querySelector('[data-cell-draft]'))
      .toBe(true)
  }
  const openHistory = async () => {
    await expect.poll(() => byTestId('edit-history-button')).not.toBeNull()
    await humanClick(byTestId('edit-history-button')!)
    await expect.poll(() => byTestId('edit-history')).not.toBeNull()
  }
  const historyEntries = () => [
    ...document.querySelectorAll<HTMLElement>('[data-history-entry]'),
  ]
  const draftMarks = () =>
    ['1', '2', '3'].filter(
      row => !!cell(row)?.querySelector('[data-cell-draft]'),
    )

  test('UD37: после отбрасывания Ctrl+Z сначала отменяет отбрасывание: черновики возвращаются, объявления «изменено извне» нет', async () => {
    await mount({ manual: true, pult: true })
    await api.writeCells(
      ['1', '2', '3'].map(rowId => ({ rowId, columnId: 'price', value: 90 })),
      { source: 'paste' },
    )
    await expect.poll(draftMarks).toEqual(['1', '2', '3'])
    // «Отменить всё» пульта; кнопка пульта — из ленивого модуля.
    await expect.poll(() => byTestId('unsaved-changes-button')).not.toBeNull()
    await humanClick(byTestId('unsaved-changes-button')!)
    const discardAll = () =>
      document.querySelector<HTMLElement>('[data-action="discard-all"]')
    await expect.poll(discardAll).not.toBeNull()
    await humanClick(discardAll()!)
    await expect.poll(draftMarks).toEqual([])
    await userEvent.keyboard('{Escape}')
    // Пульт возвращает фокус своей кнопке, закрываясь: ячейку выбираем после.
    await expect.poll(() => byTestId('unsaved-changes')).toBeNull()
    await focusCell('1')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(draftMarks).toEqual(['1', '2', '3'])
    const live = [...document.querySelectorAll('[aria-live]')]
      .map(region => region.textContent)
      .join('|')
    expect(live).not.toContain(labels.announceConflicts(3))
    expect(live).not.toContain(labels.announceConflicts(1))
  })

  test('UD38: точка — только у текущей записи: тона черновика, пока её изменения не применены, синяя — после «Применить»; неприменённые записи подписаны для скринридера — с пультом и без', async () => {
    for (const pult of [true, false]) {
      const screen = await mount({ manual: true, pult })
      await writeDraft('1', 91)
      await writeDraft('2', 92)
      await openHistory()
      const entry = () => historyEntries()[0]!
      expect(entry().hasAttribute('data-unsaved')).toBe(true)
      // Прошлая неприменённая запись — без точки, но подписана для скринридера.
      const older = historyEntries()[1]!
      expect(older.hasAttribute('data-unsaved')).toBe(true)
      expect(older.querySelector('[data-history-dot]')).toBeNull()
      expect(older.textContent).toContain(labels.historyUnsaved)
      // Точка тона черновика — иного цвета, чем точка применённой записи.
      const dotColor = () =>
        getComputedStyle(
          entry().querySelector<HTMLElement>('[data-history-dot]')!,
        ).backgroundColor
      const unsavedColor = dotColor()
      expect(entry().textContent).toContain(labels.historyUnsaved)
      await userEvent.keyboard('{Escape}')
      // «Применить» — из кода: пометка уходит у открытого попапа.
      await openHistory()
      act(() => commitAllDrafts(api))
      await expect.poll(() => entry().hasAttribute('data-unsaved')).toBe(false)
      expect(entry().textContent).not.toContain(labels.historyUnsaved)
      expect(dotColor()).not.toBe(unsavedColor)
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
    }
  })

  test('UD39: «Применить» с сохранёнными изменениями кладёт разделитель «Применено, N изменений» со временем; Ctrl+Z и откат к шагу его не касаются; уходит с вытесненными записями; без сохранённых изменений разделителя нет', async () => {
    const screen = await mount({ manual: true, history: { limit: 3 } })
    await writeDraft('1', 91)
    await writeDraft('2', 92)
    act(() => commitAllDrafts(api))
    await expect.poll(() => api.getHistory().applied.length).toBe(1)
    await openHistory()
    const mark = () =>
      document.querySelector<HTMLElement>('[data-history-applied]')
    expect(mark()!.textContent).toContain(labels.historyApplied(2))
    expect(mark()!.querySelector('time')).not.toBeNull()
    // Разделитель — над записью, после которой применили.
    expect(mark()!.getBoundingClientRect().top).toBeLessThan(
      historyEntries()[0]!.getBoundingClientRect().top,
    )
    await userEvent.keyboard('{Escape}')
    // Шаг отмены разделитель не тратит: отменяется сама правка.
    await focusCell('2')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(() => api.getHistory().position).toBe(1)
    expect(api.getHistory().applied).toHaveLength(1)
    // Сервер отказал всему пакету — разделителя нет.
    answer = batch => ({
      refused: batch.cells.map(item => ({
        rowId: item.rowId,
        columnId: item.columnId,
        reason: 'no',
      })),
    })
    act(() => commitAllDrafts(api))
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(api.getHistory().applied).toHaveLength(1)
    // Вытеснение: новые записи сверх предела уносят запись разделителя и его самого.
    answer = () => undefined
    await writeDraft('3', 93)
    await writeDraft('4', 94)
    await writeDraft('5', 95)
    await expect.poll(() => api.getHistory().applied.length).toBe(0)
    await screen.unmount()
  })

  test('UD40: пометка неприменённого и разделитель — axe с color-contrast в обеих темах, видны в forced-colors', async () => {
    await mount({ manual: true })
    await writeDraft('1', 91)
    act(() => commitAllDrafts(api))
    await expect.poll(() => api.getHistory().applied.length).toBe(1)
    await writeDraft('2', 92)
    await openHistory()
    await expect
      .poll(() => document.querySelector('[data-history-applied]'))
      .not.toBeNull()
    expect(historyEntries()[0]!.hasAttribute('data-unsaved')).toBe(true)
    await inBothThemes(async () => {
      const result = await axe.run(byTestId('edit-history')!, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(result.violations.map(v => v.id)).toEqual([])
    })
    await pointer.forcedColors(true)
    const mark = document.querySelector<HTMLElement>('[data-history-applied]')!
    expect(getComputedStyle(mark).color).not.toBe('rgba(0, 0, 0, 0)')
    const dot =
      historyEntries()[0]!.querySelector<HTMLElement>('[data-history-dot]')!
    const shown = getComputedStyle(dot)
    expect(
      shown.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        shown.borderStyle !== 'none' ||
        shown.outlineStyle !== 'none',
    ).toBe(true)
  })
})
