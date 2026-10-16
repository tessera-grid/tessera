import axe from 'axe-core'
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
})
