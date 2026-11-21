import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { renderGrid, rowState } from '../helpers'
import { waitForGrid } from './core-helpers'
import { IconButton } from '../../../ui/IconButton'
import { INPUT_MODALITY_ATTR } from '../../../core/inputModality'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { tableLabels } from '../labels'

// Касание на экране с наведением (ADR 0231, TV3–TV4): проект `browser` — Chromium с мышью
// и наведением; палец — касание через CDP, оно оставляет «залипшее» `:hover`.

interface Point {
  x: number
  y: number
}

const touch = commands as unknown as {
  realTouchDown: (fingers: Point[]) => Promise<void>
  realTouchUp: () => Promise<void>
}

const tap = async (el: Element) => {
  const box = el.getBoundingClientRect()
  await touch.realTouchDown([
    { x: box.left + Math.min(8, box.width / 2), y: box.top + box.height / 2 },
  ])
  await touch.realTouchUp()
}

const modality = () =>
  document.documentElement.getAttribute(INPUT_MODALITY_ATTR)
const rowAt = (index: number) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index='${index}']`,
  )!
const cellOf = (row: HTMLElement, columnId: string) =>
  row.querySelector<HTMLElement>(`[data-column-id='${columnId}']`)!
const head = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id='${id}']`,
  )!
const shown = (el: Element) =>
  Number(getComputedStyle(el).opacity) === 1 &&
  el.getBoundingClientRect().width > 1
/** Верх зоны нажатия кнопки шапки: во всю высоту ячейки — далеко за её верхом. */
const zoneTop = () => {
  const button = head('firstName').querySelector('button')!
  return parseFloat(getComputedStyle(button, '::before').top) || 0
}
const outline = (el: Element) => getComputedStyle(el).outlineColor

afterEach(async () => {
  await userEvent.unhover(document.body)
})

describe('Касание на экране с наведением (ADR 0231)', () => {
  test('TV3: при касании на экране с наведением действия headerActionMenu, включая активные, — в кебабе с bubble, ручка видима, зона нажатия — во всю высоту ячейки; после мыши вид прежний', async ({
    skip,
  }) => {
    skip(server.browser !== 'chromium', 'жест касания — CDP Chromium')
    renderGrid({
      columnCount: 5,
      dataCount: 10,
      enableColumnSorting: true,
      enableColumnFiltering: true,
      enableColumnDragging: true,
      enableHeaderActionMenu: true,
    })
    await waitForGrid()
    expect(matchMedia('(hover: hover)').matches).toBe(true)
    const buttons = () =>
      Array.from(head('firstName').querySelectorAll('.cell__button--hidden'))
    const inlineActions = () =>
      head('firstName').querySelector(
        '.column-sort__button, .column-filter__button',
      )
    const kebab = () =>
      head('firstName').querySelector<HTMLElement>('[data-action-menu]')!
    expect(buttons().length).toBeGreaterThan(1)
    await userEvent.hover(cellOf(rowAt(5), 'lastName'))
    await expect.poll(() => buttons().filter(shown).length).toBe(0)
    expect(zoneTop()).toBeGreaterThan(-100)

    await tap(cellOf(rowAt(2), 'firstName'))
    expect(modality()).toBe('touch')
    await expect.poll(() => buttons().filter(b => !shown(b)).length).toBe(0)
    await expect.poll(inlineActions).toBeNull()
    expect(
      head('firstName').querySelector('.drag__handler--column'),
    ).not.toBeNull()
    expect(zoneTop()).toBeLessThan(-100)

    await tap(kebab())
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    const sort = [
      ...document.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    ].find(item =>
      item.textContent?.includes(
        columnSortingLabels(tableLabels).sortAscending,
      ),
    )!
    await tap(sort)
    await expect
      .poll(() => head('firstName').getAttribute('aria-sort'))
      .toBe('ascending')
    await expect.poll(inlineActions).toBeNull()
    await expect
      .poll(() => {
        const bubble = kebab().querySelector('[data-active-indicator]')
        return !!bubble && getComputedStyle(bubble).opacity === '1'
      })
      .toBe(true)

    await userEvent.hover(cellOf(rowAt(5), 'lastName'))
    expect(modality()).toBe('pointer')
    await expect.poll(() => buttons().filter(shown).length).toBe(1)
    expect(zoneTop()).toBeGreaterThan(-100)
  })

  test('TV4: при признаке «касание» наведение не действует: подсветка строки, контур ячейки, подсветка кнопок кита; после мыши наведение снова действует', async ({
    skip,
  }) => {
    skip(server.browser !== 'chromium', 'жест касания — CDP Chromium')
    renderGrid({ columnCount: 5, dataCount: 10 })
    await waitForGrid()
    const { container } = await render(
      <div className="data-grid-theme">
        <IconButton label="Probe">+</IconButton>
      </div>,
    )
    const kit = container.querySelector('button')!
    const kitIdle = getComputedStyle(kit).backgroundColor
    const row = rowAt(2)
    const cell = cellOf(row, 'age')
    const rowIdle = rowState(row)
    const cellIdle = outline(cell)

    // Мышь: наведение действует.
    await userEvent.hover(cell)
    await expect.poll(() => rowState(row)).not.toBe(rowIdle)
    await expect.poll(() => outline(cell)).not.toBe(cellIdle)
    await userEvent.hover(kit)
    await expect
      .poll(() => getComputedStyle(kit).backgroundColor)
      .not.toBe(kitIdle)
    await userEvent.unhover(document.body)
    await expect.poll(() => rowState(row)).toBe(rowIdle)

    // Палец: «залипшее» наведение не подсвечивает строку, ячейку и кнопку кита.
    await tap(kit)
    expect(kit.matches(':hover')).toBe(true)
    expect(modality()).toBe('touch')
    await expect.poll(() => getComputedStyle(kit).backgroundColor).toBe(kitIdle)
    await tap(cell)
    expect(cell.matches(':hover')).toBe(true)
    expect(row.matches(':hover')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(rowState(row)).toBe(rowIdle)
    expect(outline(cell)).toBe(cellIdle)

    // Мышь после пальца — наведение снова действует.
    await userEvent.hover(cellOf(rowAt(4), 'age'))
    await userEvent.hover(cell)
    expect(modality()).toBe('pointer')
    await expect.poll(() => rowState(row)).not.toBe(rowIdle)
    await expect.poll(() => outline(cell)).not.toBe(cellIdle)
  })

  test('TV5: тело, шапка, итоги, панели и поповеры таблицы — `touch-action: manipulation`; полоска ширины и ручки — `none`', async () => {
    renderGrid({
      columnCount: 5,
      dataCount: 10,
      enableFooter: true,
      enableToolbar: true,
      enableStatusBar: true,
      enableColumnVisibility: true,
      enableColumnSizing: true,
      enableRowDragging: true,
      enableColumnDragging: true,
      enableHeaderActionMenu: true,
    })
    await waitForGrid()
    /** Касание по элементу: самый строгий `touch-action` среди него и предков. */
    const effective = (el: Element) => {
      const values: string[] = []
      for (let node: Element | null = el; node; node = node.parentElement) {
        const value = getComputedStyle(node).touchAction
        if (value !== 'auto') values.push(value)
      }
      return values.includes('none')
        ? 'none'
        : values.includes('manipulation')
          ? 'manipulation'
          : 'auto'
    }
    const parts = [
      '.data-grid__body-cell',
      '.data-grid__head-cell',
      '.data-grid__footer-cell',
      '[role="toolbar"]',
      '[data-testid="data-grid-status-bar"]',
    ]
    for (const selector of parts) {
      const el = () => document.querySelector(selector)
      await expect.poll(el).not.toBeNull()
      expect(effective(el()!), selector).toBe('manipulation')
    }
    for (const selector of [
      '.resize__handler--column',
      '.data-grid__body-cell .drag__handler--column',
      '.data-grid__head-cell .drag__handler--column',
    ]) {
      const el = document.querySelector(selector)
      expect(el, selector).not.toBeNull()
      expect(effective(el!), selector).toBe('none')
    }
    const kebab =
      head('firstName').querySelector<HTMLElement>('[data-action-menu]')!
    await userEvent.click(kebab)
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    expect(effective(document.querySelector('[role="menu"]')!)).toBe(
      'manipulation',
    )
    await userEvent.keyboard('{Escape}')
  })
  test('TV9: на сенсорном экране у поля правки ячейки кнопки «Готово» и «Отмена»: «Готово» сохраняет, как Enter, «Отмена» отменяет с причиной `cancel`, как Escape; при мыши кнопок нет', async ({
    skip,
  }) => {
    skip(server.browser !== 'chromium', 'жест касания — CDP Chromium')
    const onCellEdit = vi.fn()
    const onEditCancel = vi.fn()
    renderGrid({
      columnCount: 5,
      dataCount: 10,
      enableCellEditing: true,
      onCellEdit,
      onEditCancel,
    })
    await waitForGrid()
    const labels = cellEditingLabels(tableLabels)
    const cell = () => cellOf(rowAt(2), 'age')
    const input = () => cell().querySelector('input')
    const button = (label: string) =>
      cell().querySelector<HTMLElement>(`[aria-label="${label}"]`)
    const press = async (el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      await touch.realTouchDown([at])
      await touch.realTouchUp()
    }
    const startEdit = async () => {
      // Колонка age — у правого края: ячейку в окно.
      cell().scrollIntoView({ block: 'nearest', inline: 'start' })
      await new Promise(resolve => requestAnimationFrame(resolve))
      await tap(cell())
      await expect.poll(() => button(labels.editCell)).not.toBeNull()
      await expect
        .poll(() => button(labels.editCell)!.getBoundingClientRect().width)
        .toBeGreaterThan(8)
      await press(button(labels.editCell)!)
      await expect.poll(input).not.toBeNull()
    }
    const original = cell().textContent

    await startEdit()
    await userEvent.fill(input()!, '77')
    await press(button(labels.editCancel)!)
    await expect.poll(input).toBeNull()
    expect(cell().textContent).toBe(original)
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'age', reason: 'cancel' }),
    )

    await startEdit()
    await userEvent.fill(input()!, '42')
    await press(button(labels.editDone)!)
    await expect.poll(input).toBeNull()
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    await expect.poll(() => cell().textContent).toBe('42')

    // Мышь на экране с наведением: у поля правки кнопок нет.
    await userEvent.hover(cell())
    expect(modality()).toBe('pointer')
    await userEvent.click(button(labels.editCell)!)
    await expect.poll(input).not.toBeNull()
    expect(button(labels.editDone)).toBeNull()
    expect(button(labels.editCancel)).toBeNull()
    await userEvent.keyboard('{Escape}')
  })
  test('TV10: пока правка открыта, уменьшение видимой области окна прокручивает таблицу так, что поле правки целиком в видимой части', async () => {
    const width = window.innerWidth
    const height = window.innerHeight
    renderGrid({ columnCount: 5, dataCount: 40, enableCellEditing: true })
    await waitForGrid()
    const labels = cellEditingLabels(tableLabels)
    // Нижняя видимая строка грида: клавиатура закроет её первой.
    const body = document.querySelector('.data-grid__container')!
    const bottomRow = [
      ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
    ]
      .filter(
        row =>
          row.getBoundingClientRect().bottom <=
          body.getBoundingClientRect().bottom,
      )
      .sort(
        (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top,
      )[0]!
    const cell = cellOf(bottomRow, 'age')
    cell.scrollIntoView({ block: 'nearest', inline: 'start' })
    await userEvent.hover(cell)
    await userEvent.click(
      cell.querySelector<HTMLElement>(`[aria-label="${labels.editCell}"]`)!,
    )
    await expect.poll(() => cell.querySelector('input')).not.toBeNull()
    const input = cell.querySelector('input')!
    const visibleBottom = () =>
      window.visualViewport!.offsetTop + window.visualViewport!.height
    const keyboardTop = input.getBoundingClientRect().top - 20
    expect(input.getBoundingClientRect().bottom).toBeGreaterThan(keyboardTop)
    try {
      await page.viewport(width, Math.round(keyboardTop))
      await expect
        .poll(() => input.getBoundingClientRect().bottom <= visibleBottom())
        .toBe(true)
      expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
      expect(document.activeElement).toBe(input)
    } finally {
      await page.viewport(width, height)
      await userEvent.keyboard('{Escape}')
    }
  })
})
