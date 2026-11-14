import axe from 'axe-core'
import { useState } from 'react'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { cancelPending } from '../../../core/cancellation'
import { readFlashes } from '../../../core/flashes/flashFeature'
import { cellHighlightKey } from '../../../core/highlights/highlightFeature'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  columnSorting,
  contextMenu,
  rowExpanding,
} from '../../../plugins'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../../../plugins/cellEditing/types'
import { startEditSession } from '../../../plugins/cellEditing/session'
import { cellSelectionLabels } from '../../../plugins/cellSelection/labels'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { tooltipText } from '../../__mocks__/catalogPlay'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Вставка, очистка и вырезание выделения на настоящих событиях (ADR 0219, этап 1): WR1, WR10,
// WR13, WR14, WR17, WR20, WR31, WR33. Разбор, размеры, пропуски, пакет и черновики —
// модульный `cellWrites.dom`.

type Row = { id: string; name: string; age: number; children?: Row[] }

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 180 },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 140,
    dataType: 'number',
  },
]
const DATA: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

let api: any

type Commit = (
  batch: CellEditBatch,
  context?: { signal: AbortSignal },
) => CellEditBatchResult | void | Promise<CellEditBatchResult | void>

interface GridProps {
  onCommitEdits?: Commit
  navigation?: boolean
  paste?: boolean
  editing?: boolean
  canEditCell?: (ctx: { column: { id: string } }) => boolean
  /** Приложение пишет сохранённый пакет в данные и сортирует по возрасту. */
  applies?: boolean
  role?: 'table' | 'grid' | 'treegrid'
  parseClipboard?: (
    clip: { text: string; html: string },
    context: { signal: AbortSignal; confirm: () => Promise<boolean> },
  ) => string[][] | null | PromiseLike<string[][] | null>
  /** Пределы записи (ADR 0223). */
  writeLimits?: { confirm?: number; max?: number } | false
}

const Grid = ({
  onCommitEdits = () => {},
  navigation = false,
  paste,
  editing = true,
  canEditCell,
  applies = false,
  role = 'table',
  parseClipboard,
  writeLimits,
}: GridProps) => {
  const [data, setData] = useState<Row[]>(
    role === 'treegrid'
      ? DATA.map((row, i) =>
          i === 0 ? { ...row, children: [{ ...DATA[11]!, id: 'c' }] } : row,
        )
      : DATA,
  )
  const commit: Commit = (batch, context) => {
    if (applies)
      setData(rows =>
        rows.map(row => {
          const cells = batch.cells.filter(cell => cell.rowId === row.id)
          return cells.reduce(
            (next, cell) => ({ ...next, [cell.columnId]: cell.value }),
            row,
          )
        }),
      )
    return onCommitEdits(batch, context)
  }
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Row) => row.id,
    getSubRows: (row: Row) => row.children,
    enableKeyboardNavigation: navigation || role !== 'table',
    ...(writeLimits === undefined ? {} : { writeLimits }),
    plugins: [
      cellEditing({
        enabled: editing,
        onCommitEdits: commit,
        ...(canEditCell ? { canEditCell } : {}),
      } as never),
      cellSelection({
        ...(paste === undefined ? {} : { paste }),
        ...(parseClipboard ? { parseClipboard } : {}),
      }),
      contextMenu(),
      columnSorting(),
      ...(role === 'treegrid' ? [rowExpanding()] : []),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 520, height: 520 }}>
      <DataGrid table={table as never} height={480} />
    </div>
  )
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const cell = (rowId: string, column = 'age') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const textOf = (rowId: string, column = 'age') => {
  const copy = cell(rowId, column).cloneNode(true) as HTMLElement
  copy
    .querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy.textContent?.trim()
}
const issue = (rowId: string, column = 'age') =>
  cell(rowId, column).querySelector('[data-cell-issue]')
const waved = (rowId: string, column = 'age') =>
  cell(rowId, column).hasAttribute('data-pending-wave')
const errorBanner = () =>
  document.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item =>
    item.textContent?.includes(label),
  )
const flashed = (outcome: string, rowId: string, column = 'age') =>
  readFlashes(api)[cellHighlightKey(rowId, column)]?.outcome === outcome

/** Выделить прямоугольник мышью: нажатие и Shift-нажатие. */
const selectCells = async (from: HTMLElement, to?: HTMLElement) => {
  await humanClick(from)
  if (to) {
    await userEvent.keyboard('{Shift>}')
    await humanClick(to)
    await userEvent.keyboard('{/Shift}')
  }
}

/** Событие `paste` на ячейке — буфер браузера с текстом. */
const pasteText = (target: HTMLElement, text: string) => {
  const data = new DataTransfer()
  data.setData('text/plain', text)
  target.dispatchEvent(
    new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    }),
  )
}

const deferred = () => {
  let resolve!: (value: CellEditBatchResult | void) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<CellEditBatchResult | void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

const cellsOf = (batch: CellEditBatch) =>
  batch.cells.map(item => [item.rowId, item.columnId, item.value])

describe('Вставка и очистка выделения (ADR 0219)', () => {
  test('WR1: Ctrl/Cmd+V с фокусом в ячейке тела вставляет буфер; в поле правки — нет; без cellEditing, с выключенным cellEditing и при paste: false вставки нет; буфер без текста ничего не меняет', async () => {
    const onCommitEdits = vi.fn()
    let screen = await mount({ onCommitEdits })
    try {
      // Настоящие Ctrl+C и Ctrl+V: копия двух строк и вставка ниже.
      await selectCells(cell('0', 'name'), cell('1', 'age'))
      await userEvent.keyboard('{ControlOrMeta>}c{/ControlOrMeta}')
      await selectCells(cell('4', 'name'))
      await userEvent.keyboard('{ControlOrMeta>}v{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['4', 'name', 'Name 0'],
        ['4', 'age', 20],
        ['5', 'name', 'Name 1'],
        ['5', 'age', 21],
      ])

      // Буфер без текста — ничего.
      pasteText(cell('6'), '')
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(onCommitEdits).toHaveBeenCalledTimes(1)

      // В поле правки вставка идёт в поле, а не в ячейки.
      startEditSession(api, api.getRowSource().byId('7'), { id: 'age' })
      await expect.poll(() => cell('7').querySelector('input')).not.toBeNull()
      const input = cell('7').querySelector('input')!
      input.focus()
      pasteText(input, '55')
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await screen.unmount()
    }

    for (const props of [{ paste: false }, { editing: false }]) {
      screen = await mount({ onCommitEdits, ...props })
      try {
        await selectCells(cell('2'))
        pasteText(cell('2'), '9')
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(onCommitEdits).toHaveBeenCalledTimes(1)
        expect(textOf('2')).toBe('22')
      } finally {
        await screen.unmount()
      }
    }
  })

  test('WR10: текст, не разобранный по типу, не пишется — отказ на объекте с причиной и вставленным текстом; годные ячейки операции записаны', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({ onCommitEdits })
    try {
      await selectCells(cell('1'))
      pasteText(cell('1'), '30\nabc\n32')
      await expect.poll(() => issue('2')).not.toBeNull()
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['1', 'age', 30],
        ['3', 'age', 32],
      ])
      expect(issue('1')).toBeNull()
      expect(
        api
          .getFailures()
          .map((failure: { target: unknown; reason: string }) => [
            failure.target,
            failure.reason,
          ]),
      ).toEqual([[{ cell: ['2', 'age'] }, 'Enter a number: "abc"']])
    } finally {
      await screen.unmount()
    }
  })

  test('WR13: пока пакет ждёт, ячейки показывают новые значения с волной ожидания; «стоп» прерывает signal и возвращает прежние значения; успех — вспышка accepted', async () => {
    let answer = deferred()
    let signal: AbortSignal | undefined
    const screen = await mount({
      onCommitEdits: (_batch, context) => {
        signal = context?.signal
        return answer.promise
      },
    })
    try {
      await selectCells(cell('1'), cell('2'))
      pasteText(cell('1'), '50')
      await expect.poll(() => textOf('1')).toBe('50')
      expect(textOf('2')).toBe('50')
      expect(waved('1')).toBe(true)

      // «Стоп»: отмена ждущего пакета — значения из данных снова видны.
      cancelPending(api, { kind: 'cellEdit' })
      await expect.poll(() => textOf('1')).toBe('21')
      expect(signal?.aborted).toBe(true)
      expect(waved('1')).toBe(false)

      answer = deferred()
      pasteText(cell('1'), '60')
      await expect.poll(() => waved('1')).toBe(true)
      answer.resolve()
      await expect.poll(() => waved('1')).toBe(false)
      expect(flashed('accepted', '1')).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('WR14: отказ части пакета — треугольники отказа на ячейках; отказ пакета целиком — одна плашка с причиной и «Повторить», ячейки откатываются, отметок на ячейках нет', async () => {
    let answer = deferred()
    const onCommitEdits = vi.fn((_batch: CellEditBatch) => answer.promise)
    const screen = await mount({ onCommitEdits })
    try {
      await selectCells(cell('1'), cell('2'))
      pasteText(cell('1'), '50')
      answer.resolve({
        refused: [{ rowId: '2', columnId: 'age', reason: 'Too old' }],
      })
      await expect.poll(() => issue('2')).not.toBeNull()
      expect(issue('1')).toBeNull()

      answer = deferred()
      await selectCells(cell('4'), cell('5'))
      pasteText(cell('4'), '70')
      await expect.poll(() => textOf('4')).toBe('70')
      answer.reject(new Error('Server is down'))
      await expect.poll(errorBanner).not.toBeNull()
      expect(errorBanner()!.textContent).toContain('Server is down')
      expect(textOf('4')).toBe('24')
      expect(issue('4')).toBeNull()
      expect(issue('5')).toBeNull()

      // «Повторить» отправляет тот же пакет.
      answer = deferred()
      const retry = document.querySelector<HTMLElement>(
        '[data-testid="load-error-retry"]',
      )!
      await humanClick(retry)
      expect(onCommitEdits).toHaveBeenCalledTimes(3)
      expect(cellsOf(onCommitEdits.mock.calls[2]![0])).toEqual([
        ['4', 'age', 70],
        ['5', 'age', 70],
      ])
      answer.resolve()
      await expect.poll(errorBanner).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('WR17: контекстное меню ячейки — «Вставить» асинхронным Clipboard API, отказ доступа — плашка с подсказкой о Ctrl+V; «Вырезать», «Очистить»; пункты недоступны без редактируемых ячеек; с клавиатуры', async () => {
    const onCommitEdits = vi.fn()
    let editable = true
    const screen = await mount({
      onCommitEdits,
      navigation: true,
      canEditCell: () => editable,
    })
    const labels = cellSelectionLabels(tableLabels)
    try {
      await selectCells(cell('1'), cell('2'))
      await userEvent.click(cell('1'), { button: 'right' })
      await expect.poll(() => menuItem(labels.clear)).toBeTruthy()
      expect(menuItem(labels.paste)).toBeTruthy()
      expect(menuItem(labels.cut)).toBeTruthy()
      await humanClick(menuItem(labels.clear)!)
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['1', 'age', null],
        ['2', 'age', null],
      ])

      // «Вставить»: браузер не дал прочесть буфер — плашка с подсказкой.
      vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(
        new Error('denied'),
      )
      cell('1').focus()
      await userEvent.keyboard('{Shift>}{F10}{/Shift}')
      await expect.poll(() => menuItem(labels.paste)).toBeTruthy()
      menuItem(labels.paste)!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(errorBanner).not.toBeNull()
      expect(errorBanner()!.textContent).toContain(labels.pasteDenied)

      // Без редактируемых ячеек пункты видны, но недоступны.
      editable = false
      await userEvent.click(cell('2'), { button: 'right' })
      await expect
        .poll(() => menuItem(labels.clear)?.getAttribute('aria-disabled'))
        .toBe('true')
    } finally {
      vi.restoreAllMocks()
      await screen.unmount()
    }
  })

  test('WR20: Delete и Backspace очищают редактируемые ячейки выделения пустым значением типа; Ctrl/Cmd+X — копирование и очистка одним пакетом cut', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({
      onCommitEdits,
      navigation: true,
      canEditCell: ctx => ctx.column.id !== 'name',
    })
    try {
      await selectCells(cell('1', 'name'), cell('2'))
      await userEvent.keyboard('{Delete}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      const cleared = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(cleared.source).toBe('clear')
      expect(cellsOf(cleared)).toEqual([
        ['1', 'age', null],
        ['2', 'age', null],
      ])

      await selectCells(cell('3'))
      await userEvent.keyboard('{Backspace}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(2)

      // Вырезание: копия в буфер и очистка; вставка ниже берёт вырезанное.
      await selectCells(cell('5'))
      await userEvent.keyboard('{ControlOrMeta>}x{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(3)
      const cut = onCommitEdits.mock.calls[2]![0] as CellEditBatch
      expect(cut.source).toBe('cut')
      expect(cellsOf(cut)).toEqual([['5', 'age', null]])
      await selectCells(cell('8'))
      await userEvent.keyboard('{ControlOrMeta>}v{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(4)
      expect(cellsOf(onCommitEdits.mock.calls[3]![0])).toEqual([
        ['8', 'age', 25],
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('WR31: клиентский режим — после того как приложение обновило данные, строки встают по сортировке, выделение следует за углами', async () => {
    const screen = await mount({ applies: true })
    try {
      // Возраст по возрастанию: строка 0 — первая. Вставка 99 — строка уходит в конец.
      api.setSorting([{ id: 'age', desc: false }])
      await expect.poll(() => api.getRowSource().at(0)?.id).toBe('0')
      await selectCells(cell('0'))
      pasteText(cell('0'), '99')
      await expect
        .poll(() => api.getRowSource().at(api.getRowSource().count() - 1)?.id)
        .toBe('0')
      const range = api.store.get().cellSelection.at(-1)
      expect([range.anchorRowId, range.focusRowId]).toEqual(['0', '0'])
      expect(cell('0').getAttribute('data-cell-selected')).toBe('true')
    } finally {
      await screen.unmount()
    }
  })

  test('WR33: axe с color-contrast отказов операции и плашки в ролях table, grid, treegrid в обеих темах', async () => {
    for (const role of ['table', 'grid', 'treegrid'] as const) {
      let answer = deferred()
      const screen = await mount({
        role,
        onCommitEdits: () => answer.promise,
      })
      try {
        await selectCells(cell('1'))
        pasteText(cell('1'), 'abc')
        await expect.poll(() => issue('1')).not.toBeNull()
        await selectCells(cell('3'))
        pasteText(cell('3'), '40')
        answer.reject(new Error('Server is down'))
        await expect.poll(errorBanner).not.toBeNull()
        answer = deferred()
        await inBothThemes(async () => {
          const result = await axe.run(
            document.querySelector<HTMLElement>(`[role="${role}"]`)!
              .parentElement!,
            {
              ...AXE_OPTIONS,
              rules: {
                ...AXE_OPTIONS.rules,
                'color-contrast': { enabled: true },
              },
            },
          )
          expect(result.violations.map(v => `${role}: ${v.id}`)).toEqual([])
        })
      } finally {
        await screen.unmount()
      }
    }
  })

  test('WR42: confirm() хука показывает сразу на месте плашки ожидания вопрос со значением буфера или числом его значений и рядом двух квадратных кнопок-иконок — галочкой «Вставить» и крестиком «Не вставлять» в тоне отказа, подписи в тултипе и доступном имени; галочка вставляет, крестик отменяет; плашки «Вставка…» при вопросе нет; axe с color-contrast в обеих темах', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({
      onCommitEdits,
      parseClipboard: async ({ text }, { confirm }) =>
        (await confirm()) ? text.split('\n').map(line => [line]) : null,
    })
    const question = () =>
      document.querySelector<HTMLElement>('[data-testid="paste-question"]')
    const pendingBanner = () =>
      document.querySelector('[data-testid="pending-action-banner"]')
    const yes = () =>
      question()!.querySelector<HTMLElement>('[data-testid="paste-confirm"]')!
    const no = () =>
      question()!.querySelector<HTMLElement>('[data-testid="paste-decline"]')!
    try {
      await selectCells(cell('1'))
      pasteText(cell('1'), '50')
      // Сразу, без задержки плашки ожидания.
      await expect.poll(question, { timeout: 300 }).not.toBeNull()
      // Вопрос называет вставляемое значение; у нескольких — их число.
      expect(question()!.textContent).toContain(
        tableLabels.pasteQuestionValue('50'),
      )
      // Крестик — в тоне отказа, кнопки — плотным рядом.
      expect(no().getAttribute('data-tone')).toBe('danger')
      expect(yes().getAttribute('data-tone')).toBeNull()
      expect(
        no().getBoundingClientRect().left - yes().getBoundingClientRect().right,
      ).toBeLessThanOrEqual(4)
      for (const [button, label] of [
        [yes(), tableLabels.pasteConfirm],
        [no(), tableLabels.pasteDecline],
      ] as const) {
        expect(button.getAttribute('aria-label')).toBe(label)
        expect(button.getAttribute('data-shape')).toBe('square')
        expect(button.textContent?.trim()).toBe('')
        expect(button.querySelector('svg')).not.toBeNull()
        await userEvent.hover(button)
        await expect.poll(tooltipText).toBe(label)
        await userEvent.unhover(button)
      }
      // Пока задан вопрос, плашки «Вставка…» нет и после её задержки.
      await new Promise(resolve => setTimeout(resolve, 1500))
      expect(pendingBanner()).toBeNull()

      await inBothThemes(async () => {
        const result = await axe.run(question()!, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(result.violations.map(v => v.id)).toEqual([])
      })

      // Крестик — отмена: вопрос ушёл, вставки нет.
      await humanClick(no())
      await expect.poll(question).toBeNull()
      expect(onCommitEdits).not.toHaveBeenCalled()
      expect(textOf('1')).toBe('21')

      // Несколько значений — их число в вопросе; галочка — вставка.
      pasteText(cell('1'), '50\n51')
      await expect.poll(question).not.toBeNull()
      expect(question()!.textContent).toContain(
        tableLabels.pasteQuestionCount(2),
      )
      await humanClick(yes())
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['1', 'age', 50],
        ['2', 'age', 51],
      ])
      await expect.poll(question).toBeNull()
    } finally {
      await screen.unmount()
    }
  })
})

describe('Пределы записи (ADR 0223)', () => {
  const question = () =>
    document.querySelector<HTMLElement>('[data-testid="paste-question"]')
  const yes = () =>
    question()!.querySelector<HTMLElement>('[data-testid="paste-confirm"]')!
  const no = () =>
    question()!.querySelector<HTMLElement>('[data-testid="paste-decline"]')!
  const announced = () =>
    [...document.querySelectorAll('[aria-live]')]
      .map(region => region.textContent)
      .join('|')

  test('LM2: жест записи больше confirm и не больше max ячеек — вопрос на месте плашки ожидания с числом ячеек; галочка записывает, крестик и Escape отменяют без записи', async () => {
    const onCommitEdits = vi.fn()
    await mount({
      onCommitEdits,
      navigation: true,
      writeLimits: { confirm: 2, max: 10 },
    })
    // Крестик — ничего не записано.
    await selectCells(cell('0'))
    pasteText(cell('0'), '50\n51\n52')
    await expect.poll(question).not.toBeNull()
    expect(question()!.textContent).toContain(tableLabels.writeQuestion(3))
    expect(yes().getAttribute('aria-label')).toBe(tableLabels.writeConfirm)
    expect(no().getAttribute('aria-label')).toBe(tableLabels.writeDecline)
    await humanClick(no())
    await expect.poll(question).toBeNull()
    expect(onCommitEdits).not.toHaveBeenCalled()
    expect(textOf('0')).toBe('20')
    // Escape — тоже без записи.
    await selectCells(cell('0'))
    pasteText(cell('0'), '50\n51\n52')
    await expect.poll(question).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(question).toBeNull()
    expect(onCommitEdits).not.toHaveBeenCalled()
    // Галочка — запись трёх ячеек одним пакетом.
    await selectCells(cell('0'))
    pasteText(cell('0'), '50\n51\n52')
    await expect.poll(question).not.toBeNull()
    await humanClick(yes())
    await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['0', 'age', 50],
      ['1', 'age', 51],
      ['2', 'age', 52],
    ])
    // Не больше confirm — без вопроса.
    await selectCells(cell('5'))
    pasteText(cell('5'), '60\n61')
    await expect.poll(() => onCommitEdits.mock.calls.length).toBe(2)
    expect(question()).toBeNull()
  })

  test('LM3: больше max — отказ без записи: плашка отказа записи и объявление с числом ячеек и пределом', async () => {
    const onCommitEdits = vi.fn()
    await mount({ onCommitEdits, writeLimits: { confirm: 1, max: 2 } })
    await selectCells(cell('0'))
    pasteText(cell('0'), '50\n51\n52')
    const reason = tableLabels.writeOverLimit(3, 2)
    await expect.poll(() => errorBanner()?.textContent ?? '').toContain(reason)
    // Заголовок — отказ записи, а не обновления данных.
    expect(errorBanner()!.textContent).toContain(
      tableLabels.serverActionFailedWrite,
    )
    expect(question()).toBeNull()
    expect(onCommitEdits).not.toHaveBeenCalled()
    expect(['0', '1', '2'].map(row => textOf(row))).toEqual(['20', '21', '22'])
    await expect.poll(announced).toContain(reason)
  })

  test('LM10: вопрос и отказ предела — axe с color-contrast в обеих темах, видны в forced-colors, подписи из словаря', async () => {
    const screen = await mount({ writeLimits: { confirm: 1, max: 3 } })
    const axeClean = async () => {
      await inBothThemes(async () => {
        const result = await axe.run(document.body, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(result.violations.map(v => v.id)).toEqual([])
      })
    }
    await selectCells(cell('0'))
    pasteText(cell('0'), '50\n51')
    await expect.poll(question).not.toBeNull()
    await axeClean()
    await commands.forcedColors(true)
    expect(getComputedStyle(question()!).outlineStyle).toBe('solid')
    await commands.forcedColors(false)
    await humanClick(no())
    await expect.poll(question).toBeNull()
    pasteText(cell('0'), '50\n51\n52\n53')
    await expect.poll(errorBanner).not.toBeNull()
    await axeClean()
    await commands.forcedColors(true)
    expect(getComputedStyle(errorBanner()!).outlineStyle).toBe('solid')
    await screen.unmount()
  })
})
