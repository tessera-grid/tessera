import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { rowExpandingModel } from '../../../plugins'
import { Stories } from '../helpers'
import { composed } from '../stories'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Модель дерева `rowExpandingModel`, интерфейс `rowExpanding` и линии `treeLines` (ADR 0119).
// TD4, TD5, TD9 — модульные в `rowExpandingModel.dom`.

type Args = Partial<Parameters<typeof Stories.DataGridPlayground>[0]>

const BASE: Args = {
  containerHeight: 600,
  height: 500,
  columnCount: 5,
  dataCount: 30,
  dataNesting: 'nested',
}

// Мок: у `item-id-0` двое детей, у первого — свой ребёнок (глубина 2).
const ROOT = 'item-id-0'
const CHILD = 'item-id-0-0'
const GRANDCHILD = 'item-id-0-0-0'

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const rowIds = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row:not(.data-grid__body-row--skeleton)',
    ),
  ).map(row => row.dataset.rowId!)
const expandHead = () =>
  document.querySelector(
    '.data-grid__head-cell[data-column-id*="rowExpanding"]',
  )
/** Первая ячейка строки — колонка отступа (служебных колонок нет). */
const indentPadding = (id: string) =>
  Number.parseFloat(
    getComputedStyle(rowEl(id)!.querySelector('.data-grid__body-cell')!)
      .paddingLeft,
  )
const withLines = () =>
  document.querySelectorAll('[data-tree-depth]').length > 0

interface Node {
  id: string
  name: string
  subRows?: Node[]
}
const TREE: Node[] = [
  {
    id: 'a',
    name: 'Alpha',
    subRows: [
      { id: 'a1', name: 'Alpha one', subRows: [{ id: 'a1x', name: 'Deep' }] },
    ],
  },
  { id: 'b', name: 'Beta' },
]

/** Грид только с моделью дерева: интерфейса раскрытия в наборе нет. */
const TreeOnly = ({
  expanded,
  enabled = true,
}: {
  expanded: true | Record<string, boolean>
  enabled?: boolean
}) => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: TREE,
    getRowId: (row: Node) => row.id,
    plugins: [rowExpandingModel({ enabled, expanded })] as never,
  })
  return (
    <div style={{ width: 480, height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const SKELETON_ROW = '.data-grid__body-row--skeleton'
const skeletonRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>(SKELETON_ROW))

describe('Модель дерева rowExpandingModel (ADR 0119)', () => {
  test('TD1: rowExpandingModel — подстроки по expanded на любой глубине с отступом, без колонки переключателя; пустой expanded или enabled: false — одни корни', async () => {
    const screen = await render(<TreeOnly expanded={true} />)
    await expect.poll(() => rowEl('a1x')).not.toBeNull()
    expect(rowIds()).toEqual(['a', 'a1', 'a1x', 'b'])
    expect(expandHead()).toBeNull()
    const indent = Number.parseFloat(
      getComputedStyle(rowEl('a')!).getPropertyValue(
        '--tsr-comp-row-nesting-indent',
      ),
    )
    expect(indent).toBeGreaterThan(0)
    const root = indentPadding('a')
    expect(indentPadding('a1') - root).toBeCloseTo(indent, 0)
    expect(indentPadding('a1x') - root).toBeCloseTo(2 * indent, 0)

    await screen.rerender(<TreeOnly expanded={{ a: true }} />)
    await expect.poll(rowIds).toEqual(['a', 'a1', 'b'])
    await screen.rerender(<TreeOnly expanded={{}} />)
    await expect.poll(rowIds).toEqual(['a', 'b'])
    await screen.rerender(<TreeOnly expanded={true} enabled={false} />)
    await expect.poll(rowIds).toEqual(['a', 'b'])
  })

  test('TD2: rowExpandingModel без rowExpanding — treegrid с aria-level и без aria-expanded; ←/→, Enter и Space не раскрывают', async () => {
    await render(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowExpandingModel
        enableKeyboardNavigation
        expandAll
      />,
    )
    await expect.poll(() => rowEl(CHILD)).not.toBeNull()
    expect(document.querySelector('[role="treegrid"]')).not.toBeNull()
    expect(rowEl(ROOT)!.getAttribute('aria-level')).toBe('1')
    expect(rowEl(CHILD)!.getAttribute('aria-level')).toBe('2')
    expect(rowEl(GRANDCHILD)!.getAttribute('aria-level')).toBe('3')
    expect(
      document
        .querySelector('[role="treegrid"]')!
        .querySelectorAll('[aria-expanded]'),
    ).toHaveLength(0)

    const before = rowIds()
    const active = () => document.activeElement as HTMLElement
    rowEl(ROOT)!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(active).toBe(rowEl(ROOT))
    // ← на раскрытом корне без переключателя — некуда: фокус и дерево на месте.
    await userEvent.keyboard('{ArrowLeft}')
    expect(active()).toBe(rowEl(ROOT))
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(rowIds()).toEqual(before)
    // → ведёт в ячейку, а не раскрывает.
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => active().getAttribute('role')).toBe('gridcell')
    expect(rowIds()).toEqual(before)
    // ← на раскрытой подстроке — к родителю, а не свернуть.
    rowEl(CHILD)!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(active).toBe(rowEl(CHILD))
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(active).toBe(rowEl(ROOT))
    expect(rowIds()).toEqual(before)
  })

  test('TD3: дерево rowExpandingModel без rowExpanding проходит axe в ролях table и treegrid в обеих темах', async () => {
    for (const keyboard of [false, true]) {
      const screen = await render(
        <Stories.DataGridPlayground
          {...BASE}
          enableRowExpandingModel
          expandAll
          enableKeyboardNavigation={keyboard}
        />,
      )
      await expect.poll(() => rowEl(CHILD)).not.toBeNull()
      const grid = document.querySelector<HTMLElement>(
        keyboard ? '[role="treegrid"]' : '[role="table"]',
      )!
      expect(grid).not.toBeNull()
      await inBothThemes(async () => {
        const result = await axe.run(grid, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(result.violations).toEqual([])
      })
      await screen.unmount()
    }
  })

  test('TD6: rowExpanding({ maxDepth }) рядом с rowExpandingModel — строка глубже предела не раскрыта и при expanded: true; rowExpandingModel без rowExpanding раскрывает на любой глубине; выключенный rowExpanding предела не задаёт', async () => {
    const props = (rowExpanding: boolean): Args => ({
      ...BASE,
      enableRowExpandingModel: true,
      expandAll: true,
      enableRowExpanding: rowExpanding,
      rowExpandingMaxDepth: 1,
    })
    const screen = await render(<Stories.DataGridPlayground {...props(true)} />)
    await expect.poll(() => rowEl(CHILD)).not.toBeNull()
    expect(rowEl(GRANDCHILD)).toBeNull()

    await screen.rerender(<Stories.DataGridPlayground {...props(false)} />)
    await expect.poll(() => rowEl(GRANDCHILD)).not.toBeNull()
  })

  test('TD7: rowGrouping с rowExpandingModel без rowExpanding — группы раскрыты по expanded, колонки переключателя нет', async () => {
    const screen = await render(
      <composed.RowGroupingPlayground
        enableRowExpanding={false}
        enableRowExpandingModel
        initialGrouping={['gender']}
        initialExpanded={true}
      />,
    )
    const groups = () => rowIds().filter(id => id.startsWith('gender:'))
    await expect.poll(() => groups().length).toBeGreaterThan(0)
    await expect.poll(() => rowIds().length).toBeGreaterThan(groups().length)
    expect(expandHead()).toBeNull()

    await screen.rerender(
      <composed.RowGroupingPlayground
        enableRowExpanding={false}
        enableRowExpandingModel
        initialGrouping={['gender']}
        expandAll={false}
      />,
    )
    await expect.poll(() => rowIds().length).toBe(groups().length)
  })

  test('TD8: treeLines рисует линии у дерева rowExpandingModel, rowExpanding и групп; без плагина и с enabled: false линий нет; переключение на лету без перемонтирования', async () => {
    const screen = await render(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowExpandingModel
        enableTreeLines
        expandAll
      />,
    )
    await expect.poll(withLines).toBe(true)
    expect(rowEl(CHILD)!.querySelector('[data-tree-depth="1"]')).not.toBeNull()
    const node = rowEl(CHILD)

    await screen.rerender(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowExpandingModel
        expandAll
      />,
    )
    await expect.poll(withLines).toBe(false)
    expect(rowEl(CHILD)).toBe(node)
    await screen.rerender(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowExpandingModel
        enableTreeLines
        expandAll
      />,
    )
    await expect.poll(withLines).toBe(true)
    expect(rowEl(CHILD)).toBe(node)

    await screen.rerender(
      <Stories.DataGridPlayground
        {...BASE}
        enableRowExpanding
        enableTreeLines
        expandAll
      />,
    )
    await expect.poll(withLines).toBe(true)
    await screen.unmount()

    await render(
      <composed.RowGroupingPlayground
        enableRowExpanding={false}
        enableRowExpandingModel
        enableTreeLines
        initialGrouping={['gender']}
        initialExpanded={true}
      />,
    )
    await expect
      .poll(() => document.querySelector('[data-tree-depth="1"]'))
      .not.toBeNull()
  })

  test('TD10: скелет — подстроки при модели дерева и expanded: true, иначе плоский; линии только с treeLines; квадраты переключателя только с колонкой rowExpanding', async () => {
    const props = (extra: Args): Args => ({
      ...BASE,
      loading: 'initial',
      dataOverride: [],
      enableTreeLines: true,
      ...extra,
    })
    const depths = () =>
      new Set(
        skeletonRows().flatMap(row =>
          Array.from(
            row.querySelectorAll<HTMLElement>('[data-tree-depth]'),
            cell => cell.dataset.treeDepth,
          ),
        ),
      )
    // Модель без переключателя: дерево с линиями, колонки раскрытия нет.
    const screen = await render(
      <Stories.DataGridPlayground
        {...props({ enableRowExpandingModel: true, expandAll: true })}
      />,
    )
    await expect.poll(() => depths().has('1')).toBe(true)
    expect(expandHead()).toBeNull()

    // С переключателем: та же модель и колонка с квадратами.
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({ enableRowExpanding: true, expandAll: true })}
      />,
    )
    await expect.poll(() => expandHead()).not.toBeNull()
    expect(depths().has('1')).toBe(true)
    expect(
      skeletonRows().some(row =>
        row.querySelector(
          '[data-column-id*="rowExpanding"] [class*="skeleton"]',
        ),
      ),
    ).toBe(true)

    // Без линий — подстроки есть, линий нет.
    await screen.rerender(
      <Stories.DataGridPlayground
        {...props({
          enableRowExpandingModel: true,
          expandAll: true,
          enableTreeLines: false,
        })}
      />,
    )
    await expect.poll(() => depths().size).toBe(0)

    // Дерево придёт свёрнутым или модели нет — скелет плоский.
    for (const extra of [
      { enableRowExpandingModel: true, expandAll: false },
      { expandAll: true },
    ]) {
      await screen.rerender(<Stories.DataGridPlayground {...props(extra)} />)
      await expect.poll(() => depths().size).toBe(0)
      expect(skeletonRows().length).toBeGreaterThan(0)
    }
  })
})
