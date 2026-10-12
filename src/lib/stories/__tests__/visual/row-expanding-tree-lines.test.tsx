import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { getScroller, humanClick, scrollToEnd } from '../helpers'
import { composed } from '../stories'
import { makeData } from '../../__mocks__/data'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { pinFirstColumn } from './column-pinning-helpers'
import {
  TREE,
  box,
  horizontalAt,
  indentOf,
  railX,
  rowEl,
  showRow,
  snapshot,
  themeTokens,
  tokenColor,
  treeGeometry,
  verticalAt,
} from './tree-lines-helpers'

// Линии дерева: ветки со скруглёнными поворотами (ADR 0102, TL1–TL6) и общие гарантии
// ADR 0058 (RE53, RE55–RE58) и шаг ADR 0059 (RE62). Линии проверяются по пикселям
// скриншота; TL7 (дробный масштаб) — `tree-lines-zoom`, перф TL8 — `performance/scroll`.

/** Начало текста ячейки. */
const textLeft = (cell: HTMLElement) =>
  cell
    .querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
    .getBoundingClientRect().left

const waitTree = () =>
  expect.poll(() => rowEl(TREE.falkland) ?? null).not.toBeNull()

describe('Row expanding: tree lines', () => {
  let restore = () => {}
  afterEach(() => {
    restore()
    restore = () => {}
  })

  test('TL1: a child joins its parent line with a rounded turn — vertical under the parent text from the row top to its middle, an arc of the radius token, a horizontal to the child text', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    await showRow(TREE.falkland)
    const g = treeGeometry()
    const cell = indentOf(TREE.falkland)
    const { top, mid, height } = box(cell)
    const x = railX(cell, 3, g)
    // Вертикаль — под началом текста родителя.
    expect(Math.abs(x - textLeft(indentOf(TREE.zimbabwe)))).toBeLessThanOrEqual(
      1,
    )
    let shot = await snapshot()
    expect(verticalAt(shot, x, top + height * 0.25), 'vertical').toBe(true)
    expect(
      horizontalAt(shot, x + g.radius + 2, mid),
      'horizontal after the arc',
    ).toBe(true)
    expect(
      horizontalAt(shot, textLeft(cell) - 6, mid),
      'horizontal up to the text',
    ).toBe(true)
    // Угол скруглён: у угла горизонтали нет — линия ушла вверх по дуге.
    expect(horizontalAt(shot, x + 1, mid, 3), 'rounded corner').toBe(false)

    // Радиус — из токена: с нулевым угол прямой.
    restore = themeTokens({ '--tsr-comp-tree-line-radius': '0px' })
    shot = await snapshot()
    expect(horizontalAt(shot, x + 1, mid), 'square corner').toBe(true)
  })

  test('TL2: a non-last child continues its parent line down without gaps through the row border; the last child ends it with the turn', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    await showRow(TREE.portugal)
    const g = treeGeometry()
    const first = indentOf(TREE.portugal)
    const last = indentOf(TREE.falkland)
    const x = railX(first, 3, g)
    const shot = await snapshot()
    const gaps: number[] = []
    // Каждая строка пикселей скриншота: граница строки тоньше CSS-пикселя.
    const to = box(last).top + box(last).height * 0.25
    for (let y = box(first).mid + 2; y <= to; y += 1 / shot.scale) {
      if (!verticalAt(shot, x, y)) gaps.push(y)
    }
    expect(gaps).toEqual([])
    const end = box(last)
    expect(verticalAt(shot, x, end.mid + end.height / 4, 3)).toBe(false)
  })

  test('TL3: an ancestor line runs through a row only while that ancestor has more siblings below', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    const g = treeGeometry()
    const below = (id: string, level: number) => {
      const cell = indentOf(id)
      const { mid, height } = box(cell)
      return [railX(cell, level, g), mid + height / 4] as const
    }

    await showRow(TREE.falkland)
    let shot = await snapshot()
    // Zimbabwe и Turkey не последние — их линии проходят.
    expect(verticalAt(shot, ...below(TREE.falkland, 2)), 'level 2').toBe(true)
    expect(verticalAt(shot, ...below(TREE.falkland, 1)), 'level 1').toBe(true)

    await showRow(TREE.samoa)
    shot = await snapshot()
    // Colombia — последняя у Turkey: её уровня нет; Turkey не последняя.
    expect(verticalAt(shot, ...below(TREE.samoa, 2), 3), 'level 2').toBe(false)
    expect(verticalAt(shot, ...below(TREE.samoa, 1)), 'level 1').toBe(true)

    await showRow(TREE.marshall)
    shot = await snapshot()
    // Myanmar — последний у корня: линии уровня 1 нет.
    expect(verticalAt(shot, ...below(TREE.marshall, 1), 3), 'level 1').toBe(
      false,
    )
  })

  test('TL4: an expanded row with visible children draws a stub from below its text to the bottom edge', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    await showRow(TREE.root)
    const g = treeGeometry()
    const root = indentOf(TREE.root)
    let shot = await snapshot()
    const x = railX(root, 1, g)
    expect(verticalAt(shot, x, box(root).bottom - 3), 'stub').toBe(true)
    expect(verticalAt(shot, x, box(root).top + 3, 3), 'above the text').toBe(
      false,
    )

    // У листа отростка нет.
    await showRow(TREE.portugal)
    shot = await snapshot()
    const leaf = indentOf(TREE.portugal)
    expect(verticalAt(shot, railX(leaf, 4, g), box(leaf).bottom - 3, 3)).toBe(
      false,
    )

    // Свёрнутая строка детей не показывает — отростка нет.
    const zimbabwe = () => indentOf(TREE.zimbabwe)
    shot = await snapshot()
    expect(
      verticalAt(shot, railX(zimbabwe(), 3, g), box(zimbabwe()).bottom - 3),
    ).toBe(true)
    await humanClick(
      rowEl(TREE.zimbabwe)!.querySelector<HTMLElement>('.row-expand-button')!,
    )
    await expect.poll(() => rowEl(TREE.portugal)).toBeNull()
    shot = await snapshot()
    expect(
      verticalAt(shot, railX(zimbabwe(), 3, g), box(zimbabwe()).bottom - 3, 3),
    ).toBe(false)
  })

  test('TL5: the last child follows the current row model — after sorting the branch closes on the new last child', async () => {
    // Сёстры разной формы: у node-0-0 дети, node-0-1 — лист. Смена их порядка меняет
    // ветки по позициям строк, а не только подписи.
    const data = makeData({ shape: 'tree', count: 1, depth: 3, breadth: 2 })
    delete data[0].subRows[1].subRows
    const [withKids, leaf] = ['node-0-0', 'node-0-1']
    await render(
      <composed.RowExpandingTreeLines
        enableColumnSorting
        dataOverride={data}
      />,
    )
    await expect.poll(() => rowEl('node-0-0-1')).not.toBeNull()
    const pair = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')]
        .map(row => row.dataset.rowId!)
        .filter(id => id === withKids || id === leaf)
    expect(pair()).toEqual([withKids, leaf])
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="country"]',
    )!
    // По возрастанию или, если порядок не сменился, по убыванию — сёстры меняются местами.
    for (let click = 0; click < 2 && pair()[0] === withKids; click++) {
      await userEvent.hover(head)
      await humanClick(head.querySelector<HTMLElement>('.column-sort__button')!)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    await expect.poll(pair).toEqual([leaf, withKids])
    await showRow(withKids)
    const g = treeGeometry()
    const shot = await snapshot()
    const first = indentOf(leaf)
    expect(
      verticalAt(shot, railX(first, 1, g), box(first).bottom - 3),
      'first continues',
    ).toBe(true)
    // Ветка с детьми теперь последняя: линия уровня 1 через её детей не идёт.
    const grandchild = indentOf('node-0-0-1')
    expect(
      verticalAt(
        shot,
        railX(grandchild, 1, g),
        box(grandchild).mid + box(grandchild).height / 4,
        3,
      ),
      'last ends',
    ).toBe(false)
  })

  test('TL6: by default 1.5px lines of a 12% neutral in both themes, overlaps no darker than the line, a 20px step; the theme overrides color, width, radius, step and inset', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    await showRow(TREE.portugal)
    let g = treeGeometry()
    expect(g.width).toBe(1.5)
    expect(g.step).toBe(20)
    expect(getComputedStyle(indentOf(TREE.zimbabwe)).paddingLeft).toBe('40px')

    await inBothThemes(async () => {
      const cell = indentOf(TREE.portugal)
      const row = rowEl(TREE.portugal)!
      const color = toRgba(tokenColor('--tsr-comp-tree-line-color', row))
      const fg = toRgba(tokenColor('--tsr-sys-fg', row))
      // Цвет текста с прозрачностью 12 %.
      for (const i of [0, 1, 2])
        expect(Math.abs(color[i]! - fg[i]!)).toBeLessThanOrEqual(3)
      expect(color[3]).toBeCloseTo(0.12, 2)
      const shot = await snapshot()
      const x = railX(cell, 3, g)
      const darkest = (y: number) =>
        Math.min(
          ...[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(dx => shot.at(x + dx, y)),
        )
      // Поворот поверх сквозной линии — не темнее одной линии.
      const overlap = darkest(box(cell).top + box(cell).height * 0.25)
      const single = darkest(box(cell).bottom - 3)
      // Наложение полупрозрачных слоёв темнее одной линии на десятки уровней.
      expect(Math.abs(overlap - single)).toBeLessThanOrEqual(4)
    })

    restore = themeTokens({
      '--tsr-comp-tree-line-color': 'rgb(255, 0, 0)',
      '--tsr-comp-tree-line-width': '3px',
      '--tsr-comp-tree-line-radius': '0px',
      '--tsr-comp-tree-line-indent': '30px',
      '--tsr-comp-tree-line-inset': '10px',
    })
    await showRow(TREE.falkland)
    g = treeGeometry()
    expect(getComputedStyle(indentOf(TREE.zimbabwe)).paddingLeft).toBe('60px')
    const cell = indentOf(TREE.falkland)
    const x = railX(cell, 3, g)
    const y = box(cell).top + box(cell).height * 0.25
    const shot = await snapshot()
    // Красная полоса около 3px шириной — по покрытию сглаженной линии.
    const step = 1 / shot.scale
    let red = 0
    for (let dx = -4; dx <= 4; dx += step) {
      const [r, gg, b] = shot.rgb(x + dx, y)
      if (r! > 200) red += 1 - (gg! + b!) / 2 / r!
    }
    expect(red / shot.scale).toBeGreaterThanOrEqual(2.5)
    // Нулевой радиус — красный угол.
    const [r] = shot.rgb(x + 1, box(cell).mid)
    expect(r).toBeGreaterThan(200)
  })

  test('RE53: without the option there are no lines and the indent is unchanged', async () => {
    await render(
      <composed.RowExpandingTreeLines rowExpandingTreeLines={false} />,
    )
    await waitTree()
    await showRow(TREE.zimbabwe)
    const cell = indentOf(TREE.zimbabwe)
    expect(getComputedStyle(cell).paddingLeft).toBe('32px')
    expect(document.querySelector('[data-tree-depth]')).toBeNull()
    const g = treeGeometry()
    const shot = await snapshot()
    for (const level of [1, 2]) {
      expect(
        verticalAt(shot, railX(cell, level, g), box(cell).top + 4, 3),
        `level ${level}`,
      ).toBe(false)
    }
  })

  test('RE55: grouped rows and their children get lines by depth', async () => {
    await render(
      <composed.RowGrouping
        enableRowExpanding
        rowExpandingTreeLines
        initialGrouping={['gender']}
        initialExpanded={true}
      />,
    )
    const child = () =>
      document.querySelector<HTMLElement>('[data-tree-depth="1"]')
    await expect.poll(child).not.toBeNull()
    child()!.scrollIntoView({ block: 'center' })
    await new Promise(resolve => requestAnimationFrame(resolve))
    const cell = child()!
    const g = treeGeometry()
    const shot = await snapshot()
    expect(
      verticalAt(shot, railX(cell, 1, g), box(cell).top + box(cell).height / 4),
    ).toBe(true)
  })

  test('RE56: lines stay in the indent cell — fixed on a pinned column under horizontal scroll, and after virtualization, sorting and a page change', async () => {
    const screen = await render(
      <composed.RowExpandingTreeLines
        enableColumnPinning
        enableColumnSorting
        columnCount={30}
        containerHeight={400}
        height={300}
        maxHeight={300}
      />,
    )
    await waitTree()
    await pinFirstColumn(screen.container)
    const turn = async (id: string, level: number) => {
      const cell = indentOf(id)
      const g = treeGeometry()
      const shot = await snapshot()
      return verticalAt(
        shot,
        railX(cell, level, g),
        box(cell).top + box(cell).height / 4,
      )
    }
    await showRow(TREE.zimbabwe)
    const before = indentOf(TREE.zimbabwe).getBoundingClientRect().left
    getScroller().scrollLeft = 600
    await expect.poll(() => getScroller().scrollLeft).toBeGreaterThan(0)
    await expect
      .poll(() => indentOf(TREE.zimbabwe).getBoundingClientRect().left)
      .toBeCloseTo(before, 0)
    expect(await turn(TREE.zimbabwe, 2)).toBe(true)

    // Виртуализация: строка уходит из окна и возвращается.
    getScroller().scrollLeft = 0
    await scrollToEnd('y')
    await expect.poll(() => rowEl(TREE.zimbabwe)).toBeNull()
    getScroller().scrollTop = 0
    await expect.poll(() => rowEl(TREE.zimbabwe)).not.toBeNull()
    await expect
      .poll(
        () =>
          indentOf(TREE.zimbabwe).querySelector('[class*="skeleton"]') ?? null,
      )
      .toBeNull()
    await showRow(TREE.zimbabwe)
    expect(await turn(TREE.zimbabwe, 2)).toBe(true)

    // Сортировка.
    const sort = document.querySelector<HTMLElement>(
      '.data-grid__head-cell .column-sort__button',
    )!
    await humanClick(sort)
    await expect
      .poll(() => sort.closest('[aria-sort]')?.getAttribute('aria-sort'))
      .toMatch(/^(ascending|descending)$/)
    const deep = () =>
      document
        .querySelector('[data-tree-depth="2"]')
        ?.closest<HTMLElement>('.data-grid__body-row')?.dataset.rowId
    await expect.poll(deep).toBeTruthy()
    const id = deep()!
    await showRow(id)
    expect(await turn(id, 2)).toBe(true)
    await screen.unmount()

    // Смена страницы.
    await render(
      <composed.RowExpandingTreeLines
        enablePagination
        // Пагинация по корням: 6 корней — три страницы по два.
        paginationPageSize={2}
      />,
    )
    await waitTree()
    await humanClick(
      document.querySelector<HTMLElement>('[aria-label="Next page"]')!,
    )
    await expect.poll(() => rowEl('node-2-0')).not.toBeNull()
    await showRow('node-2-0')
    expect(await turn('node-2-0', 1)).toBe(true)
  })

  test('RE57: lines keep the cell layout and do not catch the pointer; row selection and hover show', async () => {
    // Шаг один и тот же: сравнивается раскладка, а не шаг отступа.
    restore = themeTokens({ '--tsr-comp-row-nesting-indent': '20px' })
    const plain = await render(
      <composed.RowExpandingTreeLines
        rowExpandingTreeLines={false}
        enableRowSelection
        enableSubRowSelection
      />,
    )
    await waitTree()
    const content = (cell: HTMLElement) =>
      cell
        .querySelector('.data-grid__cell-wrapper-title')!
        .getBoundingClientRect()
    const without = content(indentOf(TREE.zimbabwe))
    await plain.unmount()

    await render(
      <composed.RowExpandingTreeLines
        enableRowSelection
        enableSubRowSelection
      />,
    )
    await waitTree()
    await showRow(TREE.falkland)
    const cell = indentOf(TREE.zimbabwe)
    const lit = content(cell)
    expect([lit.left, lit.width]).toEqual([without.left, without.width])

    // В точке линии указатель достаётся ячейке, а не линии.
    const g = treeGeometry()
    const falkland = indentOf(TREE.falkland)
    const x = railX(falkland, 3, g)
    const y = box(falkland).top + box(falkland).height / 4
    const hit = document.elementFromPoint(x, y)!
    expect(hit.closest('[data-column-id]')).toBe(falkland)
    expect(getComputedStyle(hit).pointerEvents).not.toBe('none')

    const row = rowEl(TREE.falkland)!
    await humanClick(row.querySelector<HTMLElement>('.row-select-checkbox')!)
    await expect.poll(() => row.getAttribute('data-selected')).toBe('true')
    await userEvent.hover(falkland)
    const selectedHovered = tokenColor(
      '--tsr-comp-row-selected-hovered-bg',
      row,
    )
    await expect
      .poll(() => getComputedStyle(row).backgroundColor)
      .toBe(selectedHovered)
    const shot = await snapshot()
    expect(verticalAt(shot, x, y)).toBe(true)
  })

  test('RE58: a tree with lines passes axe in table and treegrid roles in both themes', async () => {
    for (const keyboard of [false, true]) {
      const screen = await render(
        <composed.RowExpandingTreeLines enableKeyboardNavigation={keyboard} />,
      )
      await waitTree()
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

  test('RE62: the theme step token changes the indent and the line step — a turn on every new step', async () => {
    restore = themeTokens({ '--tsr-comp-row-nesting-indent': '24px' })
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    await showRow(TREE.falkland)
    expect(getComputedStyle(indentOf(TREE.zimbabwe)).paddingLeft).toBe('48px')
    const g = treeGeometry()
    expect(g.step).toBe(24)
    const shot = await snapshot()
    for (const [id, level] of [
      [TREE.turkey, 1],
      [TREE.zimbabwe, 2],
      [TREE.falkland, 3],
    ] as const) {
      const cell = indentOf(id)
      expect(
        verticalAt(
          shot,
          railX(cell, level, g),
          box(cell).top + box(cell).height / 4,
        ),
        id,
      ).toBe(true)
    }
  })
})
