import { useMemo } from 'react'
import { render } from 'vitest-browser-react'
import { page, server, userEvent } from 'vitest/browser'
import { beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  columnPinning,
  rowActions,
  rowSelection,
} from '../../../plugins'
import {
  type Combo,
  applyCombo,
  comboLabel,
  finishTransitions,
  frame,
  resetCombo,
  snapshot,
  sys,
} from './contrast-helpers'
import { parkPointer } from '../pointer'
import { over, toRgba } from './a11y-helpers'

// Первенство заливок ячейки (ADR 0126, FP1–FP3): стенд с закреплением слева и справа,
// служебной колонкой выбора, колонкой действий, выбором строк, подсветкой строк, ячеек и
// колонок и диапазоном ячеек — в шести режимах, по пикселям снимка. Один проход собирает
// заливку каждой ячейки каждой строки в покое и под наведением; тесты сверяют собранное.

/** WebKit не подменяет цвета в forced-colors (у Safari режима нет): FP1–FP2 там пропущены. */
const forcing = server.browser !== 'webkit'

const MODES: Combo[] = [
  { palette: 'stories', theme: 'light', mode: 'standard' },
  { palette: 'stories', theme: 'dark', mode: 'standard' },
  { palette: 'stories', theme: 'light', mode: 'more' },
  { palette: 'stories', theme: 'dark', mode: 'more' },
  { palette: 'stories', theme: 'light', mode: 'forced', scheme: 'light' },
  { palette: 'stories', theme: 'light', mode: 'forced', scheme: 'dark' },
]
const COMBOS = MODES.filter(combo => forcing || combo.mode !== 'forced')

/** Обычные колонки — точка отсчёта для закреплённых и служебных. */
const REGULAR = ['b', 'c', 'd']

const ROWS = Array.from({ length: 10 }, (_, i) => `r${i}`)
const SELECTED = ['r2', 'r4', 'r6']
const HIGHLIGHTED = ['r3', 'r4', 'r8']

/**
 * Фаза `cells` — подсветка ячеек `a` и `c` в r6 (выбранной), диапазон `a…c` в r8–r9 с
 * якорем в r8 `a`; фаза `columns` — подсветка колонок `a` (закреплённой) и `c`.
 */
type Phase = 'cells' | 'columns'

/** Группа ячейки: в одной группе заливка одинакова (FP2) или сдвиг одинаков (FP3). */
const groupOf = (phase: Phase, row: string, column: string) => {
  if (phase === 'columns') return ['a', 'c'].includes(column) ? 'hl' : 'row'
  if (row === 'r6' && ['a', 'c'].includes(column)) return 'hl'
  if (row === 'r8' && ['b', 'c'].includes(column)) return 'range'
  if (row === 'r9' && ['a', 'b', 'c'].includes(column)) return 'range'
  return 'row'
}

const COLUMNS = ['a', 'b', 'c', 'd', 'e'].map(id => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  size: 110,
}))

type Api = { highlight: (target: object) => unknown }
let table: Api

const Grid = () => {
  const data = useMemo(
    () =>
      ROWS.map((id, i) => ({
        id,
        ...Object.fromEntries(COLUMNS.map(c => [c.id, `${c.header}${i}`])),
      })),
    [],
  )
  table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    state: { columnPinning: { start: ['a'], end: ['e'] } },
    plugins: [
      columnPinning(),
      rowSelection({
        rowSelection: Object.fromEntries(SELECTED.map(id => [id, true])),
      }),
      cellSelection(),
      rowActions({ column: 'always', width: 56 }),
    ] as never,
  }) as unknown as Api
  return (
    <div style={{ width: 820, height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellsOf = (id: string) => [
  ...rowEl(id).querySelectorAll<HTMLElement>('.data-grid__body-cell'),
]
const cellEl = (id: string, column: string) =>
  cellsOf(id).find(cell => cell.dataset.columnId === column)!

/** Нажатие по ячейке — подготовка диапазона, не предмет проверки. */
const press = (cell: HTMLElement, shiftKey = false) => {
  const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
  cell.dispatchEvent(new MouseEvent('mousedown', init))
  document.dispatchEvent(new MouseEvent('mouseup', init))
}

/** Строки смонтированы: `expect.poll` в `beforeAll` недоступен. */
const rowsMounted = async () => {
  for (
    let wait = 0;
    document.querySelectorAll('.data-grid__body-row').length < ROWS.length;
    wait += 20
  ) {
    if (wait > 5000) throw new Error('строки стенда не смонтировались')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

const settle = async () => {
  await frame()
  finishTransitions()
  await frame()
}

/** Заливка ячеек строки — у правого края, в стороне от текста, флажка и кнопок. */
type Fills = Record<string, number[]>
const fillsOf = (shot: Awaited<ReturnType<typeof snapshot>>, id: string) =>
  Object.fromEntries(
    cellsOf(id).map(cell => {
      const r = cell.getBoundingClientRect()
      // Усредняем плоский участок вдали от кромок, чтобы сравнивать заливку,
      // а не отдельный пиксель дизеринга многослойного градиента Chromium.
      const rgb = [0, 0, 0]
      for (let x = 5; x < 9; x++) {
        for (let y = -2; y < 2; y++) {
          const pixel = shot(r.right - x, r.top + r.height / 2 + y)!
          for (let i = 0; i < 3; i++) rgb[i]! += pixel[i]! / 16
        }
      }
      return [cell.dataset.columnId!, rgb]
    }),
  ) as Fills

interface Sample {
  combo: Combo
  phase: Phase
  row: string
  hover: boolean
  fills: Fills
}

const samples: Sample[] = []
/** Системные цвета и цвет текста r4 — в каждом сочетании режима (FP1). */
const forcedFacts: {
  combo: Combo
  system: Record<string, number[]>
  markRowText: string
  markText: string
}[] = []

const near = (a: number[], b: number[], tolerance: number) =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tolerance)

describe('Первенство заливок ячейки (ADR 0126)', () => {
  beforeAll(async () => {
    // Окно в рамку раннера: снимок без сжатия.
    const viewport = { width: innerWidth, height: innerHeight }
    await page.viewport(900, 720)
    try {
      for (const combo of COMBOS) {
        for (const phase of ['cells', 'columns'] as const) {
          const screen = await render(<Grid />)
          await rowsMounted()
          for (const id of HIGHLIGHTED) table.highlight({ row: id })
          if (phase === 'cells') {
            table.highlight({ cell: ['r6', 'a'] })
            table.highlight({ cell: ['r6', 'c'] })
            press(cellEl('r8', 'a'))
            press(cellEl('r9', 'c'), true)
          } else {
            table.highlight({ column: 'a' })
            table.highlight({ column: 'c' })
          }
          await applyCombo(combo)
          await parkPointer()
          await settle()
          const rest = await snapshot()
          for (const row of ROWS) {
            samples.push({
              combo,
              phase,
              row,
              hover: false,
              fills: fillsOf(rest, row),
            })
          }
          if (combo.mode === 'forced' && phase === 'cells') {
            forcedFacts.push({
              combo,
              system: Object.fromEntries(
                ['Canvas', 'Highlight', 'Mark'].map(name => [
                  name,
                  over(toRgba(sys(name)), toRgba(sys('Canvas'))).slice(0, 3),
                ]),
              ),
              markRowText: getComputedStyle(
                cellEl('r4', 'b').querySelector('*') ?? cellEl('r4', 'b'),
              ).color,
              markText: sys('MarkText'),
            })
          }
          for (const row of ROWS) {
            await userEvent.hover(cellEl(row, 'd'))
            await settle()
            samples.push({
              combo,
              phase,
              row,
              hover: true,
              fills: fillsOf(await snapshot(), row),
            })
          }
          await parkPointer()
          await resetCombo()
          await screen.unmount()
        }
      }
    } finally {
      await resetCombo()
      await page.viewport(viewport.width, viewport.height)
    }
  }, 600_000)

  test('FP1: первенство в forced-colors — диапазон Highlight и на подсвеченной строке, якорь — заливка строки, подсветка ячейки на выбранной строке Mark, строка выбранная и подсвеченная Mark с текстом MarkText, нечётная как чётная', ({
    skip,
  }) => {
    skip(!forcing, 'WebKit не подменяет цвета в forced-colors')
    expect(forcedFacts).toHaveLength(2)
    const problems: string[] = []
    for (const { combo, system, markRowText, markText } of forcedFacts) {
      const at = (row: string, column: string) =>
        samples.find(
          s =>
            s.combo === combo &&
            s.phase === 'cells' &&
            s.row === row &&
            !s.hover,
        )!.fills[column]!
      const expectFill = (row: string, column: string, name: string) => {
        if (!near(at(row, column), system[name]!, 4)) {
          problems.push(
            `${comboLabel(combo)} ${row}/${column}: ${at(row, column)} ≠ ${name} ${system[name]}`,
          )
        }
      }
      expectFill('r0', 'd', 'Canvas')
      expectFill('r1', 'd', 'Canvas')
      expectFill('r2', 'b', 'Highlight')
      expectFill('r3', 'b', 'Mark')
      expectFill('r4', 'b', 'Mark')
      expectFill('r4', 'a', 'Mark')
      expectFill('r6', 'a', 'Mark')
      expectFill('r6', 'c', 'Mark')
      expectFill('r6', 'b', 'Highlight')
      expectFill('r8', 'b', 'Highlight')
      expectFill('r8', 'a', 'Mark')
      expectFill('r9', 'b', 'Highlight')
      if (markRowText !== markText) {
        problems.push(
          `${comboLabel(combo)} r4: текст ${markRowText} ≠ MarkText ${markText}`,
        )
      }
    }
    expect(problems).toEqual([])
  })

  test('FP2: forced-colors — служебная, закреплённые и колонка действий залиты как обычная ячейка строки в том же состоянии, наведение заливку не меняет', ({
    skip,
  }) => {
    skip(!forcing, 'WebKit не подменяет цвета в forced-colors')
    const forced = samples.filter(s => s.combo.mode === 'forced')
    expect(forced.length).toBeGreaterThan(0)
    const problems: string[] = []
    for (const sample of forced) {
      const where = `${comboLabel(sample.combo)} ${sample.phase} ${sample.row}${sample.hover ? ' hover' : ''}`
      const groups = new Map<string, [string, number[]][]>()
      for (const [column, fill] of Object.entries(sample.fills)) {
        const group = groupOf(sample.phase, sample.row, column)
        groups.set(group, [...(groups.get(group) ?? []), [column, fill]])
      }
      for (const [group, cells] of groups) {
        const [, first] = cells[0]!
        if (cells.some(([, fill]) => !near(fill, first, 4))) {
          problems.push(
            `${where} ${group}: ${cells.map(([c, f]) => `${c}=${f}`).join(' ')}`,
          )
        }
      }
      if (sample.hover) {
        const rest = forced.find(
          s =>
            s.combo === sample.combo &&
            s.phase === sample.phase &&
            s.row === sample.row &&
            !s.hover,
        )!
        for (const [column, fill] of Object.entries(sample.fills)) {
          if (!near(fill, rest.fills[column]!, 4)) {
            problems.push(
              `${where} ${column}: наведение ${fill}, в покое ${rest.fills[column]}`,
            )
          }
        }
      }
    }
    expect(problems).toEqual([])
  })

  test('FP3: обычный и повышенный режимы — состояние не увеличивает ступень закрепления: служебная и закреплённые ячейки отличаются от обычной ячейки строки не больше, чем в покое, и в ту же сторону', () => {
    // Округление снимка и смешения в разных цветовых пространствах.
    const ROUNDING = 2
    const problems: string[] = []
    const plain = samples.filter(s => s.combo.mode !== 'forced')
    expect(plain.length).toBeGreaterThan(0)
    let compared = 0
    for (const sample of plain) {
      // Покой той же чётности без состояний ячейки — ступень закрепления.
      const index = Number(sample.row.slice(1))
      const base = plain.find(
        s =>
          s.combo === sample.combo &&
          s.phase === 'cells' &&
          s.row === (index % 2 ? 'r1' : 'r0') &&
          !s.hover,
      )!.fills
      const groups = new Map<string, string[]>()
      for (const column of Object.keys(sample.fills)) {
        const group = groupOf(sample.phase, sample.row, column)
        groups.set(group, [...(groups.get(group) ?? []), column])
      }
      for (const [group, columns] of groups) {
        const ref = columns.find(column => REGULAR.includes(column))!
        for (const column of columns) {
          if (column === ref) continue
          compared++
          for (let i = 0; i < 3; i++) {
            const step = base[column]![i]! - base[ref]![i]!
            const now = sample.fills[column]![i]! - sample.fills[ref]![i]!
            // Слой может приблизить ячейку к обычной (плотная подсветка «съедает»
            // ступень), но не отдалить и не перебросить на другую сторону.
            const grows = Math.abs(now) > Math.abs(step) + ROUNDING
            const flips =
              Math.abs(now) > ROUNDING && Math.sign(now) !== Math.sign(step)
            if (grows || flips) {
              problems.push(
                `${comboLabel(sample.combo)} ${sample.phase} ${sample.row}${sample.hover ? ' hover' : ''} ${group} ${column}[${i}]: ступень ${step} → ${now}; ${column} ${base[column]} → ${sample.fills[column]}, ${ref} ${base[ref]} → ${sample.fills[ref]}`,
              )
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(0)
    expect(problems).toEqual([])
  })
})
