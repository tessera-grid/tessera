import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { ENGLISH_LABELS } from '../../../core/localization'
import { overflowColumns, overflowData } from '../../__mocks__/overflowColumns'
import { humanClick } from '../helpers'
import { composed } from '../stories'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'

// Тултип у обрезанного текста ячейки (ADR 0075, OT1–OT10). Наведение — настоящий
// указатель Playwright; узкие колонки мока `overflowColumns` обрезают длинный текст.

const LONG_NAME = 'Bartholomew Montgomery-Fitzgerald'
const SHORT_NAME = 'Bob'
const LONG_HEADER = 'Company registered name'
const LONG_FOOTER = 'Companies registered in total'
const FITTING_CITY = 'Saint Petersburg'
/** Больше задержки показа (200 мс) с запасом: тултипа нет — значит, не будет. */
const SETTLE_MS = 500

type Args = Partial<Parameters<typeof composed.DataGridPlayground>[0]>

/** Песочница ядра с узкими колонками, длинным текстом и футером. */
const OverflowGrid = (args: Args) => (
  <composed.DataGridPlayground
    columnsOverride={overflowColumns}
    dataOverride={overflowData}
    enableFooter
    containerHeight="560"
    height="460"
    maxHeight="460"
    {...args}
  />
)

const pointer = commands as unknown as {
  realDragHold: (from: object, to: object, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
}

async function renderOverflow(args: Args = {}) {
  const view = await render(<OverflowGrid {...args} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(3)
  return view
}

/** Первый текст ячейки с ровно таким содержимым. */
const title = (text: string) =>
  [
    ...document.querySelectorAll<HTMLElement>('.data-grid__cell-wrapper-title'),
  ].find(element => element.textContent === text)!

/** Тексты открытых тултипов (`data-open` у позиционера Base UI). */
const openTips = () =>
  [...document.querySelectorAll('[role="presentation"][data-open]')].map(
    element => element.textContent ?? '',
  )

const tipShown = (text: string) =>
  expect.poll(() => openTips().includes(text), { timeout: 2000 }).toBe(true)

const tipHidden = (text: string) =>
  expect.poll(() => openTips().includes(text), { timeout: 2000 }).toBe(false)

const settle = () => new Promise(resolve => setTimeout(resolve, SETTLE_MS))

const centerOf = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

/** Tab — в грид на активную ячейку шапки, вниз — на ячейку с длинным именем. */
const focusLongName = async () => {
  await userEvent.tab()
  await expect
    .poll(() => document.activeElement?.getAttribute('role'))
    .toBe('columnheader')
  await userEvent.keyboard('{ArrowDown}')
}

describe('Overflow tooltip — тултип у обрезанного текста', () => {
  test('OT1: наведение на обрезанный текст ячейки тела показывает тултип с полным текстом, у необрезанного тултипа нет', async () => {
    await renderOverflow()

    await userEvent.hover(title(LONG_NAME))
    await tipShown(LONG_NAME)

    await userEvent.hover(title(SHORT_NAME))
    await tipHidden(LONG_NAME)
    await settle()
    expect(openTips()).toEqual([])
  })

  test('OT2: обрезанный текст заголовка колонки и ячейки футера показывает тултип', async () => {
    await renderOverflow()

    await userEvent.hover(title(LONG_HEADER))
    await tipShown(LONG_HEADER)

    await userEvent.hover(title(LONG_FOOTER))
    await tipShown(LONG_FOOTER)
    await tipHidden(LONG_HEADER)
  })

  test('OT3: текст, обрезанный раскрывшейся при наведении кнопкой ячейки, показывает тултип', async () => {
    await renderOverflow({
      enableCellEditing: true,
      cellEditingCanEditCell: () => true,
    })
    const city = title(FITTING_CITY)
    expect(city.scrollWidth).toBeLessThanOrEqual(city.clientWidth)

    await userEvent.hover(city)
    await tipShown(FITTING_CITY)
    expect(city.scrollWidth).toBeGreaterThan(city.clientWidth)
  })

  test('OT4: клавиатурный фокус ячейки показывает тултип, уход фокуса и Escape прячут; без навигации тултипа нет', async () => {
    const view = await renderOverflow({ enableKeyboardNavigation: true })

    await focusLongName()
    await tipShown(LONG_NAME)

    await userEvent.keyboard('{Escape}')
    await tipHidden(LONG_NAME)

    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(openTips()).toEqual([])

    await userEvent.keyboard('{ArrowUp}')
    await tipShown(LONG_NAME)
    await userEvent.tab()
    await tipHidden(LONG_NAME)
    await view.unmount()

    await renderOverflow({ enableKeyboardNavigation: false })
    await userEvent.tab()
    await settle()
    expect(openTips()).toEqual([])
  })

  test('OT5: над кнопкой заголовка виден только её тултип', async () => {
    await renderOverflow({ enableColumnSorting: true })
    const header = title(LONG_HEADER)

    await userEvent.hover(header)
    await tipShown(LONG_HEADER)

    const button = header
      .closest('.data-grid__head-cell')!
      .querySelector<HTMLElement>('.column-sort__button')!
    await userEvent.hover(button)
    await tipShown(columnSortingLabels(ENGLISH_LABELS).sortDescending)
    expect(openTips()).not.toContain(LONG_HEADER)
  })

  test('OT6: прокрутка и нажатие кнопки мыши прячут тултип; пока кнопка зажата, тултип не показывается', async () => {
    const view = await renderOverflow({ enableKeyboardNavigation: true })

    // Прокрутка — у тултипа от фокуса: указатель не двигается и сам его не закроет.
    await focusLongName()
    await tipShown(LONG_NAME)
    scroller().scrollTop += 40
    await tipHidden(LONG_NAME)
    await view.unmount()

    await renderOverflow()
    await userEvent.hover(title(LONG_NAME))
    await tipShown(LONG_NAME)
    const long = centerOf(title(LONG_NAME))
    await pointer.realDragHold(long, long, 1)
    try {
      await tipHidden(LONG_NAME)
      // С зажатой кнопкой — на короткий текст и обратно на длинный.
      const company = centerOf(title(`Acme 1`))
      await pointer.realDragHold(company, long, 6)
      await settle()
      expect(openTips()).toEqual([])
    } finally {
      await pointer.realMouseUp()
    }
  })

  test('OT7: ячейка в правке и тач-указатель тултипа не получают', async () => {
    await renderOverflow({
      enableCellEditing: true,
      cellEditingCanEditCell: () => true,
    })
    const cell = title(LONG_NAME).closest<HTMLElement>('.data-grid__body-cell')!
    await userEvent.hover(cell)
    await humanClick(cell.querySelector<HTMLElement>('.cell__button button')!)
    await expect.poll(() => cell.querySelector('input')).not.toBeNull()
    await userEvent.hover(cell.querySelector('input')!)
    await settle()
    expect(openTips()).not.toContain(LONG_NAME)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => cell.querySelector('input')).toBeNull()

    await userEvent.hover(title(SHORT_NAME))
    title(LONG_NAME).dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }),
    )
    await settle()
    expect(openTips()).toEqual([])
  })

  test('OT8: текст ушёл из DOM — тултип исчезает', async () => {
    const view = await renderOverflow({ enableKeyboardNavigation: true })
    await focusLongName()
    await tipShown(LONG_NAME)

    // Строка с длинным именем исчезает из данных без прокрутки и без указателя.
    await view.rerender(
      <OverflowGrid
        enableKeyboardNavigation
        dataOverride={[{ id: 'only', name: 'Zoe', company: 'Acme', city: '' }]}
      />,
    )
    await tipHidden(LONG_NAME)
  })

  test('OT9: enableOverflowTooltip: false отключает тултип, без флага он включён', async () => {
    const view = await renderOverflow({ enableOverflowTooltip: false })
    await userEvent.hover(title(LONG_NAME))
    await settle()
    expect(openTips()).toEqual([])
    await view.unmount()

    await renderOverflow({ enableOverflowTooltip: undefined })
    await userEvent.hover(title(LONG_NAME))
    await tipShown(LONG_NAME)
  })

  test('OT10: открытый тултип проходит axe в обеих темах, доступное имя ячейки не меняется', async () => {
    await renderOverflow()
    const cell = title(LONG_NAME).closest<HTMLElement>('.data-grid__body-cell')!
    const describedBy = cell.getAttribute('aria-describedby')

    await userEvent.hover(title(LONG_NAME))
    await tipShown(LONG_NAME)
    expect(cell.getAttribute('aria-describedby')).toBe(describedBy)

    const popup = document.querySelector<HTMLElement>(
      '[role="presentation"][data-open]',
    )!
    await inBothThemes(async () => {
      const { violations } = await axe.run(
        { include: [popup, cell] },
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(violations).toEqual([])
    })
  })
})
