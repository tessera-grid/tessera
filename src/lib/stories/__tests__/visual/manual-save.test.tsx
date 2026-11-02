import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnFiltering,
  columnSorting,
  contextMenu,
  dataExportModel,
  quickSearch,
  rowGroupingModel,
  unsavedChanges,
} from '../../../plugins'
import { applyAllDrafts } from '../../../core/drafts/drafts'
import { collectExportData } from '../../../plugins/dataExportModel/exportData'
import {
  readEditingState,
  saveEdit,
  startEditSession,
} from '../../../plugins/cellEditing/session'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Сохранение правок по кнопке (ADR 0178, §5–§6; DR15, DR16, DR18, DR20): ячейка показывает
// черновик, модели считают по данным; полый уголок, «Откатить»; открытая правка в пульте;
// доступность. DR14, DR17, DR19 — модульные (`manualSave.dom`), DR21 — перф в `scroll`.

const COLUMNS = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 200,
    dataType: 'text',
  },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 200,
    dataType: 'number',
  },
]
const DATA = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

let api: any

const Grid = ({ role }: { role?: 'grid' }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableKeyboardNavigation: role === 'grid',
    plugins: [
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      columnSorting(),
      columnFiltering(),
      quickSearch(),
      rowGroupingModel(),
      dataExportModel(),
      contextMenu(),
      unsavedChanges(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 700, height: 520 }}>
      <DataGrid table={table as never} height={480} />
    </div>
  )
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const cell = (rowId: string, column = 'age') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const corner = (rowId: string) =>
  cell(rowId)?.querySelector<HTMLElement>('[data-cell-draft]') ?? null
/** Текст ячейки без кнопок и отметок. */
const text = (rowId: string) => {
  const copy = cell(rowId)?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim()
}
const popover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const pultButton = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const pultCount = () => {
  const bubble = pultButton()?.querySelector('[data-active-indicator]')
  return bubble?.getAttribute('data-shown') === 'true'
    ? bubble.textContent
    : '0'
}

/** Правка возраста строки сохранена, как Enter: в ячейке черновик. */
const draftAge = async (rowId: string, value: string) => {
  startEditSession(api, api.getRowSource().byId(rowId), { id: 'age' })
  saveEdit(
    api,
    { rowId, columnId: 'age' },
    { text: value },
    api.getHooks().cellEditing,
  )
  await expect.poll(() => corner(rowId)).not.toBeNull()
}

const mount = async (role?: 'grid') => {
  const screen = await render(<Grid role={role} />)
  await waitForGrid()
  return screen
}

describe('Сохранение по кнопке (ADR 0178)', () => {
  test('DR15: ячейка показывает значение черновика; сортировка, фильтр, поиск, группировка и выгрузка считают по данным', async () => {
    const screen = await mount()
    try {
      // Строка 0 — 20 лет; черновик — 99: в ячейке 99, в данных 20.
      await draftAge('0', '99')
      expect(text('0')).toBe('99')

      // Сортировка по возрасту по убыванию: строка 0 — последняя, по данным.
      api.setSorting([{ id: 'age', desc: true }])
      await expect.poll(() => api.getRowModel().rows.at(-1).id).toBe('0')
      api.setSorting([])

      // Фильтр колонки по значению черновика — пусто.
      api.setColumnFilters([
        { id: 'age', value: { operator: 'equals', value: 99 } },
      ])
      await expect.poll(() => api.getRowModel().rows.length).toBe(0)
      // Тот же фильтр по значению из данных находит строку.
      api.setColumnFilters([
        { id: 'age', value: { operator: 'equals', value: 20 } },
      ])
      await expect
        .poll(() => api.getRowModel().rows.map((row: { id: string }) => row.id))
        .toEqual(['0'])
      api.setColumnFilters([])

      // Группировка по возрасту — группа по данным.
      api.setGrouping(['age'])
      await expect
        .poll(() =>
          api
            .getRowModel()
            .rows.map((row: { getValue: (id: string) => unknown }) =>
              row.getValue('age'),
            ),
        )
        .toContain(20)
      expect(
        api
          .getRowModel()
          .rows.map((row: { getValue: (id: string) => unknown }) =>
            row.getValue('age'),
          ),
      ).not.toContain(99)
      api.setGrouping([])

      // Выгрузка — значение из данных.
      await expect.poll(() => text('0')).toBe('99')
      const exported = collectExportData(api, { rows: 'all' }).rows
      expect(exported[0]).toContain(20)
      expect(exported.flat()).not.toContain(99)

      // Поиск по тексту черновика строку не находит; по значению из данных — находит.
      api.setGlobalFilter('99')
      await expect.poll(() => api.getRowModel().rows.length).toBe(0)
      api.setGlobalFilter('20')
      await expect
        .poll(() => api.getRowModel().rows.map((row: { id: string }) => row.id))
        .toContain('0')
    } finally {
      await screen.unmount()
    }
  })

  test('DR16: ячейка с черновиком — полый уголок кита на месте треугольника отказа, отказ главнее; нажатие — поповер «было, стало, Откатить»; «Откатить» — и в контекстном меню', async () => {
    const screen = await mount()
    try {
      await draftAge('1', '77')
      const mark = corner('1')!
      expect(mark.getAttribute('aria-label')).toBe(tableLabels.cellDraft)
      // Уголок — в правом верхнем углу ячейки, как треугольник отказа.
      const box = cell('1')!.getBoundingClientRect()
      const at = mark.getBoundingClientRect()
      expect(Math.abs(at.right - box.right)).toBeLessThanOrEqual(1)
      expect(Math.abs(at.top - box.top)).toBeLessThanOrEqual(1)

      // Поповер: было, стало, «Откатить».
      await humanClick(mark)
      await expect.poll(popover).not.toBeNull()
      expect(popover()!.textContent).toContain(
        tableLabels.cellDraftReason('21', '77'),
      )
      await humanClick(
        popover()!.querySelector<HTMLElement>('[data-action="rollback"]')!,
      )
      await expect.poll(() => corner('1')).toBeNull()
      expect(text('1')).toBe('21')

      // Контекстное меню ячейки с черновиком — «Откатить».
      await draftAge('2', '5')
      await userEvent.click(cell('2')!, { button: 'right' })
      const item = await expect
        .poll(() =>
          [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
            node => node.textContent?.includes(tableLabels.cellDraftRollback),
          ),
        )
        .toBeTruthy()
      void item
      await humanClick(
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          node => node.textContent?.includes(tableLabels.cellDraftRollback),
        )!,
      )
      await expect.poll(() => corner('2')).toBeNull()

      // Отказ главнее: у ячейки с отказом и черновиком — треугольник отказа, без уголка.
      await draftAge('3', '40')
      api.reportFailure({
        label: 'Age',
        target: { cell: ['3', 'age'] },
        reason: 'Locked',
      })
      await expect
        .poll(() => cell('3')!.querySelector('[data-cell-issue]'))
        .not.toBeNull()
      expect(corner('3')).toBeNull()
      expect(text('3')).toBe('40')
    } finally {
      await screen.unmount()
    }
  })

  test('DR18: открытая правка — в срезе editing; пульт считает её; «Применить всё» сначала завершает её и кладёт в пакет', async () => {
    const batches: unknown[] = []
    const Host = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: (typeof DATA)[number]) => row.id,
        plugins: [
          cellEditing({
            saveMode: 'manual',
            onCommitEdits: (batch: unknown) => {
              batches.push(batch)
            },
          } as never),
          unsavedChanges(),
        ] as never,
      })
      api = table
      return (
        <div style={{ width: 700, height: 520 }}>
          <DataGrid table={table as never} height={480} />
        </div>
      )
    }
    const screen = await render(<Host />)
    await waitForGrid()
    try {
      await draftAge('1', '77')
      await expect.poll(pultCount).toBe('1')
      // Правка открыта и набрана, но не сохранена: она в срезе правки, не в черновиках.
      startEditSession(api, api.getRowSource().byId('2'), { id: 'age' })
      const input = await expect
        .poll(() => cell('2')?.querySelector('input'))
        .toBeTruthy()
      void input
      await userEvent.fill(cell('2')!.querySelector('input')!, '9')
      expect(readEditingState(api).active?.cell).toEqual({
        rowId: '2',
        columnId: 'age',
      })
      expect(api.getDrafts()).toHaveLength(1)
      await expect.poll(pultCount).toBe('2')

      // «Применить всё» без ухода фокуса из редактора (из кода): открытая правка — в пакет.
      applyAllDrafts(api)
      await expect.poll(() => batches.length).toBe(1)
      expect(
        (
          batches[0] as { cells: { rowId: string; value: unknown }[] }
        ).cells.map(cell => [cell.rowId, cell.value]),
      ).toEqual([
        ['1', 77],
        ['2', 9],
      ])
      expect(readEditingState(api).active).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('DR20: отметка черновика — в описании ячейки для скринридера; «Откатить» доступен с клавиатуры; axe и forced-colors уголка', async () => {
    const screen = await mount('grid')
    try {
      await draftAge('1', '77')
      const mark = corner('1')!
      // Описание отметки — «было, стало».
      const described = document.getElementById(
        mark.getAttribute('aria-describedby')!,
      )
      expect(described?.textContent).toBe(
        tableLabels.cellDraftReason('21', '77'),
      )

      // С клавиатуры: фокус на отметке, Enter — поповер, Tab до «Откатить», Enter.
      mark.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(popover).not.toBeNull()
      const rollback = popover()!.querySelector<HTMLElement>(
        '[data-action="rollback"]',
      )!
      rollback.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => corner('1')).toBeNull()

      await draftAge('1', '77')
      await inBothThemes(async () => {
        const result = await axe.run(cell('1')!, AXE_OPTIONS)
        expect(result.violations.map(v => v.id)).toEqual([])
      })

      if (server.browser === 'webkit') return
      await commands.forcedColors(true)
      const shape = corner('1')!.querySelector<HTMLElement>('span')!
      await expect
        .poll(() => toRgba(getComputedStyle(shape).backgroundColor)[3])
        .toBeGreaterThan(0)
      expect(shape.getBoundingClientRect().width).toBeGreaterThan(0)
    } finally {
      await screen.unmount()
    }
  })
})
