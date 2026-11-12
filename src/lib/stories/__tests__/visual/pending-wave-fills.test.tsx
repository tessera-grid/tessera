import { useMemo } from 'react'
import { render } from 'vitest-browser-react'
import { commands, page, userEvent } from 'vitest/browser'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnPinning, rowActions, rowSelection } from '../../../plugins'
import { setObjectPending } from '../../../shared/objectPending'
import {
  type Combo,
  applyCombo,
  finishTransitions,
  frame,
  resetCombo,
  snapshot,
} from './contrast-helpers'

// Волна ожидания на цели-строке по пикселям (ADR 0155, PW6–PW7): одним слоем на каждой ячейке
// строки при любом закреплении, служебных колонках, состоянии строки и режиме темы, и до
// внешнего края ячейки. Сравнивается строка в ожидании с такой же строкой без него: сдвиг
// заливки у всех ячеек один.

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

const COMBOS: Combo[] = [
  { palette: 'stories', theme: 'light', mode: 'standard' },
  { palette: 'stories', theme: 'dark', mode: 'standard' },
  { palette: 'stories', theme: 'light', mode: 'more' },
]

const COLUMNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map(id => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  size: 110,
}))
const ROWS = Array.from({ length: 14 }, (_, i) => `r${i}`)
/**
 * Пары «образец — та же строка в ожидании»: чётная, нечётная, выбранная, подсвеченная. Первые
 * строки не берутся: при прокрутке на них ложится тень шапки.
 */
const PAIRS = [
  ['r2', 'r4'],
  ['r3', 'r5'],
  ['r6', 'r8'],
  ['r7', 'r9'],
] as const
const SELECTED = ['r6', 'r8']
const HIGHLIGHTED = ['r7', 'r9']
/** Под указателем: образец r12 и r10 в ожидании — снимаются по очереди. */
const HOVER_PAIR = ['r12', 'r10'] as const
const PENDING = ['r4', 'r5', 'r8', 'r9', 'r10']

/** Колонка действий одна справа или справа ещё закреплённая колонка данных. */
type Layout = 'actionsAlone' | 'pinnedRight'

let table: { highlight: (target: object) => unknown }

const Grid = ({ layout }: { layout: Layout }) => {
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
    state: {
      columnPinning: {
        start: ['a'],
        end: layout === 'pinnedRight' ? ['i'] : [],
      },
    },
    plugins: [
      columnPinning(),
      rowSelection({
        rowSelection: Object.fromEntries(SELECTED.map(id => [id, true])),
      }),
      rowActions({ column: 'always', width: 56 }),
    ] as never,
  }) as never
  return (
    <div style={{ width: 820, height: 640 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const container = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellsOf = (id: string) => [
  ...rowEl(id).querySelectorAll<HTMLElement>('.data-grid__body-cell'),
]
const cellOf = (id: string, column: string) =>
  cellsOf(id).find(cell => cell.dataset.columnId === column)

const settle = async () => {
  await frame()
  finishTransitions()
  await frame()
}

/** Видимая часть ячейки по горизонтали: закреплённые перекрывают прокрученные. */
const visibleSpan = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  const scroller = container().getBoundingClientRect()
  let left = Math.max(box.left, scroller.left)
  let right = Math.min(box.right, scroller.right)
  if (cell.dataset.cellPinned === 'false') {
    for (const pinned of cellsOf(
      cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId!,
    ).filter(other => other.dataset.cellPinned !== 'false')) {
      const p = pinned.getBoundingClientRect()
      if (p.left <= left && p.right > left) left = p.right
      if (p.right >= right && p.left < right) right = p.left
    }
  }
  return { left, right, top: box.top + box.height / 2 - 3 }
}

/**
 * Точки заливки строки, по столбцам: у краёв видимой части ячейки на середине высоты; у
 * края закрепления, пока блок не прилип, — и сам пиксель прозрачного разделителя (PW7).
 */
const pointsOf = (id: string) => {
  const stuckLeft = container().hasAttribute('data-pinned-left-stuck')
  const stuckRight = container().hasAttribute('data-pinned-right-stuck')
  const points: { name: string; x: number; y: number }[] = []
  for (const cell of cellsOf(id)) {
    const { left, right, top } = visibleSpan(cell)
    if (right - left < 8) continue
    const column = cell.dataset.columnId!
    points.push(
      { name: `${column}:left`, x: left + 3, y: top + 3 },
      { name: `${column}:right`, x: right - 3, y: top + 3 },
    )
    if (cell.dataset.cellLastLeftPinned === 'true' && !stuckLeft)
      points.push({ name: `${column}:edge`, x: right - 0.5, y: top + 3 })
    if (
      cell.dataset.cellFirstRightPinned === 'true' &&
      cell.dataset.actionsColumnCell !== 'true' &&
      !stuckRight
    )
      points.push({ name: `${column}:edge`, x: left + 0.5, y: top + 3 })
  }
  return points
}

type Shot = Awaited<ReturnType<typeof snapshot>>

/** Сдвиг заливки «в ожидании − образец» по каждой точке; точки — по столбцам образца. */
const deltasOf = (
  shotRef: Shot,
  ref: string,
  shotPending: Shot,
  pending: string,
) => {
  const dy =
    rowEl(pending).getBoundingClientRect().top -
    rowEl(ref).getBoundingClientRect().top
  return pointsOf(ref).map(point => {
    const a = shotRef(point.x, point.y)!.slice(0, 3)
    const b = shotPending(point.x, point.y + dy)!.slice(0, 3)
    return { name: point.name, delta: b.map((v, k) => v - a[k]!) }
  })
}

/** Сдвиги одинаковы: каждый — в пределах ±3 от первого по каждому каналу. */
const uneven = (deltas: { name: string; delta: number[] }[]) => {
  const [first] = deltas
  return deltas
    .filter(d => d.delta.some((v, k) => Math.abs(v - first!.delta[k]!) > 3))
    .map(d => `${d.name} ${d.delta} ≠ ${first!.name} ${first!.delta}`)
}

const scrollTo = async (at: 'start' | 'end') => {
  const scroller = container()
  scroller.scrollLeft = at === 'start' ? 0 : scroller.scrollWidth
  await frame()
  await frame()
}

const rowsMounted = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThanOrEqual(ROWS.length)

/** Десятки снимков экрана: в Firefox и WebKit снимок дольше, чем в Chromium. */
const PIXEL_TIMEOUT = 90_000

describe('Волна ожидания на цели-строке по пикселям (ADR 0155)', () => {
  beforeAll(() => page.viewport(900, 720))
  afterAll(async () => {
    await resetCombo()
    await motion.reducedMotion(false)
  })

  test(
    'PW6: волна на цели-строке — одним слоем на каждой ячейке строки: сдвиг заливки против той же строки без ожидания один у закреплённых слева и справа, служебной колонки, колонки действий — одной справа и рядом с закреплённой, прокручиваемых под ними; у чётной, нечётной, выбранной, подсвеченной строки и под указателем; при прилипшем и не прилипшем блоке; в светлой и тёмной теме и повышенном контрасте',
    async () => {
      await motion.reducedMotion(true)
      const failures: string[] = []
      try {
        for (const layout of ['actionsAlone', 'pinnedRight'] as const) {
          const screen = await render(<Grid layout={layout} />)
          await rowsMounted()
          for (const id of HIGHLIGHTED) table.highlight({ row: id })
          setObjectPending(
            table,
            'row',
            PENDING.map(row => ({ row })),
          )
          await expect
            .poll(() =>
              cellsOf('r10').every(c => c.hasAttribute('data-pending-wave')),
            )
            .toBe(true)
          for (const combo of COMBOS) {
            await applyCombo(combo)
            for (const at of ['start', 'end'] as const) {
              await scrollTo(at)
              // Указатель — на шапке: ни одна строка не под ним.
              await userEvent.hover(
                document.querySelector<HTMLElement>('.data-grid__head-cell')!,
              )
              await settle()
              const label = `${layout} ${combo.theme}/${combo.mode} ${at}`
              const shot = await snapshot()
              for (const [ref, pending] of PAIRS)
                failures.push(
                  ...uneven(deltasOf(shot, ref, shot, pending)).map(
                    f => `${label} ${ref}→${pending}: ${f}`,
                  ),
                )
              // Под указателем: образец и строка в ожидании — по очереди, той же ячейкой.
              const hovered = async (id: string) => {
                await userEvent.hover(cellOf(id, 'd') ?? cellOf(id, 'c')!)
                await settle()
                return snapshot()
              }
              const [ref, pending] = HOVER_PAIR
              const refShot = await hovered(ref)
              const pendingShot = await hovered(pending)
              failures.push(
                ...uneven(deltasOf(refShot, ref, pendingShot, pending)).map(
                  f => `${label} hover ${ref}→${pending}: ${f}`,
                ),
              )
            }
          }
          await resetCombo()
          await screen.unmount()
        }
      } finally {
        await motion.reducedMotion(false)
      }
      expect(failures).toEqual([])
    },
    PIXEL_TIMEOUT,
  )

  test(
    'PW7: подложка и блик волны закрывают ячейку до внешнего края — прозрачный разделитель не прилипшего края закрепления слева и справа не виден полосой ни в покое волны, ни когда по нему идёт блик',
    async () => {
      const failures: string[] = []
      for (const layout of ['actionsAlone', 'pinnedRight'] as const) {
        const screen = await render(<Grid layout={layout} />)
        await rowsMounted()
        setObjectPending(table, 'row', [{ row: 'r2' }])
        await expect
          .poll(
            () =>
              rowEl('r2')
                .getAnimations({ subtree: true })
                .filter(animation => animation.id === 'tsr-pending-wave')
                .length,
          )
          .toBeGreaterThan(0)
        // Левый край не прилип в начале прокрутки, правый — в конце.
        for (const at of ['start', 'end'] as const) {
          await scrollTo(at)
          const edges = pointsOf('r2').filter(p => p.name.endsWith(':edge'))
          if (layout === 'pinnedRight' || at === 'start')
            expect(edges.length, `${layout} ${at}: край`).toBeGreaterThan(0)
          const waves = rowEl('r2')
            .getAnimations({ subtree: true })
            .filter(animation => animation.id === 'tsr-pending-wave')
          const duration = Number(
            waves[0]!.effect!.getComputedTiming().duration,
          )
          waves.forEach(animation => animation.pause())
          for (let step = 0; step <= 40; step++) {
            for (const animation of waves)
              animation.currentTime = (duration * step) / 40
            await frame()
            const shot = await snapshot()
            for (const edge of edges) {
              // Сосед — 2px внутрь ячейки: разделитель справа у левого блока, слева у правого.
              const inward = edge.name.startsWith('a:') ? -2 : 2
              const e = shot(edge.x, edge.y)!.slice(0, 3)
              const n = shot(edge.x + inward, edge.y)!.slice(0, 3)
              if (e.some((v, k) => Math.abs(v - n[k]!) > 8))
                failures.push(
                  `${layout} ${at} t${step} ${edge.name}: ${e} ≠ ${n}`,
                )
            }
          }
          waves.forEach(animation => animation.play())
        }
        await screen.unmount()
      }
      expect(failures).toEqual([])
    },
    PIXEL_TIMEOUT,
  )
})
