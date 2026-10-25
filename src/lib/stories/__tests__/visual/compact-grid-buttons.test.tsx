import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import '../../../core/themeVariables/theme.css'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { SvgIcon } from '@/lib/ui/icons'
import wrapperStyles from '@/lib/grid/CellWrapperContent/CellWrapperContent.module.css'
import {
  arcTrackOf,
  humanClick,
  pendingArcOf,
  renderGrid,
  revealCellButtons,
  SEL,
} from '../helpers'
import { tableLabels } from '../labels'
import { composed, treeLinesArgs } from '../stories'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import {
  indentOf,
  railX,
  rowEl,
  showRow,
  snapshot,
  themeTokens,
  tokenPx,
  treeGeometry,
  TREE,
  verticalAt,
} from './tree-lines-helpers'

// Кнопки грида 28px, отступ ячейки 12px и подпись под грипом (ADR 0135, GZ1–GZ16).
// Размеры и положения — из раскладки и токенов темы, состояние — из ARIA и стилей.

const pointer = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

let restore = () => {}
afterEach(async () => {
  restore()
  restore = () => {}
  await pointer.forcedColors(false)
})

const icon = <SvgIcon width={16} height={16} />
const box = (el: Element) => el.getBoundingClientRect()
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `${SEL.headCell}[data-column-id="${id}"]`,
  )!
const visibleButtons = (cell: Element) =>
  [...cell.querySelectorAll<HTMLElement>('button')].filter(
    b => box(b).width > 0 && getComputedStyle(b.parentElement!).opacity !== '0',
  )
const iconOf = (button: Element) =>
  button.querySelector<SVGElement>('svg:not([data-pending-arc])')!
/** Левый край текста узла — по прямоугольнику его содержимого. */
const textLeft = (el: Element) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect().left
}
const titleOf = (cell: Element) =>
  cell.querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
const gripZone = (cell: Element) =>
  box(cell.querySelector('.resize__handler--column')!)
/**
 * Ячейка тела с кнопкой правки — колонка «Age» первой отрисованной строки: левее
 * плавающей колонки действий строки, которая лежит поверх ячеек справа.
 */
const editableCell = () =>
  document.querySelector<HTMLElement>(
    `${SEL.bodyRow} ${SEL.bodyCell}[data-column-id="age"]`,
  )!

const ALL_BUTTONS = {
  columnCount: 6,
  dataCount: 40,
  dataNesting: 'nested',
  enableColumnSorting: true,
  enableHeaderActionMenu: true,
  enableColumnSizing: true,
  enableRowExpanding: true,
  enableRowActions: true,
  enableRowActionMenu: true,
  enableCellEditing: true,
} as const

/** Колонки, в которые инлайн-кнопки заголовка помещаются без меню. */
const WIDE_COLUMNS = [
  {
    id: 'firstName',
    accessorKey: 'firstName',
    header: 'First Name',
    size: 260,
  },
  { id: 'lastName', accessorKey: 'lastName', header: 'Last Name', size: 260 },
  { id: 'age', accessorKey: 'age', header: 'Age', size: 150 },
] as never

describe('Кнопки грида 28px (ADR 0135)', () => {
  test('GZ1: кнопки ячеек, действия строки, тоггл раскрытия, кнопки и кебабы заголовка и строки — сторона --tsr-comp-grid-button-size (28px), иконка 16px; вид совпадает с зоной нажатия', async () => {
    await renderGrid(ALL_BUTTONS)
    await waitForGrid()
    const side = tokenPx('--tsr-comp-grid-button-size')
    expect(side).toBe(28)
    const iconSide = tokenPx('--tsr-comp-button-icon-size')

    const check = async (button: HTMLElement) => {
      const label = button.getAttribute('aria-label')
      const r = box(button)
      expect([r.width, r.height], label!).toEqual([side, side])
      const i = box(iconOf(button))
      expect([i.width, i.height], label!).toEqual([iconSide, iconSide])
      // Нажатие у самого края попадает в кнопку, на 2px снаружи — нет.
      // Место кнопки — на момент проверки: раскрытие сдвигает её вместе с обёрткой.
      const hit = (dx: number) => {
        const now = box(button)
        const target = document.elementFromPoint(
          now.left + dx,
          now.top + now.height / 2,
        )
        return target?.closest('button') === button
          ? 'button'
          : (target?.className.toString() ?? 'null')
      }
      await expect
        .poll(() => hit(1), { message: `${label}: край` })
        .toBe('button')
      expect(hit(-2), `${label}: снаружи`).not.toBe('button')
    }

    const head = headCell('lastName')
    await revealCellButtons(head)
    const headButtons = visibleButtons(head).filter(
      b => !b.classList.contains('drag__handler--column'),
    )
    expect(headButtons.length).toBeGreaterThan(0)
    for (const button of headButtons) await check(button)

    const cell = editableCell()
    await revealCellButtons(cell)
    const edit = cell.querySelector<HTMLElement>('[aria-label="Edit cell"]')!
    // Указатель — на раскрытой кнопке, как у пользователя, который к ней тянется.
    await userEvent.hover(edit)
    await check(edit)

    const row = cell.closest<HTMLElement>(SEL.bodyRow)!
    await userEvent.hover(row)
    const toggle = document.querySelector<HTMLElement>(
      '[aria-label="Expand row"]',
    )!
    await revealCellButtons(toggle.closest(SEL.bodyCell)!)
    await check(toggle)
    const options = row.querySelector<HTMLElement>(
      '[aria-label="Row options"]',
    )!
    await revealCellButtons(options.closest(SEL.bodyCell)!)
    await check(options)
  })

  test('GZ2: кнопки тулбара, нижней панели и поповеров, плашки Alert и Button с подписью — прежние --tsr-comp-button-size (32px), и Button внутри ячейки', async () => {
    await renderGrid({
      ...ALL_BUTTONS,
      enableColumnVisibility: true,
      enablePagination: true,
    })
    await waitForGrid()
    const side = tokenPx('--tsr-comp-button-size')
    expect(side).toBe(32)
    const outsideCells = () =>
      [
        ...document.querySelectorAll<HTMLElement>('.data-grid__icon-button'),
      ].filter(
        b => !b.closest(`${SEL.headCell}, ${SEL.bodyCell}`) && box(b).width > 0,
      )
    // Кнопки тулбара — ленивый модуль (ADR 0061): ждём кнопку «Колонки».
    await expect
      .poll(() => outsideCells().some(b => b.hasAttribute('aria-expanded')))
      .toBe(true)
    const outside = outsideCells()
    expect(outside.length).toBeGreaterThan(1)
    for (const button of outside) {
      expect(box(button).height, button.getAttribute('aria-label')!).toBe(side)
    }
    // Поповер «Колонки»: его кнопки — тоже 32px.
    const columns = outside.find(b => b.hasAttribute('aria-expanded'))!
    await userEvent.click(columns)
    await expect
      .poll(() => document.querySelector('[role="dialog"], [role="menu"]'))
      .not.toBeNull()
    const popup = document.querySelector('[role="dialog"], [role="menu"]')!
    // Кнопки кита в поповере: иконки и кнопки с подписью.
    const popupButtons = [
      ...popup.querySelectorAll<HTMLElement>(
        '.data-grid__icon-button, .data-grid__button',
      ),
    ].filter(b => box(b).height > 0)
    // Высота без трансформации: поповер раскрывается анимацией масштаба.
    expect(popupButtons.length).toBeGreaterThan(0)
    for (const button of popupButtons) {
      expect(button.offsetHeight, button.textContent!).toBe(side)
    }
    await userEvent.keyboard('{Escape}')

    // Button с подписью внутри обёртки ячейки не меняется, IconButton рядом — 28px.
    const kit = await render(
      <div className="data-grid-theme">
        <div className={wrapperStyles.cell__wrapper}>
          <Button data-testid="text">Retry</Button>
          <IconButton label="Pin">{icon}</IconButton>
        </div>
      </div>,
    )
    const text = kit.container.querySelector('[data-testid="text"]')!
    expect(box(text).height).toBe(side)
    expect(box(kit.container.querySelector('[aria-label="Pin"]')!).height).toBe(
      28,
    )
  })

  test('GZ3: тема меняет размер кнопок грида одним токеном; кнопки вне ячеек и ручки переноса не меняются', async () => {
    restore = themeTokens({ '--tsr-comp-grid-button-size': '32px' })
    await renderGrid({
      ...ALL_BUTTONS,
      enableColumnVisibility: true,
      enableColumnDragging: true,
      enableRowDragging: true,
    })
    await waitForGrid()
    const head = headCell('lastName')
    await revealCellButtons(head)
    const kebab = head.querySelector<HTMLElement>('[data-action-menu]')!
    const handle = head.querySelector<HTMLElement>('.drag__handler--column')!
    const cell = editableCell()
    await revealCellButtons(cell)
    const edit = cell.querySelector<HTMLElement>('[aria-label="Edit cell"]')!
    const rowHandle = document.querySelector<HTMLElement>(
      '[aria-label="Move row"]',
    )!
    const columns = document.querySelector<HTMLElement>(
      `[role="toolbar"] [aria-label="${tableLabels.columns}"]`,
    )!
    const sizes = () =>
      [kebab, edit, handle, rowHandle, columns].map(b => box(b).width)

    // Токен меняет кнопки шапки и тела; ручки и тулбар — прежние.
    expect(sizes()).toEqual([32, 32, 24, 24, 32])

    restore()
    restore = () => {}
    await expect.poll(sizes).toEqual([28, 28, 24, 24, 32])
  })

  test('GZ4: иконка кнопки у края стоит на линии текста соседних ячеек; справа в заголовке колонки с грипом кнопка не заходит в зону грипа — при любом наборе кнопок', async () => {
    let screen = await renderGrid({ ...ALL_BUTTONS, enableColumnSizing: false })
    await waitForGrid()
    const gap = tokenPx('--tsr-comp-head-grip-gap')
    const cell = editableCell()
    await revealCellButtons(cell)
    const c = box(cell)
    const pencil = box(iconOf(cell.querySelector('[aria-label="Edit cell"]')!))
    const text = textLeft(titleOf(cell)) - c.left
    expect(c.right - pencil.right).toBeCloseTo(text, 0)
    // Заголовок без грипа: иконка последней кнопки — на линии текста.
    let head = headCell('lastName')
    await revealCellButtons(head)
    const last = visibleButtons(head).at(-1)!
    expect(box(head).right - box(iconOf(last)).right).toBeCloseTo(text, 0)
    await screen.unmount()

    // С грипом: кебаб (грип перед ним) и инлайн-кнопки (грип после них) — левее зоны
    // на промежуток до грипа.
    for (const args of [
      { ...ALL_BUTTONS },
      {
        ...ALL_BUTTONS,
        enableColumnPinning: true,
        enableRowGrouping: true,
        enableHeaderActionMenu: false,
        columnsOverride: WIDE_COLUMNS,
      },
    ]) {
      screen = await renderGrid(args)
      await waitForGrid()
      head = headCell('lastName')
      await revealCellButtons(head)
      const edge = visibleButtons(head).at(-1)!
      expect(
        gripZone(head).left - box(edge).right,
        edge.getAttribute('aria-label')!,
      ).toBeCloseTo(gap, 0)
      await screen.unmount()
    }
  })

  test('GZ7: при мыши цели заголовка и строки — зона нажатия не меньше 24×24, зоны соседей и грипов не пересекаются (касание — TU11)', async () => {
    await renderGrid({
      ...ALL_BUTTONS,
      enableColumnDragging: true,
      enableRowDragging: true,
      enableRowSelection: true,
    })
    await waitForGrid()
    const overlap = (a: DOMRect, b: DOMRect) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
    const head = headCell('lastName')
    await revealCellButtons(head)
    const previous = head.previousElementSibling!
    const targets = [
      ...visibleButtons(head).map(box),
      gripZone(head),
      gripZone(previous),
    ]
    for (const r of targets.slice(0, -2)) {
      expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(24)
    }
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        expect(overlap(targets[i]!, targets[j]!), `${i}×${j}`).toBe(false)
      }
    }
    const row = editableCell().closest<HTMLElement>(SEL.bodyRow)!
    await userEvent.hover(row)
    const rowTargets = visibleButtons(row).map(box)
    for (const r of rowTargets) {
      expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(24)
    }
    for (let i = 0; i < rowTargets.length; i++) {
      for (let j = i + 1; j < rowTargets.length; j++) {
        expect(
          overlap(rowTargets[i]!, rowTargets[j]!),
          `строка ${i}×${j}`,
        ).toBe(false)
      }
    }
  })
})

describe('Вместимость, служебные колонки и состояния (ADR 0135)', () => {
  test('GZ6: ширина колонок выбора и раскрытия — кнопка грида плюс 2 × 4px из темы; тема в px, rem и em меняет ширину', async () => {
    const mount = async () => {
      const screen = await render(
        <composed.DataGridPlayground
          containerHeight={600}
          height={500}
          columnCount={4}
          dataCount={20}
          dataNesting="nested"
          enableRowSelection
          enableRowExpanding
        />,
      )
      await waitForGrid()
      await new Promise(resolve => setTimeout(resolve, 300))
      const service = [
        ...document.querySelectorAll<HTMLElement>(SEL.headCell),
      ].slice(0, 2)
      const widths = service.map(cell => Math.round(box(cell).width))
      widths.push(
        Math.round(
          box(document.querySelector('button.row-expand-button')!).width,
        ),
      )
      await screen.unmount()
      return widths
    }
    expect(await mount()).toEqual([36, 36, 28])
    // `em` — от кегля кнопки: ширина колонок следует кнопке, какой она вышла.
    for (const size of ['32px', '2rem', '2.5em']) {
      restore = themeTokens({ '--tsr-comp-grid-button-size': size })
      const [select, expand, toggle] = await mount()
      expect(toggle, size).not.toBe(28)
      expect([select, expand], size).toEqual([toggle! + 8, toggle! + 8])
      restore()
      restore = () => {}
    }
  })

  test('GZ8: дуга ожидания и кольцо фокуса — по контуру кнопки 28px; кольцо фокуса в покое не заходит на соседнюю кнопку заголовка', async () => {
    // Дуга — средняя линия на половину толщины внутрь от края кнопки 28px.
    const kit = await render(
      <div className="data-grid-theme" style={{ padding: 24 }}>
        <div className={wrapperStyles.cell__wrapper}>
          <IconButton label="Load" pending>
            {icon}
          </IconButton>
        </div>
      </div>,
    )
    const load = kit.container.querySelector<HTMLElement>(
      '[aria-label="Load"]',
    )!
    expect(box(load).width).toBe(28)
    const ring = tokenPx('--tsr-comp-pending-ring-width')
    const track = arcTrackOf(pendingArcOf(load)!)
    expect(track.getBBox().width).toBeCloseTo(28 - ring, 1)
    await kit.unmount()

    // Кольцо фокуса покоя — тень на его толщину снаружи кнопки: до соседа не доходит.
    await renderGrid({
      columnCount: 4,
      dataCount: 10,
      enableColumnSizing: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableRowGrouping: true,
    })
    await waitForGrid()
    const head = headCell('lastName')
    await revealCellButtons(head)
    const buttons = visibleButtons(head).filter(
      b => !b.classList.contains('drag__handler--column'),
    )
    expect(buttons.length).toBeGreaterThan(1)
    const [first, second] = buttons as [HTMLElement, HTMLElement]
    first.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(second)
    expect(second.matches(':focus-visible')).toBe(true)
    const width = tokenPx('--tsr-comp-focus-ring-width')
    expect(getComputedStyle(second).boxShadow).toContain(
      `0px 0px 0px ${width}px`,
    )
    expect(box(second).left - box(first).right).toBeGreaterThanOrEqual(width)
  })

  test('GZ9: бабл включённой кнопки и точка отказа помещаются в кнопку 28px и не обрезаются ячейкой', async () => {
    const screen = await render(
      <div className="data-grid-theme" style={{ padding: 24 }}>
        <div
          className="data-grid__body-cell"
          style={{ width: 160, height: 50, display: 'flex' }}
        >
          <div className={wrapperStyles.cell__wrapper}>
            <span style={{ flex: 1 }}>Text</span>
            <span className="cell__button">
              <IconButton label="Failed" failure="Failed: offline">
                {icon}
              </IconButton>
            </span>
            <span className="cell__button">
              <IconButton label="Sorted, 3" active count={3}>
                {icon}
              </IconButton>
            </span>
          </div>
        </div>
      </div>,
    )
    const wrapper = screen.container.querySelector(
      `.${wrapperStyles.cell__wrapper}`,
    )!
    const failed = screen.container.querySelector('[aria-label="Failed"]')!
    const dot = failed.querySelector('[data-failure-indicator]')!
    await expect.poll(() => getComputedStyle(dot).opacity).toBe('1')
    const inside = (inner: DOMRect, outer: DOMRect) =>
      inner.left >= outer.left - 0.5 &&
      inner.right <= outer.right + 0.5 &&
      inner.top >= outer.top - 0.5 &&
      inner.bottom <= outer.bottom + 0.5
    expect(inside(box(dot), box(failed)), 'точка в кнопке').toBe(true)
    const sorted = screen.container.querySelector('[aria-label="Sorted, 3"]')!
    const bubble = sorted.querySelector('[data-active-indicator]')!
    await expect.poll(() => getComputedStyle(bubble).opacity).toBe('1')
    expect(inside(box(bubble), box(wrapper)), 'бабл в ячейке').toBe(true)
  })

  test('GZ10: с тогглом 28px в колонке 36px линии дерева на прежних местах — под началом текста родителя, тоггл — по центру колонки', async () => {
    await render(<composed.RowExpandingPlayground {...treeLinesArgs} />)
    await expect.poll(() => rowEl(TREE.zimbabwe)).not.toBeNull()
    await showRow(TREE.falkland)
    const g = treeGeometry()
    const cell = indentOf(TREE.falkland)
    const x = railX(cell, 3, g)
    const parentText = textLeft(
      indentOf(TREE.zimbabwe).querySelector('.data-grid__cell-wrapper-title')!,
    )
    expect(Math.abs(x - parentText)).toBeLessThanOrEqual(1)
    const shot = await snapshot()
    const r = box(cell)
    expect(verticalAt(shot, x, r.top + r.height * 0.25)).toBe(true)

    const toggle = rowEl(TREE.zimbabwe)!.querySelector<HTMLElement>(
      '[aria-label="Collapse row"], [aria-label="Expand row"]',
    )!
    const column = box(toggle.closest(SEL.bodyCell)!)
    const t = box(toggle)
    expect(t.width).toBe(28)
    expect(column.width).toBe(36)
    expect(t.left + t.width / 2).toBeCloseTo(column.left + column.width / 2, 0)
  })

  test('GZ11: axe с color-contrast для кнопок 28px в обеих темах; в forced-colors и повышенном контрасте кнопки те же 28px', async () => {
    const screen = await renderGrid(ALL_BUTTONS)
    await waitForGrid()
    await revealCellButtons(headCell('lastName'))
    await inBothThemes(async () => {
      const result = await axe.run(
        document.querySelector<HTMLElement>('.data-grid__container')!,
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(result.violations).toEqual([])
    })
    // Стороны кнопок заголовка и кнопки правки ячейки.
    const sides = async () => {
      const head = headCell('lastName')
      await revealCellButtons(head)
      const headSides = new Set(
        visibleButtons(head)
          .filter(b => !b.classList.contains('drag__handler--column'))
          .map(b => box(b).width),
      )
      const cell = editableCell()
      await revealCellButtons(cell)
      return {
        head: headSides,
        body: box(cell.querySelector('[aria-label="Edit cell"]')!).width,
      }
    }
    const expected = { head: new Set([28]), body: 28 }
    await pointer.forcedColors(true)
    expect(await sides()).toEqual(expected)
    await pointer.forcedColors(false)
    await screen.unmount()

    await renderGrid({ ...ALL_BUTTONS, contrast: 'more' })
    await waitForGrid()
    expect(await sides()).toEqual(expected)
  })
})

describe('Ряд кнопок заголовка с открытым поповером (ADR 0135)', () => {
  test('GZ16: открытые мини-меню, панель и кебаб кнопки заголовка, меню ручки и грипа не сдвигают подпись и кнопки заголовка и не прячут кнопки, пока указатель на поповере', async () => {
    const popup = () => document.querySelector('[role="menu"], [role="dialog"]')
    const GRIP = '.resize__handler--column'
    /**
     * Указатель — в центр элемента. Элемент портала vitest адресовать не умеет: мишень
     * с `id` поверх него, как у `parkPointer`, после наведения убирается.
     */
    const pointAt = async (el: Element) => {
      const r = box(el)
      const target = document.createElement('div')
      target.id = 'gz16-pointer'
      target.style.cssText = `position:fixed;left:${r.left + r.width / 2 - 2}px;top:${r.top + r.height / 2 - 2}px;width:4px;height:4px;z-index:2147483647`
      document.body.appendChild(target)
      await userEvent.hover(target)
      target.remove()
    }
    /**
     * Левые края подписи и видимых кнопок от края заголовка: фокус на грипе у края окна
     * докручивает грид, ряд при этом стоит.
     */
    const layout = (head: HTMLElement) =>
      [titleOf(head), ...visibleButtons(head)].map(el =>
        Math.round(box(el).left - box(head).left),
      )
    const check = async (head: HTMLElement, selector: string, name: string) => {
      await revealCellButtons(head)
      // Наведение догружает модуль меню (ADR 0061): заглушку сменяет кнопка с меню.
      const trigger = () => head.querySelector<HTMLElement>(selector)!
      await expect
        .poll(
          () => trigger().hasAttribute('aria-haspopup') || selector === GRIP,
          { message: `${name}: кнопка с меню` },
        )
        .toBe(true)
      const before = layout(head)
      await humanClick(trigger())
      await expect.poll(popup, { message: `${name}: открыт` }).not.toBeNull()
      expect(layout(head), name).toEqual(before)
      // Указатель уходит с заголовка на поповер: наведения на заголовке больше нет.
      await pointAt(popup()!)
      expect(head.matches(':hover'), `${name}: наведение`).toBe(false)
      await expect
        .poll(() => layout(head), { message: `${name}: указатель на поповере` })
        .toEqual(before)
      // Кнопки не гаснут: переход прозрачности не стартовал.
      expect(
        visibleButtons(head).every(
          b => getComputedStyle(b.parentElement!).opacity === '1',
        ),
        `${name}: видны`,
      ).toBe(true)
      await userEvent.keyboard('{Escape}')
      await expect.poll(popup, { message: `${name}: закрыт` }).toBeNull()
    }

    const screen = await renderGrid({
      columnCount: 4,
      dataCount: 10,
      enableColumnSizing: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableColumnFiltering: true,
      enableHeaderActionMenu: false,
      // У колонки с фильтром — кнопка панели фильтра.
      columnsOverride: (WIDE_COLUMNS as unknown as object[]).map(column =>
        (column as { id: string }).id === 'lastName'
          ? { ...column, filter: { type: 'text' } }
          : column,
      ) as never,
    })
    await waitForGrid()
    let head = headCell('lastName')
    await check(head, '.column-pin__button', 'мини-меню закрепления')
    await check(head, '.column-filter__button', 'панель фильтра')
    await check(head, GRIP, 'меню грипа')
    await screen.unmount()

    await renderGrid({
      ...ALL_BUTTONS,
      enableColumnDragging: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()
    head = headCell('lastName')
    await check(head, '[data-action-menu]', 'кебаб')
    await check(head, '.drag__handler--column', 'меню ручки')
  })
})

describe('Отступ ячейки и подпись под грипом (ADR 0135)', () => {
  test('GZ13: горизонтальный отступ содержимого ячеек шапки, тела и футера — 12px; вертикаль линий дерева — под началом текста ячейки', async () => {
    await renderGrid({ columnCount: 4, dataCount: 10, enableFooter: true })
    await waitForGrid()
    const padding = tokenPx('--tsr-comp-cell-content-padding-x')
    expect(padding).toBe(12)
    const wrappers = [
      document.querySelector(
        `${SEL.headCell} .data-grid__cell-wrapper-content`,
      ),
      document.querySelector(
        `${SEL.bodyCell} .data-grid__cell-wrapper-content`,
      ),
      document.querySelector(
        '.data-grid__footer-cell .data-grid__cell-wrapper-content',
      ),
    ]
    wrappers.forEach((wrapper, i) => {
      expect(wrapper, `обёртка ${i}`).not.toBeNull()
      const style = getComputedStyle(wrapper!)
      expect(style.paddingLeft, `слева ${i}`).toBe(`${padding}px`)
    })
    expect(tokenPx('--tsr-comp-tree-line-inset')).toBe(padding)
  })

  test('GZ14: подпись колонки с грипом заходит под зону до 4px от края, кнопки — нет; конец подписи — в прозрачность маской; затемнение у черты; между кнопками — --tsr-comp-head-button-gap', async () => {
    await renderGrid({
      columnCount: 4,
      dataCount: 10,
      enableColumnSizing: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
      enableRowGrouping: true,
      columnsOverride: WIDE_COLUMNS,
    })
    await waitForGrid()
    const head = headCell('lastName')
    const title = titleOf(head)
    // В покое: подпись — до 4px от края (скрытые кнопки промежутков не занимают), под
    // зоной грипа, маска на её конце.
    expect(box(head).right - box(title).right).toBeCloseTo(
      tokenPx('--tsr-comp-drag-handle-inset'),
      0,
    )
    expect(box(title).right).toBeGreaterThan(gripZone(head).left)
    expect(getComputedStyle(title).maskImage).toContain('linear-gradient')

    await revealCellButtons(head)
    const buttons = visibleButtons(head)
    // Кнопки — левее зоны, между ними — промежуток кнопок.
    expect(box(buttons.at(-1)!).right).toBeLessThan(gripZone(head).left)
    const gap = tokenPx('--tsr-comp-head-button-gap')
    for (let i = 1; i < buttons.length; i++) {
      expect(box(buttons[i]!).left - box(buttons[i - 1]!).right).toBeCloseTo(
        gap,
        0,
      )
    }
    // Раскрытые кнопки — подпись кончается у них, маски нет.
    expect(getComputedStyle(title).maskImage).toBe('none')
    // У черты — затемнение без краёв, цветом тени грипа.
    const grip = head.querySelector('.resize__handler--column')!
    const shade = getComputedStyle(grip, '::before')
    expect(shade.backgroundImage).toMatch(/^linear-gradient/)
    expect(parseFloat(shade.width)).toBe(
      tokenPx('--tsr-comp-resize-handler-width') / 2 +
        tokenPx('--tsr-comp-head-grip-gap'),
    )
    // В forced-colors затемнения нет.
    await pointer.forcedColors(true)
    expect(getComputedStyle(grip, '::before').display).toBe('none')
  })
})
