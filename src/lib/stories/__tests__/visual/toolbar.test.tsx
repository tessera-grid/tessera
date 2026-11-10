import type { ReactElement } from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { toolbarDemoPlugins } from '../../toolbarDemo'
import { Stories, getScroller } from '../helpers'
import { tableLabels } from '../labels'
import { dataExportLabels } from '../../../plugins/dataExport/labels'

// Рамка грида и верхний тулбар (ADR 0035, TB1–TB7, TB10–TB15). Каждый тест — одно
// требование, назван по его ID. Состояние читается из DOM/ARIA-контракта (role,
// aria-*, data-*) и вычисленных стилей, а не из хешированных классов CSS-модулей.
// TB8–TB9 — модульные (`src/lib/__tests__/toolbar.test.ts`). Порядок кнопок встроенных
// плагинов — TB17, TB18, TB20 (ADR 0051); TB16, TB19 — модульные там же.

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 12,
  dataCount: 60,
}

/** Тулбар демо-кнопок: встроенные кнопки истории выключены. */
const DEMO = {
  ...GRID,
  columnsOverride: undefined,
  dataOverride: undefined,
  enableQuickSearch: false,
  enableColumnFiltering: false,
  enableColumnVisibility: false,
  enableDataExport: false,
  extraPlugins: toolbarDemoPlugins,
}

const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"]')
const toolbarButtons = () => [
  ...toolbar()!.querySelectorAll<HTMLButtonElement>('button'),
]
const frame = () => getScroller().parentElement!
const head = () => document.querySelector<HTMLElement>('.data-grid__head')!
const rect = (el: Element) => el.getBoundingClientRect()
const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

/** Значение токена, разрешённое внутри рамки грида (там объявлена тема). */
const resolveToken = (token: string, prop = 'background-color') => {
  const probe = document.createElement('div')
  probe.style.setProperty(prop, `var(${token})`)
  frame().appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

/** Тулбар грузится лениво: ждём, пока он появится вместо заглушки. */
const mount = async (node: ReactElement) => {
  const result = await render(node)
  await expect.poll(() => toolbar()).not.toBeNull()
  return result
}

const renderToolbar = () => mount(<Stories.ToolbarPlayground {...DEMO} />)

describe('Grid frame', () => {
  test('TB1: the grid has a rounded frame from --tsr-comp-frame-* tokens; width 0 removes it', async () => {
    await render(<Stories.DataGridPlayground {...GRID} />)
    const el = frame()
    expect(read(el, 'border-top-width')).toBe('1px')
    expect(read(el, 'border-top-color')).toBe(
      resolveToken('--tsr-comp-frame-border-color'),
    )
    expect(read(el, 'border-top-left-radius')).toBe(
      resolveToken('--tsr-comp-frame-radius', 'border-top-left-radius'),
    )
    expect(read(el, 'border-top-left-radius')).not.toBe('0px')

    el.style.setProperty('--tsr-comp-frame-border-width', '0px')
    expect(read(el, 'border-top-width')).toBe('0px')
    el.style.removeProperty('--tsr-comp-frame-border-width')
  })

  test('TB2: content is clipped to the frame; the table container keeps scrolling', async () => {
    await render(<Stories.DataGridPlayground {...GRID} />)
    expect(read(frame(), 'overflow')).toBe('hidden')
    const scroller = getScroller()
    expect(read(scroller, 'overflow')).toBe('auto')
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })
})

describe('Toolbar', () => {
  test('TB3: the toolbar is labelled and stands above the table', async () => {
    await renderToolbar()
    const el = toolbar()!
    expect(el.getAttribute('aria-label')).toBe(tableLabels.toolbar)
    expect(rect(el).bottom).toBeLessThanOrEqual(rect(getScroller()).top + 0.5)
  })

  test('TB4: with enableToolbar: true the toolbar renders without buttons and keeps the same height', async () => {
    const empty = await mount(
      <Stories.ToolbarPlayground {...DEMO} extraPlugins={[]} enableToolbar />,
    )
    expect(toolbar()).not.toBeNull()
    expect(toolbarButtons()).toHaveLength(0)
    const emptyHeight = rect(toolbar()!).height
    await empty.unmount()

    await renderToolbar()
    expect(rect(toolbar()!).height).toBe(emptyHeight)
  })

  test('TB5: the toolbar is outside the scroll container — scrolling on both axes does not move it', async () => {
    await renderToolbar()
    const before = rect(toolbar()!)
    const scroller = getScroller()
    scroller.scrollTo({ top: 400, left: 300 })
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
    expect(scroller.scrollLeft).toBeGreaterThan(0)
    const after = rect(toolbar()!)
    expect([after.top, after.left, after.width]).toEqual([
      before.top,
      before.left,
      before.width,
    ])
    expect(scroller.contains(toolbar())).toBe(false)
  })

  test('TB6: one horizontal line separates the toolbar from the head — the head has no top border', async () => {
    const flat = await renderToolbar()
    expect(read(toolbar()!, 'border-bottom-width')).toBe('1px')
    expect(read(toolbar()!, 'border-bottom-color')).toBe(
      resolveToken('--tsr-comp-toolbar-divider-color'),
    )
    expect(read(head(), 'border-top-width')).toBe('0px')
    await flat.unmount()

    await mount(<Stories.ToolbarPlayground {...DEMO} headerNesting="nested" />)
    expect(head().querySelectorAll('[role="row"]').length).toBeGreaterThan(1)
    expect(read(head(), 'border-top-width')).toBe('0px')
  })

  test('TB7: toolbar buttons are pushed to the right edge', async () => {
    await renderToolbar()
    const bar = rect(toolbar()!)
    const padding = parseFloat(read(toolbar()!, 'padding-right'))
    const buttons = toolbarButtons().map(rect)
    expect(buttons.at(-1)!.right).toBeCloseTo(bar.right - padding, 0)
    expect(buttons[0].left).toBeGreaterThan(bar.left + bar.width / 2)
  })

  test('TB10: a vertical separator sits between adjacent groups; a single group has none', async () => {
    const grouped = await renderToolbar()
    const separators = [
      ...toolbar()!.querySelectorAll<HTMLElement>('[role="separator"]'),
    ]
    expect(separators).toHaveLength(1)
    expect(separators[0].getAttribute('aria-orientation')).toBe('vertical')
    // Разделитель — между последней кнопкой группы `view` и первой `data`.
    const [, settings, exportButton] = toolbarButtons().map(rect)
    expect(rect(separators[0]).left).toBeGreaterThan(settings.right)
    expect(rect(separators[0]).right).toBeLessThan(exportButton.left)
    await grouped.unmount()

    await mount(
      <Stories.ToolbarPlayground
        {...DEMO}
        extraPlugins={[toolbarDemoPlugins[0]]}
      />,
    )
    expect(toolbarButtons()).toHaveLength(2)
    expect(toolbar()!.querySelectorAll('[role="separator"]')).toHaveLength(0)
  })

  test('TB11: the toolbar is one tab stop; ←/→ loop over buttons, Home/End jump to the edges, Tab moves on to the grid', async () => {
    await renderToolbar()
    const label = () => document.activeElement?.getAttribute('aria-label')
    const [first] = toolbarButtons()
    first.focus()
    expect(
      toolbarButtons().filter(button => button.tabIndex === 0),
    ).toHaveLength(1)

    await userEvent.keyboard('{ArrowRight}')
    expect(label()).toBe('Settings')
    await userEvent.keyboard('{ArrowRight}')
    expect(label()).toBe(dataExportLabels(tableLabels).export)
    await userEvent.keyboard('{ArrowRight}')
    expect(label()).toBe('Density')
    await userEvent.keyboard('{ArrowLeft}')
    expect(label()).toBe(dataExportLabels(tableLabels).export)
    await userEvent.keyboard('{Home}')
    expect(label()).toBe('Density')
    await userEvent.keyboard('{End}')
    expect(label()).toBe(dataExportLabels(tableLabels).export)

    await userEvent.keyboard('{Tab}')
    expect(toolbar()!.contains(document.activeElement)).toBe(false)
  })

  test('TB12: with a toolbar the loading bar stays right under the head', async () => {
    // Положение полосы относительно шапки — то же, что без тулбара.
    const offsetFromHead = () =>
      rect(document.querySelector('[role="progressbar"]')!).bottom -
      rect(head()).bottom

    const plain = await render(
      <Stories.DataGridPlayground {...GRID} loading="refresh" />,
    )
    // Индикатор — после задержки показа (ADR 0094, GL5).
    await expect
      .poll(() => document.querySelector('[role="progressbar"]'))
      .not.toBeNull()
    const withoutToolbar = offsetFromHead()
    await plain.unmount()

    await mount(<Stories.ToolbarPlayground {...DEMO} loading="refresh" />)
    // Индикатор — после задержки показа (ADR 0094, GL5).
    await expect
      .poll(() => document.querySelector('[role="progressbar"]'))
      .not.toBeNull()
    expect(offsetFromHead()).toBe(withoutToolbar)
    expect(
      rect(document.querySelector('[role="progressbar"]')!).top,
    ).toBeGreaterThan(rect(toolbar()!).bottom)
  })
})

describe('ToolbarButton (F4)', () => {
  test('TB13: the button is square with rounded corners — the kit square shape and size (ADR 0098)', async () => {
    await renderToolbar()
    const button = toolbarButtons()[0]
    const size = parseFloat(
      resolveToken('--tsr-comp-toolbar-button-size', 'width'),
    )
    expect(button.offsetWidth).toBe(size)
    expect(button.offsetHeight).toBe(size)
    expect(size).toBeGreaterThanOrEqual(24)
    const radius = read(button, 'border-top-left-radius')
    expect(radius).toBe(
      resolveToken('--tsr-comp-button-radius-square', 'border-top-left-radius'),
    )
    expect(radius).not.toBe('50%')
    expect(radius).not.toBe('0px')
  })

  test('TB14: F4 state colors — rest, hover, active, disabled and focus ring', async () => {
    await renderToolbar()
    const [density, settings, exportButton] = toolbarButtons()

    expect(read(density, 'color')).toBe(
      resolveToken('--tsr-comp-control-color', 'color'),
    )
    await userEvent.hover(density)
    await expect
      .poll(() => read(density, 'background-color'))
      .toBe(resolveToken('--tsr-comp-control-hover-bg'))

    expect(settings.hasAttribute('data-active')).toBe(true)
    expect(read(settings, 'color')).toBe(
      resolveToken('--tsr-comp-control-active-color', 'color'),
    )
    // Активное — цвет и точка; фон — при наведении, как у кнопок шапки (ADR 0098).
    expect(read(settings, 'background-color')).toBe('rgba(0, 0, 0, 0)')
    await userEvent.hover(settings)
    await expect
      .poll(() => read(settings, 'background-color'))
      .toBe(resolveToken('--tsr-comp-control-active-hover-bg'))

    expect(read(exportButton, 'color')).toBe(
      resolveToken('--tsr-comp-control-disabled-color', 'color'),
    )

    density.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(settings)
    expect(read(settings, 'box-shadow')).toContain(
      resolveToken('--tsr-comp-focus-ring'),
    )
  })

  test('TB15: the label is both the tooltip and the accessible name', async () => {
    await renderToolbar()
    const density = toolbarButtons()[0]
    expect(density.getAttribute('aria-label')).toBe('Density')
    await userEvent.hover(density)
    await expect
      .poll(() => document.querySelector('[data-side]')?.textContent ?? '')
      .toContain('Density')
  })
})

describe('Toolbar button order', () => {
  const byTestId = (id: string) =>
    toolbar()!.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  const separators = () => [
    ...toolbar()!.querySelectorAll<HTMLElement>('[role="separator"]'),
  ]

  const renderBuiltIns = (enableQuickSearch = true) =>
    mount(
      <Stories.DataGridPlayground
        {...GRID}
        enableColumnVisibility
        enableColumnFiltering
        enableQuickSearch={enableQuickSearch}
        enableDataExport
      />,
    )

  test('TB17: the filter summary sits on the left right after the search field with no separator; without search it comes first on the left', async () => {
    const { unmount } = await renderBuiltIns()
    const search = rect(byTestId('quick-search'))
    const filters = rect(byTestId('filter-summary-button'))
    const columns = rect(byTestId('column-visibility-button'))
    const gap = parseFloat(read(toolbar()!, 'column-gap'))
    // Вплотную к полю поиска (зазор группы) и не наезжает на правую сторону.
    expect(filters.left - search.right).toBeCloseTo(gap, 0)
    expect(columns.left - filters.right).toBeGreaterThanOrEqual(gap)
    expect(
      separators().filter(separator => rect(separator).right < filters.left),
    ).toHaveLength(0)
    await unmount()

    await renderBuiltIns(false)
    const padding = parseFloat(read(toolbar()!, 'padding-left'))
    expect(rect(byTestId('filter-summary-button')).left).toBeCloseTo(
      rect(toolbar()!).left + padding,
      0,
    )
  })

  test('TB18: on the right — Columns, a separator, then Export', async () => {
    await renderBuiltIns()
    const bar = rect(toolbar()!)
    const columns = rect(byTestId('column-visibility-button'))
    const exportButton = rect(byTestId('export-button'))
    expect(columns.left).toBeGreaterThan(bar.left + bar.width / 2)
    const [separator] = separators().map(rect)
    expect(separators()).toHaveLength(1)
    expect(separator.left).toBeGreaterThan(columns.right)
    expect(separator.right).toBeLessThan(exportButton.left)
  })

  test('TB20: ←/→ and Home/End walk the buttons in the visual order', async () => {
    await renderBuiltIns()
    const focused = () => document.activeElement?.getAttribute('data-testid')
    byTestId('column-visibility-button').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(focused()).toBe('filter-summary-button')
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()).toBe('column-visibility-button')
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()).toBe('export-button')
    await userEvent.keyboard('{Home}')
    expect(focused()).toBe('quick-search')
    byTestId('filter-summary-button').focus()
    await userEvent.keyboard('{End}')
    expect(focused()).toBe('export-button')
  })
})
