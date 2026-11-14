import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DataGrid } from '../../../grid/DataGrid'
import { useCreateTable } from '../../../core/useCreateTable'
import { pagination, rowExpanding } from '../../../plugins'
import { AXE_OPTIONS } from './a11y-helpers'

// Сквозные aria-posinset/aria-setsize строк верхнего уровня через страницы (ADR 0226, SZ2).
// SZ1, SZ3–SZ4 — модульные (`src/lib/__tests__/treeAria.dom.test.tsx`), SZ5 — в
// `server-row-model`, SZ6 — в `screen-reader`.

interface Item {
  id: string
  name: string
  subRows?: Item[]
}

const ROOTS = 60
const PAGE = 25

/** У каждой третьей строки верхнего уровня — две вложенные. */
const DATA: Item[] = Array.from({ length: ROOTS }, (_, index) => ({
  id: `r${index}`,
  name: `Name ${index}`,
  subRows:
    index % 3 === 0
      ? [0, 1].map(child => ({
          id: `r${index}.${child}`,
          name: `Child ${index}.${child}`,
        }))
      : undefined,
}))

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

const Grid = ({
  keyboard,
  colorMode,
}: {
  keyboard: boolean
  colorMode?: 'light' | 'dark'
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: [
      rowExpanding({ initialExpanded: true }),
      pagination({ initialPageSize: PAGE, pageNumbers: false }),
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 500 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const topLevelRows = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[aria-level="1"]',
    ),
  )
const ariaOf = (row: HTMLElement | undefined) =>
  row && [
    row.dataset.rowId,
    row.getAttribute('aria-posinset'),
    row.getAttribute('aria-setsize'),
  ]
const nextPage = () => q<HTMLButtonElement>('[data-page-action="next"]')!

describe('aria-* дерева сквозь страницы (ADR 0226)', () => {
  test('SZ2: в роли treegrid переход на следующую страницу кнопкой пейджера и с клавиатуры даёт сквозные aria-posinset и aria-setsize у первой и последней строки верхнего уровня; без клавиатурной навигации атрибутов уровня нет; axe в роли treegrid в обеих темах', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      const screen = await render(<Grid keyboard colorMode={colorMode} />)
      try {
        await expect.poll(() => q('[role="treegrid"]')).not.toBeNull()
        await expect
          .poll(() => ariaOf(topLevelRows()[0]))
          .toEqual(['r0', '1', `${ROOTS}`])

        // Мышью: вторая страница.
        await userEvent.click(nextPage())
        await expect
          .poll(() => ariaOf(topLevelRows()[0]))
          .toEqual(['r25', '26', `${ROOTS}`])
        // Окно виртуализации может не показать хвост страницы: последняя — прокруткой.
        const scroller = q('.data-grid__container')!
        scroller.scrollTop = scroller.scrollHeight
        await expect
          .poll(() => ariaOf(topLevelRows().at(-1)))
          .toEqual(['r49', '50', `${ROOTS}`])

        // С клавиатуры: фокус на кнопке пейджера и Enter — третья страница.
        nextPage().focus()
        await userEvent.keyboard('{Enter}')
        await expect
          .poll(() => ariaOf(topLevelRows()[0]))
          .toEqual(['r50', '51', `${ROOTS}`])
        scroller.scrollTop = scroller.scrollHeight
        await expect
          .poll(() => ariaOf(topLevelRows().at(-1)))
          .toEqual(['r59', '60', `${ROOTS}`])

        const { violations } = await axe.run(q('.data-grid-theme')!, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(violations).toEqual([])
      } finally {
        await screen.unmount()
      }
    }

    // Без клавиатурной навигации — роль table, атрибутов уровня у строк нет (W10).
    const screen = await render(<Grid keyboard={false} />)
    try {
      await expect.poll(() => q('[role="table"]')).not.toBeNull()
      await expect
        .poll(() => q('.data-grid__body-row[data-row-id="r0"]'))
        .not.toBeNull()
      await userEvent.click(nextPage())
      await expect
        .poll(() => q('.data-grid__body-row[data-row-id="r25"]'))
        .not.toBeNull()
      expect(
        q(
          '.data-grid__body-row[aria-level], .data-grid__body-row[aria-setsize]',
        ),
      ).toBeNull()
    } finally {
      await screen.unmount()
    }
  })
})
