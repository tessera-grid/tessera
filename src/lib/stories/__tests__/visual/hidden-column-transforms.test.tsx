import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  headerActionMenu,
} from '../../../plugins'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import { capitalized } from '../../../plugins/columnVisibility/hiddenTransforms'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'
import { openColumnsMenu } from '../viewSettings'

// Преобразования скрытых колонок в меню «Колонки» и кебабе (ADR 0204, этап 2, HT3–HT6). HT1–HT2 —
// модульные (`columnTransforms.dom`).

const DATA = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: ['Paris', 'Oslo', 'Rome', 'Lima'][i % 4]!,
}))

/** Колонка с сортировкой по убыванию и фильтром «содержит a». */
const TRANSFORMED = 'city'
const PLAIN = 'name'
const FILTERED_ROWS = DATA.filter(row => row.city.includes('a')).length

const visibility = columnVisibilityLabels(tableLabels)
const sorting = columnSortingLabels(tableLabels)
const filtering = columnFilteringLabels(tableLabels)
const NAMES = [sorting.transformName, filtering.transformName]
const DESCRIPTIONS = [
  sorting.transformDescending,
  filtering.transformDescription,
]

interface Probe {
  actions: { plugin: string; action: string }[]
  onToggleColumnSort: ReturnType<typeof vi.fn>
}

const Grid = ({ probe, eraser }: { probe: Probe; eraser?: boolean }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
      { id: 'city', accessorKey: 'city', header: 'City', size: 200 },
    ] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    onDebugAction: (action: { plugin: string; action: string }) => {
      probe.actions.push({ plugin: action.plugin, action: action.action })
    },
    plugins: [
      columnSorting({
        initialSorting: [{ id: TRANSFORMED, desc: true }],
        onToggleColumnSort: probe.onToggleColumnSort,
      } as never),
      columnFiltering({
        initialColumnFilters: [
          { id: TRANSFORMED, value: { operator: 'contains', value: 'a' } },
        ],
      } as never),
      columnVisibility(),
      headerActionMenu(),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 560 }}>
      <DataGrid
        table={table as never}
        height={520}
        icons={
          eraser
            ? {
                clearColumnTransforms: () => (
                  <svg data-testid="own-eraser" width={16} height={16} />
                ),
              }
            : undefined
        }
      />
    </div>
  )
}

const mount = async (eraser = false) => {
  const probe: Probe = {
    actions: [],
    onToggleColumnSort: vi.fn(() => Promise.resolve()),
  }
  const screen = await render(<Grid probe={probe} eraser={eraser} />)
  await waitForGrid()
  return { screen, probe }
}

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const menu = () => byTestId('column-visibility-menu')
const rowOf = (id: string) =>
  menu()?.querySelector<HTMLElement>(`[data-column-id="${id}"]`) ?? null
const boxOf = (id: string) =>
  rowOf(id)?.querySelector<HTMLElement>('[role="checkbox"]') ?? null
const erasersOf = (id: string) => [
  ...(rowOf(id)?.querySelectorAll<HTMLElement>(
    '[data-testid="column-visibility-clear-transforms"]',
  ) ?? []),
]
const keptOf = (id: string) =>
  rowOf(id)?.querySelector('[data-transforms-kept]')?.textContent ?? null
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )
const bodyRows = () =>
  document.querySelectorAll('.data-grid__body-row[data-row-id]').length
const announced = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(el => el.textContent ?? '')
    .join(' ')
const accessibleName = (el: HTMLElement) =>
  el.getAttribute('aria-label') ??
  (el.getAttribute('aria-labelledby') ?? '')
    .split(' ')
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()

const settle = async () => {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  await Promise.all(
    document
      .getAnimations()
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )
}

const openMenu = async () => {
  await openColumnsMenu({ click: humanClick })
  await settle()
}
const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => menu()).toBeNull()
}
/** Скрыть колонку галочкой в меню «Колонки»; меню остаётся открытым. */
const hideInMenu = async (id: string) => {
  await humanClick(boxOf(id)!)
  await expect.poll(() => headCell(id)).toBeNull()
}

const kebabItems = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const hideItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menu"] [data-action-id="columnVisibility.hide"]',
  )
const captionOf = (item: HTMLElement | null) =>
  item?.querySelector('[data-popup-item-caption]')?.textContent ?? null
const openKebab = async (id: string) => {
  await revealCellButtons(headCell(id)!)
  await humanClick(
    headCell(id)!.querySelector<HTMLElement>('[data-action-menu]')!,
  )
  await expect.poll(hideItem).not.toBeNull()
  await settle()
}
const closeKebab = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => kebabItems().length).toBe(0)
}

describe('Преобразования скрытых колонок (ADR 0204)', () => {
  test('HT3: в меню «Колонки» у пункта скрытой колонки с преобразованием — одна кнопка-ластик icons.clearColumnTransforms в активном цвете; её тултип и доступное имя называют преобразования колонки, доступное имя флажка — тоже; у видимой колонки кнопки нет', async () => {
    const { screen } = await mount(true)
    await openMenu()
    // Видимая колонка с преобразованиями — без кнопки: они видны в шапке.
    expect(erasersOf(TRANSFORMED)).toHaveLength(0)
    expect(erasersOf(PLAIN)).toHaveLength(0)
    await hideInMenu(TRANSFORMED)
    await closeMenu()
    await openMenu()

    const erasers = erasersOf(TRANSFORMED)
    expect(erasers).toHaveLength(1)
    const eraser = erasers[0]!
    // Значок — из `icons`.
    expect(eraser.querySelector('[data-testid="own-eraser"]')).not.toBeNull()
    // Активный цвет — как у включённых кнопок шапки.
    const probe = document.createElement('span')
    probe.style.color = 'var(--tsr-comp-control-active-color)'
    eraser.parentElement!.append(probe)
    expect(getComputedStyle(eraser).color).toBe(getComputedStyle(probe).color)
    probe.remove()
    // Имя кнопки и тултип: что с колонкой сейчас и что сделает нажатие.
    const label = visibility.activeTransforms(
      capitalized(DESCRIPTIONS.join(', ')),
    )
    expect(accessibleName(eraser)).toBe(label)
    await userEvent.hover(eraser)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === label,
        ),
      )
      .toBe(true)
    // Флажок пункта называет колонку, что она скрыта, и её преобразования.
    expect(accessibleName(boxOf(TRANSFORMED)!)).toBe(
      ['City', visibility.hiddenColumn, ...DESCRIPTIONS].join(', '),
    )
    expect(accessibleName(boxOf(PLAIN)!)).toBe('Name')
    await closeMenu()
    await screen.unmount()
  })

  test('HT4: нажатие ластика снимает все преобразования колонки одним действием путями плагинов (канал действий, серверное действие); кнопка уходит, фокус остаётся в меню', async () => {
    const { screen, probe } = await mount()
    expect(bodyRows()).toBe(FILTERED_ROWS)
    await openMenu()
    await hideInMenu(TRANSFORMED)
    probe.actions.length = 0
    await humanClick(erasersOf(TRANSFORMED)[0]!)

    await expect.poll(() => erasersOf(TRANSFORMED)).toHaveLength(0)
    // Фокус — на флажке той же колонки, во всех движках.
    expect(document.activeElement).toBe(
      menu()!.querySelector(
        `[data-column-id="${TRANSFORMED}"] [role="checkbox"]`,
      ),
    )
    // Одно действие меню, а под ним — пути плагинов.
    expect(probe.actions).toEqual(
      expect.arrayContaining([
        { plugin: 'columnVisibility', action: 'clearTransforms' },
        { plugin: 'columnSorting', action: 'clearSort' },
        expect.objectContaining({ plugin: 'columnFiltering' }),
      ]),
    )
    expect(
      probe.actions.filter(action => action.plugin === 'columnVisibility'),
    ).toHaveLength(1)
    // Сортировка снята серверным путём плагина: его колбэк получил колонку.
    expect(probe.onToggleColumnSort).toHaveBeenCalledWith(
      TRANSFORMED,
      false,
      expect.anything(),
    )
    // Фильтр снят: в таблице снова все строки.
    await expect.poll(bodyRows).toBe(DATA.length)
    await closeMenu()
    await screen.unmount()
  })

  test('HT5: пункт кебаба «Скрыть колонку» у колонки с преобразованием несёт подсказку по составу; у колонки без преобразований подсказки нет', async () => {
    const { screen } = await mount()
    await openKebab(TRANSFORMED)
    expect(captionOf(hideItem())).toBe(
      capitalized(visibility.transformsWillRemain(NAMES, NAMES.length)),
    )
    await closeKebab()
    await openKebab(PLAIN)
    expect(captionOf(hideItem())).toBeNull()
    await closeKebab()
    await screen.unmount()
  })

  test('HT6: сняв галочку колонки с преобразованием, пользователь видит у её пункта подсказку по составу и ластик; скрытие из меню и кебаба объявляется скринридеру с составом', async () => {
    const { screen } = await mount()
    const announcement = visibility.columnsHiddenKept(
      ['City'],
      NAMES,
      NAMES.length,
    )
    await openMenu()
    expect(keptOf(TRANSFORMED)).toBeNull()
    await hideInMenu(TRANSFORMED)
    await expect
      .poll(() => keptOf(TRANSFORMED))
      .toBe(capitalized(visibility.transformsKept(NAMES, NAMES.length)))
    expect(erasersOf(TRANSFORMED)).toHaveLength(1)
    // Подсказка — перед ластиком.
    const kept = rowOf(TRANSFORMED)!.querySelector('[data-transforms-kept]')!
    expect(
      kept.compareDocumentPosition(erasersOf(TRANSFORMED)[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await expect.poll(announced).toContain(announcement)
    // Колонка без преобразований скрывается молча.
    await hideInMenu(PLAIN)
    expect(keptOf(PLAIN)).toBeNull()
    await closeMenu()
    await screen.unmount()

    // Из кебаба.
    const second = await mount()
    await openKebab(TRANSFORMED)
    await humanClick(hideItem()!)
    await expect.poll(() => headCell(TRANSFORMED)).toBeNull()
    await expect.poll(announced).toContain(announcement)
    await second.screen.unmount()
  })
})
