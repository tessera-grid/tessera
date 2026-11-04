import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useMemo, useState } from 'react'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import axe from 'axe-core'

import {
  cellEditing,
  rowSelection,
  type CellEditCommit,
} from '../../../plugins'
import { inBothThemes } from './a11y-helpers'
import { isThenable } from '../../../util/thenable'
import {
  failureShownOn,
  headCells,
  humanClick,
  pendingArcOf,
  revealCellButtons,
} from '../helpers'
import { RU_LABELS } from '../../__mocks__/localization.ru'
import { storyLabels } from '../../__mocks__/storyLabels'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'

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
const box = () =>
  cellOf('inStock').querySelector<HTMLElement>('[role="checkbox"]')
const checked = () => box()?.getAttribute('aria-checked') === 'true'
/** Смена данных извне посреди правки (ED22). */
let changeRows: (change: (rows: typeof ROWS) => typeof ROWS) => void = () => {}

/** Таблица на русском: сохранение пишет значение в данные — сразу или после ответа. */
const Host = ({
  onCellEdit,
  selection = false,
  onConflict,
}: {
  onCellEdit: (
    commit: CellEditCommit,
    context: { signal: AbortSignal },
  ) => unknown
  /** Выбор строк: пробел и Shift+Space (ED20). */
  selection?: boolean
  onConflict?: 'block'
}) => {
  const [rows, setRows] = useState(ROWS)
  changeRows = setRows
  const plugins = useMemo(
    () => [
      cellEditing({
        onCellEdit: (commit, context) => {
          const write = () =>
            setRows(prev =>
              prev.map(row =>
                row.id === commit.rowId
                  ? { ...row, [commit.columnId]: commit.value }
                  : row,
              ),
            )
          const result = onCellEdit(commit, context)
          if (!isThenable(result)) {
            write()
            return
          }
          return result.then(write)
        },
        onConflict,
      }),
      ...(selection ? [rowSelection()] : []),
    ],
    [onCellEdit, selection, onConflict],
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

const renderGrid = (
  onCellEdit: (
    commit: CellEditCommit,
    context: { signal: AbortSignal },
  ) => unknown,
  selection = false,
  onConflict?: 'block',
) =>
  render(
    <Host
      onCellEdit={onCellEdit}
      selection={selection}
      onConflict={onConflict}
    />,
  )

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
      cellEditingLabels(ru).editInvalidNumber,
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await retype('price', '1 250,75{Enter}')
    await expect.poll(() => inputOf('price')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 1250.75, text: '1 250,75' }),
      { signal: expect.any(AbortSignal) },
    )

    await openEdit('price')
    await retype('price', '{Enter}')
    await expect.poll(() => inputOf('price')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: null }),
      { signal: expect.any(AbortSignal) },
    )

    await openEdit('amount')
    await expect
      .poll(() => inputOf('amount')?.value)
      .toBe('12345678901234567,89')
    await retype('amount', '98765432109876543,21{Enter}')
    await expect.poll(() => inputOf('amount')).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: '98765432109876543.21' }),
      { signal: expect.any(AbortSignal) },
    )
  })

  test('ED5: булево — нажатие на флажок, Enter, F2 и Space сразу переключают значение и сохраняют его без поля; ожидание — дугой на флажке, отказ — вспышкой отката', async () => {
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

    await expect.poll(box).not.toBeNull()
    await humanClick(box()!)
    await expect.poll(checked).toBe(true)
    // Поля правки нет: у флажка — только скрытое поле формы Base UI.
    expect(
      cellOf('inStock').querySelector('input:not([aria-hidden="true"])'),
    ).toBeNull()
    // Флажок — не своя остановка Tab: фокус у ячейки.
    expect(box()).toHaveAttribute('tabindex', '-1')

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

    // Ожидание — дуга на флажке, новое значение уже видно; отказ — вспышка и значение из данных.
    answer = 'refuse'
    await userEvent.keyboard(' ')
    await expect.poll(() => box()?.getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(box()!.parentElement!)).not.toBeNull()
    expect(checked()).toBe(true)
    release()
    await expect
      .poll(() => cellOf('inStock').getAttribute('data-flash'))
      .toBe('reverted')
    expect(checked()).toBe(false)
    // Дуга гаснет переходом, затем уходит из DOM.
    await expect.poll(() => pendingArcOf(box()!.parentElement!)).toBeNull()
  })

  test('ED20: настоящими нажатиями — на редактируемой булевой ячейке Space переключает значение; Shift+Space на любой ячейке тела переключает выбор строки, в том числе на булевой; Space на остальных ячейках выбирает строку', async () => {
    const onCellEdit = vi.fn()
    await renderGrid(onCellEdit, true)
    await expect.poll(() => headCells().length).toBeGreaterThan(0)
    const selected = () =>
      document
        .querySelector('.data-grid__body-row[data-row-id="p1"]')!
        .getAttribute('data-selected') === 'true'

    cellOf('inStock').focus()
    await userEvent.keyboard(' ')
    await expect.poll(checked).toBe(true)
    expect(selected()).toBe(false)

    await userEvent.keyboard('{Shift>} {/Shift}')
    await expect.poll(selected).toBe(true)
    expect(checked()).toBe(true)
    expect(onCellEdit).toHaveBeenCalledTimes(1)

    cellOf('name').focus()
    await userEvent.keyboard(' ')
    await expect.poll(selected).toBe(false)
    await userEvent.keyboard('{Shift>} {/Shift}')
    await expect.poll(selected).toBe(true)
    expect(onCellEdit).toHaveBeenCalledTimes(1)
  })

  test('ED21: флажок редактируемой булевой ячейки — флажок кита по центру ячейки, нажатие во всю ячейку переключает значение, кнопки правки у ячейки нет; имя флажка — заголовок колонки; axe с color-contrast в обеих темах', async () => {
    const onCellEdit = vi.fn()
    await renderGrid(onCellEdit)
    await expect.poll(() => headCells().length).toBeGreaterThan(0)
    await expect.poll(box).not.toBeNull()
    expect(box()).toHaveClass('row-select-checkbox')
    expect(box()).toHaveAttribute('aria-checked', 'false')
    expect(box()).toHaveAttribute('aria-label', 'In stock')
    await revealCellButtons(cellOf('inStock'))
    expect(cellOf('inStock').querySelector('.cell__button button')).toBeNull()

    // У левого края, как текст в ячейке названия; по высоте — по центру.
    const cellBox = cellOf('inStock').getBoundingClientRect()
    const flag = box()!.getBoundingClientRect()
    const text = document.createRange()
    text.selectNodeContents(
      cellOf('name').querySelector('.data-grid__cell-wrapper-title') ??
        cellOf('name'),
    )
    const textStart =
      text.getBoundingClientRect().left -
      cellOf('name').getBoundingClientRect().left
    expect(Math.abs(flag.left - cellBox.left - textStart)).toBeLessThan(2)
    expect(
      Math.abs(flag.top + flag.height / 2 - (cellBox.top + cellBox.height / 2)),
    ).toBeLessThan(2)

    // Нажатие у правого края ячейки, мимо флажка.
    await userEvent.click(cellOf('inStock'), {
      position: { x: cellBox.width - 6, y: 6 },
    })
    await expect.poll(checked).toBe(true)
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'inStock', value: true }),
      { signal: expect.any(AbortSignal) },
    )

    await inBothThemes(async () => {
      const { violations } = await axe.run(cellOf('inStock'), {
        rules: { region: { enabled: false } },
      })
      expect(violations.map(item => item.id)).toEqual([])
    })
  })

  test("ED22: onConflict: 'block' — отклонение как отказ сервера: вспышка отката на ячейке, треугольник отказа ячейки с причиной, объявление; повторная правка открывается с черновиком и причиной", async () => {
    const onCellEdit = vi.fn()
    await renderGrid(onCellEdit, false, 'block')
    await expect.poll(() => headCells().length).toBeGreaterThan(0)

    await openEdit('name')
    await retype('name', 'Lantern')
    // Значение меняется извне, пока правка открыта.
    changeRows(rows =>
      rows.map(row => (row.id === 'p1' ? { ...row, name: 'Lamp v2' } : row)),
    )
    await expect
      .poll(() =>
        document.querySelector('.data-grid__body-row[data-row-id="p1"]'),
      )
      .not.toBeNull()
    expect(inputOf('name')?.value).toBe('Lantern')
    await userEvent.keyboard('{Enter}')

    await expect
      .poll(() => cellOf('name').getAttribute('data-flash'))
      .toBe('reverted')
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(inputOf('name')).toBeNull()
    const mark = () =>
      cellOf('name').querySelector<HTMLElement>('button[data-cell-issue]')
    await expect.poll(mark).not.toBeNull()
    const description = mark()!
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map(id => document.getElementById(id)?.textContent)
      .join(' ')
    expect(description).toContain(RU_LABELS['cellEditing.editConflict'])
    await expect
      .poll(() => document.querySelector('[aria-live]')?.textContent)
      .toContain(RU_LABELS['cellEditing.editConflict'])

    // Повторная правка — черновик и причина.
    await openEdit('name')
    await expect.poll(() => inputOf('name')?.value).toBe('Lantern')
    expect(cellOf('name').querySelector('[role="alert"]')?.textContent).toBe(
      RU_LABELS['cellEditing.editConflict'],
    )
  })
})
