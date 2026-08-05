import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import {
  SEL,
  bodyRows,
  headCells,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from './helpers'

// Requirement #2: the table renders columns and rows according to the args.
// - Small sets fit the viewport → nothing is virtualized → exact DOM counts.
// - Large sets are virtualized → a subset renders, but the full set stays
//   reachable (scrolling to the far edge reveals the last row / column).

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe('exact counts when everything fits the viewport', () => {
  test.for([
    { columnCount: 3, dataCount: 3 },
    { columnCount: 5, dataCount: 6 },
  ])(
    'renders %o columns and rows exactly',
    async ({ columnCount, dataCount }) => {
      renderGrid({ columnCount, dataCount })
      await waitForGrid()

      expect(headCells()).toHaveLength(columnCount)

      const rows = bodyRows()
      expect(rows).toHaveLength(dataCount)

      // every row has exactly one cell per column
      rows.forEach(row => {
        expect(row.querySelectorAll(SEL.bodyCell)).toHaveLength(columnCount)
      })

      // rows are indexed 0..dataCount-1
      expect(renderedRowIndexes().sort((a, b) => a - b)).toEqual(
        Array.from({ length: dataCount }, (_, i) => i),
      )
    },
  )
})

describe('virtualization with a large data set', () => {
  const columnCount = 30
  const dataCount = 200

  test('renders only a subset of rows and columns', async () => {
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    const rows = bodyRows().length
    const cols = headCells().length

    expect(rows).toBeGreaterThan(0)
    expect(rows).toBeLessThan(dataCount)
    expect(cols).toBeGreaterThan(0)
    expect(cols).toBeLessThan(columnCount)

    // the first row is at the top
    expect(Math.min(...renderedRowIndexes())).toBe(0)
  })

  test('the last row becomes reachable by scrolling down', async () => {
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    await scrollToEnd('y')

    expect(Math.max(...renderedRowIndexes())).toBe(dataCount - 1)
  })

  test('the last column becomes reachable by scrolling right', async () => {
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    await scrollToEnd('x')

    expect(Math.max(...renderedColumnIndexes())).toBe(columnCount - 1)
  })
})
