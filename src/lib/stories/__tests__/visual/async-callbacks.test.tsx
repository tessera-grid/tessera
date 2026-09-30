import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { Stories, bodyRows, headCells } from '../helpers'

// Асинхронный контракт бизнес-колбэков (ADR 0041, AS2–AS3): сохранение с промисом
// отделяет ячейку в ожидание, правка других ячеек не ждёт сервера. AS1, AS4, AS8–AS9
// — модульные (`src/lib/__tests__/asyncCallbacks.dom.test.tsx`).

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 30,
}

const allow = () => true
/** Сервер, который не отвечает: ячейка остаётся в ожидании. */
const never = () => new Promise<void>(() => {})

const ageCell = (index: number) =>
  bodyRows()
    .find(row => row.dataset.index === String(index))!
    .querySelector<HTMLElement>('.data-grid__body-cell[data-column-id="age"]')!

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

/** Открыть правку ячейки `age` строки и ввести `value`. */
const openAndType = async (index: number, value: string) => {
  await userEvent.hover(ageCell(index))
  await userEvent.click(
    ageCell(index).querySelector<HTMLElement>('.cell__button button')!,
  )
  await expect.poll(() => ageCell(index).querySelector('input')).not.toBeNull()
  const input = ageCell(index).querySelector<HTMLInputElement>('input')!
  await userEvent.clear(input)
  await userEvent.type(input, value)
  return input
}

describe('Асинхронный контракт бизнес-колбэков', () => {
  test('AS2: onCellEdit вернул промис — редактор закрыт, ячейка показывает отправленное значение с aria-busy, кнопки правки нет, Enter игнорируется', async () => {
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEdit={allow}
        onCellEdit={never}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')

    const busy = () => ageCell(0).querySelector('[aria-busy="true"]')
    await expect.poll(busy).not.toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(busy()!.textContent).toBe('999')

    await userEvent.hover(ageCell(0))
    expect(ageCell(0).querySelector('.cell__button button')).toBeNull()

    await userEvent.click(ageCell(0))
    await userEvent.keyboard('{Enter}')
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(busy()).not.toBeNull()
  })

  test('AS3: пока ячейка ожидает, другую ячейку можно править', async () => {
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
        onCellEdit={never}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .not.toBeNull()

    const input = await openAndType(1, '42')
    expect(input.value).toBe('42')
    expect(ageCell(0).querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})
