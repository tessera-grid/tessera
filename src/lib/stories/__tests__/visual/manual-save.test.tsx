import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellErrors,
  columnFiltering,
  serverRowModel,
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
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  resolveColor,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Сохранение правок по кнопке (ADR 0178, §4–§6; DR15, DR16, DR18, DR20, DR22, DR23): ячейка
// показывает черновик, модели считают по данным; уголок и «Откатить»; открытая правка в пульте;
// доступность; цвет несохранённого; общий поповер отметки. DR14, DR17, DR19, DR24, DR25 —
// модульные (`manualSave.dom`), DR21 — перф в `scroll`, DR26 — в `interaction`.

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
/** Строки тела поповера: подпись и значение. */
const details = () =>
  [...(popover()?.querySelectorAll('dt') ?? [])].map(term => [
    term.textContent,
    term.nextElementSibling?.textContent,
  ])
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

  test('DR16: ячейка с черновиком — уголок кита на месте треугольника отказа, отказ главнее; нажатие — поповер «было, стало, Откатить»; «Откатить» — и в контекстном меню', async () => {
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
      expect(details()).toEqual([
        [tableLabels.draftWas, '21'],
        [tableLabels.draftNow, '77'],
      ])
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

  test('DR22: уголок черновика — залитый треугольник; уголок, точка на кнопке фильтра с черновиком и бабл пульта — заливкой токеном --tsr-comp-draft-color, не ниже 3:1 к фону ячейки и кнопки в обеих темах', async () => {
    const Host = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: (typeof DATA)[number]) => row.id,
        dataMode: { filtering: 'server' },
        plugins: [
          cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
          columnFiltering({ onFilterChange: () => Promise.resolve() }),
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
      api.setDraft({
        kind: 'columnFilter',
        target: { column: 'name' },
        value: { operator: 'contains', value: 'Bob' },
      })
      const filterDot = () =>
        document.querySelector<HTMLElement>(
          '.data-grid__head-cell[data-column-id="name"] [data-draft] [data-active-indicator][data-shown="true"]',
        )
      await expect.poll(filterDot).toBeTruthy()
      await expect.poll(pultCount).toBe('2')
      await inBothThemes(async () => {
        const root = document.querySelector('.data-grid-theme')!
        const draft = resolveColor(root, 'var(--tsr-comp-draft-color)')
        // Уголок — залитый треугольник без выреза, цвета несохранённого.
        const shape = corner('1')!.querySelector<HTMLElement>('span')!
        const style = getComputedStyle(shape)
        expect(style.backgroundColor).toBe(draft)
        expect(style.clipPath).not.toContain('evenodd')
        expect(
          contrast(toRgba(draft), backgroundOf(cell('1'))),
        ).toBeGreaterThanOrEqual(3)
        // Точка на кнопке фильтра — заливка тем же цветом.
        const dot = filterDot()!
        expect(getComputedStyle(dot).backgroundColor).toBe(draft)
        expect(
          contrast(toRgba(draft), backgroundOf(dot.parentElement)),
        ).toBeGreaterThanOrEqual(3)
        // Бабл пульта — заливка цветом несохранённого.
        const bubble = pultButton()!.querySelector<HTMLElement>(
          '[data-active-indicator]',
        )!
        expect(getComputedStyle(bubble).backgroundColor).toBe(draft)
        expect(
          contrast(toRgba(draft), backgroundOf(pultButton())),
        ).toBeGreaterThanOrEqual(3)
      })
    } finally {
      await screen.unmount()
    }
  })

  test('DR23: поповер отметки ячейки один у отказа, ошибки данных и черновика: заголовок без отметки, причина — цветом текста ошибки, «Было» и «Стало» — обычным, под разделителем кнопки справа, главная — с рамкой; не уже --tsr-comp-popup-min-width', async () => {
    const Host = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: (typeof DATA)[number]) => row.id,
        plugins: [
          cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
          cellErrors({
            getCellError: ({
              row,
              column,
            }: {
              row: { id: string }
              column: { id: string }
            }) =>
              row.id === '5' && column.id === 'age' ? 'Too old' : undefined,
          } as never),
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
    const open = async (mark: HTMLElement) => {
      await humanClick(mark)
      await expect.poll(popover).not.toBeNull()
      return popover()!
    }
    const close = async () => {
      await userEvent.keyboard('{Escape}')
      await expect.poll(popover).toBeNull()
    }
    /** Заголовок, цвет тела, кнопки слева направо и разделитель над ними. */
    const layout = (pop: HTMLElement) => {
      const title = pop.querySelector<HTMLElement>('[id]')!
      const body = title.nextElementSibling as HTMLElement
      const buttons = [...pop.querySelectorAll<HTMLElement>('[data-action]')]
      return {
        title: title.textContent,
        labelled: pop.getAttribute('aria-labelledby') === title.id,
        // Отметки у заголовка нет: только текст.
        markless: title.children.length === 0,
        bodyColor: getComputedStyle(body).color,
        popColor: getComputedStyle(pop).color,
        buttons: buttons.map(button => [
          button.dataset.action,
          button.dataset.variant,
        ]),
        right:
          buttons.length > 0
            ? pop.getBoundingClientRect().right -
              buttons.at(-1)!.getBoundingClientRect().right
            : undefined,
        justify: buttons[0]
          ? getComputedStyle(buttons[0].parentElement!).justifyContent
          : undefined,
        // Разделитель — линия над рядом кнопок, по ширине содержимого.
        divider: buttons[0]
          ? (() => {
              const row = buttons[0].parentElement!
              const line = getComputedStyle(row, '::before')
              const box = row.getBoundingClientRect()
              const outer = pop.getBoundingClientRect()
              return {
                line: `${line.borderTopStyle} ${line.borderTopColor}`,
                inset: [
                  Math.round(box.left + parseFloat(line.left) - outer.left),
                  Math.round(outer.right - box.right + parseFloat(line.right)),
                ],
                above: box.top >= body.getBoundingClientRect().bottom,
              }
            })()
          : undefined,
        // Край содержимого: начало текста заголовка.
        content: Math.round(
          title.getBoundingClientRect().left +
            parseFloat(getComputedStyle(title).paddingLeft) -
            pop.getBoundingClientRect().left,
        ),
        width: pop.getBoundingClientRect().width,
      }
    }
    try {
      const root = document.querySelector('.data-grid-theme')!
      const divider = `solid ${resolveColor(root, 'var(--tsr-comp-popup-divider-color)')}`
      const probe = document.createElement('span')
      probe.style.color = 'var(--tsr-comp-error-text-color)'
      probe.style.width = 'var(--tsr-comp-popup-min-width)'
      probe.style.display = 'block'
      root.append(probe)
      const errorColor = getComputedStyle(probe).color
      const minWidth = parseFloat(getComputedStyle(probe).width)
      probe.remove()

      // Отказ с повтором: «Не сохранено», причина цветом ошибки, «Повторить» — справа с рамкой.
      api.reportFailure({
        label: 'Age',
        target: { cell: ['3', 'age'] },
        reason: 'Locked',
        retry: () => {},
      })
      const failed = await expect
        .poll(() => cell('3')!.querySelector<HTMLElement>('[data-cell-issue]'))
        .toBeTruthy()
      void failed
      let view = layout(
        await open(cell('3')!.querySelector<HTMLElement>('[data-cell-issue]')!),
      )
      expect(view.title).toBe(tableLabels.cellNotSaved)
      expect(view.labelled).toBe(true)
      expect(view.markless).toBe(true)
      expect(view.bodyColor).toBe(errorColor)
      // Разделитель над кнопками — по ширине содержимого, как у пульта и журнала.
      expect(view.divider).toEqual({
        line: divider,
        inset: [view.content, view.content],
        above: true,
      })
      expect(view.width).toBeGreaterThanOrEqual(minWidth - 0.5)
      expect(view.buttons).toEqual([
        ['discard', 'ghost'],
        ['retry', 'outline'],
      ])
      const failureRight = view.right!
      expect(view.justify).toBe('flex-end')
      await close()

      // Ошибка данных: тот же поповер без кнопок.
      view = layout(
        await open(cell('5')!.querySelector<HTMLElement>('[data-cell-issue]')!),
      )
      expect(view.title).toBe(tableLabels.cellError)
      expect(view.markless).toBe(true)
      expect(view.bodyColor).toBe(errorColor)
      expect(view.buttons).toEqual([])
      await close()

      // Черновик: «Было» и «Стало», под разделителем «Откатить» — справа с рамкой.
      await draftAge('1', '77')
      view = layout(await open(corner('1')!))
      expect(view.title).toBe(tableLabels.cellDraft)
      expect(view.markless).toBe(true)
      expect(view.bodyColor).toBe(view.popColor)
      expect(view.divider?.line).toBe(divider)
      expect(view.divider?.inset).toEqual([view.content, view.content])
      // Узкое содержимое не сужает поповер: кнопка справа, а не посередине.
      expect(view.width).toBeGreaterThanOrEqual(minWidth - 0.5)
      expect(view.buttons).toEqual([['rollback', 'outline']])
      expect(view.justify).toBe('flex-end')
      expect(view.right!).toBeCloseTo(failureRight, 0)
      expect(details()).toEqual([
        [tableLabels.draftWas, '21'],
        [tableLabels.draftNow, '77'],
      ])
      await close()
    } finally {
      await screen.unmount()
    }
  })

  test('DR39: правка пульта показывает «было → стало», скринридер читает «Было» и «Стало» словами: у значения ячейки — значение в данных и черновика, у условия фильтра — действующее условие или «Нет фильтра» и неприменённое; прежнего не знаем — только значение', async () => {
    const Host = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: (typeof DATA)[number]) => row.id,
        dataMode: { filtering: 'server' },
        plugins: [
          cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
          columnFiltering({ onFilterChange: () => Promise.resolve() }),
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
    /** Значение правки пульта: что видно и что читает скринридер. */
    const textWithout = (el: Element, hidden: string) => {
      const copy = el.cloneNode(true) as Element
      copy.querySelectorAll(hidden).forEach(node => node.remove())
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
    }
    const entries = () =>
      [
        ...(dialog()?.querySelectorAll<HTMLElement>('[data-draft-kind]') ?? []),
      ].map(entry => {
        const value = entry.querySelector('[class*="value"]')
        return value
          ? {
              shown: textWithout(value, '[class*="visually-hidden"]'),
              spoken: textWithout(value, '[aria-hidden]'),
            }
          : undefined
      })
    const dialog = () =>
      [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1) ??
      null
    try {
      await draftAge('1', '77')
      // Действующее условие у колонки возраста — «было» у её черновика.
      api.setColumnFilters([
        { id: 'age', value: { operator: 'greaterThan', value: 30 } },
      ])
      api.setDraft({
        kind: 'columnFilter',
        target: { column: 'age' },
        value: { operator: 'greaterThan', value: 40 },
      })
      api.setDraft({
        kind: 'columnFilter',
        target: { column: 'name' },
        value: { operator: 'contains', value: 'Bob' },
      })
      // Тулбар грузится лениво (ADR 0061).
      await expect.poll(pultButton).toBeTruthy()
      await humanClick(pultButton()!)
      await expect.poll(dialog).not.toBeNull()
      const rows = await expect.poll(entries).toHaveLength(3)
      void rows
      // Записи — в порядке появления: правка ячейки, затем раздел фильтров — возраст, имя.
      const [cellEntry, ageFilter, nameFilter] = entries() as {
        shown: string
        spoken: string
      }[]
      // Видно «было → стало», скринридер читает «Было» и «Стало» словами.
      expect(cellEntry).toEqual({
        shown: '21 → 77',
        spoken: `${tableLabels.draftWas} 21 ${tableLabels.draftNow} 77`,
      })
      expect(ageFilter!.shown).toMatch(/30.* → .*40/)
      expect(ageFilter!.spoken).toMatch(
        new RegExp(
          `^${tableLabels.draftWas} .*30.* ${tableLabels.draftNow} .*40`,
        ),
      )
      expect(nameFilter!.shown).toMatch(
        new RegExp(`^${tableLabels.draftNoFilter} → .*Bob`),
      )
    } finally {
      await screen.unmount()
    }

    // Серверная модель: строки нет в кэше — прежнего не знаем, в записи только значение.
    const ServerHost = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: [],
        plugins: [
          serverRowModel({
            blockSize: 10,
            maxBlocks: 1,
            getRows: ({ start, end }: { start: number; end: number }) => ({
              rows: Array.from({ length: end - start }, (_, i) => ({
                id: String(start + i),
                name: `Name ${start + i}`,
                age: 20 + start + i,
              })),
              rowCount: 1000,
            }),
          }),
          cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
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
    const server = await render(<ServerHost />)
    await waitForGrid()
    try {
      await expect.poll(() => api.getRowSource().byId('0')).toBeTruthy()
      expect(api.getRowSource().byId('900')).toBeUndefined()
      api.setDraft({
        kind: 'cellValue',
        target: { cell: ['900', 'age'] },
        value: { value: 5, text: '5' },
      })
      // Тулбар грузится лениво (ADR 0061).
      await expect.poll(pultButton).toBeTruthy()
      await humanClick(pultButton()!)
      await expect.poll(dialog).not.toBeNull()
      await expect.poll(entries).toEqual([{ shown: '5', spoken: '5' }])
    } finally {
      await server.unmount()
    }
  })
})
