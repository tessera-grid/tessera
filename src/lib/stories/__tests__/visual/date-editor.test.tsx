import { ru } from '@daypicker/react/locale/ru'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, type CellEditCommit } from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'
import { waitForGrid } from './core-helpers'

// Редактор даты (ADR 0175, ED6) настоящими событиями: календарь в поясе и на языке таблицы,
// поле времени, Enter, Escape и фокус. Загрузка модуля календаря — `date-editor-chunk` (ED7).

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'day', accessorKey: 'day', header: 'Day', dataType: 'dateString' },
  {
    id: 'stamp',
    accessorKey: 'stamp',
    header: 'Stamp',
    dataType: 'dateTimeString',
  },
  { id: 'born', accessorKey: 'born', header: 'Born', dataType: 'date' },
  { id: 'meet', accessorKey: 'meet', header: 'Meet', dataType: 'dateTime' },
]
const ROWS = [
  {
    id: 'r1',
    name: 'Ann',
    day: '2026-03-15',
    // 09:30 в Токио.
    stamp: '2026-03-15T00:30:00Z',
    born: new Date('2026-03-15T03:00:00Z'),
    meet: new Date('2026-03-15T03:00:00Z'),
  },
]

const Grid = ({
  onCellEdit,
  onEditCancel,
}: {
  onCellEdit: (commit: CellEditCommit) => void
  onEditCancel: () => void
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    timeZone: 'Asia/Tokyo',
    dateLocale: ru,
    enableKeyboardNavigation: true,
    plugins: [cellEditing({ onCellEdit, onEditCancel })],
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} />
    </div>
  )
}

const cellOf = (column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="r1"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const popup = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-date"]')
const day = (iso: string) =>
  popup()!.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)!
const time = () =>
  popup()?.querySelector<HTMLElement>('[data-testid="edit-time"]') ?? null
/** Значение поля времени кита (ADR 0183, PK20). */
const timeValue = () => time()?.getAttribute('data-value')

const openEdit = async (column: string) => {
  await revealCellButtons(cellOf(column))
  await humanClick(
    cellOf(column).querySelector<HTMLElement>('.cell__button button')!,
  )
  await expect.poll(popup).not.toBeNull()
}

describe('редактор даты (ADR 0175)', () => {
  test('ED6: дата — поповер с календарём в поясе и на языке таблицы; у dateTime и dateTimeString — поле времени; значение — Date или строка формата типа; Enter сохраняет, Escape отменяет, фокус возвращается в ячейку', async () => {
    const onCellEdit = vi.fn()
    const onEditCancel = vi.fn()
    await render(<Grid onCellEdit={onCellEdit} onEditCancel={onEditCancel} />)
    await waitForGrid()

    // День без времени: календарь на языке таблицы, фокус — на выбранном дне; выбор сохраняет.
    await openEdit('day')
    expect(
      popup()!.querySelector('thead th')!.textContent!.trim().toLowerCase(),
    ).toMatch(/^пн/)
    await expect.poll(() => document.activeElement).toBe(day('2026-03-15'))
    expect(time()).toBeNull()
    await humanClick(day('2026-03-20'))
    await expect.poll(popup).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'day', value: '2026-03-20' }),
      { signal: expect.any(AbortSignal) },
    )
    await expect.poll(() => document.activeElement).toBe(cellOf('day'))

    // Escape — без сохранения, фокус в ячейке.
    onCellEdit.mockClear()
    await openEdit('day')
    await userEvent.keyboard('{Escape}')
    await expect.poll(popup).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalledTimes(1)
    await expect.poll(() => document.activeElement).toBe(cellOf('day'))

    // Момент строкой: день и время на часах пояса таблицы, Enter в поле времени сохраняет.
    await openEdit('stamp')
    expect(timeValue()).toBe('09:30')
    await humanClick(day('2026-03-16'))
    expect(popup()).not.toBeNull()
    // Время — сегментами: часы, минуты, половина суток (en-US — 12 часов).
    await humanClick(
      time()!.querySelector<HTMLElement>('[data-segment="hours"]')!,
    )
    await userEvent.keyboard('1045a')
    await userEvent.keyboard('{Enter}')
    await expect.poll(popup).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        columnId: 'stamp',
        value: '2026-03-16T01:45:00.000Z',
      }),
      { signal: expect.any(AbortSignal) },
    )
    await expect.poll(() => document.activeElement).toBe(cellOf('stamp'))

    // `date` — `Date` того же времени суток в новый день.
    await openEdit('born')
    await humanClick(day('2026-03-18'))
    await expect.poll(popup).toBeNull()
    const born = onCellEdit.mock.lastCall![0].value
    expect(born).toBeInstanceOf(Date)
    expect((born as Date).toISOString()).toBe('2026-03-18T03:00:00.000Z')

    // `dateTime` — `Date` из дня и времени; уход из поповера тоже сохраняет.
    await openEdit('meet')
    expect(timeValue()).toBe('12:00')
    await humanClick(day('2026-03-17'))
    await humanClick(cellOf('name'))
    await expect.poll(popup).toBeNull()
    const meet = onCellEdit.mock.lastCall![0].value
    expect(meet).toBeInstanceOf(Date)
    expect((meet as Date).toISOString()).toBe('2026-03-17T03:00:00.000Z')
  })
})
