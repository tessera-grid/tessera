import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import {
  PIN_ICON_SIZE,
  BODY_CELL,
  PIN_BUTTON,
  DATA_HEAD_CELL,
  LEFT_PINNED_HEAD,
  renderColumnPinning,
  scrollerOf,
  waitForBodyText,
  renderedDataCells,
  pinButtonOf,
  hiddenWrapperOf,
  revealPin,
  pinFirstColumn,
} from './column-pinning-helpers'
import { composed } from './column-pinning-helpers'
import { luminance, toRgba } from './a11y-helpers'
import { parkPointer } from '../pointer'

// CP1–CP12: кнопка, переключение и sticky-рендер закрепления.
// Каждое требование — отдельный тест с ID из таблицы требований
// docs/decisions/0011-column-pinning.md (правило именования — ADR 0009).
// Story ColumnPinning переполнена по обеим осям — у sticky-требований (CP10–CP12)
// есть реальная горизонтальная прокрутка. CSS `:hover` (CP5) и тултип Base UI (CP6)
// требуют доверенного ввода браузера, остальное — синтетического.
// Селекторы и хелперы — column-pinning-helpers.tsx.

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the sticky requirements (CP10–CP12) from
// silently passing when the grid doesn't actually overflow horizontally.

describe('Column Pinning — setup guard', () => {
  test('ColumnPinning story overflows on both axes (feeds CP10–CP12)', async () => {
    const scroller = scrollerOf(await renderColumnPinning())
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })
})

// --- Requirements (CP1–CP12) --------------------------------------------------

describe('Column Pinning — requirements', () => {
  test('CP1: the plugin is inert without `enableColumnPinning`', async () => {
    const container = await renderColumnPinning({ enableColumnPinning: false })
    // No affordance and nothing sticky when the feature is off.
    expect(container.querySelector(PIN_BUTTON)).toBeNull()
    expect(container.querySelector(LEFT_PINNED_HEAD)).toBeNull()
    expect(
      container.querySelector(`${BODY_CELL}[data-cell-pinned='left']`),
    ).toBeNull()
  })

  test('CP2: each pinnable data column gets a pin button in its header', async () => {
    const container = await renderColumnPinning()
    const dataCells = renderedDataCells(container)
    expect(dataCells.length).toBeGreaterThan(0)
    // Every rendered data column carries exactly one pin toggle.
    expect(
      container.querySelectorAll(`${DATA_HEAD_CELL} ${PIN_BUTTON}`).length,
    ).toBe(dataCells.length)
  })

  test('CP3: the pin icon is 16×16', async () => {
    const container = await renderColumnPinning()
    const svg = container.querySelector<HTMLElement>(`${PIN_BUTTON} svg`)!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${PIN_ICON_SIZE}px`)
    expect(style.height).toBe(`${PIN_ICON_SIZE}px`)
  })

  test('CP4: the pin button is hidden (opacity 0) until the header is hovered', async () => {
    const container = await renderColumnPinning()
    // An unpinned column's toggle: hidden wrapper, not yet active.
    const button = pinButtonOf(renderedDataCells(container)[0])
    const wrapper = hiddenWrapperOf(button)
    expect(wrapper.getAttribute('data-button-active')).toBe('false')
    expect(getComputedStyle(wrapper).opacity).toBe('0')
  })

  test('CP5: the pin button is revealed on header hover', async () => {
    const container = await renderColumnPinning()
    const cell = renderedDataCells(container)[0]
    const wrapper = hiddenWrapperOf(pinButtonOf(cell))

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the cell.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  })

  test('CP6: the tooltip reads "pin" before pinning and "unpin" after', async () => {
    const container = await renderColumnPinning()
    const cell = renderedDataCells(container)[0]

    // Before pinning: hovering the cell then its trigger surfaces the
    // "Pin column" tooltip (Base UI renders the popup in a body portal after
    // its open delay).
    await userEvent.hover(cell)
    const button = pinButtonOf(cell)
    await userEvent.hover(button)
    expect(await waitForBodyText('Pin column')).toBe(true)

    // Pin it, then the same trigger's tooltip flips to "Unpin column".
    await userEvent.click(button)
    await expect
      .poll(() => container.querySelector(LEFT_PINNED_HEAD) !== null)
      .toBe(true)
    const pinnedButton = pinButtonOf(
      container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!,
    )
    // Move the pointer away first so re-hovering the (already-hovered) trigger
    // fires a fresh enter and re-opens the tooltip with its flipped label.
    await userEvent.hover(renderedDataCells(container)[3])
    await userEvent.hover(pinnedButton)
    expect(await waitForBodyText('Unpin column')).toBe(true)
  })

  test('CP7: clicking pins the column left; clicking again unpins it', async () => {
    const container = await renderColumnPinning()

    const pinnedCell = await pinFirstColumn(container)
    expect(pinnedCell.getAttribute('data-cell-pinned')).toBe('left')

    // The pinned button stays visible (data-button-active) — unpin with one click.
    await userEvent.click(pinButtonOf(pinnedCell))
    await expect
      .poll(() => container.querySelector(LEFT_PINNED_HEAD) === null)
      .toBe(true)
  })

  test('CP8: a pinned toggle highlights its icon with the accent colour, not a rotation', async () => {
    const container = await renderColumnPinning()
    const pinnedCell = await pinFirstColumn(container)
    const pinnedButton = pinButtonOf(pinnedCell)

    expect(
      hiddenWrapperOf(pinnedButton).getAttribute('data-button-active'),
    ).toBe('true')

    // The pinned toggle switches to `--tsr-comp-control-active-color`, so its
    // colour differs from an unpinned column's toggle…
    const plainCell = renderedDataCells(container).find(
      cell => cell.getAttribute('data-cell-pinned') !== 'left',
    )!
    const plainButton = await revealPin(plainCell)
    expect(getComputedStyle(pinnedButton).color).not.toBe(
      getComputedStyle(plainButton).color,
    )

    // …while the icon itself stays upright (no `rotate` transform).
    const svg = pinnedButton.querySelector<HTMLElement>('svg')!
    expect(getComputedStyle(svg).rotate).toBe('none')
  })

  test('CP9: toggling pin calls the `onTogglePin` hook with the new flag', async () => {
    const onTogglePin = vi.fn()
    const container = await renderColumnPinning({ onTogglePin })

    const pinnedCell = await pinFirstColumn(container)
    expect(onTogglePin).toHaveBeenLastCalledWith(true)

    await userEvent.click(pinButtonOf(pinnedCell))
    await expect.poll(() => onTogglePin).toHaveBeenLastCalledWith(false)
  })

  test('CP10: a pinned cell is position:sticky offset by getStart("left")', async () => {
    const container = await renderColumnPinning()
    await pinFirstColumn(container)

    // Both the header and the body cells of the pinned column go sticky.
    const headCell = container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!
    const bodyCell = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-cell-pinned='left']`,
    )!
    expect(getComputedStyle(headCell).position).toBe('sticky')
    expect(getComputedStyle(bodyCell).position).toBe('sticky')
    // First pinned column sits flush at the left edge (getStart('left') === 0).
    expect(getComputedStyle(headCell).left).toBe('0px')
    expect(getComputedStyle(bodyCell).left).toBe('0px')
  })

  test('CP11: a pinned cell keeps a background and stays put while scrolling', async () => {
    const container = await renderColumnPinning()
    await pinFirstColumn(container)
    const scroller = scrollerOf(container)
    const bodyCell = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-cell-pinned='left']`,
    )!

    // A pinned cell paints an opaque background so scrolled content can't bleed
    // through, and carries the pinned stacking layer. Its background-color
    // transitions in, so poll until it settles to an opaque colour.
    await expect
      .poll(() => {
        const bg = getComputedStyle(bodyCell).backgroundColor
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      })
      .toBe(true)
    expect(Number(getComputedStyle(bodyCell).zIndex)).toBeGreaterThan(0)

    // It stays glued to the left edge across a horizontal scroll.
    const leftBefore = bodyCell.getBoundingClientRect().left
    scroller.scrollLeft = Math.min(
      600,
      scroller.scrollWidth - scroller.clientWidth,
    )
    await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)
    expect(
      Math.abs(bodyCell.getBoundingClientRect().left - leftBefore),
    ).toBeLessThan(2)
  })

  test('CP12: the last left-pinned column carries a right divider border', async () => {
    const container = await renderColumnPinning()
    const pinnedCell = await pinFirstColumn(container)

    // Only one left-pinned column → it is the last one, so it gets the border.
    expect(pinnedCell.getAttribute('data-cell-last-left-pinned')).toBe('true')
    const border = getComputedStyle(pinnedCell).borderRightWidth
    expect(parseFloat(border)).toBeGreaterThan(0)
  })

  test('CP28: in both themes a pinned cell is tinted the same way against its row (even and odd), and the pinned header matches the header', async () => {
    const lum = (el: Element) =>
      luminance(toRgba(getComputedStyle(el).backgroundColor))
    for (const theme of ['light', 'dark'] as const) {
      const screen = await render(
        <div className={theme === 'dark' ? 'dark' : undefined}>
          <composed.ColumnPinning />
        </div>,
      )
      await expect
        .poll(() => document.querySelectorAll(PIN_BUTTON).length)
        .toBeGreaterThan(0)
      await userEvent.click(
        document.querySelectorAll<HTMLElement>(PIN_BUTTON)[0],
      )
      await expect
        .poll(() =>
          document.querySelector(`${BODY_CELL}[data-cell-pinned='left']`),
        )
        .not.toBeNull()
      // Курсор вне грида: hover заголовка и строки меняет их фон.
      await parkPointer()

      const rows = [...document.querySelectorAll('.data-grid__body-row')]
      const pinned = (row: Element) =>
        row.querySelector(`${BODY_CELL}[data-cell-pinned='left']`)!
      const even = lum(pinned(rows[0])) - lum(rows[0])
      const odd = lum(pinned(rows[1])) - lum(rows[1])
      // Тон текста: в светлой теме темнее строки, в тёмной — светлее; одинаково у чётных и нечётных.
      const sign = theme === 'dark' ? 1 : -1
      expect(Math.sign(even), `${theme} even`).toBe(sign)
      expect(Math.sign(odd), `${theme} odd`).toBe(sign)

      const head = document.querySelector(LEFT_PINNED_HEAD)!
      const probe = document.createElement('div')
      probe.className =
        theme === 'dark' ? 'data-grid-theme dark' : 'data-grid-theme'
      probe.style.backgroundColor = 'var(--tsr-comp-head-bg)'
      document.body.appendChild(probe)
      const headBg = getComputedStyle(probe).backgroundColor
      probe.remove()
      await expect
        .poll(() => getComputedStyle(head).backgroundColor, {
          message: `${theme} header`,
        })
        .toBe(headBg)
      await screen.unmount()
    }
  })
})
