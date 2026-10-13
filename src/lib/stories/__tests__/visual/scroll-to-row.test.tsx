import { useEffect, useMemo } from 'react'

import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  IDLE_DELAY,
  MIN_DURATION,
} from '../../../core/fastScroll/fastScrollDetector'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import {
  argsToPlugins,
  type FeatureToggles,
} from '../../__mocks__/utils/argsToPlugins'

// Прокрутка к строке (ADR 0104, SV1–SV10): `table.scrollToRow` и `reveal` подсветки на
// настоящей раскладке — липкие шапка и футер, закреплённые колонки, пагинация, дерево.

type ScrollTable = {
  scrollToRow: (
    rowId: string,
    options?: {
      align?: 'auto' | 'start' | 'center' | 'end'
      behavior?: 'instant' | 'smooth'
      columnId?: string
      expandParents?: boolean
    },
  ) => Promise<boolean>
  highlight: (
    target: object,
    options?: { reveal?: boolean; key?: string },
  ) => { clear: () => void }
  store: { state: Record<string, any> }
  getRowModel: () => { rows: unknown[] }
  setGrouping: (grouping: string[]) => void
  setColumnVisibility: (visibility: Record<string, boolean>) => void
  setColumnPinning: (pinning: { start?: string[]; end?: string[] }) => void
}

interface GridProps {
  toggles?: FeatureToggles
  data?: unknown[]
  width?: number
  onTable: (table: ScrollTable) => void
}

const Grid = ({ toggles = {}, data, width = 1100, onTable }: GridProps) => {
  const plugins = useMemo(() => argsToPlugins(toggles), [toggles])
  const rows = useMemo(() => data ?? getData(300), [data])
  const table = useCreateTable({
    columns: columns as never,
    data: rows as never,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
    enableFooter: true,
  })
  useEffect(() => {
    onTable(table as unknown as ScrollTable)
  })
  return (
    <div style={{ width, height: 440 }}>
      <DataGrid table={table} height={420} />
    </div>
  )
}

const mount = async (props: Omit<GridProps, 'onTable'> = {}) => {
  const box: { table?: ScrollTable } = {}
  const screen = await render(
    <Grid {...props} onTable={table => (box.table = table)} />,
  )
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  return { table: () => box.table!, screen }
}

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1280, 900))
afterAll(() => page.viewport(viewport.width, viewport.height))

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const rect = (el: Element) => el.getBoundingClientRect()
/** Окно тела: между низом липкой шапки и верхом липкого футера. */
const bodyArea = () => ({
  top: rect(document.querySelector('.data-grid__head')!).bottom,
  bottom: rect(document.querySelector('.data-grid__footer')!).top,
})
const frames = async (count: number) => {
  for (let i = 0; i < count; i++)
    await new Promise(resolve => requestAnimationFrame(resolve))
}
const skeletonCount = () =>
  document.querySelectorAll('.data-grid__body-row [class*="skeleton"]').length
const idle = () =>
  new Promise(resolve => setTimeout(resolve, IDLE_DELAY + MIN_DURATION + 100))

const expectInside = (id: string) => {
  const row = rect(rowEl(id)!)
  const area = bodyArea()
  expect(row.top, `${id} сверху`).toBeGreaterThanOrEqual(area.top - 0.5)
  expect(row.bottom, `${id} снизу`).toBeLessThanOrEqual(area.bottom + 0.5)
}

/** Строка у верхнего края окна: целиком в окне и не дальше пикселя от края. */
const expectAtTop = (id: string) => {
  const gap = rect(rowEl(id)!).top - bodyArea().top
  expect(gap, `${id} у верха`).toBeGreaterThanOrEqual(0)
  expect(gap, `${id} у верха`).toBeLessThan(1)
}
/** Строка у нижнего края окна: целиком в окне и не дальше пикселя от края. */
const expectAtBottom = (id: string) => {
  const gap = bodyArea().bottom - rect(rowEl(id)!).bottom
  expect(gap, `${id} у низа`).toBeGreaterThanOrEqual(0)
  expect(gap, `${id} у низа`).toBeLessThan(1)
}

describe('Прокрутка к строке', () => {
  test('SV1: строка видна целиком под липкой шапкой и над липким футером; промис — true, когда строка смонтирована на месте', async () => {
    const { table } = await mount()
    expect(rowEl('item-id-200')).toBeNull()
    expect(await table().scrollToRow('item-id-200')).toBe(true)
    expect(rowEl('item-id-200')).not.toBeNull()
    expectInside('item-id-200')
    expect(await table().scrollToRow('item-id-5')).toBe(true)
    expectInside('item-id-5')
  })

  test('SV2: auto не двигает видимую строку, ниже окна — к нижнему краю, выше — к верхнему; start, center, end — к своему краю или центру', async () => {
    const { table } = await mount()
    const before = scroller().scrollTop
    expect(await table().scrollToRow('item-id-2')).toBe(true)
    expect(scroller().scrollTop).toBe(before)

    await table().scrollToRow('item-id-150')
    expectAtBottom('item-id-150')
    await table().scrollToRow('item-id-100')
    expectAtTop('item-id-100')

    await table().scrollToRow('item-id-120', { align: 'start' })
    expectAtTop('item-id-120')
    await table().scrollToRow('item-id-120', { align: 'end' })
    expectAtBottom('item-id-120')
    await table().scrollToRow('item-id-120', { align: 'center' })
    const row = rect(rowEl('item-id-120')!)
    const area = bodyArea()
    expect(
      Math.abs((row.top + row.bottom) / 2 - (area.top + area.bottom) / 2),
    ).toBeLessThan(1)

    // Последняя строка к верху окна не встанет: прокрутка упирается — как можно ближе.
    expect(await table().scrollToRow('item-id-299', { align: 'start' })).toBe(
      true,
    )
    expectInside('item-id-299')
    expect(scroller().scrollTop).toBe(
      scroller().scrollHeight - scroller().clientHeight,
    )
  })

  test('SV3: прыжок по умолчанию мгновенный и без скелетов; smooth — плавно, промис после конца', async () => {
    const { table } = await mount()
    await idle()
    let skeletons = 0
    let positions = 0
    let watching = true
    let last = scroller().scrollTop
    const watch = () => {
      skeletons += skeletonCount()
      if (scroller().scrollTop !== last) {
        positions++
        last = scroller().scrollTop
      }
      if (watching) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
    expect(await table().scrollToRow('item-id-250')).toBe(true)
    await frames(5)
    watching = false
    expect(skeletons).toBe(0)
    expect(positions).toBe(1)
    expect(rowEl('item-id-250')!.textContent).not.toBe('')

    await idle()
    const tops: number[] = []
    watching = true
    const record = () => {
      tops.push(scroller().scrollTop)
      if (watching) requestAnimationFrame(record)
    }
    requestAnimationFrame(record)
    expect(
      await table().scrollToRow('item-id-120', { behavior: 'smooth' }),
    ).toBe(true)
    const done = scroller().scrollTop
    await frames(5)
    watching = false
    expect(new Set(tops).size, 'промежуточные положения').toBeGreaterThan(3)
    expect(scroller().scrollTop).toBe(done)
    expectInside('item-id-120')
  })

  test('SV4: строка на другой странице пагинации — страница переключается, затем прокрутка', async () => {
    const { table } = await mount({
      toggles: { enablePagination: true, paginationInitialPageSize: 100 },
    })
    expect(await table().scrollToRow('item-id-250')).toBe(true)
    expect(table().store.state.pagination.pageIndex).toBe(2)
    expectInside('item-id-250')
  })

  test('SV5: строка в свёрнутом родителе или группе — без опции false и раскрытие не меняется, с expandParents предки раскрываются, а запрет раскрытия (maxDepth) — false без смены', async () => {
    const { table, screen } = await mount({
      toggles: {
        enableRowExpanding: true,
        rowExpandingMaxDepth: 3,
        enableRowGrouping: true,
      },
      data: getData(120, 'nested'),
    })
    const expanded = table().store.state.expanded
    expect(await table().scrollToRow('item-id-90-0-0')).toBe(false)
    expect(table().store.state.expanded).toEqual(expanded)
    expect(rowEl('item-id-90-0-0')).toBeNull()

    expect(
      await table().scrollToRow('item-id-90-0-0', { expandParents: true }),
    ).toBe(true)
    expectInside('item-id-90-0-0')
    expect(rowEl('item-id-90')!.getAttribute('data-expanded')).toBe('true')
    expect(rowEl('item-id-90-0')!.getAttribute('data-expanded')).toBe('true')

    // Группы: строка в свёрнутой группе страны.
    table().setGrouping(['country'])
    await expect
      .poll(() => document.querySelector('[data-group-row="true"]'))
      .not.toBeNull()
    expect(await table().scrollToRow('item-id-77')).toBe(false)
    expect(
      await table().scrollToRow('item-id-77', { expandParents: true }),
    ).toBe(true)
    expectInside('item-id-77')
    await screen.unmount()

    // Предка, которого раскрыть нельзя (maxDepth по умолчанию — 1), не трогаем.
    const limited = await mount({
      toggles: { enableRowExpanding: true },
      data: getData(120, 'nested'),
    })
    const before = limited.table().store.state.expanded
    expect(
      await limited
        .table()
        .scrollToRow('item-id-90-0-0', { expandParents: true }),
    ).toBe(false)
    expect(limited.table().store.state.expanded).toEqual(before)
  })

  test('SV6: отфильтрованная, незагруженная или несуществующая строка и несмонтированный грид — false без прокрутки и смены состояния', async () => {
    let answer: ((rows: unknown[]) => void) | undefined
    const { table, screen } = await mount({
      toggles: {
        enableQuickSearch: true,
        enablePagination: true,
        paginationInitialPageSize: 100,
        enableRowExpanding: true,
        rowExpandingHasChildren: (row: { id: string }) =>
          row.id === 'item-id-3',
        rowExpandingLoadChildren: () =>
          new Promise(resolve => (answer = resolve as never)) as never,
      },
    })
    /** Отказ: `false`, ни прокрутки, ни смены состояния. */
    const expectRefused = async (rowId: string) => {
      await scroller().scrollTo({ top: 300, behavior: 'instant' })
      await frames(2)
      const state = JSON.stringify(table().store.state)
      const top = scroller().scrollTop
      expect(await table().scrollToRow(rowId), rowId).toBe(false)
      expect(scroller().scrollTop, rowId).toBe(top)
      expect(JSON.stringify(table().store.state), rowId).toBe(state)
    }

    await expectRefused('missing')
    // Ребёнок ленивой строки до ответа `loadChildren`.
    await expectRefused('item-id-3-lazy')
    expect(answer).toBeUndefined()

    // Тулбар — ленивый модуль (ADR 0046, PB6). Поиск оставляет строки, но не нужную.
    await expect
      .poll(() => document.querySelector('input[type="search"]'))
      .not.toBeNull()
    const search = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!
    const name = (getData(300)[1] as { firstName: string }).firstName
    await userEvent.type(search, name)
    // Поиск применён (после дебаунса): в модели — только совпадения.
    await expect.poll(() => table().getRowModel().rows.length).toBeLessThan(20)
    // Строка, ни одно значение которой не содержит запрос, — отфильтрована.
    const hidden = (
      getData(300) as { id: string; [key: string]: unknown }[]
    ).find(
      (row, i) =>
        i > 100 &&
        !Object.values(row).some(value =>
          String(value).toLowerCase().includes(name.toLowerCase()),
        ),
    )!.id
    await expectRefused(hidden)

    const detached = table()
    await screen.unmount()
    expect(await detached.scrollToRow('item-id-1')).toBe(false)
  })

  test('SV7: columnId — ещё и горизонталь к колонке между закреплёнными; закреплённая колонка горизонталь не трогает, скрытая — false', async () => {
    const { table } = await mount({
      width: 520,
      toggles: {
        enableRowSelection: true,
        enableRowActions: true,
        actionsDemo: 'basic',
        enableColumnPinning: true,
      },
    })
    table().setColumnPinning({ start: ['country'] })
    await frames(3)
    expect(scroller().scrollLeft).toBe(0)
    expect(await table().scrollToRow('item-id-80', { columnId: 'total' })).toBe(
      true,
    )
    const cell = rowEl('item-id-80')!.querySelector<HTMLElement>(
      '[data-column-id="total"]',
    )!
    const row = rowEl('item-id-80')!
    const left = Math.max(
      ...[...row.querySelectorAll('[data-cell-pinned="left"]')].map(
        el => rect(el).right,
      ),
    )
    const right = Math.min(
      ...[...row.querySelectorAll('[data-cell-pinned="right"]')].map(
        el => rect(el).left,
      ),
    )
    expect(rect(cell).left).toBeGreaterThanOrEqual(left - 0.5)
    expect(rect(cell).right).toBeLessThanOrEqual(right + 0.5)
    expectInside('item-id-80')

    const scrolled = scroller().scrollLeft
    expect(scrolled).toBeGreaterThan(0)
    expect(
      await table().scrollToRow('item-id-20', { columnId: 'country' }),
    ).toBe(true)
    expect(scroller().scrollLeft).toBe(scrolled)

    table().setColumnVisibility({ age: false })
    await frames(2)
    const top = scroller().scrollTop
    expect(await table().scrollToRow('item-id-200', { columnId: 'age' })).toBe(
      false,
    )
    expect(scroller().scrollTop).toBe(top)
  })

  test('SV8: фокус и активная ячейка клавиатурной навигации не меняются', async () => {
    const { table } = await mount({
      toggles: { enableKeyboardNavigation: true },
    })
    const cell = rowEl('item-id-1')!.querySelector<HTMLElement>(
      '[data-column-id="firstName"]',
    )!
    await userEvent.click(cell)
    await expect.poll(() => document.activeElement).toBe(cell)
    const active = JSON.stringify(
      table().store.state['plugin:keyboardNavigation'],
    )
    expect(await table().scrollToRow('item-id-200')).toBe(true)
    expect(document.activeElement).toBe(cell)
    expect(
      JSON.stringify(table().store.state['plugin:keyboardNavigation']),
    ).toBe(active)
  })

  test('SV9: новый вызов до конца прошлого побеждает — прошлый промис даёт false', async () => {
    const { table } = await mount()
    // Первый — долгая плавная прокрутка вниз; второй перебивает её прыжком вверх.
    const first = table().scrollToRow('item-id-250', { behavior: 'smooth' })
    await frames(5)
    const second = table().scrollToRow('item-id-40', { align: 'start' })
    expect(await second).toBe(true)
    expect(await first).toBe(false)
    // Перебитый вызов не доводит свою строку поверх итога нового.
    await frames(30)
    expectAtTop('item-id-40')
    expect(rowEl('item-id-250')).toBeNull()
  })

  test('SV10: highlight с reveal докручивает к строке, к ячейке и к колонке (только по горизонтали)', async () => {
    const { table } = await mount({
      width: 520,
      toggles: { enableRowSelection: true },
    })
    table().highlight({ row: 'item-id-180' }, { reveal: true, key: 'a' })
    await expect.poll(() => rowEl('item-id-180')).not.toBeNull()
    await expect
      .poll(() => rect(rowEl('item-id-180')!).bottom <= bodyArea().bottom + 0.5)
      .toBe(true)
    expect(rowEl('item-id-180')!.hasAttribute('data-highlight')).toBe(true)

    table().highlight(
      { cell: ['item-id-60', 'total'] },
      { reveal: true, key: 'b' },
    )
    await expect.poll(() => rowEl('item-id-60')).not.toBeNull()
    await expect.poll(() => scroller().scrollLeft).toBeGreaterThan(0)
    expectInside('item-id-60')

    await scroller().scrollTo({ left: 0, behavior: 'instant' })
    await frames(3)
    const top = scroller().scrollTop
    table().highlight({ column: 'total' }, { reveal: true, key: 'c' })
    await expect.poll(() => scroller().scrollLeft).toBeGreaterThan(0)
    expect(scroller().scrollTop).toBe(top)
  })
})
