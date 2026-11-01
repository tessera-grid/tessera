import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useMemo, useState } from 'react'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, type CellEditCommit } from '../../../plugins'
import { isThenable } from '../../../util/thenable'
import { headCells, humanClick, revealCellButtons } from '../helpers'
import { RU_LABELS } from '../../__mocks__/localization.ru'
import { storyLabels } from '../../__mocks__/storyLabels'

// Встроенные редакторы по типу (ADR 0175, ED4–ED5) настоящими событиями: поле числа на
// языке таблицы, булево одним нажатием. ED1–ED3 — модульные (`cellEditWrite.dom`,
// `typedEditors.dom`).

const ru = storyLabels('ru')

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', dataType: 'text' },
  { id: 'price', accessorKey: 'price', header: 'Price', dataType: 'number' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'numberString',
  },
  {
    id: 'inStock',
    accessorKey: 'inStock',
    header: 'In stock',
    dataType: 'boolean',
  },
]
const ROWS = [
  {
    id: 'p1',
    name: 'Lamp',
    price: 1234.5,
    amount: '12345678901234567.89',
    inStock: false,
  },
  { id: 'p2', name: 'Desk', price: 80, amount: '1', inStock: true },
]

const cellOf = (column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="p1"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const inputOf = (column: string) => cellOf(column).querySelector('input')
const checked = () =>
  !!cellOf('inStock').querySelector('.check-mark[data-checked]')

/** Таблица на русском: сохранение пишет значение в данные — сразу или после ответа. */
const Host = ({
  onCellEdit,
}: {
  onCellEdit: (commit: CellEditCommit) => unknown
}) => {
  const [rows, setRows] = useState(ROWS)
  const plugins = useMemo(
    () => [
      cellEditing({
        onCellEdit: commit => {
          const write = () =>
            setRows(prev =>
              prev.map(row =>
                row.id === commit.rowId
                  ? { ...row, [commit.columnId]: commit.value }
                  : row,
              ),
            )
          const result = onCellEdit(commit)
          if (!isThenable(result)) {
            write()
            return
          }
          return result.then(write)
        },
      }),
    ],
    [onCellEdit],
  )
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: rows,
    plugins,
    locale: 'ru-RU',
    enableKeyboardNavigation: true,
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table} localization={RU_LABELS} />
    </div>
  )
}

const renderGrid = (onCellEdit: (commit: CellEditCommit) => unknown) =>
  render(<Host onCellEdit={onCellEdit} />)

const openEdit = async (column: string) => {
  await revealCellButtons(cellOf(column))
  await humanClick(
    cellOf(column).querySelector<HTMLElement>('.cell__button button')!,
  )
}

const retype = async (column: string, text: string) => {
  await expect.poll(() => inputOf(column)).not.toBeNull()
  await userEvent.clear(inputOf(column)!)
  await userEvent.type(inputOf(column)!, text)
}

describe('редакторы по типу (ADR 0175)', () => {
  test('ED4: число и numberString — поле показывает значение с десятичным знаком языка таблицы без разрядов и принимает ввод по языку; не число — ошибка поля из словаря без сохранения; пустое поле — null; numberString сохраняется десятичной строкой без float', async () => {
    const onCellEdit = vi.fn()
    await renderGrid(onCellEdit)
    await expect.poll(() => headCells().length).toBeGreaterThan(0)

    await openEdit('price')
    await expect.poll(() => inputOf('price')?.value).toBe('1234,5')
    expect(inputOf('price')).toHaveAttribute('inputmode', 'decimal')

    await retype('price', 'abc{Enter}')
    await expect
      .poll(() => inputOf('price')?.getAttribute('aria-invalid'))
      .toBe('true')
    expect(cellOf('price').querySelector('[role="alert"]')!.textContent).toBe(
      ru.editInvalidNumber,
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await retype('price', '1 250,75{Enter}')
    await expect.poll(() => inputOf('price')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 1250.75, text: '1 250,75' }),
    )

    await openEdit('price')
    await retype('price', '{Enter}')
    await expect.poll(() => inputOf('price')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: null }),
    )

    await openEdit('amount')
    await expect
      .poll(() => inputOf('amount')?.value)
      .toBe('12345678901234567,89')
    await retype('amount', '98765432109876543,21{Enter}')
    await expect.poll(() => inputOf('amount')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: '98765432109876543.21' }),
    )
  })

  test('ED5: булево — кнопка правки, Enter, F2 и Space сразу переключают значение и сохраняют его без поля; ожидание и отказ — как у правки', async () => {
    let answer: 'now' | 'hold' | 'refuse' = 'now'
    let release = () => {}
    const onCellEdit = vi.fn(() => {
      if (answer === 'now') return undefined
      return new Promise<void>((resolve, reject) => {
        release = () =>
          answer === 'refuse' ? reject(new Error('Refused')) : resolve()
      })
    })
    await renderGrid(onCellEdit)
    await expect.poll(() => headCells().length).toBeGreaterThan(0)

    await openEdit('inStock')
    await expect.poll(checked).toBe(true)
    expect(inputOf('inStock')).toBeNull()
    expect(cellOf('inStock').querySelector('[role="checkbox"]')).toBeNull()

    cellOf('inStock').focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(checked).toBe(false)
    await userEvent.keyboard('{F2}')
    await expect.poll(checked).toBe(true)
    await userEvent.keyboard(' ')
    await expect.poll(checked).toBe(false)
    expect(onCellEdit.mock.calls.map(call => (call as never[])[0])).toEqual([
      expect.objectContaining({ value: true, original: false }),
      expect.objectContaining({ value: false, original: true }),
      expect.objectContaining({ value: true, original: false }),
      expect.objectContaining({ value: false, original: true }),
    ])

    // Ожидание — на кнопке правки, отказ — отметка и значение из данных.
    answer = 'refuse'
    await userEvent.keyboard(' ')
    const button = () =>
      cellOf('inStock').querySelector<HTMLElement>('.cell__button button')
    await expect.poll(() => button()?.getAttribute('aria-busy')).toBe('true')
    expect(checked()).toBe(true)
    release()
    await expect
      .poll(() => !!cellOf('inStock').querySelector('[data-failure-indicator]'))
      .toBe(true)
    expect(checked()).toBe(false)
  })
})
