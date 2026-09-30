import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { Stories, bodyRows, headCells } from '../helpers'
import { composed } from '../stories'

// Асинхронный контракт бизнес-колбэков (ADR 0041, AS2–AS3, AS5–AS6, AS11): сохранение с
// промисом отделяет ячейку в ожидание, правка других ячеек не ждёт сервера, отказ —
// «ошибка» с черновиком; раскрытие ждёт подгрузки. AS1, AS4, AS7–AS10, AS12 —
// модульные
// (`src/lib/__tests__/asyncCallbacks.dom.test.tsx`).

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

/** Сервер, ответ которого задаёт тест: `settle[i]` — итог i-го сохранения. */
const controlledServer = () => {
  const settle: { resolve: () => void; reject: (reason: unknown) => void }[] =
    []
  const onCellEdit = () =>
    new Promise<void>((resolve, reject) => settle.push({ resolve, reject }))
  return { settle, onCellEdit }
}

const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!

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

  test('AS5: промис отклонён — ячейка в «ошибке» с меткой и текстом, отказ объявлен; активная правка другой ячейки не тронута', async () => {
    const server = controlledServer()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    const original = ageCell(0).textContent
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(1)
    const active = await openAndType(1, '42')

    server.settle[0].reject(new Error('Server down'))
    const failed = () =>
      ageCell(0).querySelector<HTMLElement>('[aria-invalid="true"]')
    await expect.poll(failed).not.toBeNull()
    expect(ageCell(0).textContent).toContain(original)
    expect(failed()!.querySelector('svg')).not.toBeNull()
    const description = document.getElementById(
      failed()!.getAttribute('aria-describedby')!,
    )
    expect(description!.textContent).toBe('Server down')
    expect(failed()!.title).toBe('Server down')
    await expect
      .poll(() => liveRegion().textContent)
      .toContain('Age: Server down')

    expect(ageCell(1).querySelector('input')).toBe(active)
    expect(active.value).toBe('42')
    expect(document.activeElement).toBe(active)
  })

  test('AS6: из «ошибки» кнопка правки открывает редактор с черновиком и текстом ошибки; успешное сохранение снимает ошибку', async () => {
    const server = controlledServer()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(1)
    server.settle[0].reject(new Error('Server down'))
    await expect
      .poll(() => ageCell(0).querySelector('[aria-invalid="true"]'))
      .not.toBeNull()

    await userEvent.hover(ageCell(0))
    await userEvent.click(
      ageCell(0).querySelector<HTMLElement>('.cell__button button')!,
    )
    await expect.poll(() => ageCell(0).querySelector('input')).not.toBeNull()
    const input = ageCell(0).querySelector<HTMLInputElement>('input')!
    expect(input.value).toBe('999')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(ageCell(0).querySelector('[role="alert"]')!.textContent).toBe(
      'Server down',
    )

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(2)
    server.settle[1].resolve()
    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .toBeNull()
    expect(ageCell(0).querySelector('[aria-invalid="true"]')).toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
  })

  test('AS11: onExpandRow вернул промис при раскрытии — кнопка раскрытия в ожидании, строка с aria-busy, повторное нажатие игнорируется', async () => {
    const onExpandRow = vi.fn(() => new Promise<void>(() => {}))
    const { container } = await render(
      <composed.RowExpanding onExpandRow={onExpandRow} />,
    )
    const firstExpandable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>('.data-grid__body-row'),
      ).find(row => row.querySelector('.row-expand-button'))!
    await expect.poll(() => firstExpandable()).toBeTruthy()
    const toggle = () =>
      firstExpandable().querySelector<HTMLElement>('.row-expand-button')!

    await userEvent.click(toggle())
    await expect
      .poll(() => firstExpandable().getAttribute('aria-busy'))
      .toBe('true')
    expect(firstExpandable().getAttribute('data-expanded')).toBe('true')
    expect(toggle().getAttribute('aria-busy')).toBe('true')

    await userEvent.click(toggle())
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(onExpandRow).toHaveBeenCalledTimes(1)
    expect(firstExpandable().getAttribute('data-expanded')).toBe('true')
    expect(firstExpandable().getAttribute('aria-busy')).toBe('true')
  })
})
