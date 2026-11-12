import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  contextMenu,
  rowExpanding,
} from '../../../plugins'
import type { CellEditBatch } from '../../../plugins/cellEditing/types'
import { cellSelectionLabels } from '../../../plugins/cellSelection/labels'
import type { CellSelectionHandleOptions } from '../../../plugins/cellSelection/types'
import { ENGLISH_LABELS } from '../../../core/localization'
import { humanClick } from '../helpers'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Протяжка значения маркером и заполнение вниз, вправо и во весь диапазон на настоящих
// событиях (ADR 0219, этап 2): WR18, WR19, WR22, WR23, WR25, WR40. Правила ряда и
// `getFillValue` — модульный `cellWrites.dom`.

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
  moreContrast: (active: boolean) => Promise<void>
}

type Row = {
  id: string
  name: string
  age: number
  score: number
  born: string
  children?: Row[]
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 140 },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 110,
    dataType: 'number',
  },
  {
    id: 'score',
    accessorKey: 'score',
    header: 'Score',
    size: 110,
    dataType: 'number',
  },
  {
    id: 'born',
    accessorKey: 'born',
    header: 'Born',
    size: 140,
    dataType: 'dateString',
  },
]
const DATA: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
  score: 100 + i,
  born: `2026-01-${String(i + 1).padStart(2, '0')}`,
}))

let api: any

interface GridProps {
  onCommitEdits?: (batch: CellEditBatch) => unknown
  handle?: CellSelectionHandleOptions
  role?: 'table' | 'grid' | 'treegrid'
  canEditCell?: (ctx: { column: { id: string } }) => boolean
}

const Grid = ({
  onCommitEdits = () => {},
  handle = { mode: 'fill' },
  role = 'grid',
  canEditCell,
}: GridProps) => {
  const data =
    role === 'treegrid'
      ? DATA.map((row, i) =>
          i === 0 ? { ...row, children: [{ ...DATA[13]!, id: 'c' }] } : row,
        )
      : DATA
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Row) => row.id,
    getSubRows: (row: Row) => row.children,
    enableKeyboardNavigation: role !== 'table',
    plugins: [
      cellEditing({
        onCommitEdits,
        ...(canEditCell ? { canEditCell } : {}),
      } as never),
      cellSelection({ handle }),
      contextMenu(),
      ...(role === 'treegrid' ? [rowExpanding()] : []),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 640, height: 720 }}>
      <DataGrid table={table as never} height={700} />
    </div>
  )
}

const initialViewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1100, 800))
afterAll(() => page.viewport(initialViewport.width, initialViewport.height))
afterEach(async () => {
  await pointer.realMouseUp()
  await userEvent.keyboard('{/Alt}')
  await pointer.forcedColors(false)
  await pointer.moreContrast(false)
  document.documentElement.classList.remove('dark')
})

const cell = (rowId: string, column = 'age') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
const handle = () =>
  document.querySelector<HTMLElement>('[data-range-handle="end"]')
const frame = () => document.querySelector<HTMLElement>('[data-fill-frame]')
const frameShown = () => {
  const el = frame()
  return el !== null && !el.hidden
}
const cellsOf = (batch: CellEditBatch) =>
  batch.cells.map(item => [item.rowId, item.columnId, item.value])
/** Углы диапазонов выделения: строки — id, в какой бы форме их ни записали. */
const selection = () =>
  (api.store.get().cellSelection as Record<string, unknown>[]).map(range => {
    const rowId = (id: unknown, index: unknown) =>
      id ?? api.getRowSource().at(index as number)?.id
    return [
      rowId(range.anchorRowId, range.anchorRowIndex),
      range.anchorColumnId,
      rowId(range.focusRowId, range.focusRowIndex),
      range.focusColumnId,
    ]
  })
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

/** Выделить прямоугольник: нажатие и Shift-нажатие. */
const selectCells = async (from: HTMLElement, to?: HTMLElement) => {
  await humanClick(from)
  if (to) {
    await userEvent.keyboard('{Shift>}')
    await humanClick(to)
    await userEvent.keyboard('{/Shift}')
  }
  await expect.poll(() => handle() !== null && !handle()!.hidden).toBe(true)
}

/** Нажать квадрат маркера и держать над ячейкой `to`. */
const holdHandleOver = async (to: HTMLElement) => {
  await pointer.realDragHold(centerOf(handle()!), centerOf(to), 8)
}

const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item =>
    item.textContent?.includes(label),
  )

const labels = cellSelectionLabels(ENGLISH_LABELS)

describe('Протяжка значения и заполнение (ADR 0219, этап 2)', () => {
  test("WR22: handle: { mode: 'fill' } — протяжка квадрата показывает рамку цели и пишет после отпускания; Escape отменяет; по умолчанию режим 'range'; круги пальца двигают диапазон; аргумент живой", async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({ onCommitEdits })
    try {
      await selectCells(cell('1'))
      await holdHandleOver(cell('4'))
      // Пока тянут — рамка от исходной ячейки до цели, записи нет.
      await expect.poll(frameShown).toBe(true)
      const box = frame()!.getBoundingClientRect()
      expect(box.top).toBeCloseTo(cell('1').getBoundingClientRect().top, 0)
      expect(box.bottom).toBeCloseTo(
        cell('4').getBoundingClientRect().bottom,
        0,
      )
      expect(box.left).toBeCloseTo(cell('1').getBoundingClientRect().left, 0)
      expect(box.right).toBeCloseTo(cell('1').getBoundingClientRect().right, 0)
      expect(onCommitEdits).not.toHaveBeenCalled()
      await pointer.realMouseUp()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(frameShown()).toBe(false)
      const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(batch.source).toBe('fill')
      expect(cellsOf(batch)).toEqual([
        ['2', 'age', 21],
        ['3', 'age', 21],
        ['4', 'age', 21],
      ])

      // Escape посреди протяжки — ни рамки, ни записи.
      await selectCells(cell('6'))
      await holdHandleOver(cell('9'))
      await expect.poll(frameShown).toBe(true)
      await userEvent.keyboard('{Escape}')
      await expect.poll(frameShown).toBe(false)
      await pointer.realMouseUp()
      await wait(50)
      expect(onCommitEdits).toHaveBeenCalledTimes(1)

      // Аргумент живой: режим диапазона без пересоздания таблицы — протяжка меняет выделение.
      await screen.rerender(
        <Grid onCommitEdits={onCommitEdits} handle={{ mode: 'range' }} />,
      )
      await selectCells(cell('1'))
      await holdHandleOver(cell('3', 'score'))
      await pointer.realMouseUp()
      await expect.poll(selection).toEqual([['1', 'age', '3', 'score']])
      expect(frame()).toBeNull()
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await screen.unmount()
    }

    // По умолчанию — режим диапазона.
    const plain = await mount({ onCommitEdits, handle: {} })
    try {
      expect(api.options.cellSelectionHandle.mode).toBe('range')
      await selectCells(cell('1'))
      await holdHandleOver(cell('3'))
      await pointer.realMouseUp()
      await expect.poll(selection).toEqual([['1', 'age', '3', 'age']])
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await plain.unmount()
    }

    // Круги пальца в режиме 'fill' двигают диапазон, а не пишут.
    const touch = await mount({ onCommitEdits })
    try {
      const touchAt = (target: Element, type: string, at: Point) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            clientX: at.x,
            clientY: at.y,
          }),
        )
      touchAt(cell('1'), 'pointerdown', centerOf(cell('1')))
      await selectCells(cell('1'))
      touchAt(cell('1'), 'pointerdown', centerOf(cell('1')))
      await expect
        .poll(() => handle()?.getAttribute('data-selection-handle'))
        .toBe('circle')
      const circle = handle()!
      touchAt(circle, 'pointerdown', centerOf(circle))
      touchAt(window as never, 'pointermove', centerOf(cell('4')))
      await wait(50)
      touchAt(window as never, 'pointerup', centerOf(cell('4')))
      await expect.poll(selection).toEqual([['1', 'age', '4', 'age']])
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await touch.unmount()
    }
  })

  test('WR23: протяжка — по одной оси, по большему смещению; direction ограничивает ось; протяжка внутрь сужает выделение без очистки; после записи выделен исходный диапазон вместе с заполненным', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({ onCommitEdits })
    try {
      // Вниз на две строки и вправо на одну колонку — вниз.
      await selectCells(cell('1'))
      await holdHandleOver(cell('3', 'score'))
      await pointer.realMouseUp()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['2', 'age', 21],
        ['3', 'age', 21],
      ])
      // Выделен исходный диапазон с заполненным.
      expect(selection()).toEqual([['1', 'age', '3', 'age']])

      // Вправо на две колонки и вниз на одну строку — вправо.
      await selectCells(cell('6'))
      await holdHandleOver(cell('7', 'born'))
      await pointer.realMouseUp()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(2)
      expect(
        (onCommitEdits.mock.calls[1]![0] as CellEditBatch).cells.map(
          item => item.columnId,
        ),
      ).toEqual(['score', 'born'])
      expect(selection()).toEqual([['6', 'age', '6', 'born']])

      // Протяжка внутрь — сужение, без записи.
      await selectCells(cell('8', 'name'), cell('11', 'score'))
      await holdHandleOver(cell('9', 'age'))
      await pointer.realMouseUp()
      await expect.poll(selection).toEqual([['8', 'name', '9', 'age']])
      await wait(50)
      expect(onCommitEdits).toHaveBeenCalledTimes(2)
    } finally {
      await screen.unmount()
    }

    // `direction: 'x'` — вниз не тянется: смещение вниз ось не выбирает.
    const onlyX = await mount({
      onCommitEdits,
      handle: { mode: 'fill', direction: 'x' },
    })
    try {
      await selectCells(cell('1'))
      await holdHandleOver(cell('5', 'score'))
      await pointer.realMouseUp()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(3)
      expect(cellsOf(onCommitEdits.mock.calls[2]![0])).toEqual([
        ['1', 'score', 21],
      ])
    } finally {
      await onlyX.unmount()
    }
  })

  test('WR25: Alt/Option во время протяжки переключает копию и ряд; у одного числа шаг 1, у одной даты — день; в сторону убывания — вычитание', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({ onCommitEdits })
    try {
      // Одно число с Alt — ряд с шагом 1.
      await selectCells(cell('2'))
      await holdHandleOver(cell('4'))
      await userEvent.keyboard('{Alt>}')
      await pointer.realMouseMove(centerOf(cell('4')), centerOf(cell('5')), 2)
      await pointer.realMouseUp()
      await userEvent.keyboard('{/Alt}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['3', 'age', 23],
        ['4', 'age', 24],
        ['5', 'age', 25],
      ])

      // Вверх с Alt — вычитание.
      await selectCells(cell('8'))
      await holdHandleOver(cell('6'))
      await userEvent.keyboard('{Alt>}')
      await pointer.realMouseMove(centerOf(cell('6')), centerOf(cell('7')), 2)
      await pointer.realMouseMove(centerOf(cell('7')), centerOf(cell('6')), 2)
      await pointer.realMouseUp()
      await userEvent.keyboard('{/Alt}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(2)
      expect(cellsOf(onCommitEdits.mock.calls[1]![0])).toEqual([
        ['7', 'age', 27],
        ['6', 'age', 26],
      ])

      // Одна дата с Alt — день; без Alt — копия.
      await selectCells(cell('1', 'born'))
      await holdHandleOver(cell('2', 'born'))
      await userEvent.keyboard('{Alt>}')
      await pointer.realMouseMove(
        centerOf(cell('2', 'born')),
        centerOf(cell('3', 'born')),
        2,
      )
      await pointer.realMouseUp()
      await userEvent.keyboard('{/Alt}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(3)
      expect(cellsOf(onCommitEdits.mock.calls[2]![0])).toEqual([
        ['2', 'born', '2026-01-03'],
        ['3', 'born', '2026-01-04'],
      ])

      // Два числа с постоянным шагом — ряд; Alt — повтор.
      await selectCells(cell('10', 'score'), cell('11', 'score'))
      await holdHandleOver(cell('13', 'score'))
      await pointer.realMouseUp()
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(4)
      expect(cellsOf(onCommitEdits.mock.calls[3]![0])).toEqual([
        ['12', 'score', 112],
        ['13', 'score', 113],
      ])
      await selectCells(cell('10', 'score'), cell('11', 'score'))
      await holdHandleOver(cell('12', 'score'))
      await userEvent.keyboard('{Alt>}')
      await pointer.realMouseMove(
        centerOf(cell('12', 'score')),
        centerOf(cell('13', 'score')),
        2,
      )
      await pointer.realMouseUp()
      await userEvent.keyboard('{/Alt}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(5)
      expect(cellsOf(onCommitEdits.mock.calls[4]![0])).toEqual([
        ['12', 'score', 110],
        ['13', 'score', 111],
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('WR19: Ctrl/Cmd+D — заполнить вниз первой строкой диапазона, Ctrl/Cmd+R — вправо первой колонкой; на одной ячейке — значением соседней выше или слева; закладка и перезагрузка браузера не срабатывают; пункты меню «Заполнить вниз» и «Заполнить вправо» — то же', async () => {
    const onCommitEdits = vi.fn()
    // Клавиша дошла до браузера — не отменена.
    const reached: string[] = []
    const watch = (event: KeyboardEvent) => {
      if (
        (event.code === 'KeyD' || event.code === 'KeyR') &&
        !event.defaultPrevented
      )
        reached.push(event.code)
    }
    window.addEventListener('keydown', watch)
    const screen = await mount({ onCommitEdits })
    try {
      await selectCells(cell('1'), cell('3', 'score'))
      await userEvent.keyboard('{ControlOrMeta>}d{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      const down = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(down.source).toBe('fillDown')
      expect(cellsOf(down)).toEqual([
        ['2', 'age', 21],
        ['3', 'age', 21],
        ['2', 'score', 101],
        ['3', 'score', 101],
      ])

      // Одна ячейка — значение ячейки выше.
      await selectCells(cell('6'))
      await userEvent.keyboard('{ControlOrMeta>}d{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(2)
      expect(cellsOf(onCommitEdits.mock.calls[1]![0])).toEqual([
        ['6', 'age', 25],
      ])

      // Вправо: первой колонкой диапазона; на одной ячейке — значением слева.
      await selectCells(cell('8'), cell('9', 'score'))
      await userEvent.keyboard('{ControlOrMeta>}r{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(3)
      const right = onCommitEdits.mock.calls[2]![0] as CellEditBatch
      expect(right.source).toBe('fillRight')
      expect(cellsOf(right)).toEqual([
        ['8', 'score', 28],
        ['9', 'score', 29],
      ])
      await selectCells(cell('10', 'score'))
      await userEvent.keyboard('{ControlOrMeta>}r{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(4)
      expect(cellsOf(onCommitEdits.mock.calls[3]![0])).toEqual([
        ['10', 'score', 30],
      ])
      // Ни Ctrl+D, ни Ctrl+R до браузера не дошли.
      expect(reached).toEqual([])

      // Код клавиши, а не буква: на другой раскладке Ctrl+D приходит с другой буквой.
      await selectCells(cell('7'))
      cell('7').dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'в',
          code: 'KeyD',
          ctrlKey: true,
        }),
      )
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(5)
      expect(cellsOf(onCommitEdits.mock.calls[4]![0])).toEqual([
        ['7', 'age', 26],
      ])

      // Пункты меню — то же.
      await selectCells(cell('4', 'name'), cell('5', 'age'))
      await userEvent.click(cell('4'), { button: 'right' })
      await expect.poll(() => menuItem(labels.fillDown)).toBeTruthy()
      await humanClick(menuItem(labels.fillDown)!)
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(6)
      expect(cellsOf(onCommitEdits.mock.calls[5]![0])).toEqual([
        ['5', 'name', 'Name 4'],
        ['5', 'age', 24],
      ])
      await selectCells(cell('11'), cell('11', 'score'))
      await userEvent.click(cell('11'), { button: 'right' })
      await expect.poll(() => menuItem(labels.fillRight)).toBeTruthy()
      await humanClick(menuItem(labels.fillRight)!)
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(7)
      expect(cellsOf(onCommitEdits.mock.calls[6]![0])).toEqual([
        ['11', 'score', 31],
      ])
    } finally {
      window.removeEventListener('keydown', watch)
      await screen.unmount()
    }
  })

  test('WR18: Ctrl/Cmd+Enter в поле правки сохраняет набранное во все редактируемые ячейки активного диапазона одним пакетом bulk', async () => {
    const onCommitEdits = vi.fn()
    const screen = await mount({
      onCommitEdits,
      canEditCell: ctx => ctx.column.id !== 'name',
    })
    try {
      // Фокус — на последней нажатой ячейке: она и откроет правку.
      await selectCells(cell('3', 'name'), cell('1'))
      // Правка активной ячейки с клавиатуры: F2, затем набор.
      await userEvent.keyboard('{F2}')
      await expect.poll(() => cell('1').querySelector('input')).not.toBeNull()
      await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}77')
      await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}')
      await expect.poll(() => onCommitEdits.mock.calls.length).toBe(1)
      const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
      expect(batch.source).toBe('bulk')
      // Только для чтения колонка пропущена; ячейка правки — в пакете вместе с прочими.
      expect(cellsOf(batch)).toEqual([
        ['1', 'age', 77],
        ['2', 'age', 77],
        ['3', 'age', 77],
      ])
      expect(cell('1').querySelector('input')).toBeNull()

      // Одна ячейка — обычный Enter: пакета операции нет.
      await selectCells(cell('6'))
      await userEvent.keyboard('{F2}')
      await expect.poll(() => cell('6').querySelector('input')).not.toBeNull()
      await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}')
      await expect.poll(() => cell('6').querySelector('input')).toBeNull()
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
    } finally {
      await screen.unmount()
    }
  })

  test('WR40: рамка цели протяжки — axe с color-contrast в обеих темах и ролях table, grid, treegrid; не ниже 3:1 к фону и заливке выделения; видна в forced-colors и повышенном контрасте', async () => {
    const borderOf = () => toRgba(getComputedStyle(frame()!).borderTopColor)
    for (const role of ['table', 'grid', 'treegrid'] as const) {
      const screen = await mount({ role })
      try {
        await selectCells(cell('2'))
        await holdHandleOver(cell('5'))
        await expect.poll(frameShown).toBe(true)
        await inBothThemes(async () => {
          const results = await axe.run(
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
          expect(results.violations).toEqual([])
          // К фону строки цели и к заливке выделенной исходной ячейки.
          expect(
            contrast(borderOf(), effectiveBg(cell('4'))),
          ).toBeGreaterThanOrEqual(3)
          expect(
            contrast(borderOf(), effectiveBg(cell('2'))),
          ).toBeGreaterThanOrEqual(3)
        })
        await pointer.realMouseUp()
      } finally {
        await screen.unmount()
      }
    }
    const screen = await mount()
    try {
      // Высокая контрастность: рамка системным цветом выделения.
      await pointer.forcedColors(true)
      await selectCells(cell('2'))
      await holdHandleOver(cell('5'))
      await expect.poll(frameShown).toBe(true)
      expect(getComputedStyle(frame()!).borderTopStyle).toBe('dashed')
      const probe = document.createElement('span')
      probe.style.color = 'Highlight'
      document.body.append(probe)
      const highlight = getComputedStyle(probe).color
      probe.remove()
      expect(getComputedStyle(frame()!).borderTopColor).toBe(highlight)
      await pointer.realMouseUp()
      await pointer.forcedColors(false)

      // Повышенный контраст: рамка видна и не ниже 3:1.
      await pointer.moreContrast(true)
      await selectCells(cell('7'))
      await holdHandleOver(cell('9'))
      await expect.poll(frameShown).toBe(true)
      expect(
        parseFloat(getComputedStyle(frame()!).borderTopWidth),
      ).toBeGreaterThan(0)
      expect(
        contrast(borderOf(), effectiveBg(cell('8'))),
      ).toBeGreaterThanOrEqual(3)
    } finally {
      await screen.unmount()
    }
  })
})
