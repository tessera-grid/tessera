import { commands, page, userEvent } from 'vitest/browser'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { render } from 'vitest-browser-react'
import { useState } from 'react'

import type { DebugAction } from '../../../core/debugActions'
import { definePlugin } from '../../../core/definePlugin'
import type {
  ContextMenuAction,
  HeaderAction,
  RowAction,
} from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  contextMenu,
  dataExport,
  dataExportModel,
  exportFormats,
  headerActionMenu,
  infiniteScroll,
  keyboardNavigation,
  rowActionMenu,
  rowActions,
  rowDragging,
} from '../../../plugins'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding'
import { Stories, humanClick, renderGrid, settleRowMotion } from '../helpers'
import { composed } from '../stories'

// Канал действий грида (ADR 0125): действия ядра и плагинов на настоящих событиях
// браузера. AL1–AL2 — в `play` историй «Plugin API», AL3, AL7–AL8 — модульные
// `debugActions`, AL6 — `debugActions.dom`.

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1280, 900))
afterAll(() => page.viewport(viewport.width, viewport.height))

const actions: DebugAction[] = []
const onDebugAction = (action: DebugAction) => actions.push(action)
beforeEach(() => {
  actions.length = 0
})

/** Действия плагина (и имени, если задано). */
const of = (plugin: string, action?: string) =>
  actions.filter(
    each =>
      each.plugin === plugin &&
      (action === undefined || each.action === action),
  )
const lastOf = (plugin: string, action?: string) => of(plugin, action).at(-1)

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T & HTMLElement>(selector)
const qa = (selector: string) => [
  ...document.querySelectorAll<HTMLElement>(selector),
]
const bodyRows = () =>
  qa('.data-grid__body-row').sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )
const headCell = (id: string) =>
  q(`.data-grid__head-cell[data-column-id="${id}"]`)!
const cellOf = (row: HTMLElement, columnId: string) =>
  row.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)!
const menuItem = (label: string) =>
  qa('[role="menuitem"]').find(
    item =>
      (
        item.querySelector('[class*="itemLabel"]') ?? item
      ).textContent?.trim() === label,
  )
const rowEl = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const nameCell = (id: string) => cellOf(rowEl(id)!, 'name')
const rowKebab = (id: string) =>
  rowEl(id)?.querySelector<HTMLElement>('[aria-label^="Row options"]') ?? null
const probeHead = () => headCell('name')

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const JSON_FORMAT = {
  id: 'json',
  label: 'JSON',
  extension: 'json',
  mimeType: 'application/json',
  serialize: ({ rows }: { rows: unknown[][] }) => JSON.stringify(rows),
}

const LAZY_ROOTS = [
  { id: 'lazy', firstName: 'lazy', childCount: 2 },
  { id: 'leaf', firstName: 'leaf', childCount: 0 },
]

/** Плагин-зонд со слот-действиями и пунктом контекстного меню; промисы — у теста. */
const makeProbe = () => {
  const runs: Deferred<void>[] = []
  const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
  const running = () => {
    const done = deferred<void>()
    runs.push(done)
    return done.promise
  }
  const remove: RowAction = {
    id: 'remove',
    slot: 'actionRowSlot',
    order: 0,
    icon: icon('R'),
    label: () => 'Remove',
    onSelect: running,
  }
  const leaf = (id: string, label: string) => ({
    id,
    icon: icon(label[0]!),
    label: () => label,
    onSelect: () => {},
  })
  const pin: HeaderAction = {
    ...leaf('pin', 'Pin to'),
    slot: 'rightHeaderSlot',
    order: 11,
    submenu: () => ({
      title: 'Pin to',
      items: [leaf('left', 'Left'), leaf('right', 'Right')],
    }),
  }
  const moveTo: RowAction = {
    ...leaf('moveTo', 'Move to'),
    slot: 'actionRowSlot',
    order: 1,
    submenu: () => ({
      title: 'Move to',
      items: [leaf('top', 'Top'), leaf('bottom', 'Bottom')],
    }),
  }
  const freeze: HeaderAction = {
    id: 'freeze',
    slot: 'rightHeaderSlot',
    order: 10,
    icon: icon('F'),
    label: () => 'Freeze',
    onSelect: () => {},
  }
  const recalculate: ContextMenuAction = {
    id: 'recalculate',
    icon: icon('C'),
    label: () => 'Recalculate',
    onSelect: running,
  }
  const plugin = definePlugin()({
    id: 'asyncProbe',
    slotActions: [remove, moveTo, freeze, pin],
    contextMenuActions: [recalculate],
  })
  return { plugin, runs }
}

const PROBE_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${String(i).padStart(2, '0')}`,
}))

const ProbeGrid = ({
  probe,
  menu,
  keyboard,
}: {
  probe: ReturnType<typeof makeProbe>
  menu: boolean
  keyboard: boolean
}) => {
  const [data, setData] = useState(PROBE_DATA)
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data,
    getRowId: (row: (typeof PROBE_DATA)[number]) => row.id,
    onDebugAction,
    plugins: [
      probe.plugin(),
      rowActions(),
      ...(menu
        ? [
            rowActionMenu({ mode: 'always' }),
            headerActionMenu({ mode: 'always' }),
          ]
        : []),
      contextMenu(),
      columnSorting(),
      keyboardNavigation({ enabled: keyboard }),
      rowDragging({ onRowOrderChange: setData as never }),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('канал действий (ADR 0125)', () => {
  test('AL4: ядро сообщает слот-действие (кнопка шапки, кебаб, инлайн-кнопка, пункт меню) с id плагина-владельца, клавиатурное действие, пункт контекстного меню и пункт меню ручки; асинхронный итог слот-действия — с cause; в коде плагина вызова нет', async () => {
    const probe = makeProbe()
    const screen = await render(
      <ProbeGrid probe={probe} menu={false} keyboard={false} />,
    )
    await expect.poll(() => rowEl('r1')).not.toBeNull()

    // Пункт меню ручки строки — до сортировки: под ней ручки нет.
    const handle = rowEl('r3')!.querySelector<HTMLElement>(
      '.drag__handler--column',
    )!
    handle.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => menuItem('Move down')).toBeTruthy()
    await humanClick(menuItem('Move down')!)
    await expect
      .poll(() => lastOf('rowDragging', 'handleMenu:moveDown'))
      .toMatchObject({ source: 'pointer' })

    // Инлайн-кнопка строки с промисом: итог — отдельным действием с cause.
    await userEvent.hover(nameCell('r1'))
    await humanClick(
      rowEl('r1')!.querySelector<HTMLElement>('[aria-label="Remove"]')!,
    )
    await expect.poll(() => probe.runs.length).toBe(1)
    const inline = lastOf('asyncProbe', 'remove')!
    expect(inline).toMatchObject({
      source: 'pointer',
      detail: { row: 'r1' },
    })
    probe.runs[0]!.resolve()
    await expect
      .poll(() => lastOf('asyncProbe', 'removeResolved'))
      .toMatchObject({ source: 'auto', cause: inline.id })

    // Пункт контекстного меню.
    await userEvent.click(nameCell('r2'), { button: 'right' })
    await expect.poll(() => menuItem('Recalculate')).toBeTruthy()
    await humanClick(menuItem('Recalculate')!)
    await expect.poll(() => probe.runs.length).toBe(2)
    const recalculate = lastOf('asyncProbe', 'recalculate')!
    expect(recalculate).toMatchObject({ detail: { row: 'r2' } })
    probe.runs[1]!.resolve()
    await expect
      .poll(() => lastOf('asyncProbe', 'recalculateResolved'))
      .toMatchObject({ cause: recalculate.id })

    // Кнопка шапки и клавиатурное действие — с клавиатурной навигацией.
    await screen.unmount()
    const keyboardScreen = await render(
      <ProbeGrid probe={probe} menu={false} keyboard />,
    )
    await expect.poll(() => rowEl('r1')).not.toBeNull()
    // Кнопка шапки — сортировка: в коде columnSorting вызова канала нет.
    await userEvent.hover(probeHead())
    await humanClick(probeHead().querySelector('.column-sort__button')!)
    await expect
      .poll(() => lastOf('columnSorting', 'columnSorting'))
      .toMatchObject({ source: 'pointer', detail: { column: 'name' } })
    // Клавиатурное действие — Enter на заголовке.
    probeHead().focus()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('columnSorting', 'columnSorting.toggle'))
      .toMatchObject({ source: 'keyboard' })

    // Кебабы — с меню действий.
    await keyboardScreen.unmount()
    actions.length = 0
    await render(<ProbeGrid probe={probe} menu keyboard={false} />)
    await expect.poll(() => rowEl('r1')).not.toBeNull()

    // Пункт кебаба шапки — от имени плагина-владельца.
    await userEvent.hover(probeHead())
    await humanClick(
      probeHead().querySelector<HTMLElement>('[aria-label^="Column options"]')!,
    )
    await expect.poll(() => menuItem('Freeze'), { timeout: 4000 }).toBeTruthy()
    await humanClick(menuItem('Freeze')!)
    await expect
      .poll(() => lastOf('asyncProbe', 'freeze'))
      .toMatchObject({ source: 'pointer', detail: { column: 'name' } })

    // Пункт кебаба строки: отказ промиса — с cause и текстом.
    await userEvent.hover(nameCell('r1'))
    await expect.poll(() => rowKebab('r1')).not.toBeNull()
    await humanClick(rowKebab('r1')!)
    await expect.poll(() => menuItem('Remove'), { timeout: 4000 }).toBeTruthy()
    await humanClick(menuItem('Remove')!)
    await expect.poll(() => probe.runs.length).toBe(3)
    const remove = lastOf('asyncProbe', 'remove')!
    expect(remove).toMatchObject({ source: 'pointer', detail: { row: 'r1' } })
    probe.runs[2]!.reject(new Error('locked'))
    await expect
      .poll(() => lastOf('asyncProbe', 'removeRejected'))
      .toMatchObject({ source: 'auto', cause: remove.id, detail: 'locked' })
  })

  test('AL5: ядро сообщает клавиатурную навигацию — переход активной ячейки, вход и выход из режима действия', async () => {
    await renderGrid({
      enableKeyboardNavigation: true,
      enableRowSelection: true,
      onDebugAction,
    })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(2)
    await humanClick(cellOf(bodyRows()[1]!, 'firstName'))
    await expect
      .poll(() => lastOf('keyboardNavigation', 'moveActiveCell'))
      .toMatchObject({ source: 'pointer' })
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() => of('keyboardNavigation', 'moveActiveCell').length)
      .toBe(2)
    expect(lastOf('keyboardNavigation', 'moveActiveCell')).toMatchObject({
      source: 'keyboard',
    })
    // Home — на ячейку флажка выбора, Enter — в её виджет.
    await userEvent.keyboard('{Home}')
    await expect
      .poll(() => document.activeElement?.querySelector('[role="checkbox"]'))
      .toBeTruthy()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('keyboardNavigation', 'enterActionMode'))
      .toMatchObject({ source: 'keyboard' })
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => lastOf('keyboardNavigation', 'exitActionMode'))
      .toMatchObject({ source: 'keyboard' })
  })

  test('AL9: rowSelection — флажок строки и «все на странице» мышью, строка — пробелом', async () => {
    await renderGrid({
      enableRowSelection: true,
      enableKeyboardNavigation: true,
      onDebugAction,
    })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(2)
    const row = bodyRows()[2]!
    await humanClick(row.querySelector<HTMLElement>('.row-select-checkbox')!)
    await expect
      .poll(() => lastOf('rowSelection', 'toggleRow'))
      .toMatchObject({
        source: 'pointer',
        detail: { rowId: row.dataset.rowId, selected: true },
      })
    await humanClick(
      q('.data-grid__head-cell .row-select-checkbox') as HTMLElement,
    )
    await expect
      .poll(() => lastOf('rowSelection', 'toggleAllPageRows'))
      .toMatchObject({ source: 'pointer' })
    await humanClick(cellOf(bodyRows()[3]!, 'firstName'))
    await userEvent.keyboard(' ')
    await expect
      .poll(() => lastOf('rowSelection', 'rowSelection.toggle'))
      .toMatchObject({ source: 'keyboard' })
  })

  test('AL10: rowExpanding — шеврон мышью, клавиша раскрытия, повтор; приход ленивых детей и отказ — с cause', async () => {
    const answers: Deferred<unknown[]>[] = []
    const loadChildren = () => {
      const answer = deferred<unknown[]>()
      answers.push(answer)
      return answer.promise
    }
    await render(
      <composed.RowExpanding
        dataOverride={LAZY_ROOTS}
        rowExpandingHasChildren={
          ((row: { original: { childCount: number } }) =>
            row.original.childCount > 0) as never
        }
        rowExpandingLoadChildren={loadChildren as never}
        enableKeyboardNavigation
        onDebugAction={onDebugAction}
      />,
    )
    await expect.poll(() => rowEl('lazy')).not.toBeNull()
    const toggle = () =>
      rowEl('lazy')!.querySelector<HTMLElement>('.row-expand-button')!

    // Отказ загрузки — итог с причиной: нажатием шеврона.
    await humanClick(toggle())
    const first = lastOf('rowExpanding', 'toggleRow')!
    expect(first).toMatchObject({
      source: 'pointer',
      detail: { rowId: 'lazy', expanded: true },
    })
    answers[0]!.reject(new Error('offline'))
    await expect
      .poll(() => lastOf('rowExpanding', 'loadChildrenRejected'))
      .toMatchObject({ source: 'auto', cause: first.id, detail: 'offline' })

    // Повтор — новое нажатие, приход детей — с его причиной.
    await expect.poll(() => toggle().getAttribute('aria-busy')).toBeNull()
    await humanClick(toggle())
    await expect.poll(() => of('rowExpanding', 'toggleRow').length).toBe(2)
    const retry = lastOf('rowExpanding', 'toggleRow')!
    answers[1]!.resolve([{ id: 'lazy-c0', firstName: 'c0', childCount: 0 }])
    await expect
      .poll(() => lastOf('rowExpanding', 'loadChildrenResolved'))
      .toMatchObject({ cause: retry.id })

    // Клавиша раскрытия — Enter в колонке раскрытия.
    rowEl('lazy')!
      .querySelector<HTMLElement>(`[data-column-id="${COLUMN_EXPANDING_ID}"]`)!
      .focus()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('rowExpanding', 'rowExpanding.toggle'))
      .toMatchObject({ source: 'keyboard' })
  })

  test('AL13: columnSizing — жест протяжки: начало и конец с итоговой шириной, отмена Escape, клавиши грипа', async () => {
    await renderGrid({ enableColumnSizing: true, onDebugAction })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(0)
    const cell = headCell('country')
    await userEvent.hover(cell)
    const separator = () =>
      cell.querySelector<HTMLElement>(
        '.resize__handler--column [role="separator"]',
      )!
    const box = separator().getBoundingClientRect()
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    // Протяжка настоящей мышью: нажатие, движение, отпускание.
    await pointer.realDragHold(from, { x: from.x + 40, y: from.y })
    await pointer.realMouseUp()
    await expect
      .poll(() => of('columnSizing', 'resize').map(each => each.phase))
      .toEqual(['start', 'end'])
    expect(lastOf('columnSizing', 'resize')).toMatchObject({
      source: 'pointer',
      detail: { columnId: 'country', width: expect.any(Number) },
    })
    // Отмена Escape посреди протяжки.
    const moved = separator().getBoundingClientRect()
    const again = {
      x: moved.left + moved.width / 2,
      y: moved.top + moved.height / 2,
    }
    await pointer.realDragHold(again, { x: again.x + 20, y: again.y })
    await userEvent.keyboard('{Escape}')
    await pointer.realMouseUp()
    await expect
      .poll(() => lastOf('columnSizing', 'resizeCancel'))
      .toMatchObject({ phase: 'end', detail: { columnId: 'country' } })
    // Клавиши грипа.
    separator().focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => lastOf('columnSizing', 'resizeBy'))
      .toMatchObject({
        source: 'keyboard',
        detail: { columnId: 'country' },
      })
    await userEvent.keyboard('{Home}')
    await expect
      .poll(() => lastOf('columnSizing', 'resetSize'))
      .toMatchObject({ source: 'keyboard' })
  })

  test('AL15: columnVisibility — открыть поповер, флажок колонки, поиск колонок, «Показать все», «Сбросить»', async () => {
    await renderGrid({ enableColumnVisibility: true, onDebugAction })
    await expect
      .poll(() => q('[data-testid="column-visibility-button"]'))
      .toBeTruthy()
    await humanClick(q('[data-testid="column-visibility-button"]')!)
    await expect
      .poll(() => lastOf('columnVisibility', 'openMenu'))
      .toMatchObject({ source: 'pointer' })
    await expect
      .poll(() => q('[data-testid="column-visibility-menu"]'))
      .toBeTruthy()
    const menu = q('[data-testid="column-visibility-menu"]')!
    await humanClick(menu.querySelector<HTMLElement>('.row-select-checkbox')!)
    await expect
      .poll(() => lastOf('columnVisibility', 'toggleColumn'))
      .toMatchObject({ source: 'pointer' })
    await userEvent.type(menu.querySelector('input[type="search"]')!, 'a')
    await expect
      .poll(() => lastOf('columnVisibility', 'searchColumns'))
      .toMatchObject({ detail: { query: 'a' } })
    const button = (label: string) =>
      [...menu.querySelectorAll<HTMLButtonElement>('button')].find(
        each => each.textContent === label,
      )!
    await humanClick(button('Show all'))
    await expect.poll(() => lastOf('columnVisibility', 'showAll')).toBeTruthy()
    await humanClick(button('Reset'))
    await expect.poll(() => lastOf('columnVisibility', 'reset')).toBeTruthy()
  })

  test('AL22: pagination — страница и размер страницы', async () => {
    await renderGrid({ enablePagination: true, onDebugAction })
    await expect.poll(() => q('[data-page-action="next"]')).toBeTruthy()
    await humanClick(q('[data-page-action="next"]')!)
    await expect
      .poll(() => lastOf('pagination', 'changePage'))
      .toMatchObject({
        source: 'pointer',
        detail: { pageIndex: 1, control: 'next' },
      })
    await humanClick(q('[data-testid="page-size-select"]')!)
    await expect
      .poll(() => q('[role="option"]'), { timeout: 3000 })
      .toBeTruthy()
    const option = qa('[role="option"]').find(
      each => each.textContent === '50',
    )!
    await humanClick(option)
    await expect
      .poll(() => lastOf('pagination', 'changePageSize'))
      .toMatchObject({ detail: { pageSize: 50, control: 'size' } })
  })

  test('AL24: backToTop — прыжок наверх и к первой колонке', async () => {
    await renderGrid({
      enableBackToTop: true,
      backToTopAxes: 'both',
      enableStatusBar: true,
      columnCount: 30,
      onDebugAction,
    })
    const scroller = await expect
      .poll(() => q('.data-grid__container'))
      .toBeTruthy()
    void scroller
    const area = q('.data-grid__container')!
    area.scrollTo({ top: area.scrollHeight, left: area.scrollWidth })
    await expect.poll(() => q('[data-testid="back-to-top"]')).toBeTruthy()
    await humanClick(q('[data-testid="back-to-top"]')!)
    await expect
      .poll(() => lastOf('backToTop', 'scrollToTop'))
      .toMatchObject({ source: 'pointer' })
    area.scrollTo({ left: area.scrollWidth })
    await expect.poll(() => q('[data-testid="back-to-start"]')).toBeTruthy()
    await humanClick(q('[data-testid="back-to-start"]')!)
    await expect
      .poll(() => lastOf('backToTop', 'scrollToStart'))
      .toMatchObject({ source: 'pointer' })
  })
  test('AL11: rowDragging — жест переноса мышью: начало и бросок, отмена Escape; итог onRowDragEnd — с cause', async () => {
    const moves: Deferred<void>[] = []
    await render(
      <composed.RowDragging
        onRowDragEnd={() => {
          const move = deferred<void>()
          moves.push(move)
          return move.promise
        }}
        onDebugAction={onDebugAction}
      />,
    )
    await expect.poll(() => bodyRows().length).toBeGreaterThan(4)
    const grab = async (row: HTMLElement) => {
      await userEvent.hover(row)
      const handle = row
        .querySelector<HTMLElement>('.drag__handler--column')!
        .getBoundingClientRect()
      return {
        x: handle.left + handle.width / 2,
        y: handle.top + handle.height / 2,
      }
    }
    const from = await grab(bodyRows()[0]!)
    const target = bodyRows()[3]!.getBoundingClientRect()
    await pointer.realDragHold(from, {
      x: from.x,
      y: target.top + target.height * 0.7,
    })
    await pointer.realMouseUp()
    await expect
      .poll(() => of('rowDragging', 'drag').map(each => each.phase))
      .toEqual(['start'])
    await expect
      .poll(() => lastOf('rowDragging', 'drop'))
      .toMatchObject({ source: 'pointer', phase: 'end' })
    const drop = lastOf('rowDragging', 'drop')!
    await expect.poll(() => moves.length).toBe(1)
    moves[0]!.resolve()
    await expect
      .poll(() => lastOf('rowDragging', 'commitMoveResolved'))
      .toMatchObject({ source: 'auto', cause: drop.id })

    // Отмена Escape посреди жеста.
    await expect.poll(() => q('[aria-busy="true"]')).toBeNull()
    await settleRowMotion()
    const again = await grab(rowEl('item-id-5')!)
    await pointer.realDragHold(again, { x: again.x, y: again.y + 90 })
    await userEvent.keyboard('{Escape}')
    await pointer.realMouseUp()
    await expect
      .poll(() => lastOf('rowDragging', 'dragCancel'))
      .toMatchObject({ phase: 'end', detail: { reason: 'cancel' } })
  })

  test('AL12: columnDragging — жест переноса мышью: начало и бросок, отмена Escape; итог onColumnDragEnd — с cause', async () => {
    const moves: Deferred<void>[] = []
    await render(
      <composed.ColumnDragging
        columnCount={6}
        onColumnDragEnd={() => {
          const move = deferred<void>()
          moves.push(move)
          return move.promise
        }}
        onDebugAction={onDebugAction}
      />,
    )
    const movable = () =>
      qa('.data-grid__head-cell[data-column-id]')
        .filter(cell => cell.querySelector('.drag__handler--column'))
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )
    await expect.poll(() => movable().length).toBeGreaterThan(3)
    const grab = async (cell: HTMLElement) => {
      await userEvent.hover(cell)
      const handle = cell.querySelector<HTMLElement>('.drag__handler--column')!
      await expect
        .poll(() => handle.parentElement!.getBoundingClientRect().width)
        .toBeGreaterThan(8)
      const box = handle.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }
    const [first, , third] = movable()
    const from = await grab(first!)
    const target = third!.getBoundingClientRect()
    await pointer.realDragHold(from, {
      x: target.left + target.width * 0.6,
      y: from.y,
    })
    await pointer.realMouseUp()
    await expect
      .poll(() => lastOf('columnDragging', 'drop'))
      .toMatchObject({ source: 'pointer', phase: 'end' })
    expect(lastOf('columnDragging', 'drag')).toMatchObject({ phase: 'start' })
    const drop = lastOf('columnDragging', 'drop')!
    await expect.poll(() => moves.length).toBe(1)
    moves[0]!.reject(new Error('Server said no'))
    await expect
      .poll(() => lastOf('columnDragging', 'commitMoveRejected'))
      .toMatchObject({
        source: 'auto',
        cause: drop.id,
        detail: 'Server said no',
      })

    // Отмена Escape посреди жеста.
    const again = await grab(movable()[1]!)
    await pointer.realDragHold(again, { x: again.x + 120, y: again.y })
    await userEvent.keyboard('{Escape}')
    await pointer.realMouseUp()
    await expect
      .poll(() => lastOf('columnDragging', 'dragCancel'))
      .toMatchObject({ phase: 'end', detail: { reason: 'cancel' } })
  })

  test('AL14: columnFiltering — открыть панель, изменить условие, снять фильтр в панели и в сводке', async () => {
    await render(
      <composed.Filtering
        containerHeight={700}
        height={620}
        enableToolbar
        columnFilteringDebounceMs={0}
        onDebugAction={onDebugAction}
      />,
    )
    await expect.poll(() => bodyRows().length).toBeGreaterThan(2)
    const filterButton = (id: string) =>
      headCell(id).querySelector<HTMLElement>('.column-filter__button')!
    const panel = () => q('[data-testid="filter-panel"]')
    const open = async (id: string) => {
      await userEvent.hover(headCell(id))
      await humanClick(filterButton(id))
      await expect.poll(panel).not.toBeNull()
    }
    await open('name')
    await expect
      .poll(() => lastOf('columnFiltering', 'openPanel'))
      .toMatchObject({ source: 'pointer', detail: { column: 'name' } })
    await userEvent.type(
      panel()!.querySelector<HTMLInputElement>('[data-testid="filter-value"]')!,
      'a',
    )
    await expect
      .poll(() => lastOf('columnFiltering', 'setFilter'))
      .toMatchObject({ detail: { columnId: 'name' } })
    // Снять в панели — «Сбросить».
    await humanClick(panel()!.querySelector('[data-testid="filter-reset"]')!)
    await expect
      .poll(() => lastOf('columnFiltering', 'removeFilter'))
      .toMatchObject({ source: 'pointer', detail: { columnId: 'name' } })
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()

    // Снять в сводке.
    await open('name')
    await userEvent.type(
      panel()!.querySelector<HTMLInputElement>('[data-testid="filter-value"]')!,
      'a',
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
    const removals = of('columnFiltering', 'removeFilter').length
    await humanClick(q('[data-testid="filter-summary-button"]')!)
    await expect
      .poll(() => lastOf('columnFiltering', 'openMenu'))
      .toMatchObject({ detail: { menu: 'summary' } })
    await expect
      .poll(() => q('[data-testid="filter-summary-remove"]'))
      .toBeTruthy()
    await humanClick(q('[data-testid="filter-summary-remove"]')!)
    await expect
      .poll(() => of('columnFiltering', 'removeFilter').length)
      .toBe(removals + 1)
    expect(lastOf('columnFiltering', 'removeFilter')).toMatchObject({
      source: 'pointer',
    })
  })

  test('AL16: headerActionMenu и rowActionMenu — открыть и закрыть меню, войти в раздел и «Назад»', async () => {
    const probe = makeProbe()
    await render(<ProbeGrid probe={probe} menu keyboard={false} />)
    await expect.poll(() => rowEl('r1')).not.toBeNull()
    const back = () => q('[role="menuitem"][data-menu-back]')

    for (const [plugin, open, section, item] of [
      [
        'headerActionMenu',
        async () => {
          await userEvent.hover(probeHead())
          await humanClick(
            probeHead().querySelector<HTMLElement>(
              '[aria-label^="Column options"]',
            )!,
          )
        },
        'Pin to',
        'Left',
      ],
      [
        'rowActionMenu',
        async () => {
          await userEvent.hover(nameCell('r1'))
          await expect.poll(() => rowKebab('r1')).not.toBeNull()
          await humanClick(rowKebab('r1')!)
        },
        'Move to',
        'Top',
      ],
    ] as const) {
      await open()
      await expect
        .poll(() => lastOf(plugin, 'openMenu'))
        .toMatchObject({ source: 'pointer' })
      await expect.poll(() => menuItem(section), { timeout: 4000 }).toBeTruthy()
      await humanClick(menuItem(section)!)
      await expect
        .poll(() => lastOf('asyncProbe', 'enterSection'))
        .toMatchObject({ source: 'pointer' })
      await expect.poll(() => menuItem(item)).toBeTruthy()
      await humanClick(back()!)
      await expect.poll(() => lastOf('asyncProbe', 'leaveSection')).toBeTruthy()
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => lastOf(plugin, 'closeMenu'))
        .toMatchObject({ source: 'keyboard' })
      await expect.poll(() => qa('[role="menuitem"]').length).toBe(0)
      actions.length = 0
    }
  })

  test('AL17: contextMenu — открыть правым кликом и клавишей, закрыть', async () => {
    const probe = makeProbe()
    await render(<ProbeGrid probe={probe} menu={false} keyboard />)
    await expect.poll(() => rowEl('r1')).not.toBeNull()
    await userEvent.click(nameCell('r1'), { button: 'right' })
    await expect
      .poll(() => lastOf('contextMenu', 'openMenu'))
      .toMatchObject({
        source: 'pointer',
        detail: { rowId: 'r1', columnId: 'name' },
      })
    await expect.poll(() => menuItem('Recalculate')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => lastOf('contextMenu', 'closeMenu')).toBeTruthy()
    await expect.poll(() => qa('[role="menuitem"]').length).toBe(0)

    nameCell('r2').focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    await expect
      .poll(() => lastOf('contextMenu', 'openMenu'))
      .toMatchObject({ source: 'keyboard', detail: { rowId: 'r2' } })
    await expect.poll(() => menuItem('Recalculate')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => of('contextMenu', 'closeMenu').length).toBe(2)
  })

  test('AL18: cellSelection — жест выделения мышью: начало и конец, расширение Shift, копирование Ctrl+C', async () => {
    await render(<composed.CellSelection onDebugAction={onDebugAction} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const cell = (row: number, column: number) =>
      bodyRows()[row]!.querySelectorAll<HTMLElement>(
        '.data-grid__body-cell:not([data-actions-column-cell="true"])',
      )[column]!
    const centerOf = (el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      return { x: box.left + 10, y: box.top + box.height / 2 }
    }
    await pointer.realDragHold(centerOf(cell(0, 0)), centerOf(cell(2, 1)))
    await expect
      .poll(() => of('cellSelection', 'select').map(each => each.phase))
      .toEqual(['start'])
    await pointer.realMouseUp()
    await expect
      .poll(() => of('cellSelection', 'select').map(each => each.phase))
      .toEqual(['start', 'end'])
    expect(lastOf('cellSelection', 'select')!.source).toBe('pointer')

    await userEvent.click(cell(3, 2), { modifiers: ['Shift'] })
    await expect
      .poll(() => lastOf('cellSelection', 'extendSelection'))
      .toMatchObject({ source: 'pointer' })

    await userEvent.keyboard('{Control>}c{/Control}')
    await expect
      .poll(() => lastOf('cellSelection', 'copy'))
      .toMatchObject({ source: 'keyboard', detail: { cells: 12 } })
  })

  test('AL19: cellEditing — сессия правки: начало клавишей и кнопкой, конец сохранением, без изменений и отменой с причиной; черновик; ошибка validate и конфликт — в сессии; итог onCellEdit — с cause', async () => {
    const saves: Deferred<void>[] = []
    const data = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      firstName: `First ${i}`,
      lastName: `Last ${i}`,
      age: 20 + i,
    }))
    const grid = (rows: typeof data) => (
      <Stories.AllFeatures
        containerHeight={600}
        height={500}
        columnCount={6}
        dataCount={30}
        dataOverride={rows}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEditCell={() => true}
        cellEditingValidate={(value: string) =>
          value === 'bad' ? 'Not allowed' : null
        }
        onConflict="block"
        onCellEdit={() => {
          const save = deferred<void>()
          saves.push(save)
          return save.promise
        }}
        onDebugAction={onDebugAction}
      />
    )
    const screen = await render(grid(data))
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const cellAt = (index: number) =>
      cellOf(
        bodyRows().find(row => row.dataset.index === String(index))!,
        'firstName',
      )
    const input = () => document.querySelector<HTMLInputElement>('input')!

    // Начало кнопкой, черновик, сохранение Enter; итог промиса — с cause.
    await userEvent.hover(cellAt(0))
    await humanClick(cellAt(0).querySelector('.cell__button button')!)
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({
        phase: 'start',
        source: 'pointer',
      })
    await userEvent.clear(input())
    await userEvent.type(input(), 'Ann')
    await expect
      .poll(() => lastOf('cellEditing', 'changeDraft'))
      .toMatchObject({ detail: { draft: 'Ann' }, source: 'keyboard' })
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({
        phase: 'end',
        source: 'keyboard',
        detail: { result: 'commit', value: 'Ann' },
      })
    const commit = lastOf('cellEditing', 'edit')!
    await expect.poll(() => saves.length).toBe(1)
    saves[0]!.resolve()
    await expect
      .poll(() => lastOf('cellEditing', 'saveResolved'))
      .toMatchObject({ source: 'auto', cause: commit.id })

    // Начало клавишей, без изменений.
    cellAt(1).focus()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({
        phase: 'start',
        source: 'keyboard',
      })
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({ phase: 'end', detail: { result: 'unchanged' } })

    // Ошибка validate — внутри сессии, отмена Escape с причиной.
    cellAt(2).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.clear(input())
    await userEvent.type(input(), 'bad')
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('cellEditing', 'validationFailed'))
      .toMatchObject({ source: 'auto', detail: { message: 'Not allowed' } })
    const failed = lastOf('cellEditing', 'validationFailed')!
    const opened = of('cellEditing', 'edit').at(-1)!
    expect(opened.phase).toBe('start')
    expect(failed.id).toBeGreaterThan(opened.id)
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({
        phase: 'end',
        source: 'keyboard',
        detail: { result: 'cancel', reason: 'cancel' },
      })

    // Конфликт: значение изменилось извне — конец сессии с причиной, без пользователя.
    cellAt(3).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.clear(input())
    await userEvent.type(input(), 'Zed')
    await screen.rerender(
      grid(
        data.map(row =>
          row.id === 'p3' ? { ...row, firstName: 'Changed' } : row,
        ),
      ),
    )
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => lastOf('cellEditing', 'edit'))
      .toMatchObject({
        phase: 'end',
        source: 'auto',
        detail: { result: 'cancel', reason: 'conflict' },
      })
  })
  test('AL20: quickSearch — запрос после дебаунса одним действием, очистка', async () => {
    await render(
      <composed.Filtering
        containerHeight={700}
        height={620}
        enableToolbar
        enableQuickSearch
        quickSearchDebounceMs={200}
        onDebugAction={onDebugAction}
      />,
    )
    await expect.poll(() => q('[data-testid="quick-search"]')).toBeTruthy()
    await userEvent.type(q('[data-testid="quick-search"]')!, 'ali')
    await expect
      .poll(() => of('quickSearch', 'search'))
      .toEqual([expect.objectContaining({ detail: { query: 'ali' } })])
    await humanClick(q('[data-testid="quick-search-clear"]')!)
    await expect
      .poll(() => lastOf('quickSearch', 'clearSearch'))
      .toMatchObject({ source: 'pointer' })
    expect(of('quickSearch', 'search')).toHaveLength(1)
  })

  test('AL21: dataExport — открыть панель, выбрать формат, запустить; итог и ошибка — с cause', async () => {
    const runs: Deferred<void>[] = []
    const ExportGrid = () => {
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
        data: PROBE_DATA,
        getRowId: (row: (typeof PROBE_DATA)[number]) => row.id,
        enableToolbar: true,
        onDebugAction,
        plugins: [
          dataExport({
            server: true,
            formats: [exportFormats.csv(), JSON_FORMAT],
            onExport: () => {
              const run = deferred<void>()
              runs.push(run)
              return run.promise
            },
          }),
        ] as never,
      })
      return (
        <div style={{ height: 400 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<ExportGrid />)
    const button = () => q('[data-testid="export-button"]')
    const panel = () => q('[data-testid="export-panel"]')
    const run = () => q('[data-testid="export-run"]')
    await expect.poll(button).toBeTruthy()

    await userEvent.click(button()!)
    await expect.poll(panel).toBeTruthy()
    expect(lastOf('dataExport', 'openMenu')).toMatchObject({
      source: 'pointer',
    })
    await userEvent.click(
      q(
        '[data-testid="export-axis-format"] [role="radio"][data-value="json"]',
      )!,
    )
    await expect
      .poll(() => lastOf('dataExport', 'chooseSettings'))
      .toMatchObject({ source: 'pointer', detail: { format: 'json' } })
    await userEvent.click(run()!)
    await expect.poll(() => runs.length).toBe(1)
    const started = lastOf('dataExport', 'export')!
    expect(started).toMatchObject({
      source: 'pointer',
      detail: { format: 'json', server: true },
    })
    runs[0]!.resolve()
    await expect
      .poll(() => lastOf('dataExport', 'exportResolved'))
      .toMatchObject({ source: 'auto', cause: started.id })

    // Ошибка — тоже с причиной.
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await userEvent.click(button()!)
    await expect.poll(panel).toBeTruthy()
    await userEvent.click(run()!)
    await expect.poll(() => runs.length).toBe(2)
    const second = lastOf('dataExport', 'export')!
    runs[1]!.reject(new Error('server down'))
    await expect
      .poll(() => lastOf('dataExport', 'exportRejected'))
      .toMatchObject({ cause: second.id, detail: 'server down' })
    error.mockRestore()
  })

  test('AL23: infiniteScroll — запрос порции с source auto, повтор; ответ, пустой ответ и ошибка — с cause', async () => {
    const calls: Deferred<void>[] = []
    let append: (count: number) => void = () => {}
    const Feed = () => {
      const [rows, setRows] = useState(() => PROBE_DATA.slice(0, 30))
      append = count =>
        setRows(prev => [
          ...prev,
          ...Array.from({ length: count }, (_, k) => ({
            id: `r${prev.length + k}`,
            name: `Name ${prev.length + k}`,
          })),
        ])
      const table = useCreateTable({
        columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
        data: rows,
        getRowId: (row: (typeof PROBE_DATA)[number]) => row.id,
        onDebugAction,
        plugins: [
          infiniteScroll({
            onLoadMore: () => {
              const call = deferred<void>()
              calls.push(call)
              return call.promise
            },
            hasMore: true,
          }),
        ] as never,
      })
      return (
        <div style={{ width: 640, height: 400 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<Feed />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(0)
    const scrollToEnd = () => {
      const el = q('.data-grid__container')!
      el.scrollTop = el.scrollHeight
    }

    // Ошибка порции — с причиной: запросом.
    scrollToEnd()
    await expect.poll(() => calls.length).toBe(1)
    const first = lastOf('infiniteScroll', 'loadMore')!
    expect(first.source).toBe('auto')
    calls[0]!.reject(new Error('Server error'))
    await expect
      .poll(() => lastOf('infiniteScroll', 'loadMoreRejected'))
      .toMatchObject({ cause: first.id })

    // Повтор кнопкой, ответ — с его причиной.
    const retry = () =>
      q('[data-testid="infinite-scroll-error"] button') as HTMLElement | null
    await expect.poll(retry).toBeTruthy()
    await humanClick(retry()!)
    await expect.poll(() => calls.length).toBe(2)
    const repeat = lastOf('infiniteScroll', 'retryLoadMore')!
    expect(repeat.source).toBe('pointer')
    append(20)
    calls[1]!.resolve()
    await expect
      .poll(() => lastOf('infiniteScroll', 'loadMoreResolved'))
      .toMatchObject({ cause: repeat.id, detail: { added: 20 } })

    // Пустой ответ.
    scrollToEnd()
    await expect.poll(() => calls.length).toBe(3)
    const third = lastOf('infiniteScroll', 'loadMore')!
    calls[2]!.resolve()
    await expect
      .poll(() => lastOf('infiniteScroll', 'loadMoreEmpty'))
      .toMatchObject({ cause: third.id })
  })

  test('AL25: ядро — повтор загрузки, закрытие плашки ошибки и сброс фильтров; scrollToRow, подсветка и exportData из приложения — с source api, отказ scrollToRow — с cause', async () => {
    let api!: {
      scrollToRow: (id: string) => Promise<boolean>
      highlight: (target: unknown) => unknown
      exportData: (arg?: string) => unknown
      setColumnFilters: (filters: unknown) => void
    }
    const CoreGrid = ({ loadError }: { loadError?: unknown }) => {
      const table = useCreateTable({
        columns: [
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Name',
            filter: 'text',
          },
        ] as never,
        data: PROBE_DATA,
        getRowId: (row: (typeof PROBE_DATA)[number]) => row.id,
        loadError,
        onRetry: () => {},
        onDebugAction,
        plugins: [columnFiltering(), dataExportModel()] as never,
      })
      api = table as never
      return (
        <div style={{ width: 600, height: 420 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<CoreGrid loadError={new Error('Down')} />)

    // Плашка ошибки: повтор и закрытие.
    await expect.poll(() => q('[data-testid="load-error-retry"]')).toBeTruthy()
    await humanClick(q('[data-testid="load-error-retry"]')!)
    await expect
      .poll(() => lastOf('core', 'retryLoad'))
      .toMatchObject({ source: 'pointer' })
    await screen.rerender(<CoreGrid loadError={new Error('Down again')} />)
    const dismiss = () =>
      q('[data-testid="load-error-banner"] [data-alert-dismiss]')
    await expect.poll(dismiss).toBeTruthy()
    await humanClick(dismiss()!)
    await expect
      .poll(() => lastOf('core', 'dismissLoadError'))
      .toMatchObject({ source: 'pointer' })

    // Сброс фильтров из заглушки пустого результата.
    await screen.rerender(<CoreGrid />)
    api.setColumnFilters([
      { id: 'name', value: { operator: 'contains', value: 'zzz' } },
    ])
    const reset = () =>
      [
        ...(q('[data-testid="filter-stub"]')?.querySelectorAll('button') ?? []),
      ].find(each => each.textContent === 'Reset filters')
    await expect.poll(reset).toBeTruthy()
    await humanClick(reset()!)
    await expect
      .poll(() => lastOf('core', 'resetFilters'))
      .toMatchObject({ source: 'pointer' })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(0)

    // API приложения.
    actions.length = 0
    await api.scrollToRow('missing')
    await expect
      .poll(() => lastOf('core', 'scrollToRowRejected'))
      .toMatchObject({
        source: 'auto',
        cause: lastOf('core', 'scrollToRow')!.id,
      })
    expect(lastOf('core', 'scrollToRow')).toMatchObject({
      source: 'api',
      detail: { rowId: 'missing' },
    })
    api.highlight({ row: 'r1' })
    expect(lastOf('core', 'highlight')).toMatchObject({
      source: 'api',
      detail: { target: { row: 'r1' } },
    })
    const csv = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:al25')
    await api.exportData('csv')
    expect(lastOf('dataExportModel', 'exportData')).toMatchObject({
      source: 'api',
      detail: 'csv',
    })
    csv.mockRestore()
    vi.restoreAllMocks()
  })
})
