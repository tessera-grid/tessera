import axe from 'axe-core'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { getScroller, humanClick, scrollToEnd } from '../helpers'
import { composed } from '../stories'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { pinFirstColumn } from './column-pinning-helpers'

// Линии дерева (ADR 0058, RE52–RE59): вертикальные направляющие по уровням в отступе
// первой колонки. Линии проверяются по пикселям скриншота — вид, а не устройство
// стилей; перф RE60 — в `performance/scroll`.

/** Шаг отступа по умолчанию — `--tsr-comp-row-nesting-indent` (ADR 0059). */
const STEP = 16

/** Скриншот страницы как пиксели: яркость точки в CSS-координатах окна. */
const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const base64 = typeof shot === 'string' ? shot : shot.base64
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const scale = image.width / document.documentElement.clientWidth
  const pixel = (x: number, y: number) =>
    context.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
      .data
  return {
    scale,
    /** Яркость (0–255) пикселя в точке окна. */
    at: (x: number, y: number) => {
      const [r, g, b] = pixel(x, y)
      return (r! + g! + b!) / 3
    },
    rgb: (x: number, y: number) => Array.from(pixel(x, y).slice(0, 3)),
  }
}

/**
 * Видимая ячейка отступа строки данной глубины (первая пользовательская колонка):
 * целиком в видимой области прокрутки — её пиксели есть на скриншоте.
 */
const indentCell = (depth: number) => {
  const view = document
    .querySelector<HTMLElement>('.data-grid__container')
    ?.getBoundingClientRect()
  return [...document.querySelectorAll<HTMLElement>('.data-grid__body-cell')]
    .filter(
      cell => parseFloat(getComputedStyle(cell).paddingLeft) === depth * STEP,
    )
    .filter(cell => {
      const rect = cell.getBoundingClientRect()
      return (
        !!view &&
        rect.top >= view.top + 40 &&
        rect.bottom <= view.bottom - 4 &&
        rect.height > 0
      )
    })
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )[0]
}

/** Центр линии уровня k (0 — первый уровень) в ячейке отступа. */
const lineX = (cell: HTMLElement, k: number) =>
  cell.getBoundingClientRect().left + STEP / 2 + k * STEP + 0.5

const midY = (cell: HTMLElement) => {
  const rect = cell.getBoundingClientRect()
  return rect.top + rect.height / 2
}

/**
 * Линия видна: в окне ±1px вокруг её центра есть точка темнее фона рядом (в том же шаге)
 * хотя бы на 3 уровня яркости — линия по умолчанию бледная, без линии разница 0. Окно — на округление: скриншот снят не в масштабе CSS-пикселей.
 */
const lineVisible = (
  shot: Awaited<ReturnType<typeof snapshot>>,
  x: number,
  y: number,
) =>
  shot.at(x + STEP / 4, y) -
    Math.min(...[-1, -0.5, 0, 0.5, 1].map(dx => shot.at(x + dx, y))) >=
  3

const waitTree = () => expect.poll(() => indentCell(2) ?? null).not.toBeNull()

const themeTokens = (vars: Record<string, string>) => {
  const style = document.createElement('style')
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  style.textContent = `.data-grid-theme.data-grid-theme { ${body} }`
  document.head.append(style)
  return () => style.remove()
}

describe('Row expanding: tree lines', () => {
  let restore = () => {}
  afterEach(() => {
    restore()
    restore = () => {}
  })

  test('RE52: with treeLines a row of depth d draws d vertical lines in the indent, one per step, with the line tokens', async () => {
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    const cell = indentCell(3) ?? indentCell(2)!
    const depth = parseFloat(getComputedStyle(cell).paddingLeft) / STEP
    const shot = await snapshot()
    for (let k = 0; k < depth; k++) {
      expect(lineVisible(shot, lineX(cell, k), midY(cell)), `level ${k}`).toBe(
        true,
      )
    }
    // Линия — цвета токена (полупрозрачный поверх фона строки).
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--tsr-comp-tree-line-color)'
    cell.appendChild(probe)
    const token = getComputedStyle(probe).backgroundColor
    probe.remove()
    expect(getComputedStyle(cell, '::before').backgroundColor).toBe(token)
  })

  test('RE53: without the option there are no lines and the indent is unchanged', async () => {
    await render(
      <composed.RowExpandingTreeLines rowExpandingTreeLines={false} />,
    )
    await waitTree()
    const cell = indentCell(2)!
    expect(getComputedStyle(cell).paddingLeft).toBe(`${2 * STEP}px`)
    expect(document.querySelector('[data-tree-depth]')).toBeNull()
    const shot = await snapshot()
    for (const k of [0, 1]) {
      expect(lineVisible(shot, lineX(cell, k), midY(cell)), `level ${k}`).toBe(
        false,
      )
    }
  })

  test('RE54: the level line runs without gaps through adjacent deeper rows, including the row border', async () => {
    // Непрерывность, а не цвет: тёмная линия — разрыв на стыке был бы виден однозначно.
    restore = themeTokens({ '--tsr-comp-tree-line-color': 'rgb(0 0 0 / 0.4)' })
    for (const showHeaderGroups of [false, true]) {
      const screen = await render(
        <composed.RowExpandingTreeLines showHeaderGroups={showHeaderGroups} />,
      )
      await waitTree()
      // Две соседние строки глубины ≥ 1 подряд.
      const cells = [
        ...document.querySelectorAll<HTMLElement>('[data-tree-depth]'),
      ].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      )
      const [first, second] = cells.filter(
        (cell, i) =>
          cells[i + 1] &&
          Math.abs(
            cells[i + 1]!.getBoundingClientRect().top -
              cell.getBoundingClientRect().bottom,
          ) <= 1,
      ) as [HTMLElement, HTMLElement]
      const next = cells[cells.indexOf(first) + 1]!
      expect(second ?? next).toBeTruthy()
      const shot = await snapshot()
      const x = lineX(first, 0)
      const from = Math.ceil(midY(first))
      const to = Math.floor(midY(next))
      const gaps: number[] = []
      // Каждая строка пикселей скриншота: граница строки тоньше CSS-пикселя.
      for (let y = from; y <= to; y += 1 / shot.scale) {
        if (!lineVisible(shot, x, y)) gaps.push(y)
      }
      expect(gaps, `headerGroups=${showHeaderGroups}`).toEqual([])
      // Граница строки тоньше пикселя скриншота — её перекрытие проверяем по геометрии:
      // линия следующей строки начинается выше на ширину её верхней границы.
      expect(
        parseFloat(getComputedStyle(next, '::before').top) +
          parseFloat(getComputedStyle(next).borderTopWidth),
        `headerGroups=${showHeaderGroups}`,
      ).toBeCloseTo(0, 5)
      await screen.unmount()
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
    await expect.poll(() => indentCell(1) ?? null).not.toBeNull()
    const cell = indentCell(1)!
    expect(cell.dataset.treeDepth).toBe('1')
    const shot = await snapshot()
    expect(lineVisible(shot, lineX(cell, 0), midY(cell))).toBe(true)
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
    const pinned = () => indentCell(2)!
    const before = pinned().getBoundingClientRect().left
    getScroller().scrollLeft = 600
    await expect.poll(() => getScroller().scrollLeft).toBeGreaterThan(0)
    await expect
      .poll(() => pinned().getBoundingClientRect().left)
      .toBeCloseTo(before, 0)
    let shot = await snapshot()
    expect(lineVisible(shot, lineX(pinned(), 0), midY(pinned()))).toBe(true)

    // Виртуализация: строка уходит из окна и возвращается.
    getScroller().scrollLeft = 0
    await scrollToEnd('y')
    getScroller().scrollTop = 0
    await waitTree()
    await expect
      .poll(() => indentCell(2)?.querySelector('[class*="skeleton"]') ?? null)
      .toBeNull()
    shot = await snapshot()
    expect(
      lineVisible(shot, lineX(indentCell(2)!, 1), midY(indentCell(2)!)),
    ).toBe(true)

    // Сортировка.
    const sort = document.querySelector<HTMLElement>(
      '.data-grid__head-cell .column-sort__button',
    )!
    await humanClick(sort)
    await waitTree()
    shot = await snapshot()
    expect(
      lineVisible(shot, lineX(indentCell(2)!, 1), midY(indentCell(2)!)),
    ).toBe(true)
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
    const firstRow = () =>
      document
        .querySelector('.data-grid__body-row')
        ?.getAttribute('data-row-id')
    const firstBefore = firstRow()
    await humanClick(
      document.querySelector<HTMLElement>('[aria-label="Next page"]')!,
    )
    await expect.poll(firstRow).not.toBe(firstBefore)
    await expect.poll(() => indentCell(1) ?? null).not.toBeNull()
    shot = await snapshot()
    expect(
      lineVisible(shot, lineX(indentCell(1)!, 0), midY(indentCell(1)!)),
    ).toBe(true)
  })

  test('RE57: lines keep the cell layout and do not catch the pointer; row selection and hover show', async () => {
    const plain = await render(
      <composed.RowExpandingTreeLines
        rowExpandingTreeLines={false}
        enableRowSelection
        enableSubRowSelection
      />,
    )
    await waitTree()
    const content = (cell: HTMLElement) =>
      cell.firstElementChild!.getBoundingClientRect()
    const without = content(indentCell(2)!)
    await plain.unmount()

    await render(
      <composed.RowExpandingTreeLines
        enableRowSelection
        enableSubRowSelection
      />,
    )
    await waitTree()
    const cell = indentCell(2)!
    const lit = content(cell)
    expect([lit.left, lit.width]).toEqual([without.left, without.width])
    expect(getComputedStyle(cell, '::before').pointerEvents).toBe('none')

    const row = cell.closest<HTMLElement>('.data-grid__body-row')!
    await humanClick(row.querySelector<HTMLElement>('.row-select-checkbox')!)
    await expect.poll(() => row.getAttribute('data-selected')).toBe('true')
    await userEvent.hover(cell)
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--tsr-comp-row-selected-hovered-bg)'
    row.appendChild(probe)
    const selectedHovered = getComputedStyle(probe).backgroundColor
    probe.remove()
    await expect
      .poll(() => getComputedStyle(row).backgroundColor)
      .toBe(selectedHovered)
    const shot = await snapshot()
    expect(lineVisible(shot, lineX(cell, 0), midY(cell))).toBe(true)
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

  test('RE59: the theme overrides line color and width', async () => {
    restore = themeTokens({
      '--tsr-comp-tree-line-color': 'rgb(255, 0, 0)',
      '--tsr-comp-tree-line-width': '3px',
    })
    await render(<composed.RowExpandingTreeLines />)
    await waitTree()
    const cell = indentCell(2)!
    const shot = await snapshot()
    const x = lineX(cell, 0)
    const y = midY(cell)
    // Красная, и ширина красной полосы — около 3px (по умолчанию была бы 1px).
    const step = 1 / shot.scale
    let red = 0
    for (let dx = -2; dx <= 6; dx += step) {
      const [r, g, b] = shot.rgb(x + dx, y)
      if (r! > 200 && g! + b! < 120) red++
    }
    expect(red / shot.scale).toBeGreaterThanOrEqual(2)
  })

  test('RE62: the theme step token changes the indent and the line step — a line centred in every new step', async () => {
    restore = themeTokens({ '--tsr-comp-row-nesting-indent': '24px' })
    await render(<composed.RowExpandingTreeLines />)
    const cellAt = (depth: number) =>
      [...document.querySelectorAll<HTMLElement>('[data-tree-depth]')].find(
        cell => cell.dataset.treeDepth === String(depth),
      )
    await expect.poll(() => cellAt(2) ?? null).not.toBeNull()
    const cell = cellAt(2)!
    expect(getComputedStyle(cell).paddingLeft).toBe('48px')
    // Ячейка должна целиком попасть на скриншот.
    cell.scrollIntoView({ block: 'center' })
    await new Promise(resolve => requestAnimationFrame(resolve))
    const shot = await snapshot()
    const left = cell.getBoundingClientRect().left
    for (const k of [0, 1]) {
      const x = left + 12 + 24 * k + 0.5
      expect(lineVisible(shot, x, midY(cell)), `level ${k}`).toBe(true)
    }
  })
})
