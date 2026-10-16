import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { COLUMN_SELECTION_ID } from '../../../plugins/rowSelection/rowSelectionColumn'
import { Stories } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Плагины модели без интерфейса (ADR 0120): видимое состояние модели без контролов.

type Args = Partial<Parameters<typeof Stories.AllFeatures>[0]>

const BASE: Args = {
  containerHeight: 600,
  height: 500,
  columnCount: 5,
  dataCount: 30,
}

const SELECTED = 'item-id-1'
const OTHER = 'item-id-2'

const cellEl = (row: string, column: string) =>
  rowEl(row)!.querySelector<HTMLElement>(`[data-column-id="${column}"]`)!
const selectedCells = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      ".data-grid__body-cell[data-cell-selected='true']",
    ),
  ].map(
    cell =>
      `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}/${cell.dataset.columnId}`,
  )

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )

describe('Плагины модели без интерфейса (ADR 0120)', () => {
  test('MP13: rowSelectionModel без колонки флажков — выбранная строка залита выбором и несёт aria-selected; axe с color-contrast в обеих темах', async () => {
    const screen = await render(
      <Stories.AllFeatures
        {...BASE}
        enableRowSelectionModel
        enableKeyboardNavigation
        rowSelectionModelRowSelection={{ [SELECTED]: true }}
      />,
    )
    await expect.poll(() => rowEl(SELECTED)).not.toBeNull()
    expect(
      document.querySelector(`[data-column-id="${COLUMN_SELECTION_ID}"]`),
    ).toBeNull()

    const selected = rowEl(SELECTED)!
    const other = rowEl(OTHER)!
    expect(selected.getAttribute('data-selected')).toBe('true')
    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(other.getAttribute('aria-selected')).toBe('false')
    expect(getComputedStyle(selected).backgroundColor).not.toBe(
      getComputedStyle(other).backgroundColor,
    )

    const grid = document.querySelector<HTMLElement>('[role="grid"]')!
    expect(grid).not.toBeNull()
    await inBothThemes(async () => {
      const result = await axe.run(grid, {
        ...AXE_OPTIONS,
        rules: {
          ...AXE_OPTIONS.rules,
          'color-contrast': { enabled: true },
        },
      })
      expect(result.violations).toEqual([])
    })
    await screen.unmount()
  })

  test('MP14: cellSelectionModel подсвечивает диапазоны из среза; мышь, клавиши и копирование выделение не меняют и не копируют', async () => {
    const range = [
      {
        anchorRowId: 'item-id-1',
        anchorColumnId: 'firstName',
        focusRowId: 'item-id-2',
        focusColumnId: 'lastName',
      },
    ]
    const screen = await render(
      <Stories.AllFeatures
        {...BASE}
        enableCellSelectionModel
        enableKeyboardNavigation
        cellSelectionModelInitialCellSelection={range}
      />,
    )
    const highlighted = [
      'item-id-1/firstName',
      'item-id-1/lastName',
      'item-id-2/firstName',
      'item-id-2/lastName',
    ]
    await expect.poll(() => selectedCells().sort()).toEqual(highlighted)

    await userEvent.click(cellEl('item-id-5', 'country'))
    await expect
      .poll(() => cellEl('item-id-5', 'country').hasAttribute('data-kn-active'))
      .toBe(true)
    await userEvent.keyboard(
      '{ArrowDown}{Shift>}{ArrowDown}{ArrowRight}{/Shift}',
    )
    expect(selectedCells().sort()).toEqual(highlighted)

    const data = new DataTransfer()
    const copy = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    })
    cellEl('item-id-1', 'firstName').dispatchEvent(copy)
    expect(copy.defaultPrevented).toBe(false)
    expect(data.getData('text/plain')).toBe('')
    await screen.unmount()
  })
})
