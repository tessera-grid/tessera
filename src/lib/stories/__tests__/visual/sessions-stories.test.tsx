import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { bodyRows, humanClick } from '../helpers'
import { composed } from '../stories'
import { dragRowOnto, rowIdOrder } from '../../rowDragging.dnd'

// Дымовые тесты демо-историй «Sessions & Async» (ADR 0042, DS1–DS5): история
// рендерится, её главный сценарий виден в интерфейсе и журнале колбэков.
// Взаимодействие — в темпе человека (humanClick, ADR 0021, KN30).

const log = () =>
  document.querySelector<HTMLElement>('[data-testid="callback-log"]')!.innerText

const rowAt = (index: number) =>
  bodyRows().find(row => row.dataset.index === String(index))!

const ageCell = (index: number) =>
  rowAt(index).querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="age"]',
  )!

const waitForRows = () =>
  expect.poll(() => bodyRows().length).toBeGreaterThan(3)

/** Открыть правку ячейки `age` строки кнопкой и ввести `value`. */
const editAge = async (index: number, value: string) => {
  await userEvent.hover(ageCell(index))
  await humanClick(
    ageCell(index).querySelector<HTMLElement>('.cell__button button')!,
  )
  await expect.poll(() => ageCell(index).querySelector('input')).not.toBeNull()
  const input = ageCell(index).querySelector<HTMLInputElement>('input')!
  await userEvent.clear(input)
  await userEvent.type(input, value)
  return input
}

describe('Демо-истории Sessions & Async', () => {
  test('DS1: «Cell Editing — server» — ячейка ждёт сервера, затем показывает новое значение; в журнале onCellEdit и saved', async () => {
    await render(<composed.CellEditingServer serverDelayMs={300} />)
    await waitForRows()
    await editAge(0, '77')
    await userEvent.keyboard('{Enter}')

    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .not.toBeNull()
    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .toBeNull()
    expect(ageCell(0).textContent).toContain('77')
    expect(log()).toContain('onCellEdit')
    expect(log()).toContain('saved age of row-0')
  })

  test('DS2: «Cell Editing — sessions» — изменение извне не закрывает редактор; onCellEdit в журнале с original и current', async () => {
    await render(<composed.CellEditingSessions />)
    await waitForRows()
    const input = await editAge(0, '55')

    await humanClick(
      Array.from(document.querySelectorAll('button')).find(
        button => button.textContent === 'Change first row age externally',
      )!,
    )
    await expect.poll(() => log()).toContain('external')
    expect(document.activeElement).toBe(input)

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => log()).toContain('onCellEdit')
    expect(log()).toMatch(/value="55" original=\d+ current=\d+/)
  })

  test('DS3: «Drag & resize callbacks» — бросок строки мышью пишет onRowDragEnd в журнал', async () => {
    await render(<composed.SessionCallbacks />)
    await waitForRows()
    const [dropped] = rowIdOrder(document.body)

    await dragRowOnto(rowAt(0), rowAt(3))
    await expect.poll(() => log()).toContain('onRowDragEnd')
    expect(log()).toContain(`rowId="${dropped}"`)
  })

  test('DS4: «Row Expanding — lazy load» — раскрытие ждёт подгрузки, затем строка раскрыта; в журнале onExpandRow и loaded', async () => {
    await render(<composed.RowExpandingLazy loadDelayMs={300} />)
    await waitForRows()

    await humanClick(rowAt(0).querySelector<HTMLElement>('.row-expand-button')!)
    await expect.poll(() => rowAt(0).getAttribute('aria-busy')).toBe('true')
    await expect.poll(() => rowAt(0).getAttribute('aria-busy')).toBeNull()
    expect(rowAt(0).getAttribute('data-expanded')).toBe('true')
    expect(log()).toContain('onExpandRow')
    expect(log()).toContain('loaded')
  })

  test('DS5: «Plugin arguments on the fly» — maxDepth ниже раскрытого уровня прячет раскрытие, возврат значения возвращает', async () => {
    const screen = await render(
      <composed.ReactiveArgs rowExpandingMaxDepth={3} />,
    )
    await waitForRows()
    await humanClick(rowAt(0).querySelector<HTMLElement>('.row-expand-button')!)
    await expect.poll(() => rowAt(0).getAttribute('data-expanded')).toBe('true')
    await humanClick(rowAt(1).querySelector<HTMLElement>('.row-expand-button')!)
    await expect.poll(() => rowAt(1).getAttribute('data-expanded')).toBe('true')

    await screen.rerender(<composed.ReactiveArgs rowExpandingMaxDepth={1} />)
    await expect.poll(() => rowAt(1).getAttribute('data-expanded')).toBeNull()
    expect(rowAt(0).getAttribute('data-expanded')).toBe('true')

    await screen.rerender(<composed.ReactiveArgs rowExpandingMaxDepth={3} />)
    await expect.poll(() => rowAt(1).getAttribute('data-expanded')).toBe('true')
  })
})
