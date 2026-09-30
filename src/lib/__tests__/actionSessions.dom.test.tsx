// @vitest-environment happy-dom
/**
 * Сессии действий (ADR 0040, SS1, SS5–SS6, SS10, SS16–SS18): успешное завершение зовёт
 * колбэк успеха, сессия правки живёт в срезе плагина и согласуется с таблицей после
 * рендера. Компоненты слотов рендерятся напрямую с контекстом ячейки и заголовка.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  columnDragging,
  columnSizing,
  type CellEditor,
} from '../plugins'
import { setEditDraft, startEditSession } from '../plugins/cellEditing/session'
import { getColumnDraggingEvents } from '../plugins/columnDragging/getColumnDraggingEvents'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name', enableDragging: true },
  { id: 'rank', accessorKey: 'rank', header: 'Rank', enableDragging: true },
]
const rows = [
  { id: '1', name: 'A', rank: 1 },
  { id: '2', name: 'B', rank: 2 },
  { id: '3', name: 'C', rank: 3 },
]

type Probe = 'edit' | 'resize' | 'none'

let captured: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
})

const slotComponent = (slot: string, id: string) =>
  captured
    .getRenderSlots()
    [slot].find((entry: { id: string }) => entry.id === id).component

interface HostProps {
  plugins: TesseraFeatureEntry[]
  data?: typeof rows
  probe?: Probe
}

const Host = ({ plugins, data = rows, probe = 'none' }: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins,
    handlers: { onRowOrderChange: () => {} },
  })
  if (probe === 'edit') {
    const cell = captured.getRow('1').getAllCells()[0]
    return createElement(slotComponent('cellSlot', 'cellEditing'), {
      ...cell.getContext(),
      content: 'A',
    })
  }
  if (probe === 'resize') {
    const header = captured.getFlatHeaders()[0]
    return createElement(
      slotComponent('rightHeaderSlot', 'columnSizingPlugin'),
      header.getContext(),
    )
  }
  return null
}

const render = (props: HostProps) => {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

const unmount = () => {
  act(() => root?.unmount())
  root = undefined
}

const key = (target: Element, name: string) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true }),
    )
  })

const startEdit = () =>
  act(() => startEditSession(captured, captured.getRow('1'), { id: 'name' }))

const session = () => captured.atoms['plugin:cellEditing'].get().active

const onCellEdit = vi.fn()
const onEditCancel = vi.fn()

beforeEach(() => {
  onCellEdit.mockReset()
  onEditCancel.mockReset()
})

describe('сессии действий', () => {
  it('SS1: успешная сессия зовёт бизнес-колбэк успеха и не зовёт колбэк отмены', () => {
    const onColumnResizeEnd = vi.fn()
    const onColumnResizeCancel = vi.fn()
    const onColumnDragEnd = vi.fn()
    const onColumnDragCancel = vi.fn()
    const plugins = [
      cellEditing({ onCellEdit, onEditCancel }),
      columnSizing({ onColumnResizeEnd, onColumnResizeCancel }),
      columnDragging({ onColumnDragEnd, onColumnDragCancel }),
    ]

    // Черновик до монтирования редактора — он стартует с него.
    render({ plugins })
    startEdit()
    act(() => setEditDraft(captured, 'B'))
    render({ plugins, probe: 'edit' })
    key(container!.querySelector('input')!, 'Enter')
    expect(onCellEdit).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      value: 'B',
      original: 'A',
    })
    expect(onEditCancel).not.toHaveBeenCalled()
    unmount()

    render({ plugins, probe: 'resize' })
    key(container!.querySelector('[role="separator"]')!, 'ArrowRight')
    expect(onColumnResizeEnd).toHaveBeenCalledWith({ id: 'name', width: 160 })
    expect(onColumnResizeCancel).not.toHaveBeenCalled()
    unmount()

    render({ plugins })
    act(() =>
      getColumnDraggingEvents(captured).onColumnDragStart({
        active: { id: 'name' },
      }),
    )
    act(() =>
      getColumnDraggingEvents(captured).onColumnDragEnd({
        over: {
          id: 'rank',
          data: { current: { orderIndex: 1, draggableIndex: 1 } },
        },
      }),
    )
    expect(onColumnDragEnd).toHaveBeenCalledWith({
      dragIndex: 0,
      hoverIndex: 1,
    })
    expect(onColumnDragCancel).not.toHaveBeenCalled()
  })

  it('SS5: строка с открытой правкой ушла из данных — сессия завершается unavailable, черновик приходит в onEditCancel', () => {
    const plugins = [cellEditing({ onCellEdit, onEditCancel })]
    render({ plugins })
    startEdit()
    act(() => setEditDraft(captured, 'draft'))
    render({ plugins, data: rows.filter(row => row.id !== '1') })

    expect(session()).toBeNull()
    expect(onEditCancel).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      reason: 'unavailable',
      draft: 'draft',
      original: 'A',
    })
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('SS6: BYO-редактор получает setDraft; черновик, сообщённый через него, переживает размонтирование', () => {
    const seen: string[] = []
    let setDraft: ((value: string) => void) | undefined
    const editor: CellEditor = props => {
      seen.push(props.value)
      setDraft = props.setDraft
      return createElement('span', { 'data-editor': true })
    }
    const plugins = [cellEditing({ editor, onEditCancel })]

    render({ plugins, probe: 'edit' })
    startEdit()
    expect(seen.at(-1)).toBe('A')
    act(() => setDraft!('kept'))
    render({ plugins, probe: 'none' })
    expect(container!.querySelector('[data-editor]')).toBeNull()

    render({ plugins, probe: 'edit' })
    expect(seen.at(-1)).toBe('kept')
    expect(session().draft).toBe('kept')
    expect(onEditCancel).not.toHaveBeenCalled()
  })

  it('SS16: плагин правки выключили или canEdit запретил ячейку вне экрана — сессия завершается revoke с черновиком', () => {
    render({ plugins: [cellEditing({ onEditCancel })] })
    startEdit()
    render({ plugins: [cellEditing({ enabled: false, onEditCancel })] })
    expect(session()).toBeNull()
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'revoke', draft: 'A' }),
    )
    unmount()

    const allow = () => true
    const deny = () => false
    render({ plugins: [cellEditing({ canEdit: allow, onEditCancel })] })
    startEdit()
    render({ plugins: [cellEditing({ canEdit: deny, onEditCancel })] })
    expect(session()).toBeNull()
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rowId: '1',
        columnId: 'name',
        reason: 'revoke',
      }),
    )
  })

  it('SS10: значение изменилось извне во время правки — по умолчанию сохранение с original и current, при onConflict: block — onEditCancel с conflict', () => {
    const changed = rows.map(row =>
      row.id === '1' ? { ...row, name: 'Z' } : row,
    )
    // Черновик до монтирования редактора — он стартует с него.
    const editAndChange = (plugins: TesseraFeatureEntry[]) => {
      render({ plugins })
      startEdit()
      act(() => setEditDraft(captured, 'mine'))
      render({ plugins, probe: 'edit', data: changed })
      key(container!.querySelector('input')!, 'Enter')
    }

    const plugins = [cellEditing({ onCellEdit, onEditCancel })]
    editAndChange(plugins)
    expect(onCellEdit).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      value: 'mine',
      original: 'A',
      current: 'Z',
    })
    expect(onEditCancel).not.toHaveBeenCalled()
    unmount()

    onCellEdit.mockReset()
    const strict = [
      cellEditing({ onCellEdit, onEditCancel, onConflict: 'block' }),
    ]
    editAndChange(strict)
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(session()).toBeNull()
    expect(onEditCancel).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      reason: 'conflict',
      draft: 'mine',
      original: 'A',
      current: 'Z',
    })
  })

  it('SS17: открытие правки другой ячейки при открытой сессии завершает прежнюю с cancel и её черновиком', () => {
    render({ plugins: [cellEditing({ onCellEdit, onEditCancel })] })
    startEdit()
    act(() => setEditDraft(captured, 'left behind'))
    act(() => startEditSession(captured, captured.getRow('2'), { id: 'name' }))

    expect(onEditCancel).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      reason: 'cancel',
      draft: 'left behind',
      original: 'A',
    })
    expect(session().cell).toEqual({ rowId: '2', columnId: 'name' })
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('SS18: сохранение неизменённого значения закрывает правку без onCellEdit, onEditCancel и validate', () => {
    const validate = vi.fn(() => 'never valid')
    const plugins = [cellEditing({ onCellEdit, onEditCancel, validate })]
    render({ plugins, probe: 'edit' })

    startEdit()
    key(container!.querySelector('input')!, 'Enter')
    expect(session()).toBeNull()
    expect(container!.querySelector('input')).toBeNull()

    startEdit()
    act(() => {
      container!
        .querySelector('input')!
        .dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(session()).toBeNull()

    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
  })
})
