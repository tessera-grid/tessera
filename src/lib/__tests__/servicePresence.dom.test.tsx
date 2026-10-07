// @vitest-environment happy-dom
/**
 * Показ служебных колонок по условию (ADR 0050, SC1–SC2, SC6, SC8–SC9, SC11): условие
 * смотрит на исходные данные, скрытие — эффективное состояние видимости, сохранённый
 * срез не переписывается.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ROW_ACTIONS_COLUMN_ID } from '../core/createColumns'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnSorting,
  pagination,
  quickSearch,
  rowActions,
  rowExpanding,
  rowSelection,
} from '../plugins'
import { COLUMN_EXPANDING_ID } from '../plugins/rowExpanding/rowExpandingColumn'
import { COLUMN_SELECTION_ID } from '../plugins/rowSelection/rowSelectionColumn'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const mount = (node: React.ReactNode) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(node))
}

const columns = [{ id: 'name', accessorKey: 'name' }]
const flat = [
  { id: '1', name: 'Ann' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Cy' },
]
// Единственная раскрываемая строка — `Zed`: сортировка, поиск и вторая страница её прячут.
const tree = [
  ...flat,
  { id: 't', name: 'Zed', subRows: [{ id: 'c', name: 'Kid' }] },
]

type Props = {
  data: typeof tree
  plugins: Parameters<typeof useCreateTable>[0]['plugins']
  state?: Record<string, unknown>
  handlers?: Record<string, unknown>
}

const Host = ({ data, plugins, state, handlers }: Props) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins,
    state: state as never,
    handlers: handlers as never,
  })
  return null
}

const visible = (id: string) => captured.getColumn(id).getIsVisible()

describe('показ служебных колонок', () => {
  it('SC1: колонка без presence видна всегда; с presence — только когда условие истинно', () => {
    mount(<Host data={flat} plugins={[rowSelection(), rowExpanding()]} />)
    expect(visible(COLUMN_SELECTION_ID)).toBe(true)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)

    mount(<Host data={tree} plugins={[rowSelection(), rowExpanding()]} />)
    expect(visible(COLUMN_SELECTION_ID)).toBe(true)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)
  })

  it('SC2: сортировка, поиск и пагинация при тех же данных колонку не скрывают', () => {
    mount(
      <Host
        data={tree}
        plugins={[
          rowExpanding(),
          columnSorting(),
          quickSearch(),
          pagination({ initialPageSize: 3 }),
        ]}
      />,
    )
    const rows = () =>
      captured.getRowModel().rows.map((row: { id: string }) => row.id)

    act(() => captured.getColumn('name').toggleSorting(false))
    expect(rows()).not.toContain('t')
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)

    act(() => captured.setGlobalFilter('Ann'))
    expect(rows()).toEqual(['1'])
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)

    act(() => {
      captured.setGlobalFilter('')
      captured.getColumn('name').clearSorting()
      captured.setPageIndex(0)
    })
    expect(rows()).toEqual(['1', '2', '3'])
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)
  })

  it('SC6: скрытие не переписывает сохранённый срез: контролируемый потребитель не получает onChange, видимость других колонок сохраняется', () => {
    const onChange = vi.fn()
    const saved = { name: false }
    mount(
      <Host
        data={flat}
        plugins={[rowExpanding()]}
        state={{ columnVisibility: saved }}
        handlers={{ onColumnVisibilityChange: onChange }}
      />,
    )
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)
    expect(visible('name')).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(saved).toEqual({ name: false })

    // Неконтролируемый срез: скрытая пользователем колонка остаётся скрытой, когда
    // служебная появляется и исчезает.
    act(() => root?.unmount())
    root = undefined
    mount(<Host data={flat} plugins={[rowExpanding()]} />)
    act(() => captured.getColumn('name').toggleVisibility(false))
    mount(<Host data={tree} plugins={[rowExpanding()]} />)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)
    expect(visible('name')).toBe(false)
    mount(<Host data={flat} plugins={[rowExpanding()]} />)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)
    expect(visible('name')).toBe(false)
  })

  it("SC8: column: 'always' показывает колонку при ложном условии; у плагинов без presence опции нет", () => {
    mount(
      <Host
        data={flat}
        plugins={[
          rowExpanding({ column: 'always' }),
          rowActions({ column: 'always' }),
        ]}
      />,
    )
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)
    expect(visible(ROW_ACTIONS_COLUMN_ID)).toBe(true)

    // @ts-expect-error — у rowSelection колонка без условия, опции `column` нет.
    rowSelection({ column: 'always' })
  })

  it('SC9: смена column на лету применяется без перемонтирования и без новых колонок', () => {
    mount(<Host data={flat} plugins={[rowExpanding()]} />)
    const store = captured.store
    const injected = captured.options.columns
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)

    mount(<Host data={flat} plugins={[rowExpanding({ column: 'always' })]} />)
    expect(captured.store).toBe(store)
    expect(captured.options.columns).toBe(injected)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(true)

    mount(<Host data={flat} plugins={[rowExpanding()]} />)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)
  })

  it('SC11: перерисовка без смены данных, колонок и видимости не пересчитывает условие и сохраняет идентичность columnVisibility', () => {
    const hasChildren = vi.fn(() => false)
    mount(<Host data={flat} plugins={[rowExpanding({ hasChildren })]} />)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)
    const visibility = captured.options.state.columnVisibility
    const calls = hasChildren.mock.calls.length

    mount(<Host data={flat} plugins={[rowExpanding({ hasChildren })]} />)
    expect(hasChildren).toHaveBeenCalledTimes(calls)
    expect(captured.options.state.columnVisibility).toBe(visibility)
    expect(visible(COLUMN_EXPANDING_ID)).toBe(false)
  })
})
