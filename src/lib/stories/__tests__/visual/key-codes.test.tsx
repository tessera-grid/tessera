import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection } from '../../../plugins'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'

// Сочетания клавиш по коду клавиши, а не по букве раскладки (ADR 0220): KC1. Имя клавиши
// сочетания и страж — модульный `keyCodes`; Ctrl+D и Ctrl+R — WR19 в `fill`.

const COLUMNS = ['a', 'b', 'c'].map(id => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  size: 120,
}))
const DATA = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  a: `a${i}`,
  b: `b${i}`,
  c: `c${i}`,
}))

const Grid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    enableKeyboardNavigation: true,
    plugins: [cellSelection()],
  })
  return (
    <div style={{ width: 420, height: 320 }}>
      <DataGrid table={table as never} height={300} />
    </div>
  )
}

const cell = (row: string, column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const selected = () =>
  document.querySelectorAll('.data-grid__body-cell[data-cell-selected="true"]')
    .length
const ALL = DATA.length * COLUMNS.length

/** Нажатие с буквой одной раскладки на клавише с кодом другой. */
const press = (target: HTMLElement, key: string, code: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  )

describe('Сочетания клавиш по коду клавиши (ADR 0220)', () => {
  test('KC1: Ctrl/Cmd+A выделяет все ячейки по коду клавиши KeyA на любой раскладке: и с буквой «a», и с буквой другой раскладки; клавиша с буквой «a» на другом месте выделения не трогает', async () => {
    const screen = await render(<Grid />)
    await waitForGrid()
    try {
      // Настоящая клавиатура.
      await humanClick(cell('1', 'b'))
      await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')
      await expect.poll(selected).toBe(ALL)

      // Русская раскладка: на клавише KeyA буква «ф».
      await humanClick(cell('2', 'a'))
      await expect.poll(selected).toBe(1)
      press(cell('2', 'a'), 'ф', 'KeyA')
      await expect.poll(selected).toBe(ALL)

      // AZERTY: буква «a» на клавише KeyQ — это не Ctrl+A.
      await humanClick(cell('3', 'c'))
      await expect.poll(selected).toBe(1)
      press(cell('3', 'c'), 'a', 'KeyQ')
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(selected()).toBe(1)
    } finally {
      await screen.unmount()
    }
  })
})
