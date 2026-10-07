import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { bodyRows, humanClick } from '../helpers'
import { composed } from '../stories'

// Дымовой тест истории «Sorting — option labels» (ADR 0063, OS12; по образцу ADR 0042):
// история рендерится, главный сценарий виден в интерфейсе.

const firstRowText = (columnId: string) =>
  bodyRows()[0]
    ?.querySelector(`[data-column-id="${columnId}"]`)
    ?.textContent?.trim()

const sortButton = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"] .column-sort__button`,
  )!

describe('Демо-история Sorting', () => {
  test('OS12: «Sorting — option labels» — Manager показывает имена, Status сортируется в порядке вариантов в обе стороны', async () => {
    await render(<composed.ColumnSortingOptionLabels />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    expect(firstRowText('managerId')).not.toMatch(/^m\d+$/)

    // Первый клик — по убыванию (sortDescFirst таблицы): последний вариант — первым,
    // пустые — внизу (OS6).
    await humanClick(sortButton('status'))
    await expect.poll(() => firstRowText('status')).toBe('Lost')
    await humanClick(sortButton('status'))
    await expect.poll(() => firstRowText('status')).toBe('Lead')
  })
})
