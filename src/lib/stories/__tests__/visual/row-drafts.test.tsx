import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  contextMenu,
  dataExportModel,
  rowActions,
  rowSelection,
  serverRowModel,
  unsavedChanges,
} from '../../../plugins'
import { collectExportData } from '../../../plugins/dataExportModel/exportData'
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
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

const pointer = commands as unknown as {
  realDragHold: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps?: number,
  ) => Promise<void>
  realMouseUp: () => Promise<void>
}
const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

// Строки до сохранения (ADR 0178, §7; DR29, DR31, DR32, DR34, DR35): правка новой строки,
// вид новой и удалённой, откат, счёт по данным, доступность. DR27, DR28, DR30, DR33 —
// модульные (`rowDrafts.dom`), DR36 — перф в `scroll`.

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
    enableStatusBar: true,
    plugins: [
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      rowActions(),
      cellSelection(),
      rowSelection({ selectedCount: true }),
      contextMenu(),
      dataExportModel(),
      unsavedChanges(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 760, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

/** Серверная модель строк с правкой по кнопке и выделением ячеек. */
const ServerGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: [],
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      serverRowModel({
        blockSize: 20,
        getRows: ({ start, end }: { start: number; end: number }) => ({
          rows: DATA.slice(start, end),
          rowCount: DATA.length,
        }),
      }),
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      cellSelection(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 760, height: 560 }}>
      <DataGrid table={table as never} height={520} />
    </div>
  )
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellOf = (id: string, column = 'name') =>
  rowOf(id)?.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  ) ?? null
const buttonIn = (root: Element | null, label: string) =>
  root?.querySelector<HTMLElement>(`button[aria-label="${label}"]`) ?? null
/** Текст ячейки без кнопок и отметок. */
const textOf = (cell: HTMLElement | null) => {
  const copy = cell?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim() ?? ''
}
/** Узел текста ячейки — тот, у которого свой текст. */
const textNodeOf = (cell: HTMLElement) =>
  [...cell.querySelectorAll<HTMLElement>('*')].find(node =>
    [...node.childNodes].some(
      child => child.nodeType === Node.TEXT_NODE && child.textContent!.trim(),
    ),
  )!
const drafts = () => api.getDrafts() as { kind: string; value: any }[]
const addRow = async (index = 2) => {
  const id = api.addRow({}, { index }) as string
  await expect.poll(() => rowOf(id)).not.toBeNull()
  return id
}
const root = () => document.querySelector<HTMLElement>('.data-grid-theme')!

/** Открыть правку ячейки кнопкой, набрать текст и сохранить Enter. */
const editCell = async (id: string, column: string, text: string) => {
  await userEvent.hover(cellOf(id, column)!)
  await humanClick(
    buttonIn(cellOf(id, column), cellEditingLabels(tableLabels).editCell)!,
  )
  await expect
    .poll(() => cellOf(id, column)?.querySelector('input'))
    .toBeTruthy()
  const input = cellOf(id, column)!.querySelector('input')!
  await userEvent.clear(input)
  await userEvent.type(input, `${text}{Enter}`)
  await expect.poll(() => cellOf(id, column)?.querySelector('input')).toBeNull()
}

describe('строки до сохранения (ADR 0178, §7)', () => {
  test('DR29: ячейки новой строки правятся, значения пишутся в её черновик rowInsert, без уголков черновиков ячеек', async () => {
    const screen = await render(<Grid />)
    try {
      await waitForGrid()
      const id = await addRow()
      await editCell(id, 'name', 'Ada')
      await editCell(id, 'age', '36')
      expect(textOf(cellOf(id))).toBe('Ada')
      expect(textOf(cellOf(id, 'age'))).toBe('36')
      expect(drafts().map(d => d.kind)).toEqual(['rowInsert'])
      expect(drafts()[0]!.value.values).toEqual({ name: 'Ada', age: 36 })
      expect(rowOf(id)!.querySelector('[data-cell-draft]')).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('DR31: новая строка залита своим токеном как фоном строки, наведение, выбор и подсветка — поверх, текст 4,5:1, при вставке вспышка arrived; удалённая приглушена токеном, текст не ниже 3:1', async () => {
    const screen = await render(<Grid />)
    try {
      await waitForGrid()
      const id = api.addRow({ name: 'Ada', age: 36 }, { index: 2 }) as string
      await expect
        .poll(() => rowOf(id)?.getAttribute('data-flash'))
        .toBe('arrived')
      api.removeRow('5')
      await expect
        .poll(() => rowOf('5')?.getAttribute('data-row-draft'))
        .toBe('deleted')
      const fill = () => resolveColor(root(), 'var(--tsr-comp-row-new-bg)')
      await inBothThemes(async () => {
        await expect
          .poll(() => getComputedStyle(rowOf(id)!).backgroundColor)
          .toBe(fill())
        expect(fill()).not.toBe(getComputedStyle(rowOf('1')!).backgroundColor)
        const text = textNodeOf(cellOf(id)!)
        expect(
          contrast(toRgba(getComputedStyle(text).color), backgroundOf(text)),
        ).toBeGreaterThanOrEqual(4.5)
        // Удалённая: содержимое ячеек — приглушено токеном, текст — 3:1 на фоне строки.
        const opacity = Number(
          getComputedStyle(root()).getPropertyValue(
            '--tsr-comp-row-deleted-opacity',
          ),
        )
        expect(opacity).toBeGreaterThan(0)
        expect(opacity).toBeLessThan(1)
        const content = cellOf('5')!.firstElementChild as HTMLElement
        expect(Number(getComputedStyle(content).opacity)).toBeCloseTo(opacity)
        const dim = textNodeOf(cellOf('5')!)
        const bg = backgroundOf(cellOf('5'))
        const shown = toRgba(getComputedStyle(dim).color)
          .slice(0, 3)
          .map((c, i) => c * opacity + bg[i]! * (1 - opacity))
        expect(contrast([...shown, 1], bg)).toBeGreaterThanOrEqual(3)
      })
      // Наведение, выбор и подсветка — слоем поверх заливки, заливка остаётся.
      const layers = () => {
        const style = getComputedStyle(rowOf(id)!)
        return {
          bg: style.backgroundColor,
          state: toRgba(style.getPropertyValue('--tsr-row-state'))[3]!,
        }
      }
      await userEvent.hover(cellOf(id)!)
      await expect.poll(() => layers().state).toBeGreaterThan(0)
      expect(layers().bg).toBe(fill())
      await userEvent.hover(document.body)
      api.setRowSelection({ [id]: true })
      await expect
        .poll(() => rowOf(id)?.getAttribute('data-selected'))
        .toBe('true')
      expect(layers().bg).toBe(fill())
      api.setRowSelection({})
      api.highlight({ row: id })
      await expect
        .poll(() => rowOf(id)?.hasAttribute('data-highlight'))
        .toBe(true)
      expect(layers().bg).toBe(fill())
      api.clearHighlights()
    } finally {
      await screen.unmount()
    }
  })

  test('DR32: в колонке действий строки — кнопка «Убрать строку» или «Вернуть строку» видна без наведения, без точки черновика, не приглушена; тот же пункт в контекстном меню, с клавиатуры; пульт перечисляет черновики строк', async () => {
    const screen = await render(<Grid role="grid" />)
    try {
      await waitForGrid()
      const id = await addRow()
      api.removeRow('5')
      await expect
        .poll(() =>
          buttonIn(rowOf('5'), cellEditingLabels(tableLabels).rowDeleteDiscard),
        )
        .not.toBeNull()
      // Видны без наведения: указатель вне таблицы.
      await userEvent.hover(document.body)
      for (const [row, label] of [
        [id, cellEditingLabels(tableLabels).rowInsertDiscard],
        ['5', cellEditingLabels(tableLabels).rowDeleteDiscard],
      ] as const) {
        const button = buttonIn(rowOf(row), label)!
        expect(button.closest('[data-button-active]')).not.toBeNull()
        expect(
          toRgba(getComputedStyle(button).color)[3],
          label,
        ).toBeGreaterThan(0.99)
        expect(
          button.querySelector('[data-active-indicator][data-shown="true"]'),
        ).toBeNull()
        const opacity = () => {
          let value = 1
          for (
            let node: Element | null = button;
            node;
            node = node.parentElement
          )
            value *= Number(getComputedStyle(node).opacity)
          return value
        }
        // Не приглушена, как содержимое удалённой строки (токен — 0,6).
        await expect.poll(opacity).toBeGreaterThan(0.95)
      }
      // Пульт перечисляет черновики строк.
      await humanClick(
        document.querySelector<HTMLElement>(
          '[data-testid="unsaved-changes-button"]',
        )!,
      )
      await expect
        .poll(() => document.querySelector('[data-testid="unsaved-changes"]'))
        .not.toBeNull()
      const pult = document.querySelector('[data-testid="unsaved-changes"]')!
      expect(pult.textContent).toContain(
        cellEditingLabels(tableLabels).rowInsertDraftKind,
      )
      expect(pult.textContent).toContain(
        cellEditingLabels(tableLabels).rowDeleteDraftKind,
      )
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => document.querySelector('[data-testid="unsaved-changes"]'))
        .toBeNull()
      // Кнопкой: новая строка уходит, удалённая возвращается.
      await humanClick(
        buttonIn(rowOf(id), cellEditingLabels(tableLabels).rowInsertDiscard)!,
      )
      await expect.poll(() => rowOf(id)).toBeNull()
      await humanClick(
        buttonIn(rowOf('5'), cellEditingLabels(tableLabels).rowDeleteDiscard)!,
      )
      await expect
        .poll(() => rowOf('5')?.hasAttribute('data-row-draft'))
        .toBe(false)
      // Контекстным меню мышью.
      api.removeRow('5')
      await expect
        .poll(() => rowOf('5')?.hasAttribute('data-row-draft'))
        .toBe(true)
      await userEvent.click(cellOf('5')!, { button: 'right' })
      const item = () =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          node =>
            node.textContent?.includes(
              cellEditingLabels(tableLabels).rowDeleteDiscard,
            ),
        )
      await expect.poll(item).toBeTruthy()
      await humanClick(item()!)
      await expect
        .poll(() => rowOf('5')?.hasAttribute('data-row-draft'))
        .toBe(false)
      // С клавиатуры: Shift+F10 на ячейке строки, стрелками к пункту, Enter.
      api.removeRow('5')
      await expect
        .poll(() => rowOf('5')?.hasAttribute('data-row-draft'))
        .toBe(true)
      await humanClick(cellOf('5', 'age')!)
      await userEvent.keyboard('{Shift>}{F10}{/Shift}')
      await expect.poll(item).toBeTruthy()
      for (let step = 0; step < 10; step++) {
        if (document.activeElement === item()) break
        await userEvent.keyboard('{ArrowDown}')
      }
      expect(document.activeElement).toBe(item())
      await userEvent.keyboard('{Enter}')
      await expect
        .poll(() => rowOf('5')?.hasAttribute('data-row-draft'))
        .toBe(false)
    } finally {
      await screen.unmount()
    }
  })

  test('DR34: новая строка — в aria-rowcount и клавиатурной навигации; выгрузка, «выбрать всё» и счётчики считают по данным; флажок выбора новой строки выключен', async () => {
    const screen = await render(<Grid role="grid" />)
    try {
      await waitForGrid()
      const grid = () => document.querySelector('[role="grid"]')!
      const before = Number(grid().getAttribute('aria-rowcount'))
      const id = await addRow()
      await expect
        .poll(() => Number(grid().getAttribute('aria-rowcount')))
        .toBe(before + 1)
      // Клавиатура: из строки над новой стрелкой вниз — в новую.
      await humanClick(cellOf('1', 'age')!)
      await userEvent.keyboard('{ArrowDown}')
      await expect
        .poll(() =>
          document.activeElement
            ?.closest('[data-row-id]')
            ?.getAttribute('data-row-id'),
        )
        .toBe(id)
      // Выгрузка — по данным.
      for (const rows of ['all', 'page'] as const) {
        const exported = collectExportData(api, { rows }).rows
        expect(exported, rows).toHaveLength(DATA.length)
      }
      // Флажок новой строки выключен; «выбрать всё» и счётчик — по данным.
      const box = rowOf(id)!.querySelector<HTMLElement>('[role="checkbox"]')!
      expect(
        box.getAttribute('aria-disabled') ?? box.hasAttribute('data-disabled'),
      ).toBeTruthy()
      const all = document.querySelector<HTMLElement>(
        `[role="checkbox"][aria-label="${rowSelectionLabels(tableLabels).selectAll}"]`,
      )!
      await humanClick(all)
      await expect
        .poll(
          () =>
            document.querySelector('[data-testid="selected-rows-count"]')
              ?.textContent,
        )
        .toContain(String(DATA.length))
      expect(rowOf(id)!.getAttribute('data-selected')).toBe('false')
      expect(Object.keys(api.store.get().rowSelection).sort()).toEqual(
        DATA.map(row => row.id).sort(),
      )
    } finally {
      await screen.unmount()
    }
  })

  test('DR35: axe с color-contrast новой и удалённой строки в обеих темах и ролях table и grid; в forced-colors новая строка — пунктирная граница, удалённая — GrayText', async () => {
    for (const role of [undefined, 'grid'] as const) {
      const screen = await render(<Grid role={role} />)
      try {
        await waitForGrid()
        const id = await addRow()
        api.removeRow('5')
        await expect
          .poll(() => rowOf('5')?.getAttribute('data-row-draft'))
          .toBe('deleted')
        expect(
          document.querySelector(`[role="${role ?? 'table'}"]`),
        ).not.toBeNull()
        await inBothThemes(async () => {
          const { violations } = await axe.run(root(), AXE_OPTIONS)
          expect(
            violations.map(v => v.id),
            role ?? 'table',
          ).toEqual([])
          // Контраст — без приглушённого содержимого удалённой строки: его держит 3:1 (DR31).
          const contrastRun = await axe.run(
            {
              include: [root()],
              exclude: [
                ...rowOf('5')!.querySelectorAll(
                  '.data-grid__body-cell:not([data-actions-column-cell="true"]) > *',
                ),
              ],
            },
            { runOnly: ['color-contrast'] },
          )
          expect(
            contrastRun.violations.flatMap(v =>
              v.nodes.map(n => n.target.join(' ')),
            ),
            role ?? 'table',
          ).toEqual([])
        })
        await commands.forcedColors(true)
        await expect
          .poll(() => getComputedStyle(rowOf(id)!, '::before').borderTopStyle)
          .toBe('dashed')
        const gray = resolveColor(root(), 'GrayText')
        expect(getComputedStyle(textNodeOf(cellOf('5')!)).color).toBe(gray)
        await commands.forcedColors(false)
      } finally {
        await screen.unmount()
      }
    }
  })

  test('DR40: диапазон выделения ячеек идёт по видимому списку — новая строка внутри диапазона выделяется и рисуется слоем поверх своей заливки, в клиентском режиме и в серверной модели; без строк до сохранения диапазон прежний — по id строк', async () => {
    const selected = (row: string) =>
      cellOf(row)?.getAttribute('data-cell-selected') === 'true'
    for (const host of ['client', 'server'] as const) {
      const screen = await render(host === 'client' ? <Grid /> : <ServerGrid />)
      try {
        await waitForGrid()
        await expect.poll(() => rowOf('2')).not.toBeNull()
        const id = api.addRow({ name: 'Zed', age: 99 }, { index: 2 }) as string
        await expect.poll(() => rowOf(id)).not.toBeNull()
        // Протяжка мышью от строки над новой до второй строки под ней: нажатие фокусирует
        // ячейку и может подкрутить таблицу, поэтому цель — с запасом.
        await pointer.realDragHold(
          centerOf(cellOf('1')!),
          centerOf(cellOf('3', 'age')!),
          20,
        )
        await expect
          .poll(() => cellOf('2', 'age')?.getAttribute('data-cell-selected'))
          .toBe('true')
        await pointer.realMouseUp()
        await expect.poll(() => selected('2')).toBe(true)
        expect(selected('1'), host).toBe(true)
        expect(selected(id), host).toBe(true)
        expect(cellOf(id, 'age')!.getAttribute('data-cell-selected')).toBe(
          'true',
        )
        // Заливка строки остаётся, выделение — слоем ячейки поверх неё.
        expect(getComputedStyle(rowOf(id)!).backgroundColor, host).toBe(
          resolveColor(root(), 'var(--tsr-comp-row-new-bg)'),
        )
        expect(getComputedStyle(cellOf(id)!).backgroundImage, host).not.toBe(
          'none',
        )
        if (host === 'client') {
          // Новая строка ушла: тот же диапазон — по id строк, без неё.
          api.removeRow(id)
          await expect.poll(() => rowOf(id)).toBeNull()
          const [range] = api.store.get().cellSelection
          expect(range).toMatchObject({ anchorRowId: '1', focusRowId: '2' })
          await expect.poll(() => selected('1')).toBe(true)
          expect(selected('2')).toBe(true)
        }
      } finally {
        await screen.unmount()
      }
    }
  })
})
