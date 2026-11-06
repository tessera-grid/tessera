import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnPinning,
  columnSizing,
  columnSorting,
  headerActionMenu,
} from '../../../plugins'
import { humanClick, tabInto } from '../helpers'
import { waitForGrid } from './core-helpers'

// Включённые действия уходят в кебаб последними (ADR 0156; KA3, KA5, KA6): отметка на
// кебабе, включение из кебаба, протяжка ширины. KA1–KA2 — модульные (`slots`), KA4 — в
// `touch`, KA7 — перф в `scroll`, KA8 — в `work-counters`.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
  age: 20 + i,
}))

interface Api {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnSizing: (value: Record<string, number>) => void
}

let api: Api

/** Три действия заголовка ниже порога: в кебаб их уводит только ширина. */
const Grid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      columnPinning(),
      columnSorting(),
      columnFiltering(),
      columnSizing(),
      headerActionMenu({ threshold: 4 }),
    ] as never,
  })
  api = table as unknown as Api
  return (
    <div style={{ width: 900, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const head = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"]',
  )!
const kebab = () => head().querySelector<HTMLElement>('[data-action-menu]')
const sortButton = () =>
  head().querySelector<HTMLElement>('.column-sort__button')
const pinButton = () => head().querySelector<HTMLElement>('.column-pin__button')
const row = () =>
  [...head().querySelectorAll<HTMLElement>('button')].map(button =>
    button.hasAttribute('data-action-menu')
      ? 'menu'
      : (button.className.match(/column-(\w+)__button/)?.[1] ?? '?'),
  )
const marked = (button: HTMLElement | null) => {
  const dot = button?.querySelector<HTMLElement>('[data-active-indicator]')
  return !!dot && getComputedStyle(dot).opacity === '1'
}
const sorted = () => head().getAttribute('aria-sort') ?? 'none'
const away = () => userEvent.hover(document.body, { position: { x: 1, y: 1 } })

/** Ширина, при которой в ряду ровно одна кнопка действия и кебаб. */
const narrowToOne = async () => {
  for (let width = 140; width <= 300; width += 5) {
    api.setColumnSizing({ name: width })
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    if (row().length === 2 && row().includes('menu')) return width
  }
  throw new Error('нет ширины на одну кнопку и кебаб')
}

const mount = async () => {
  const screen = await render(<Grid />)
  await waitForGrid()
  const width = await narrowToOne()
  return { screen, width }
}

describe('Включённые действия уходят в кебаб последними (ADR 0156)', () => {
  test('KA3: точка или число на кебабе — только включённые действия, ушедшие в кебаб; все включённые в ряду — кебаб без точки', async () => {
    const { screen, width } = await mount()
    expect(row()).toEqual(['pin', 'menu'])
    expect(marked(kebab())).toBe(false)

    // Включённая сортировка встала в ряд: отметка на ней, кебаб без точки.
    api.setSorting([{ id: 'name', desc: false }])
    await expect.poll(row).toEqual(['sort', 'menu'])
    await expect.poll(() => marked(sortButton())).toBe(true)
    expect(marked(kebab())).toBe(false)

    // Места только на кебаб: включённая ушла в него — точка на кебабе.
    let tight = width
    while (row().length > 1 && tight > 60) {
      tight -= 5
      api.setColumnSizing({ name: tight })
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
    }
    expect(row()).toEqual(['menu'])
    await expect.poll(() => marked(kebab())).toBe(true)
    await screen.unmount()
  })

  test('KA5: включённое из кебаба действие встаёт в ряд после закрытия меню и ухода из заголовка; невключённое уходит в кебаб', async () => {
    const { screen } = await mount()
    const ascItem = () =>
      document.querySelector<HTMLElement>(
        '[role="menu"] [data-action-id="columnSorting"][data-item-id="asc"]',
      )

    // Мышь: пункт меню закрывает его, указатель над меню, а не над заголовком.
    await userEvent.hover(head())
    await humanClick(kebab()!)
    await expect.poll(ascItem).not.toBeNull()
    await humanClick(ascItem()!)
    await expect.poll(sorted).toBe('ascending')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    await away()
    await expect.poll(row).toEqual(['sort', 'menu'])

    // Клавиатура: после выбора фокус на кебабе — ряд ждёт, пока фокус не уйдёт.
    api.setSorting([])
    await expect.poll(row).toEqual(['pin', 'menu'])
    await tabInto(kebab()!)
    await userEvent.keyboard('{Enter}')
    await expect.poll(ascItem).not.toBeNull()
    await expect
      .poll(() => document.activeElement?.closest('[role="menu"]'))
      .toBeTruthy()
    for (let i = 0; i < 10 && document.activeElement !== ascItem(); i++) {
      await userEvent.keyboard('{ArrowDown}')
    }
    await userEvent.keyboard('{Enter}')
    await expect.poll(sorted).toBe('ascending')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    expect(head().contains(document.activeElement)).toBe(true)
    expect(row()).toEqual(['pin', 'menu'])
    await userEvent.keyboard('{Tab}')
    await expect.poll(() => head().contains(document.activeElement)).toBe(false)
    await expect.poll(row).toEqual(['sort', 'menu'])
    await screen.unmount()
  })

  test('KA6: протяжка ширины колонки с включённым действием — сначала уходят невключённые; ряд пересчитывается во время протяжки, не дожидаясь ухода', async () => {
    const pointer = commands as unknown as {
      realMouseMove: (
        from: { x: number; y: number },
        to: { x: number; y: number },
        steps?: number,
      ) => Promise<void>
      realDragHold: (
        from: { x: number; y: number },
        to: { x: number; y: number },
        steps?: number,
      ) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    const { screen, width } = await mount()
    // Широкая колонка: все три кнопки в ряду, сортировка включена.
    api.setColumnSizing({ name: width + 120 })
    api.setSorting([{ id: 'name', desc: false }])
    await expect.poll(row).toEqual(['pin', 'sort', 'filter'])

    // Протяжка грипа влево до ширины на одну кнопку и кебаб, кнопка мыши ещё нажата.
    const r = head().getBoundingClientRect()
    const from = { x: r.right, y: r.top + r.height / 2 }
    await pointer.realMouseMove({ x: r.left + 8, y: from.y }, from, 4)
    await pointer.realDragHold(from, { x: from.x - 120, y: from.y }, 12)
    try {
      await expect.poll(row).toEqual(['sort', 'menu'])
      expect(pinButton()).toBeNull()
    } finally {
      await pointer.realMouseUp()
    }
    await screen.unmount()
  })
})
