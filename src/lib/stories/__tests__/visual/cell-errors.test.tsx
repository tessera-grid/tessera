import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { CellComponentProps } from '../../../core/createSlots'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellErrors,
  columnSortingModel,
  paginationModel,
  serverRowModel,
} from '../../../plugins'
import { columns as mockColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import { Stories, headCells, humanClick } from '../helpers'
import { tableLabels } from '../labels'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Ошибка в ячейке (ADR 0150, ER1–ER7): красный треугольник в правом верхнем углу ячейки с
// ошибкой приложения, один при любом содержимом (ADR 0177, §5); отказ сохранения — первым.

const ERROR_ROW = 'item-id-3'
const ERROR = 'Age must be 18 or more'

const errorAt =
  (rowId: string, text = ERROR) =>
  (ctx: CellComponentProps) =>
    ctx.row.id === rowId && ctx.column.id === 'age' ? text : undefined

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellOf = (id: string, column = 'age') =>
  rowOf(id)?.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  ) ?? null
/** Треугольник ячейки — кнопка отметки (ADR 0177, §5). */
const markOf = (id: string) =>
  cellOf(id)?.querySelector<HTMLElement>('button[data-cell-issue]') ?? null
const lone = markOf
/** Видимая часть треугольника. */
const triangleOf = (id: string) =>
  markOf(id)?.querySelector<HTMLElement>('span[aria-hidden]') ?? null
const dotShown = (id: string) => {
  const triangle = triangleOf(id)
  return !!triangle && triangle.getBoundingClientRect().width > 0
}
const editOf = (id: string) =>
  cellOf(id)?.querySelector<HTMLElement>(
    `button[aria-label="${tableLabels.editCell}"]`,
  ) ?? null
const issuePopover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const description = (button: HTMLElement) =>
  button
    .getAttribute('aria-describedby')!
    .split(' ')
    .map(id => document.getElementById(id)?.textContent)
    .join(' ')
const tooltip = () =>
  [...document.querySelectorAll('[data-side]')]
    .map(el => el.textContent?.trim())
    .find(Boolean) ?? null
const away = () => userEvent.hover(headCells()[0]!)

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 30,
}

const renderErrors = (props: Record<string, unknown> = {}) =>
  render(
    <Stories.DataGridPlayground
      {...GRID}
      enableCellErrors
      cellErrorsGetCellError={errorAt(ERROR_ROW)}
      {...props}
    />,
  )

describe('Ошибка в ячейке (ADR 0150)', () => {
  test('ER1: getCellError(ctx) возвращает текст или undefined; у ячейки с текстом в правом верхнем углу красный треугольник, видный без наведения; без текста — ни треугольника, ни его узла', async () => {
    await renderErrors()
    await waitForGrid()
    await away()
    await expect.poll(() => dotShown(ERROR_ROW)).toBe(true)
    const cell = cellOf(ERROR_ROW)!.getBoundingClientRect()
    const triangle = triangleOf(ERROR_ROW)!.getBoundingClientRect()
    expect(Math.abs(triangle.right - cell.right)).toBeLessThanOrEqual(1)
    expect(Math.abs(triangle.top - cell.top)).toBeLessThanOrEqual(1)
    expect(cellOf('item-id-4')!.querySelector('[data-cell-issue]')).toBeNull()
    expect(
      cellOf(ERROR_ROW, 'firstName')!.querySelector('[data-cell-issue]'),
    ).toBeNull()
  })

  for (const keyboard of [false, true]) {
    test(`ER2: треугольник — кнопка кита без значка: зона нажатия не меньше 24×24, фокус Tab без keyboardNavigation и режимом действия с ней, тултип с текстом при наведении и клавиатурном фокусе; нажатие открывает поповер с причиной, правку не начинает (keyboardNavigation ${keyboard ? 'вкл' : 'выкл'})`, async () => {
      await renderErrors({ enableKeyboardNavigation: keyboard })
      await waitForGrid()
      await away()
      const mark = () => lone(ERROR_ROW)!
      await expect.poll(() => lone(ERROR_ROW)).not.toBeNull()
      expect(mark().querySelector('svg')).toBeNull()
      const box = mark().getBoundingClientRect()
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24)

      await userEvent.hover(mark())
      await expect.poll(tooltip).toBe(ERROR)
      await away()

      if (keyboard) {
        await humanClick(cellOf(ERROR_ROW, 'firstName')!)
        for (
          let i = 0;
          i < 6 && document.activeElement !== cellOf(ERROR_ROW);
          i++
        )
          await userEvent.keyboard('{ArrowRight}')
        expect(document.activeElement).toBe(cellOf(ERROR_ROW))
        await userEvent.keyboard('{Enter}')
      } else {
        ;(document.activeElement as HTMLElement | null)?.blur()
        for (let i = 0; i < 10 && document.activeElement !== mark(); i++)
          await userEvent.keyboard('{Tab}')
      }
      await expect.poll(() => document.activeElement).toBe(mark())
      await expect.poll(tooltip).toBe(ERROR)

      await userEvent.keyboard('{Enter}')
      await humanClick(mark())
      await expect.poll(issuePopover).not.toBeNull()
      expect(issuePopover()!.textContent).toContain(ERROR)
      expect(cellOf(ERROR_ROW)!.querySelector('input')).toBeNull()
      expect(dotShown(ERROR_ROW)).toBe(true)
      await userEvent.keyboard('{Escape}')
      await expect.poll(issuePopover).toBeNull()
    })
  }

  test('ER3: ячейка с ошибкой — приложения или отказом сохранения — несёт aria-invalid="true"; текст ошибки — описание треугольника; в ролях grid, table и treegrid', async () => {
    for (const [role, props] of [
      ['table', {}],
      ['grid', { enableKeyboardNavigation: true }],
      [
        'treegrid',
        {
          enableKeyboardNavigation: true,
          enableRowExpanding: true,
          dataNesting: 'nested',
        },
      ],
    ] as const) {
      const screen = await renderErrors(props)
      await waitForGrid()
      expect(document.querySelector(`[role="${role}"]`), role).not.toBeNull()
      await expect
        .poll(() => cellOf(ERROR_ROW)?.getAttribute('aria-invalid'))
        .toBe('true')
      expect(cellOf('item-id-4')!.hasAttribute('aria-invalid')).toBe(false)
      expect(description(lone(ERROR_ROW)!)).toBe(ERROR)
      await screen.unmount()
    }

    // Отказ сохранения без ошибки приложения — тоже ошибка ячейки.
    const screen = await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        cellEditingCanEditCell={() => true}
        onCellEdit={() => Promise.reject(new Error('Server down'))}
      />,
    )
    await waitForGrid()
    await userEvent.hover(cellOf('item-id-2')!)
    const edit = cellOf('item-id-2')!.querySelector<HTMLElement>(
      `button[aria-label="${tableLabels.editCell}"]`,
    )!
    await humanClick(edit)
    const input = await expect
      .poll(() => cellOf('item-id-2')!.querySelector('input'))
      .not.toBeNull()
      .then(() => cellOf('item-id-2')!.querySelector('input')!)
    await userEvent.clear(input)
    await userEvent.type(input, '77{Enter}')
    await expect
      .poll(() => cellOf('item-id-2')!.getAttribute('aria-invalid'))
      .toBe('true')
    await screen.unmount()
  })

  test('ER4: с cellEditing у правимой ячейки тот же треугольник ячейки, а не отметка на кнопке правки; кнопка правки открывает правку', async () => {
    await renderErrors({
      enableCellEditing: true,
      cellEditingCanEditCell: (ctx: CellComponentProps) =>
        ctx.column.id === 'age',
    })
    await waitForGrid()
    await away()
    await expect.poll(() => dotShown(ERROR_ROW)).toBe(true)
    expect(description(markOf(ERROR_ROW)!)).toBe(ERROR)
    await userEvent.hover(cellOf(ERROR_ROW)!)
    await expect.poll(() => editOf(ERROR_ROW)).not.toBeNull()
    const edit = editOf(ERROR_ROW)!
    expect(edit.querySelector('[data-failure-indicator]')).toBeNull()
    expect(edit.hasAttribute('aria-describedby')).toBe(false)
    await humanClick(edit)
    await expect
      .poll(() => cellOf(ERROR_ROW)!.querySelector('input'))
      .not.toBeNull()
    await userEvent.keyboard('{Escape}')
  })

  test('ER5: при отказе сохранения и ошибке приложения треугольник один — тултип и описание показывают отказ; снятый успехом или отменой отказ открывает ошибку приложения', async () => {
    const settle: { resolve: () => void; reject: (reason: unknown) => void }[] =
      []
    await renderErrors({
      enableCellEditing: true,
      cellEditingCanEditCell: (ctx: CellComponentProps) =>
        ctx.column.id === 'age',
      onCellEdit: () =>
        new Promise<void>((resolve, reject) =>
          settle.push({ resolve, reject }),
        ),
    })
    await waitForGrid()
    const save = async (value: string) => {
      await userEvent.hover(cellOf(ERROR_ROW)!)
      await expect.poll(() => editOf(ERROR_ROW)).not.toBeNull()
      await humanClick(editOf(ERROR_ROW)!)
      await expect
        .poll(() => cellOf(ERROR_ROW)!.querySelector('input'))
        .not.toBeNull()
      const input = cellOf(ERROR_ROW)!.querySelector('input')!
      await userEvent.clear(input)
      await userEvent.type(input, `${value}{Enter}`)
    }
    const refused = 'Server down'

    await save('17')
    settle.at(-1)!.reject(new Error('Server down'))
    await expect.poll(() => description(markOf(ERROR_ROW)!)).toBe(refused)
    expect(
      cellOf(ERROR_ROW)!.querySelectorAll('[data-cell-issue]').length,
    ).toBe(1)
    await userEvent.hover(markOf(ERROR_ROW)!)
    await expect.poll(tooltip).toBe(refused)

    // Отмена: повтор открывает черновик, Escape снимает отказ.
    await userEvent.hover(cellOf(ERROR_ROW)!)
    await humanClick(editOf(ERROR_ROW)!)
    await expect
      .poll(() => cellOf(ERROR_ROW)!.querySelector('input'))
      .not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => description(markOf(ERROR_ROW)!)).toBe(ERROR)

    // Успех: отказ снят сохранением — снова ошибка приложения.
    await save('16')
    settle.at(-1)!.reject(new Error('Server down'))
    await expect.poll(() => description(markOf(ERROR_ROW)!)).toBe(refused)
    await save('15')
    settle.at(-1)!.resolve()
    await expect
      .poll(() => markOf(ERROR_ROW) && description(markOf(ERROR_ROW)!))
      .toBe(ERROR)
  })

  test('ER6: getCellError — живой аргумент: новая функция или новые данные пересчитывают треугольники; треугольник следует за ячейкой при сортировке, смене страницы, уходе из окна виртуализации и возврате, на загруженных строках SSRM', async () => {
    let table: {
      setSorting: (sorting: { id: string; desc: boolean }[]) => void
      setPageIndex: (index: number) => void
    }
    const data = getData(300)
    const Host = ({
      getCellError,
      rows,
    }: {
      getCellError: (ctx: CellComponentProps) => string | undefined
      rows: typeof data
    }) => {
      const created = useCreateTable({
        columns: mockColumns as never,
        data: rows,
        getRowId: (row: { id: string }) => row.id,
        plugins: [
          cellErrors({ getCellError }),
          columnSortingModel(),
          paginationModel({ initialPageSize: 100 }),
        ],
      })
      table = created as never
      return (
        <div style={{ width: 900, height: 520 }}>
          <DataGrid table={created} height={500} />
        </div>
      )
    }
    const screen = await render(
      <Host getCellError={errorAt(ERROR_ROW)} rows={data} />,
    )
    await waitForGrid()
    await expect.poll(() => markOf(ERROR_ROW)).not.toBeNull()

    // Новая функция.
    await screen.rerender(
      <Host getCellError={errorAt('item-id-5')} rows={data} />,
    )
    await expect.poll(() => markOf('item-id-5')).not.toBeNull()
    expect(markOf(ERROR_ROW)).toBeNull()

    // Новые данные: ошибка по значению.
    const byAge = (ctx: CellComponentProps) =>
      ctx.column.id === 'age' && ctx.getValue() === 7 ? ERROR : undefined
    await screen.rerender(<Host getCellError={byAge} rows={data} />)
    expect(document.querySelectorAll('[data-cell-issue]').length).toBe(0)
    const changed = data.map(row =>
      row.id === 'item-id-6' ? { ...row, age: 7 } : row,
    )
    await screen.rerender(<Host getCellError={byAge} rows={changed} />)
    await expect.poll(() => markOf('item-id-6')).not.toBeNull()

    // Сортировка: строка уходит на другое место, треугольник — с ней.
    await screen.rerender(
      <Host getCellError={errorAt('item-id-5')} rows={data} />,
    )
    const indexOf = () => rowOf('item-id-5')?.getAttribute('data-index')
    const before = indexOf()
    table!.setSorting([{ id: 'age', desc: true }])
    await expect
      .poll(() => rowOf('item-id-5') === null || indexOf() !== before)
      .toBe(true)
    table!.setSorting([])
    await expect.poll(() => markOf('item-id-5')).not.toBeNull()

    // Страница: на второй странице ошибки нет, возврат на первую — есть.
    table!.setPageIndex(1)
    await expect.poll(() => rowOf('item-id-5')).toBeNull()
    expect(document.querySelectorAll('[data-cell-issue]').length).toBe(0)
    table!.setPageIndex(0)
    await expect.poll(() => markOf('item-id-5')).not.toBeNull()

    // Виртуализация: строка уходит из окна и возвращается.
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = 3000
    await expect.poll(() => rowOf('item-id-5')).toBeNull()
    scroller.scrollTop = 0
    await expect.poll(() => markOf('item-id-5')).not.toBeNull()
    await screen.unmount()

    // SSRM: треугольник на загруженной строке.
    const Server = () => {
      const created = useCreateTable({
        columns: mockColumns as never,
        data: [],
        getRowId: (row: { id: string }) => row.id,
        plugins: [
          cellErrors({ getCellError: errorAt('item-id-8') }),
          serverRowModel({
            blockSize: 20,
            getRows: ({ start, end }: { start: number; end: number }) => ({
              rows: data.slice(start, end),
              rowCount: data.length,
            }),
          }),
        ],
      })
      return (
        <div style={{ width: 900, height: 520 }}>
          <DataGrid table={created} height={500} />
        </div>
      )
    }
    const ssrm = await render(<Server />)
    await expect.poll(() => markOf('item-id-8')).not.toBeNull()
    expect(cellOf('item-id-8')!.getAttribute('aria-invalid')).toBe('true')
    await ssrm.unmount()
  })

  test('ER7: контраст треугольника не ниже 3:1 в обеих темах; в forced-colors — CanvasText (ADR 0087); axe с color-contrast', async () => {
    await renderErrors({
      enableCellEditing: true,
      cellEditingCanEditCell: () => false,
    })
    await waitForGrid()
    await away()
    await expect.poll(() => dotShown(ERROR_ROW)).toBe(true)
    const dot = () => triangleOf(ERROR_ROW)!
    await inBothThemes(async () => {
      const ratio = contrast(
        toRgba(getComputedStyle(dot()).backgroundColor),
        effectiveBg(cellOf(ERROR_ROW)!),
      )
      expect(ratio).toBeGreaterThanOrEqual(3)
      const result = await axe.run(
        document.querySelector('.data-grid-theme')!,
        AXE_OPTIONS,
      )
      expect(result.violations.map(v => v.id)).toEqual([])
    })

    if (server.browser === 'webkit') return
    const fc = commands as unknown as {
      forcedColors: (active: boolean) => Promise<void>
    }
    await fc.forcedColors(true)
    try {
      const probe = document.createElement('span')
      probe.style.color = 'CanvasText'
      document.body.append(probe)
      const mark = getComputedStyle(probe).color
      probe.remove()
      await expect
        .poll(() => toRgba(getComputedStyle(dot()).backgroundColor))
        .toEqual(toRgba(mark))
    } finally {
      await fc.forcedColors(false)
    }
  })
})
