import { virtual } from '@guidepup/virtual-screen-reader'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { Stories, bodyRows, renderGrid } from '../helpers'
import { plainGroupingArgs } from '../stories'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'
import { rowSelectionModelLabels } from '../../../plugins/rowSelectionModel/labels'
import { DataGrid } from '../../../grid/DataGrid'
import { useCreateTable } from '../../../core/useCreateTable'
import { pagination, rowExpanding } from '../../../plugins'

// Уровень 2 (ADR 0033): эмулятор скринридера `@guidepup/virtual-screen-reader`
// слушает фокус и live-области реального DOM; грид ведётся реальными клавишами,
// сверяется журнал произнесённых фраз. Каждое требование — свой тест `SR<n>`.

const settle = () => new Promise(resolve => setTimeout(resolve, 300))
const spoken = () => virtual.spokenPhraseLog()

interface TreeItem {
  id: string
  name: string
  subRows?: TreeItem[]
}

/** Дерево по страницам: 60 строк верхнего уровня, у каждой третьей — вложенные (ADR 0226). */
const PagedTree = () => {
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: Array.from({ length: 60 }, (_, index): TreeItem => ({
      id: `r${index}`,
      name: `Name ${index}`,
      subRows:
        index % 3 === 0
          ? [{ id: `r${index}.0`, name: `Child ${index}` }]
          : undefined,
    })),
    getRowId: (row: TreeItem) => row.id,
    getSubRows: (row: TreeItem) => row.subRows,
    plugins: [
      rowExpanding(),
      pagination({ initialPageSize: 25, pageNumbers: false }),
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 500 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

afterEach(async () => {
  await virtual.stop()
})

describe('Эмулятор скринридера (SR)', () => {
  test('SR1: вход в грид по Tab озвучивает активную ячейку', async () => {
    await render(
      <>
        <button id="before-grid">before</button>
        {/* Без тулбара «Настроек вида»: его остановка Tab стояла бы перед гридом (TB11). */}
        <Stories.KeyboardPlayground enableToolbar={false} />
      </>,
    )
    await waitForGrid()
    await virtual.start({ container: document.body })
    document.getElementById('before-grid')!.focus()

    await userEvent.keyboard('{Tab}')
    await settle()
    expect((await spoken()).at(-1)).toMatch(/^(columnheader|gridcell), /)
  })

  test('SR2: Enter на заголовке сортирует и объявляет «Sorted by …»', async () => {
    await renderGrid({
      columnCount: 3,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableColumnSorting: true,
    })
    await waitForGrid()
    await virtual.start({ container: document.body })
    document
      .querySelector<HTMLElement>(
        '.data-grid__head-cell[data-kn-cell]:not([data-actions-column-cell="true"])',
      )!
      .focus()

    await userEvent.keyboard('{Enter}')
    await settle()
    expect(await spoken()).toContainEqual(
      expect.stringMatching(/^polite: Sorted by .+, (ascending|descending)$/),
    )
  })

  test('SR3: Space на строке выбирает её и объявляет «1 row selected»', async () => {
    await renderGrid({
      columnCount: 3,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableRowSelection: true,
    })
    await waitForGrid()
    await virtual.start({ container: document.body })
    bodyRows()[0].querySelectorAll<HTMLElement>('[data-kn-cell]')[1].focus()

    await userEvent.keyboard(' ')
    await settle()
    expect(await spoken()).toContain(
      `polite: ${rowSelectionModelLabels(tableLabels).announceSelection(1)}`,
    )
  })

  test('SR4: правка ячейки — поле «Edit …», недопустимое значение объявляет ошибку', async () => {
    await renderGrid({
      columnCount: 6,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableCellEditing: true,
      validateCellEdit: (value: string) =>
        /^\d+$/.test(value) ? null : 'Digits only',
    })
    await waitForGrid()
    await virtual.start({ container: document.body })
    document
      .querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="0"] .data-grid__body-cell[data-column-id="age"]',
      )!
      .focus()

    await userEvent.keyboard('{Enter}')
    await settle()
    expect((await spoken()).at(-1)).toMatch(/^textbox, Edit Age, /)

    const input = document.activeElement as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '-1{Enter}')
    await settle()
    expect(await spoken()).toContain('assertive: Digits only')
  })

  test('SR5: копирование выделения объявляет «Copied … cells»', async () => {
    await renderGrid({
      columnCount: 3,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableCellSelection: true,
    })
    await waitForGrid()
    await virtual.start({ container: document.body })
    const cell = bodyRows()[0].querySelector<HTMLElement>(
      '.data-grid__body-cell[data-cell-selectable]',
    )!
    await userEvent.click(cell)
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    cell.dispatchEvent(
      new ClipboardEvent('copy', {
        bubbles: true,
        clipboardData: new DataTransfer(),
      }),
    )
    await settle()
    expect(await spoken()).toContain('polite: Copied 2 cells')
  })

  test('SR6: перестановка строки Alt+Shift+↓ — фокус следует и озвучивается', async () => {
    await render(<Stories.RowDraggingPlayground enableKeyboardNavigation />)
    await waitForGrid()
    await virtual.start({ container: document.body })
    const moved = bodyRows()[0].getAttribute('data-row-id')
    const cell =
      bodyRows()[0].querySelectorAll<HTMLElement>('[data-kn-cell]')[1]
    const text = cell.textContent!.trim()
    cell.focus()
    await settle()
    await virtual.clearSpokenPhraseLog()

    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
    await settle()
    expect(
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id'),
    ).toBe(moved)
    // После перестановки фокус возвращается на ту же ячейку — она озвучивается.
    expect((await spoken()).at(-1)?.startsWith(`gridcell, ${text}`)).toBe(true)
  })

  test('SR7: фокус на строке treegrid озвучивает раскрытие, уровень и позицию', async () => {
    await render(
      <Stories.RowGroupingPlayground
        {...plainGroupingArgs}
        enableKeyboardNavigation
        enableRowExpanding
        initialGrouping={['gender']}
      />,
    )
    await waitForGrid()
    await virtual.start({ container: document.body })
    bodyRows()[0].querySelector<HTMLElement>('[data-kn-cell]')!.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect((await spoken()).at(-1)).toMatch(
      /^row, .*, not expanded, level 1, position 1, .*set size \d+$/,
    )
  })

  test('SZ6: на второй странице фокус на строке верхнего уровня озвучивает её позицию среди всех строк верхнего уровня списка', async () => {
    await render(<PagedTree />)
    await waitForGrid()
    await userEvent.click(
      document.querySelector<HTMLElement>('[data-page-action="next"]')!,
    )
    await expect
      .poll(() => bodyRows()[0]?.getAttribute('data-row-id'))
      .toBe('r25')
    await virtual.start({ container: document.body })
    // Строка без вложенных: ← переводит фокус с ячейки на строку.
    bodyRows()[1]!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect((await spoken()).at(-1)).toMatch(
      /^row, .*level 1, position 27, .*set size 60$/,
    )
  })
})
