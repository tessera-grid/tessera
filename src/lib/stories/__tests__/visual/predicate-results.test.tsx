/**
 * Перерисовка по результату предиката (ADR 0193; RP2–RP6, RP8): новая ссылка на предикат из
 * `refreshOn` с прежними ответами не даёт второго прохода по таблице; с другим ответом
 * перерисовываются только его читатели — кнопка правки, отметка ошибки, ручка строки, выделение
 * ячейки и слот плагина автора. Обвязка историй передаёт демо-предикаты стабильными.
 */
import { type ReactNode, useCallback, useMemo } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin, usePredicateResult } from '../../../../index'
import type { PluginCellProps } from '../../../core/definePlugin'
import { useCreateTable } from '../../../core/useCreateTable'
import { BodyCell } from '../../../grid/BodyCell'
import { BodyRowCells } from '../../../grid/BodyRow'
import { HeadCellView } from '../../../grid/HeadCell'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellErrors,
  cellSelection,
  rowDragging,
  rowExpanding,
} from '../../../plugins'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { COLUMN_EXPANDING_ID } from '../../../plugins/rowExpanding/rowExpandingColumn'
import { useColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import { onReactCommit, type FiberRoot } from '../reactCommits'
import { renderGrid } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'

const ROWS = 12

interface Answers {
  editable: readonly string[]
  errorColumn: string
  draggable: readonly string[]
  expandable: readonly string[]
  selectable: readonly string[]
  flagged: readonly string[]
  /** Предикаты — стабильные функции, а не созданные в рендере. */
  stable?: boolean
}

const START: Answers = {
  editable: ['firstName'],
  errorColumn: 'age',
  draggable: ['item-id-0', 'item-id-1'],
  expandable: ['item-id-2'],
  selectable: ['country', 'firstName', 'lastName', 'age'],
  flagged: ['item-id-0'],
}

/** Метка плагина автора: читает свой предикат из `refreshOn` хуком ядра (RP6). */
const FlagMark = (
  props: PluginCellProps<{ isFlagged: (id: string) => boolean }>,
) => {
  const flagged = usePredicateResult(() => props.hooks.isFlagged(props.row.id))
  return flagged ? <span data-testid="author-flag" /> : null
}
const flags = definePlugin<{
  enabled?: boolean
  isFlagged?: (id: string) => boolean
}>()({
  id: 'authorFlags',
  refreshOn: ['isFlagged'],
  diagnose: () => undefined,
  hooks: o => ({ isFlagged: o.isFlagged ?? (() => false) }),
  slots: [
    { id: 'authorFlags', slot: 'rightCellSlot', component: FlagMark as never },
  ],
})

const Host = ({ answers }: { answers: Answers }): ReactNode => {
  const columns = useColumns(6)
  const data = useMemo(() => getData(ROWS), [])
  const { editable, errorColumn, draggable, expandable, selectable, flagged } =
    answers
  // Стабильные предикаты: ссылка меняется только со сменой ответов.
  const canEditStable = useCallback(
    (ctx: { column: { id: string } }) => editable.includes(ctx.column.id),
    [editable],
  )
  const inline = !answers.stable
  const canEditCell = inline
    ? (ctx: { column: { id: string } }) => editable.includes(ctx.column.id)
    : canEditStable
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      cellEditing({ canEditCell: canEditCell as never }),
      cellErrors({
        getCellError: ((ctx: { column: { id: string } }) =>
          ctx.column.id === errorColumn ? 'Bad' : undefined) as never,
      }),
      rowDragging({
        canDragRow: ((row: { id: string }) =>
          draggable.includes(row.id)) as never,
      }),
      rowExpanding({
        hasChildren: ((row: { id: string }) =>
          expandable.includes(row.id)) as never,
        loadChildren: () => new Promise(() => {}),
      }),
      cellSelection({
        canSelectCell: ((cell: { column: { id: string } }) =>
          selectable.includes(cell.column.id)) as never,
      }),
      flags({ isFlagged: id => flagged.includes(id) }),
    ] as never,
  })
  return (
    <div
      style={{
        width: 1100,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DataGrid table={table as never} height={560} />
    </div>
  )
}

type Component = unknown
const MEMO = Symbol.for('react.memo')
const unwrap = (c: Component): Component => {
  const memo = c as { $$typeof?: symbol; type?: Component }
  return memo?.$$typeof === MEMO ? unwrap(memo.type) : c
}

interface Fiber {
  tag: number
  flags: number
  type: unknown
  child: Fiber | null
  sibling: Fiber | null
}
const COMPONENT_TAGS = new Set([0, 1, 11, 15])
const walk = (fiber: Fiber | null, out: Fiber[]) => {
  for (let f = fiber; f; f = f.sibling) {
    out.push(f)
    walk(f.child, out)
  }
}

/** Отрисовки по компоненту в каждом коммите корня, пока идёт `action` и кадры после него. */
const commitsOf = async (
  action: () => Promise<unknown> | unknown,
): Promise<Map<Component, number>[]> => {
  const element = document.querySelector('.data-grid__body-row')!
  const key = Object.keys(element).find(k => k.startsWith('__reactFiber$'))!
  let fiber = (element as unknown as Record<string, { return: unknown }>)[key]!
  while ((fiber as { return: unknown }).return)
    fiber = (fiber as { return: typeof fiber }).return as typeof fiber
  const root = (fiber as unknown as { stateNode: FiberRoot }).stateNode
  const all = () => {
    const out: Fiber[] = []
    walk((root.current as Fiber).child, out)
    return out
  }
  let previous = new Set(all())
  const commits: Map<Component, number>[] = []
  onReactCommit(committed => {
    if (committed !== root) return
    const current = all()
    const counts = new Map<Component, number>()
    for (const f of current) {
      if (COMPONENT_TAGS.has(f.tag) && !previous.has(f) && (f.flags & 1) !== 0)
        counts.set(f.type, (counts.get(f.type) ?? 0) + 1)
    }
    commits.push(counts)
    previous = new Set(current)
  })
  try {
    await action()
    for (let i = 0; i < 6; i++)
      await new Promise(resolve => requestAnimationFrame(resolve))
  } finally {
    onReactCommit(undefined)
  }
  return commits
}
const rendersIn = (commits: Map<Component, number>[], component: Component) =>
  commits.reduce((sum, c) => sum + (c.get(unwrap(component)) ?? 0), 0)
const total = (commits: Map<Component, number>[]) =>
  commits.reduce(
    (sum, c) => sum + [...c.values()].reduce((a, b) => a + b, 0),
    0,
  )

const cellOf = (row: string, column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const editIn = (row: string, column: string) =>
  !!cellOf(row, column)?.querySelector(
    `button[aria-label="${cellEditingLabels(tableLabels).editCell}"]`,
  )
const errorIn = (row: string, column: string) =>
  !!cellOf(row, column)?.querySelector('button[data-cell-issue]')
const toggleIn = (row: string) =>
  !!cellOf(row, COLUMN_EXPANDING_ID)?.querySelector('.row-expand-button')
const handleIn = (row: string) =>
  !!document
    .querySelector(`.data-grid__body-row[data-row-id="${row}"]`)
    ?.querySelector('.drag__handler--column')
const selectableIn = (row: string, column: string) =>
  cellOf(row, column)?.getAttribute('data-cell-selectable') === 'true'
const flagIn = (row: string) =>
  !!document
    .querySelector(`.data-grid__body-row[data-row-id="${row}"]`)
    ?.querySelector('[data-testid="author-flag"]')

/** Строки, ячейки и шапка во втором и следующих коммитах. */
const gridRendersAfterFirst = (commits: Map<Component, number>[]) =>
  rendersIn(commits.slice(1), BodyCell) +
  rendersIn(commits.slice(1), BodyRowCells) +
  rendersIn(commits.slice(1), HeadCellView)

let screen: Awaited<ReturnType<typeof render>> | undefined
afterEach(async () => {
  await screen?.unmount()
  screen = undefined
})

const mount = async (answers: Answers) => {
  screen = await render(<Host answers={answers} />)
  await waitForGrid()
  await expect.poll(() => toggleIn('item-id-2')).toBe(true)
}

describe('Перерисовка по результату предиката (ADR 0193)', () => {
  test('RP2: новая ссылка на canEditCell с прежними ответами при перерисовке хоста — после эффекта коммита строки, ячейки и шапка не перерисовываются', async () => {
    // Контроль: та же перерисовка хоста со стабильными предикатами.
    await mount({ ...START, stable: true })
    const control = await commitsOf(() =>
      screen!.rerender(<Host answers={{ ...START, stable: true }} />),
    )
    await screen!.unmount()

    await mount(START)
    const inline = await commitsOf(() =>
      screen!.rerender(<Host answers={{ ...START }} />),
    )
    expect(editIn('item-id-0', 'firstName')).toBe(true)
    expect(gridRendersAfterFirst(inline)).toBe(0)
    expect(inline.length).toBe(control.length)
    expect(total(inline)).toBe(total(control))
  })

  test('RP3: новая ссылка на canEditCell или getCellError с другим ответом показывает и убирает кнопку правки и отметку ошибки только в затронутых ячейках, в том же кадре', async () => {
    await mount(START)
    expect(editIn('item-id-0', 'firstName')).toBe(true)
    expect(editIn('item-id-0', 'lastName')).toBe(false)
    expect(errorIn('item-id-0', 'age')).toBe(true)
    const commits = await commitsOf(() =>
      screen!.rerender(
        <Host
          answers={{ ...START, editable: ['lastName'], errorColumn: 'gender' }}
        />,
      ),
    )
    expect(editIn('item-id-0', 'firstName')).toBe(false)
    expect(editIn('item-id-0', 'lastName')).toBe(true)
    expect(errorIn('item-id-0', 'age')).toBe(false)
    expect(errorIn('item-id-0', 'gender')).toBe(true)
    expect(gridRendersAfterFirst(commits)).toBe(0)
  })

  test('RP4: новая ссылка на canDragRow с другим ответом показывает и убирает ручку перетаскивания только в затронутых строках, в том же кадре', async () => {
    await mount(START)
    expect(handleIn('item-id-0')).toBe(true)
    expect(handleIn('item-id-3')).toBe(false)
    const commits = await commitsOf(() =>
      screen!.rerender(
        <Host
          answers={{
            ...START,
            draggable: ['item-id-3'],
          }}
        />,
      ),
    )
    expect(handleIn('item-id-0')).toBe(false)
    expect(handleIn('item-id-3')).toBe(true)
    // Перерисованы только три строки со сменившимся ответом (0 и 1 теряют ручку, 3 получает);
    // шапка — нет.
    expect(rendersIn(commits.slice(1), BodyRowCells)).toBe(3)
    expect(rendersIn(commits.slice(1), HeadCellView)).toBe(0)
  })

  test('RP5: узел канала вклада пересчитывает выборы при новой версии — canSelectCell с другим ответом меняет выделяемость ячейки, с прежним ячейки не перерисовываются', async () => {
    await mount(START)
    expect(selectableIn('item-id-0', 'age')).toBe(true)
    const same = await commitsOf(() =>
      screen!.rerender(<Host answers={{ ...START }} />),
    )
    expect(rendersIn(same.slice(1), BodyCell)).toBe(0)
    await commitsOf(() =>
      screen!.rerender(
        <Host answers={{ ...START, selectable: ['country', 'firstName'] }} />,
      ),
    )
    expect(selectableIn('item-id-0', 'age')).toBe(false)
    expect(selectableIn('item-id-0', 'firstName')).toBe(true)
  })

  test('RP6: слот плагина автора читает свой предикат из refreshOn хуком usePredicateResult из публичного API — ответ виден до кадра, общей перерисовки ячеек нет', async () => {
    await mount(START)
    expect(flagIn('item-id-0')).toBe(true)
    expect(flagIn('item-id-1')).toBe(false)
    const commits = await commitsOf(() =>
      screen!.rerender(<Host answers={{ ...START, flagged: ['item-id-1'] }} />),
    )
    expect(flagIn('item-id-0')).toBe(false)
    expect(flagIn('item-id-1')).toBe(true)
    expect(gridRendersAfterFirst(commits)).toBe(0)
  })
})

/** Таблица грида на странице — из пропсов `DataGrid` в дереве React. */
const tableOfGrid = () => {
  const element = document.querySelector('.data-grid__body-row')!
  const key = Object.keys(element).find(k => k.startsWith('__reactFiber$'))!
  type Node = { memoizedProps?: { table?: unknown }; return: Node | null }
  for (
    let f: Node | null = (element as unknown as Record<string, Node>)[key]!;
    f;
    f = f.return
  ) {
    const table = f.memoizedProps?.table as
      { options: { pluginRenderVersion?: { get: () => number } } } | undefined
    if (table?.options.pluginRenderVersion) return table
  }
  throw new Error('таблица грида не найдена')
}

describe('Предикаты обвязки историй (ADR 0193)', () => {
  test('RP8: обвязка историй передаёт демо-предикаты стабильными — перерисовка истории не поднимает версию отрисовки', async () => {
    screen = await renderGrid({
      dataCount: 20,
      enableCellEditing: true,
      enableCellErrors: true,
      enableRowSelection: true,
    })
    await waitForGrid()
    const version = () => tableOfGrid().options.pluginRenderVersion!.get()
    await expect
      .poll(() =>
        document.querySelector(
          ".data-grid__body-row[data-row-id='item-id-1'] .row-select-checkbox",
        ),
      )
      .not.toBeNull()
    const before = version()
    // Выбор строки пишет колбэк в консоль истории — история перерисовывается.
    document
      .querySelector<HTMLElement>(
        ".data-grid__body-row[data-row-id='item-id-1'] .row-select-checkbox",
      )!
      .click()
    await expect
      .poll(() =>
        document
          .querySelector(".data-grid__body-row[data-row-id='item-id-1']")
          ?.getAttribute('data-selected'),
      )
      .toBe('true')
    for (let i = 0; i < 4; i++)
      await new Promise(resolve => requestAnimationFrame(resolve))
    expect(version()).toBe(before)
  })
})
