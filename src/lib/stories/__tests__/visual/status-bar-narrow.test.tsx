import axe from 'axe-core'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { pagination, rowSelection } from '../../../plugins'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { nextFrame, waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'
import { paginationLabels } from '../../../plugins/pagination/labels'

// Нижняя панель на узкой ширине (ADR 0038, SB7–SB13). Ширина задаётся обёрткой грида
// напрямую, без перерисовки React; вид панели — атрибут `data-status-bar-layout`.

const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: `Row ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
}))

let cellRenders = 0

const COLUMNS = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 120,
    cell: (info: { getValue: () => unknown }) => {
      cellRenders += 1
      return String(info.getValue())
    },
  },
  { id: 'city', accessorKey: 'city', header: 'City', size: 120 },
]

const Grid = ({
  withStatusBar = true,
  localization,
  extra = [],
}: {
  withStatusBar?: boolean
  localization?: Record<string, unknown>
  extra?: unknown[]
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      ...(withStatusBar
        ? [rowSelection({ selectedCount: true }), pagination()]
        : [rowSelection()]),
      ...extra,
    ] as never,
  })
  return (
    <div data-testid="frame-host" style={{ width: 900, height: 420 }}>
      <DataGrid table={table as never} localization={localization as never} />
    </div>
  )
}

const host = () =>
  document.querySelector<HTMLElement>('[data-testid="frame-host"]')!
const bar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')!
const layout = () => bar().getAttribute('data-status-bar-layout')
const frame = () => bar().parentElement!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

/** Ширина рамки грида — через ширину обёртки (рамка занимает её целиком). */
const setFrameWidth = async (width: number) => {
  host().style.width = `${width}px`
  for (let i = 0; i < 4; i++) await nextFrame()
}

const selectAll = async () => {
  await userEvent.click(
    document.querySelector<HTMLElement>('.data-grid__head [role="checkbox"]')!,
  )
  await expect
    .poll(
      () =>
        document.querySelector('[data-testid="selected-rows-count"]')
          ?.textContent,
    )
    .toBeTruthy()
}

/** Каждый контрол панели внутри рамки и получает нажатие в своём центре. */
const controlsReachable = () => {
  const box = frame().getBoundingClientRect()
  const controls = [...bar().querySelectorAll<HTMLElement>('button')]
  expect(controls.length).toBeGreaterThan(4)
  for (const control of controls) {
    const r = control.getBoundingClientRect()
    const name = control.getAttribute('aria-label') ?? control.textContent
    expect(r.left, `${name}`).toBeGreaterThanOrEqual(box.left - 0.5)
    expect(r.right, `${name}`).toBeLessThanOrEqual(box.right + 0.5)
    expect(r.top, `${name}`).toBeGreaterThanOrEqual(box.top - 0.5)
    expect(r.bottom, `${name}`).toBeLessThanOrEqual(box.bottom + 0.5)
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    )
    expect(control.contains(hit), `${name}`).toBe(true)
  }
}

/** Ширина, на которой панель впервые входит в вид `target` при сужении. */
const narrowUntil = async (target: string) => {
  for (let width = 900; width >= 240; width -= 10) {
    await setFrameWidth(width)
    if (layout() === target) return width
  }
  throw new Error(`layout ${target} not reached`)
}

let viewport: { width: number; height: number }
beforeEach(async () => {
  cellRenders = 0
  viewport = { width: innerWidth, height: innerHeight }
  await page.viewport(1000, 900)
})
afterEach(() => page.viewport(viewport.width, viewport.height))

describe('Нижняя панель — узкая ширина', () => {
  test('SB7: содержимое не помещается в одну строку — компактный вид, подпись «Rows per page» скрыта визуально и остаётся доступным именем списка', async () => {
    await render(<Grid />)
    await waitForGrid()
    expect(layout()).toBe('full')
    await narrowUntil('compact')

    const trigger = bar().querySelector<HTMLElement>(
      '[data-testid="page-size-select"]',
    )!
    const label = document.getElementById(
      trigger.getAttribute('aria-labelledby')!.split(' ')[0],
    )!
    expect(label.textContent).toBe(paginationLabels(tableLabels).rowsPerPage)
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    expect(getComputedStyle(label).clipPath).toBe('inset(50%)')
  })

  test('SB8: не помещается и компактный вид — две строки, start сверху и end снизу; при ширине рамки 520, 400 и 300 px все контролы внутри рамки и нажимаются', async () => {
    await render(<Grid />)
    await waitForGrid()
    await selectAll()

    for (const width of [520, 400, 300]) {
      await setFrameWidth(width)
      controlsReachable()
    }
    expect(layout()).toBe('stacked')
    const [start, end] = bar().children
    expect(start.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      end.getBoundingClientRect().top + 0.5,
    )
  })

  test('SB9: в двух строках отступ контейнера прокрутки равен реальной высоте панели — последняя строка тела не уходит под панель', async () => {
    await render(<Grid />)
    await waitForGrid()
    await selectAll()
    await setFrameWidth(300)
    expect(layout()).toBe('stacked')

    const panel = bar().getBoundingClientRect()
    expect(panel.height).toBeGreaterThan(60)
    // Панель целиком в рамке — рамка не обрезает её низ.
    expect(panel.bottom).toBeLessThanOrEqual(
      frame().getBoundingClientRect().bottom + 0.5,
    )
    expect(scroller().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      panel.top + 0.5,
    )
    scroller().scrollTop = scroller().scrollHeight
    for (let i = 0; i < 4; i++) await nextFrame()
    const rows = [
      ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
    ]
    const last = rows.reduce((a, b) =>
      Number(a.dataset.index) > Number(b.dataset.index) ? a : b,
    )
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      panel.top + 0.5,
    )
  })

  test('SB10: хватает ширины — панель возвращается к полному виду; при неизменной ширине вид не переключается туда-обратно', async () => {
    await render(<Grid />)
    await waitForGrid()
    const changes: (string | null)[] = []
    const observer = new MutationObserver(() => changes.push(layout()))
    observer.observe(bar(), { attributeFilter: ['data-status-bar-layout'] })

    // Каждый вид при неизменной ширине держится.
    for (const target of ['compact', 'stacked']) {
      await narrowUntil(target)
      changes.length = 0
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(changes, target).toEqual([])
    }

    await setFrameWidth(900)
    await expect.poll(layout).toBe('full')
    changes.length = 0
    await new Promise(resolve => setTimeout(resolve, 400))
    observer.disconnect()
    expect(changes).toEqual([])
    expect(frame().style.getPropertyValue('--tsr-comp-status-bar-offset')).toBe(
      '',
    )
  })

  test('SB11: текст стороны start в двух строках не шире строки — многоточие, полный текст в title', async () => {
    // Текст слота приложения; счётчики встроенных плагинов не обрезаются (ADR 0083, TX7).
    const long =
      'Synced with the warehouse across every page of this long result set'
    const note = {
      id: 'note',
      slots: [
        {
          id: 'note',
          slot: 'statusBarSlot',
          component: () => <span data-testid="note">{long}</span>,
        },
      ],
    }
    await render(<Grid extra={[note]} />)
    await waitForGrid()
    await setFrameWidth(300)
    expect(layout()).toBe('stacked')

    const start = bar().querySelector<HTMLElement>('[data-align="start"]')!
    const text = start.querySelector<HTMLElement>('[data-testid="note"]')!
    expect(start.getBoundingClientRect().right).toBeLessThanOrEqual(
      frame().getBoundingClientRect().right + 0.5,
    )
    expect(getComputedStyle(text).textOverflow).toBe('ellipsis')
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth)
    await expect.poll(() => start.title).toBe(long)
  })

  test('SB12: компактный и двухстрочный вид проходят axe с color-contrast в светлой и тёмной теме', async () => {
    await render(<Grid />)
    await waitForGrid()
    await selectAll()
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    for (const target of ['compact', 'stacked']) {
      await narrowUntil(target)
      await inBothThemes(async () => {
        expect((await axe.run(bar(), options)).violations).toEqual([])
      })
    }
  })

  test('SB13: переход панели между полным и компактным видом при изменении ширины не меняет DOM строк тела', async () => {
    // Ширина компактного перехода — без изменения высоты, значит, и без смены строк.
    const screen = await render(<Grid />)
    await waitForGrid()
    const compactAt = await narrowUntil('compact')
    await setFrameWidth(900)
    await expect.poll(layout).toBe('full')

    const rowsBox = document.querySelector('.data-grid__body')!
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(rowsBox, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })
    const rendersBefore = cellRenders
    await setFrameWidth(compactAt)
    expect(layout()).toBe('compact')
    await setFrameWidth(900)
    expect(layout()).toBe('full')
    observer.disconnect()
    const withPanel = {
      mutations: mutations.length,
      renders: cellRenders - rendersBefore,
    }
    await screen.unmount()

    // Та же смена ширины без нижней панели — эталон работы тела.
    cellRenders = 0
    await render(<Grid withStatusBar={false} />)
    await waitForGrid()
    const baseBox = document.querySelector('.data-grid__body')!
    const baseMutations: MutationRecord[] = []
    const baseObserver = new MutationObserver(records =>
      baseMutations.push(...records),
    )
    baseObserver.observe(baseBox, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })
    const baseBefore = cellRenders
    await setFrameWidth(compactAt)
    await setFrameWidth(900)
    baseObserver.disconnect()

    expect(withPanel.renders).toBe(cellRenders - baseBefore)
    expect(withPanel.mutations).toBe(baseMutations.length)
  })

  test('SB14: на узкой ширине появление текста стороны start переводит панель в две строки, а потом она держит высоту — пустой текст не возвращает её к одной строке', async () => {
    // Короткая форма счётчика длиннее места в компактном виде (ADR 0083, TX6).
    await render(
      <Grid
        localization={{
          selectedRowsShort: (count: number) =>
            `${count} selected on this page`,
        }}
      />,
    )
    await waitForGrid()
    await narrowUntil('compact')
    const checkbox = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row [role="checkbox"]',
      )!
    const height = () => bar().getBoundingClientRect().height

    await userEvent.click(checkbox())
    await expect.poll(layout).toBe('stacked')
    const grown = height()
    await userEvent.click(checkbox())
    await expect
      .poll(
        () =>
          document.querySelector('[data-testid="selected-rows-count"]')
            ?.textContent,
      )
      .toBe('')
    for (let i = 0; i < 6; i++) await nextFrame()
    expect(layout()).toBe('stacked')
    expect(height()).toBe(grown)
  })
})
