import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import type { TesseraFeatureEntry } from '../../../core/features'
import { CellButton } from '../../../ui/CellButton/CellButton'
import { headCells, humanClick, renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'

// Значки скрытых кнопок — только там, где их видно (ADR 0149, §4, PS4–PS6): кнопка остаётся
// у каждой строки, значок монтирует строка под указателем, с фокусом, тронутая пальцем или
// с открытым меню своей кнопки; своё состояние кнопки держит значок всегда.

const COLUMN = 'age'

/** Своя скрытая кнопка ячейки: в строке 1 включена, во 2 ждёт, в 3 — с отметкой отказа. */
const markSeed: TesseraFeatureEntry = {
  id: 'revealMarks',
  slots: [
    {
      id: 'revealMarks',
      slot: 'rightCellSlot',
      component: ({
        row,
        column,
      }: {
        row: { id: string; index: number }
        column: { id: string }
      }) =>
        column.id === COLUMN ? (
          <CellButton
            label={`Mark ${row.id}`}
            icon={<svg data-mark-icon="" width={16} height={16} />}
            active={row.index === 1 || undefined}
            pending={row.index === 2}
            failure={row.index === 3 ? 'Refused' : undefined}
          />
        ) : null,
    },
  ],
}

const rowAt = (index: number) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"]`,
  )!
const cellAt = (index: number, column: string) =>
  rowAt(index).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const mark = (index: number) =>
  rowAt(index).querySelector<HTMLElement>('[aria-label^="Mark"]')!
const iconShown = (index: number) =>
  mark(index).querySelector('[data-mark-icon]') !== null
/** Указатель на шапку: ни одна строка тела не под ним. */
const away = () => userEvent.hover(headCells()[0]!)

const mount = async (keyboard: boolean) => {
  renderGrid({
    columnCount: 6,
    dataCount: 30,
    enableKeyboardNavigation: keyboard,
    enableRowActions: true,
    enableRowActionMenu: true,
    extraPlugins: [markSeed],
  })
  await waitForGrid()
  await expect.poll(() => mark(5)).not.toBeNull()
  await away()
}

describe('Значки скрытых кнопок по месту показа (ADR 0149)', () => {
  test('PS4: значок скрытой кнопки ячейки и строки монтируется только у строки под указателем, с фокусом внутри, тронутой пальцем или с открытым меню своей кнопки, а у включённой, ждущей и упавшей кнопки — всегда; узел кнопки и её имя — у каждой строки', async () => {
    await mount(false)
    const rows = document.querySelectorAll('.data-grid__body-row').length
    expect(document.querySelectorAll('[aria-label^="Mark"]').length).toBe(rows)
    await expect.poll(() => [4, 5, 6, 7, 8].some(iconShown)).toBe(false)
    // Своё состояние кнопки видно без наведения — значок при нём есть.
    expect([1, 2, 3].map(iconShown)).toEqual([true, true, true])

    await userEvent.hover(cellAt(5, 'firstName'))
    await expect.poll(() => iconShown(5)).toBe(true)
    expect(iconShown(4)).toBe(false)
    await away()
    await expect.poll(() => iconShown(5)).toBe(false)

    mark(6).focus()
    await expect.poll(() => iconShown(6)).toBe(true)
    mark(6).blur()
    await expect.poll(() => iconShown(6)).toBe(false)

    const touch = (index: number) =>
      cellAt(index, 'firstName').dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          bubbles: true,
          composed: true,
        }),
      )
    touch(7)
    await expect.poll(() => iconShown(7)).toBe(true)
    touch(8)
    await expect.poll(() => [iconShown(7), iconShown(8)]).toEqual([false, true])

    // Открытое меню кнопки строки держит её значки, пока указатель на меню.
    await userEvent.hover(cellAt(9, 'firstName'))
    const kebab = rowAt(9).querySelector<HTMLElement>('[data-action-menu]')!
    await humanClick(kebab)
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await userEvent.hover(document.querySelector<HTMLElement>('[role="menu"]')!)
    await away()
    expect(iconShown(9)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    // Закрытое меню вернуло фокус на кебаб — строку держит уже фокус.
    expect(rowAt(9).contains(document.activeElement)).toBe(true)
    ;(document.activeElement as HTMLElement).blur()
    await away()
    await expect.poll(() => iconShown(9)).toBe(false)
  })

  test('PS5: кнопки появляются при наведении без сдвига раскладки, с прежним плавным проявлением', async () => {
    await mount(false)
    const before = [rowAt(5), rowAt(6)].map(row => row.getBoundingClientRect())
    const wrapper = () => mark(5).closest<HTMLElement>('.cell__button')!
    // Кадры проявления: значок уже есть, а обёртка ещё не проявилась целиком.
    const frames: { icon: boolean; opacity: number }[] = []
    await userEvent.hover(cellAt(5, COLUMN))
    for (let i = 0; i < 30; i++) {
      frames.push({
        icon: iconShown(5),
        opacity: Number(getComputedStyle(wrapper()).opacity),
      })
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    expect(frames.some(f => f.icon && f.opacity > 0 && f.opacity < 1)).toBe(
      true,
    )
    expect(frames.at(-1)).toEqual({ icon: true, opacity: 1 })
    const after = [rowAt(5), rowAt(6)].map(row => row.getBoundingClientRect())
    expect(after.map(r => [r.top, r.height])).toEqual(
      before.map(r => [r.top, r.height]),
    )
  })

  for (const keyboard of [false, true]) {
    test(`PS6: клавиатура до кнопок строки работает как прежде: Tab и режим действия доходят до кнопки любой строки, её значок появляется с фокусом; с keyboardNavigation и без (keyboardNavigation ${keyboard ? 'вкл' : 'выкл'})`, async () => {
      await mount(keyboard)
      if (keyboard) {
        await humanClick(cellAt(4, COLUMN))
        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(() => document.activeElement).toBe(cellAt(5, COLUMN))
        await expect.poll(() => iconShown(5)).toBe(true)
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => document.activeElement).toBe(mark(5))
        await away()
        expect(iconShown(5)).toBe(true)
        return
      }
      // Без навигации кнопки — остановки Tab: от кнопки строки 4 Tab доходит до строки 5.
      mark(4).focus()
      for (let i = 0; i < 10 && !rowAt(5).contains(document.activeElement); i++)
        await userEvent.keyboard('{Tab}')
      expect(rowAt(5).contains(document.activeElement)).toBe(true)
      await away()
      await expect.poll(() => iconShown(5)).toBe(true)
      expect(iconShown(4)).toBe(false)
    })
  }
})
