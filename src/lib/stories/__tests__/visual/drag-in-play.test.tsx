import { commands, page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import {
  centerOf,
  dragHold,
  settle,
  type Point,
} from '../../__mocks__/catalogPlay'
import { composed } from '../stories'
import { ColumnDraggingGrid } from './columns-fixtures'

// Перетаскивание из `play` (ADR 0130, этап 1): помощник `dragHold` ведёт перетаскивание
// событиями указателя, без команд Playwright, в StrictMode (`vitest.setup.ts`). Истории
// рендерятся без своих `play`.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

const HANDLE = '.drag__handler--column'
const CLOUD = '.data-grid-body__row .data-grid__cell-wrapper-title'
const SLOT = '.data-grid__body-row[data-row-draggable="true"]'
const COLUMN_CLOUD = '.data-grid-head__cell--overlay'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const release = (handle: HTMLElement) =>
  handle.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, isPrimary: true }),
  )

type Screen = Awaited<ReturnType<typeof render>>

/** Ручка и цель в середине окна грида: у края включилась бы автопрокрутка. */
const holdRow = async () => {
  const screen = await render(<composed.RowDraggingPlayground />)
  const row = (id: string) =>
    screen.container.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="${id}"]`,
    )!
  await expect.poll(() => row('item-id-3')).not.toBeNull()
  const handle = row('item-id-2').querySelector<HTMLElement>(HANDLE)!
  const to: Point = {
    x: centerOf(handle).x,
    y: centerOf(row('item-id-3')).y + 6,
  }
  await dragHold(handle, to)
  return { handle, screen }
}

const headCells = (screen: Screen) => [
  ...screen.container.querySelectorAll<HTMLElement>('.data-grid__head-cell'),
]

const holdColumn = async () => {
  const screen = await render(<ColumnDraggingGrid />)
  await expect.poll(() => headCells(screen).length).toBeGreaterThan(3)
  const cells = headCells(screen)
  const handle = cells[1]!.querySelector<HTMLElement>(HANDLE)!
  const box = screen.container
    .querySelector('.data-grid__container')!
    .getBoundingClientRect()
  // К началу первой колонки: место считается от её левой десятой, а прокрутка
  // уже в нуле — автопрокрутке у левого края ехать некуда.
  const to: Point = { x: box.left + box.width * 0.1, y: centerOf(handle).y }
  await dragHold(handle, to)
  return { handle, screen }
}

/** Место вставки колонки: исходная ячейка скрыта, соседи сдвинуты. */
const columnPlace = (screen: Screen) => {
  const cells = headCells(screen)
  const hidden = cells.some(cell => getComputedStyle(cell).opacity === '0')
  const shifted = cells.some(
    cell =>
      getComputedStyle(cell).opacity !== '0' &&
      Math.abs(new DOMMatrix(getComputedStyle(cell).transform).m41) > 0.5,
  )
  return hidden && shifted
}

const screenshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  return typeof shot === 'string' ? shot : shot.base64
}

let held: HTMLElement | undefined

afterEach(async () => {
  if (held) release(held)
  held = undefined
  await reducedMotion(false)
})

describe('Перетаскивание из play (ADR 0130)', () => {
  test('DG4: шаг ведёт перетаскивание строки и колонки событиями указателя без Playwright, в StrictMode — облако и слот или место вставки стоят до конца шага', async () => {
    const row = await holdRow()
    held = row.handle
    await expect.poll(() => document.querySelector(CLOUD)).not.toBeNull()
    await expect.poll(() => document.querySelector(SLOT)).not.toBeNull()
    await sleep(500)
    expect(document.querySelector(CLOUD), 'облако строки').not.toBeNull()
    expect(document.querySelector(SLOT), 'слот строки').not.toBeNull()
    release(row.handle)
    await expect.poll(() => document.querySelector(CLOUD)).toBeNull()
    await row.screen.unmount()

    const column = await holdColumn()
    held = column.handle
    await expect.poll(() => document.querySelector(COLUMN_CLOUD)).not.toBeNull()
    await expect.poll(() => columnPlace(column.screen)).toBe(true)
    await sleep(500)
    expect(document.querySelector(COLUMN_CLOUD), 'облако шапки').not.toBeNull()
    expect(columnPlace(column.screen), 'место вставки').toBe(true)
  })

  test('DG5: кадр удержанного перетаскивания детерминирован — после settle два снимка подряд совпадают', async () => {
    await reducedMotion(true)
    for (const hold of [holdRow, holdColumn]) {
      const { handle, screen } = await hold()
      held = handle
      await expect
        .poll(() => document.querySelector(`${CLOUD}, ${COLUMN_CLOUD}`))
        .not.toBeNull()
      await settle()
      const first = await screenshot()
      await sleep(300)
      expect(await screenshot(), hold.name).toBe(first)
      release(handle)
      held = undefined
      await screen.unmount()
    }
  })
})
