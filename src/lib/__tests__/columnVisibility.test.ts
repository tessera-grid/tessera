/**
 * Headless-проверки модели меню колонок (ADR 0035, CV4, CV6, CV7, CV9–CV13; ADR 0046, PB7):
 * дерево, галочки групп, переключение, поиск, «Показать все» / «Сбросить», общий
 * срез и бизнес-колбэк.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { resolveHooks } from '../core/createHooks'
import { foldHooks } from '../core/features'
import { columnVisibility } from '../plugins/columnVisibility'
import {
  buildColumnTree,
  type ColumnTreeNode,
  filterColumnTree,
  getCheckState,
  getShowAll,
  getToggle,
} from '../plugins/columnVisibility/columnTree'
import {
  resetColumnsVisibility,
  setColumnsVisible,
} from '../plugins/columnVisibility/applyVisibility'
import { rowSelection } from '../plugins/rowSelection'
import { hideHeaderAction } from '../plugins/columnVisibility/hideHeaderAction'

const NESTED = [
  {
    id: 'person',
    header: 'Person',
    columns: [
      { id: 'first', accessorKey: 'first', header: 'First name' },
      { id: 'last', accessorKey: 'last', header: 'Last name' },
    ],
  },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]

const build = ({
  columns = NESTED as any[],
  plugins = [] as any[],
  state,
  initialState,
  onColumnVisibilityChange,
  enableToolbar,
}: {
  columns?: any[]
  plugins?: any[]
  state?: Record<string, unknown>
  initialState?: Record<string, unknown>
  onColumnVisibilityChange?: (updater: unknown) => void
  enableToolbar?: boolean
} = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: [{ id: '1', first: 'A', last: 'B', age: 3 }],
    columns: injectServiceColumns(columns, folded.serviceColumns),
    getRowId: (row: any) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries)),
    ...(state ? { state } : {}),
    ...(initialState ? { initialState } : {}),
    ...(onColumnVisibilityChange ? { onColumnVisibilityChange } : {}),
    enableToolbar,
  } as never) as any
}

const find = (nodes: ColumnTreeNode[], id: string): ColumnTreeNode => {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = node.children.length ? find(node.children, id) : undefined
    if (child) return child
  }
  return undefined as never
}

const shape = (nodes: ColumnTreeNode[]): unknown[] =>
  nodes.map(node =>
    node.children.length ? [node.id, shape(node.children)] : node.id,
  )

describe('columnVisibility — модель меню', () => {
  it('CV4: служебные колонки в меню не попадают', () => {
    const table = build({ plugins: [rowSelection()] })
    expect(
      table.getAllLeafColumns().some((c: any) => c.getIsActionsColumn()),
    ).toBe(true)
    expect(shape(buildColumnTree(table))).toEqual([
      ['person', ['first', 'last']],
      'age',
    ])
  })

  it('CV6: галочка группы трёхсостоянная — все видимы / ни одного / часть', () => {
    const all = build()
    expect(getCheckState(find(buildColumnTree(all), 'person'))).toBe('checked')

    const some = build({ state: { columnVisibility: { first: false } } })
    expect(getCheckState(find(buildColumnTree(some), 'person'))).toBe(
      'indeterminate',
    )

    const none = build({
      state: { columnVisibility: { first: false, last: false } },
    })
    expect(getCheckState(find(buildColumnTree(none), 'person'))).toBe(
      'unchecked',
    )
  })

  it('CV7: клик по группе показывает всех потомков, если хоть один скрыт, иначе скрывает всех', () => {
    const partial = build({ state: { columnVisibility: { first: false } } })
    expect(
      getToggle(find(buildColumnTree(partial), 'person'), partial),
    ).toEqual({ columnIds: ['first'], visible: true })

    const visible = build()
    expect(
      getToggle(find(buildColumnTree(visible), 'person'), visible),
    ).toEqual({ columnIds: ['first', 'last'], visible: false })
  })

  it('CV9: последнюю видимую пользовательскую колонку скрыть нельзя', () => {
    const table = build({
      plugins: [rowSelection()],
      state: { columnVisibility: { first: false, last: false } },
    })
    const tree = buildColumnTree(table)
    // Служебная колонка выбора видима, но не считается: age — последняя своя.
    expect(getToggle(find(tree, 'age'), table)).toBeNull()
    // Показать группу при этом можно.
    expect(getToggle(find(tree, 'person'), table)?.visible).toBe(true)
  })

  it('CV10: поиск без учёта регистра — совпавшая группа со всеми потомками, лист — с цепочкой родителей', () => {
    const tree = buildColumnTree(build())
    expect(shape(filterColumnTree(tree, 'PERSON'))).toEqual([
      ['person', ['first', 'last']],
    ])
    expect(shape(filterColumnTree(tree, 'last'))).toEqual([
      ['person', ['last']],
    ])
    expect(filterColumnTree(tree, 'nothing')).toEqual([])
    expect(filterColumnTree(tree, '  ')).toBe(tree)
  })

  it('CV11: «Показать все» открывает все скрываемые; «Сбросить» возвращает initialState.columnVisibility', () => {
    const table = build({
      columns: [
        ...NESTED,
        { id: 'locked', accessorKey: 'age', header: 'L', enableHiding: false },
      ],
      initialState: { columnVisibility: { age: false } },
    })
    expect(getShowAll(table)).toEqual(['age'])

    setColumnsVisible(table, ['first', 'last'], false)
    expect(getShowAll(table)).toEqual(['first', 'last', 'age'])
    setColumnsVisible(table, getShowAll(table), true)
    expect(getShowAll(table)).toEqual([])

    resetColumnsVisibility(table)
    expect(table.getColumn('age').getIsVisible()).toBe(false)
    expect(table.getColumn('first').getIsVisible()).toBe(true)
  })

  it('CV12: видимость — общий срез: контролируемый state и handler управляют меню', () => {
    const onColumnVisibilityChange = vi.fn()
    const table = build({
      state: { columnVisibility: { age: false } },
      onColumnVisibilityChange,
    })
    expect(getCheckState(find(buildColumnTree(table), 'age'))).toBe('unchecked')

    setColumnsVisible(table, ['age'], true)
    expect(onColumnVisibilityChange).toHaveBeenCalledTimes(1)
  })

  it('CV13: onToggleColumnVisibility вызывается на действие пользователя; для группы — одним вызовом со всеми листьями', () => {
    const onToggle = vi.fn()
    const table = build({
      plugins: [columnVisibility({ onToggleColumnVisibility: onToggle })],
    })

    const group = getToggle(find(buildColumnTree(table), 'person'), table)!
    setColumnsVisible(table, group.columnIds, group.visible)
    expect(onToggle).toHaveBeenLastCalledWith(['first', 'last'], false)

    resetColumnsVisibility(table)
    expect(onToggle).toHaveBeenLastCalledWith(['first', 'last'], true)
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('PB7: при enableToolbar: false columnVisibility инертен — diagnose noToolbar, «Скрыть колонку» нет; без флага — активен и пункт есть', () => {
    const { diagnose } = columnVisibility()
    // Видимая ячейка `age` — вершина цепочки v9 (ADR 0049), а не покрытый лист снизу.
    const headerCtx = (table: any) =>
      table
        .getHeaderGroups()
        .flatMap((group: any) => group.headers)
        .find((h: any) => h.column.id === 'age' && h.rowSpan > 0)
        .getContext()

    const byDefault = build({ plugins: [columnVisibility()] })
    expect(diagnose?.(byDefault)).toBeUndefined()
    expect(hideHeaderAction.visible!(headerCtx(byDefault))).toBe(true)

    const forbidden = build({
      plugins: [columnVisibility()],
      enableToolbar: false,
    })
    expect(diagnose?.(forbidden)).toBe('noToolbar')
    expect(hideHeaderAction.visible!(headerCtx(forbidden))).toBe(false)
  })
})
