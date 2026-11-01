// @vitest-environment happy-dom
/**
 * Выбор редактора ячейки (ADR 0175, ED3): `editor` колонки, затем типа (по `extends`), затем
 * аргумент плагина, затем встроенный по базовому типу; что получает редактор.
 * Запуск: npx vitest run --config vitest.node.config.ts typedEditors
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import { cellEditing, type CellEditor, type CellEditorProps } from '../plugins'
import { editorOf, togglesInPlace } from '../plugins/cellEditing/editors'
import { startEditSession } from '../plugins/cellEditing/session'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const seen: Record<string, CellEditorProps[]> = {}
const capture =
  (name: string): CellEditor =>
  props => {
    ;(seen[name] ??= []).push(props)
    return createElement('span', { 'data-editor': name })
  }
const columnEditor = capture('column')
const typeEditor = capture('type')
const pluginEditor = capture('plugin')

const DATA_TYPES = {
  measure: { extends: 'number', editor: typeEditor },
  // Редактор наследуется по `extends`.
  weight: { extends: 'measure' },
}

const columns = [
  {
    id: 'own',
    accessorKey: 'own',
    dataType: 'weight',
    editor: columnEditor,
  },
  { id: 'typed', accessorKey: 'typed', dataType: 'weight' },
  { id: 'plain', accessorKey: 'plain', dataType: 'number' },
  { id: 'flag', accessorKey: 'flag', dataType: 'boolean' },
  { id: 'name', accessorKey: 'name' },
]
const rows = [
  { id: '1', own: 1.5, typed: 2, plain: 1234.5, flag: false, name: 'A' },
]

let table: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  for (const key of Object.keys(seen)) delete seen[key]
})

const Host = ({
  editor,
  onCellEdit,
  probe,
}: {
  editor?: CellEditor
  onCellEdit?: () => void
  probe?: string
}) => {
  table = useCreateTable({
    columns: columns as never,
    data: rows,
    locale: 'ru-RU',
    dataTypes: DATA_TYPES,
    plugins: [cellEditing({ editor, onCellEdit })],
  })
  if (!probe) return null
  const cell = table
    .getRow('1')
    .getAllCells()
    .find((item: any) => item.column.id === probe)
  const slot = table
    .getRenderSlots()
    .cellSlot.find((entry: { id: string }) => entry.id === 'cellEditing')
  return createElement(slot.component, { ...cell.getContext(), content: '' })
}

const render = (props: Parameters<typeof Host>[0]) => {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

const hooksOf = () => table.getHooks().cellEditing
const column = (id: string) => table.getColumn(id)

describe('выбор редактора (ADR 0175)', () => {
  it('ED3: редактор — editor колонки, затем editor типа (наследуется по extends), затем аргумент editor плагина, затем встроенный по базовому типу; редактор получает черновик в типе колонки, текст, commit(value) и setDraft(value)', () => {
    render({ editor: pluginEditor })
    const hooks = hooksOf()
    expect(editorOf(table, column('own'), hooks)).toBe(columnEditor)
    expect(editorOf(table, column('typed'), hooks)).toBe(typeEditor)
    expect(editorOf(table, column('plain'), hooks)).toBe(pluginEditor)
    expect(togglesInPlace(table, column('flag'), hooks)).toBe(false)

    // Без аргумента плагина — встроенные: поле числа и булево без поля.
    render({})
    const builtIn = hooksOf()
    expect(editorOf(table, column('typed'), builtIn)).toBe(typeEditor)
    expect(togglesInPlace(table, column('flag'), builtIn)).toBe(true)
    expect(editorOf(table, column('plain'), builtIn)).not.toBe(
      editorOf(table, column('name'), builtIn),
    )
    act(() => startEditSession(table, table.getRow('1'), { id: 'plain' }))
    render({ probe: 'plain' })
    expect(container!.querySelector('input')!.getAttribute('inputmode')).toBe(
      'decimal',
    )

    // Что получает редактор: значение в типе и его текст по языку таблицы.
    const onCellEdit = vi.fn()
    render({ editor: pluginEditor, onCellEdit })
    act(() => startEditSession(table, table.getRow('1'), { id: 'plain' }))
    render({ editor: pluginEditor, onCellEdit, probe: 'plain' })
    const props = seen.plugin!.at(-1)!
    expect(props.value).toBe(1234.5)
    expect(props.text).toBe('1234,5')
    act(() => props.setDraft(7.25))
    const session = table.atoms['plugin:cellEditing'].get().active
    expect(session).toMatchObject({ draft: 7.25, text: '7,25' })
    act(() => seen.plugin!.at(-1)!.commit(8))
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'plain', value: 8, text: '8' }),
    )
  })
})
