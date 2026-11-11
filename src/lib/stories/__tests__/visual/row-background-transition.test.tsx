import { useMemo } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnPinning,
  columnSorting,
  columnSortingModel,
  rowSelection,
  rowSelectionModel,
} from '../../../plugins'

// Фон строк и ячеек без перехода (ADR 0214): смена прилипания и чётности строк не запускает
// анимаций, наведение и выбор — переходом слоя `--tsr-row-state`.

const IDS = ['a', 'b', 'c', 'd', 'e', 'f']
/** Сортировка по `n` уводит r0 в конец: остальные строки сдвигаются на одну и меняют чётность. */
const ROWS = Array.from({ length: 30 }, (_, i) => ({
  id: `r${i}`,
  n: i === 0 ? 100 : i,
  ...Object.fromEntries(IDS.map(id => [id, `${id}${i}`])),
}))

const PINNING = { start: ['a', 'b'], end: ['f'] }

interface Api {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setRowSelection: (value: Record<string, boolean>) => void
}
let api: Api

/** Слева закреплены a и b, справа — f; футер включён. */
const Grid = () => {
  const columns = useMemo(
    () => [
      ...IDS.map(id => ({
        id,
        accessorKey: id,
        header: id.toUpperCase(),
        footer: () => `Σ${id}`,
        size: 150,
      })),
      { id: 'n', accessorKey: 'n', header: 'N', size: 150 },
    ],
    [],
  )
  const [plugins] = useMemo(
    () => [
      [
        columnPinning(),
        columnSorting(),
        columnSortingModel(),
        rowSelection(),
        rowSelectionModel(),
      ],
    ],
    [],
  )
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    state: { columnPinning: PINNING },
    enableFooter: true,
    plugins: plugins as never,
  } as never)
  api = table as unknown as Api
  return (
    <div style={{ width: 600, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)!
const container = () => q('.data-grid__container')
const rowEl = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const cellEl = (row: string, column: string) =>
  rowEl(row).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const bg = (el: Element) => getComputedStyle(el).backgroundColor

/** Переходы CSS на строках и ячейках шапки, тела и футера. */
const gridTransitions = () =>
  container()
    .getAnimations({ subtree: true })
    .filter((a): a is CSSTransition => a instanceof CSSTransition)
    .filter(a => {
      const target = (a.effect as KeyframeEffect | null)?.target
      return (
        target instanceof Element &&
        target.matches(
          '.data-grid__body-row, .data-grid__body-cell, .data-grid__head-cell, .data-grid__footer-cell',
        )
      )
    })

/**
 * Снять показание в момент смены атрибута — синхронно, до следующего кадра: начатый переход
 * показал бы здесь прежнее значение.
 */
const readOnChange = <T,>(
  target: Element,
  attribute: string,
  read: () => T,
  act: () => void,
) =>
  new Promise<T>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve(read())
    })
    observer.observe(target, { attributes: true, attributeFilter: [attribute] })
    act()
    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`${attribute} не сменился`))
    }, 3000)
  })

const settle = () =>
  Promise.all(
    container()
      .getAnimations({ subtree: true })
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )

describe('фон строк и ячеек без перехода (ADR 0214)', () => {
  test('NF2: смена прилипания слева и справа не запускает анимаций в теле, футере и шапке; тон закреплённого блока — новый в том же кадре', async () => {
    const screen = await render(<Grid />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      await settle()
      const plainLeft = bg(cellEl('r1', 'b'))
      expect(plainLeft).toBe(bg(rowEl('r1')))

      // Слева прилип: тон в момент смены атрибута — уже итоговый.
      const stuckLeft = await readOnChange(
        container(),
        'data-pinned-left-stuck',
        () => ({ cell: bg(cellEl('r1', 'b')), transitions: gridTransitions() }),
        () => (container().scrollLeft = 100),
      )
      expect(stuckLeft.transitions).toEqual([])
      await settle()
      expect(stuckLeft.cell).toBe(bg(cellEl('r1', 'b')))
      expect(stuckLeft.cell).not.toBe(plainLeft)

      // Справа отлип у конца: фон строки сразу.
      const plainRight = await readOnChange(
        container(),
        'data-pinned-right-stuck',
        () => ({ cell: bg(cellEl('r1', 'f')), transitions: gridTransitions() }),
        () => (container().scrollLeft = container().scrollWidth),
      )
      expect(plainRight.transitions).toEqual([])
      expect(plainRight.cell).toBe(bg(rowEl('r1')))

      // Обратно к началу: оба блока меняют вид без переходов.
      const back = await readOnChange(
        container(),
        'data-pinned-left-stuck',
        () => ({
          left: bg(cellEl('r1', 'b')),
          right: bg(cellEl('r1', 'f')),
          transitions: gridTransitions(),
        }),
        () => (container().scrollLeft = 0),
      )
      expect(back.transitions).toEqual([])
      expect(back.left).toBe(bg(rowEl('r1')))
      expect(back.right).not.toBe(bg(rowEl('r1')))
    } finally {
      await screen.unmount()
    }
  })

  test('NF3: сортировка, меняющая чётность строк, не запускает переходов фона строк и закреплённых ячеек; зебра — новая в том же кадре', async () => {
    const screen = await render(<Grid />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      // Закреплённые ячейки прилипли — у них свой тон по чётности.
      container().scrollLeft = 100
      await expect
        .poll(() => container().hasAttribute('data-pinned-left-stuck'))
        .toBe(true)
      await settle()
      expect(rowEl('r1').getAttribute('data-row-odd')).toBe('true')
      const before = { row: bg(rowEl('r1')), cell: bg(cellEl('r1', 'b')) }
      const evenRow = bg(rowEl('r2'))
      const evenCell = bg(cellEl('r2', 'b'))
      expect(before.row).not.toBe(evenRow)

      const after = await readOnChange(
        rowEl('r1'),
        'data-row-odd',
        () => ({
          row: bg(rowEl('r1')),
          cell: bg(cellEl('r1', 'b')),
          transitions: gridTransitions().filter(
            a => a.transitionProperty === 'background-color',
          ),
        }),
        () => api.setSorting([{ id: 'n', desc: false }]),
      )
      expect(rowEl('r1').getAttribute('data-row-odd')).toBe('false')
      expect(after.transitions).toEqual([])
      expect(after.row).toBe(evenRow)
      expect(after.cell).toBe(evenCell)
    } finally {
      await screen.unmount()
    }
  })

  test('NF4: наведение и выбор строки остаются плавными, и на закреплённых ячейках: в середине перехода тон — промежуточный между прежним и новым', async () => {
    /** Тон слоя состояния у закреплённой ячейки посреди перехода строки. */
    const midway = async (row: string) => {
      const transition = await expect
        .poll(() =>
          rowEl(row)
            .getAnimations()
            .find(
              (a): a is CSSTransition =>
                a instanceof CSSTransition &&
                a.transitionProperty === '--tsr-row-state',
            ),
        )
        .toBeTruthy()
        .then(() =>
          rowEl(row)
            .getAnimations()
            .find(
              (a): a is CSSTransition =>
                a instanceof CSSTransition &&
                a.transitionProperty === '--tsr-row-state',
            ),
        )
      const duration = Number(transition!.effect!.getTiming().duration)
      transition!.pause()
      const at = (time: number) => {
        transition!.currentTime = time
        return getComputedStyle(cellEl(row, 'b'))
          .getPropertyValue('--tsr-row-state')
          .trim()
      }
      const tones = { from: at(0), middle: at(duration / 2), to: at(duration) }
      transition!.finish()
      return tones
    }

    const screen = await render(<Grid />)
    try {
      await expect.poll(() => cellEl('r1', 'b')).toBeTruthy()
      await settle()

      await userEvent.hover(cellEl('r1', 'c'))
      const hover = await midway('r1')
      expect(hover.middle).not.toBe(hover.from)
      expect(hover.middle).not.toBe(hover.to)

      await userEvent.unhover(cellEl('r1', 'c'))
      await settle()
      api.setRowSelection({ r3: true })
      const select = await midway('r3')
      expect(select.middle).not.toBe(select.from)
      expect(select.middle).not.toBe(select.to)
    } finally {
      await screen.unmount()
    }
  })
})
