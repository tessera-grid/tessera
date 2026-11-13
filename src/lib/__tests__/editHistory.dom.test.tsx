// @vitest-environment happy-dom
/**
 * История правок (ADR 0222, этап 1): записи из сохранённых операций, отмена и повтор
 * компенсирующей записью, очередь за ждущими сохранениями, конфликт, жизнь по id строк, режим
 * «Применить», API, записи приложения, объявления и канал действий, умолчание маркера.
 * Запуск: npx vitest run --config vitest.node.config.ts editHistory
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import { cancelPending } from '../core/cancellation'
import type { DebugAction } from '../core/debugActions'
import { readPluginHooks } from '../core/definePlugin'
import { readFailures } from '../core/failures/failuresFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  cellSelection,
  columnFilteringModel,
  columnSortingModel,
  editHistory,
  paginationModel,
  quickSearchModel,
  rowDragging,
  rowGroupingModel,
} from '../plugins'
import {
  commitAllDrafts,
  saveEdit,
  startEditSession,
} from '../plugins/cellEditing/session'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'
import { editHistoryLabels } from '../plugins/editHistory/labels'
import { moveRow } from '../plugins/rowDragging/moveRow'
import type { RowDragEnd } from '../plugins/rowDragging/types'
import { objectTargetText } from '../shared/objectTarget'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; age: number }

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age', dataType: 'number' },
]
const ROWS: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

type Answer = CellEditBatchResult | void | Promise<CellEditBatchResult | void>

interface HostProps {
  /** Ответ на пакет; по умолчанию — сохранено сразу. */
  answer?: (batch: CellEditBatch) => Answer
  saveMode?: 'auto' | 'manual'
  conflict?: 'skip' | 'overwrite'
  limit?: number
  canEditCell?: (ctx: { column: { id: string } }) => boolean
  onDebugAction?: (action: DebugAction) => void
  /** Перенос строк: `onRowDragEnd` получает каждый перенос. */
  onRowDragEnd?: (end: RowDragEnd) => void
  /** Без модели группировки: строки до сохранения работают в плоском списке (DR33). */
  flat?: boolean
}

let table: any
let setRows: (update: (rows: Row[]) => Row[]) => void = () => {}
let batches: CellEditBatch[] = []
let root: Root | undefined
let container: HTMLDivElement | undefined

/** Сохранённое — в данные приложения, как у настоящего приложения. */
const apply = (rows: Row[], batch: CellEditBatch, refused: Set<string>) =>
  insertRows(
    rows.filter(row => !(batch.deletes ?? []).some(d => d.rowId === row.id)),
    batch,
  ).map(row => {
    const cells = batch.cells.filter(
      cell =>
        cell.rowId === row.id && !refused.has(`${cell.rowId}:${cell.columnId}`),
    )
    return cells.length === 0
      ? row
      : cells.reduce(
          (next, cell) => ({ ...next, [cell.columnId]: cell.value }),
          row,
        )
  })

/** Новые строки пакета — за строкой над ними, как у приложения (ADR 0178, §7). */
const insertRows = (rows: Row[], batch: CellEditBatch) =>
  (batch.inserts ?? []).reduce((next, insert) => {
    const at = insert.after
      ? next.findIndex(row => row.id === insert.after) + 1
      : 0
    const copy = [...next]
    copy.splice(at, 0, { ...(insert.values as Row), id: insert.rowId })
    return copy
  }, rows)

const Host = ({
  answer,
  saveMode = 'auto',
  conflict,
  limit,
  canEditCell,
  onDebugAction,
  onRowDragEnd,
  flat = false,
}: HostProps) => {
  const [rows, set] = useState(ROWS)
  setRows = set
  table = useCreateTable({
    columns: columns as never,
    data: rows,
    getRowId: (row: Row) => row.id,
    ...(onDebugAction ? { onDebugAction } : {}),
    plugins: [
      cellEditing({
        saveMode,
        onCellEdit: (commit: {
          rowId: string
          columnId: string
          value: unknown
        }) =>
          set(prev =>
            prev.map(row =>
              row.id === commit.rowId
                ? { ...row, [commit.columnId]: commit.value }
                : row,
            ),
          ),
        onCommitEdits: (batch: CellEditBatch) => {
          batches.push(batch)
          const settle = (result: CellEditBatchResult | void) => {
            const refused = new Set(
              (result?.refused ?? []).map(
                item => `${item.rowId}:${item.columnId}`,
              ),
            )
            set(prev => apply(prev, batch, refused))
            return result
          }
          const result = answer?.(batch)
          return result instanceof Promise
            ? result.then(settle)
            : settle(result)
        },
        ...(canEditCell ? { canEditCell } : {}),
      } as never),
      cellSelection(),
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
      paginationModel(),
      ...(flat ? [] : [rowGroupingModel()]),
      ...(onRowDragEnd
        ? [
            rowDragging({
              onRowOrderChange: (update: (prev: Row[]) => Row[]) =>
                set(prev => update(prev)),
              onRowDragEnd,
            } as never),
          ]
        : []),
      editHistory({
        ...(conflict ? { conflict } : {}),
        ...(limit ? { limit } : {}),
      }),
    ],
  } as never)
  return null
}

const render = (props: HostProps = {}) => {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = undefined
  batches = []
})

const flush = () => act(async () => {})

const write = async (
  changes: { rowId: string; columnId: string; value: unknown }[],
  source:
    | 'paste'
    | 'api'
    | 'clear'
    | 'cut'
    | 'bulk'
    | 'fill'
    | 'fillDown'
    | 'fillRight' = 'paste',
) => {
  await act(async () => {
    await table.writeCells(changes, { source })
  })
  await flush()
}

const ageOf = (rowId: string) =>
  table.getRowSource().byId(rowId)?.getValue('age') as number

const undo = async () => {
  let ok = false
  await act(async () => {
    ok = await table.undo()
  })
  await flush()
  return ok
}

const redo = async () => {
  let ok = false
  await act(async () => {
    ok = await table.redo()
  })
  await flush()
  return ok
}

const deferred = () => {
  let resolve!: (value: CellEditBatchResult | void) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<CellEditBatchResult | void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const say = vi.fn()
const announce = () => {
  say.mockClear()
  registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
}
const said = () => say.mock.calls.map(([text]) => String(text)).join(' | ')
const own = editHistoryLabels(ENGLISH_LABELS)

describe('История правок (ADR 0222)', () => {
  it('UD2: сохранённая операция записи — одна запись с id, источником, временем и ячейками «было → стало» в типе колонки; правка в редакторе, вставка, протяжка, Ctrl+D, Ctrl+R, очистка, вырезание, Ctrl+Enter и writeCells дают запись', async () => {
    render()
    const sources = [
      'paste',
      'fill',
      'fillDown',
      'fillRight',
      'clear',
      'cut',
      'bulk',
      'api',
    ] as const
    for (const [index, source] of sources.entries())
      await write([{ rowId: '0', columnId: 'age', value: 30 + index }], source)
    act(() => {
      const row = table.getRowSource().byId('1')
      startEditSession(table, row, { id: 'age' })
    })
    act(() =>
      saveEdit(
        table,
        { rowId: '1', columnId: 'age' },
        { value: 77 },
        readPluginHooks(table, 'cellEditing'),
      ),
    )
    await flush()
    const history = table.getHistory()
    expect(
      history.entries.map((entry: { source: string }) => entry.source),
    ).toEqual([...sources, 'edit'])
    expect(history.position).toBe(sources.length + 1)
    expect(
      history.entries.every(
        (entry: { time: number; id: string }) => entry.time > 0 && entry.id,
      ),
    ).toBe(true)
    expect(history.entries.at(-1).cells).toBe(1)
    // Значения в типе колонки: отмена правки в редакторе пишет число, а не текст.
    await undo()
    expect(batches.at(-1)!.cells[0]).toMatchObject({
      rowId: '1',
      columnId: 'age',
      value: 21,
    })
    expect(ageOf('1')).toBe(21)
  })

  it('UD3: ждущая правка записи не даёт до успеха; отклонённые ячейки ответа в запись не входят; пакет, отклонённый целиком, записи не даёт', async () => {
    let next = deferred()
    render({ answer: () => next.promise })
    await write([
      { rowId: '0', columnId: 'age', value: 40 },
      { rowId: '1', columnId: 'age', value: 41 },
    ])
    expect(table.getHistory().entries).toHaveLength(0)
    await act(async () => {
      next.resolve({ refused: [{ rowId: '1', columnId: 'age', reason: 'no' }] })
    })
    await flush()
    expect(table.getHistory().entries).toHaveLength(1)
    expect(table.getHistory().entries[0].cells).toBe(1)
    next = deferred()
    await write([{ rowId: '2', columnId: 'age', value: 42 }])
    await act(async () => {
      next.reject(new Error('down'))
    })
    await flush()
    expect(table.getHistory().entries).toHaveLength(1)
  })

  it('UD4: отмена — пакет source undo с after → before через onCommitEdits, повтор — source redo с before → after; canEditCell и validate проверяют значения; пакеты отмены и повтора новой записи не дают', async () => {
    const canEditCell = vi.fn(() => true)
    render({ canEditCell })
    await write([{ rowId: '0', columnId: 'age', value: 50 }])
    expect(await undo()).toBe(true)
    expect(batches.at(-1)).toMatchObject({
      source: 'undo',
      cells: [{ rowId: '0', columnId: 'age', value: 20 }],
    })
    expect(ageOf('0')).toBe(20)
    expect(await redo()).toBe(true)
    expect(batches.at(-1)).toMatchObject({
      source: 'redo',
      cells: [{ rowId: '0', columnId: 'age', value: 50 }],
    })
    expect(ageOf('0')).toBe(50)
    expect(table.getHistory().entries).toHaveLength(1)
    // Запрет правки на лету: отмена ничего не пишет, запись остаётся.
    canEditCell.mockReturnValue(false)
    announce()
    const sent = batches.length
    expect(await undo()).toBe(false)
    expect(batches).toHaveLength(sent)
    expect(table.getHistory().position).toBe(1)
    expect(said()).toContain(own.announceNotWritable(1))
  })

  it('UD5: новая запись после отмены обрезает ветку повтора; сверх limit (по умолчанию 30) уходит старейшая', async () => {
    render({ limit: 3 })
    for (const value of [31, 32, 33, 34])
      await write([{ rowId: '0', columnId: 'age', value }])
    expect(table.getHistory().entries).toHaveLength(3)
    await undo()
    await undo()
    expect(table.canRedo()).toBe(true)
    await write([{ rowId: '1', columnId: 'age', value: 99 }])
    expect(table.canRedo()).toBe(false)
    expect(table.getHistory().entries).toHaveLength(2)
    act(() => root!.unmount())
    root = undefined
    render()
    for (let i = 0; i < 32; i++)
      await write([{ rowId: '0', columnId: 'age', value: i }])
    expect(table.getHistory().entries).toHaveLength(30)
  })

  it('UD6: отмены и повторы идут по одной; Ctrl+Z при ждущей правке ждёт её итога: сохранена — обратная запись, отклонена — отменяется предыдущая запись', async () => {
    let next: ReturnType<typeof deferred> | undefined
    render({ answer: () => next?.promise })
    await write([{ rowId: '0', columnId: 'age', value: 60 }])
    next = deferred()
    await write([{ rowId: '1', columnId: 'age', value: 61 }])
    let undone: Promise<boolean> | undefined
    act(() => {
      undone = table.undo()
    })
    await flush()
    // Пока правка ждёт, отмена не уходит.
    expect(batches.filter(batch => batch.source === 'undo')).toHaveLength(0)
    const pending = next
    next = undefined
    await act(async () => {
      pending.resolve()
    })
    await act(async () => {
      await undone
    })
    await flush()
    expect(batches.at(-1)).toMatchObject({
      source: 'undo',
      cells: [{ rowId: '1', value: 21 }],
    })
    // Отклонённая ждущая правка — отменяется предыдущая запись.
    next = deferred()
    await write([{ rowId: '2', columnId: 'age', value: 62 }])
    act(() => {
      undone = table.undo()
    })
    const refused = next
    next = undefined
    await act(async () => {
      refused.reject(new Error('down'))
    })
    await act(async () => {
      await undone
    })
    await flush()
    expect(batches.at(-1)).toMatchObject({
      source: 'undo',
      cells: [{ rowId: '0', value: 20 }],
    })
    // «Стоп» снимает отмену, вставшую в очередь: после ответа она не уходит.
    next = deferred()
    await write([{ rowId: '3', columnId: 'age', value: 63 }])
    act(() => {
      undone = table.undo()
    })
    await flush()
    expect(table.getHistory().busy).toBe(true)
    act(() => void cancelPending(table, { kind: 'history' }))
    let queued = true
    await act(async () => {
      queued = await undone!
    })
    expect(queued).toBe(false)
    const sent = batches.length
    const saved = next
    next = undefined
    await act(async () => {
      saved.resolve()
    })
    await flush()
    expect(batches).toHaveLength(sent)
    expect(ageOf('3')).toBe(63)
  })

  it('UD8: ячейка, изменённая извне после записи, при отмене пропускается, при повторе сравнивается с before; объявление; conflict overwrite пишет поверх; запись без ячеек уходит', async () => {
    render()
    await write([
      { rowId: '0', columnId: 'age', value: 70 },
      { rowId: '1', columnId: 'age', value: 71 },
    ])
    act(() =>
      setRows(rows =>
        rows.map(row => (row.id === '0' ? { ...row, age: 80 } : row)),
      ),
    )
    announce()
    await undo()
    expect(batches.at(-1)!.cells.map(cell => cell.rowId)).toEqual(['1'])
    expect(ageOf('0')).toBe(80)
    expect(said()).toContain(own.announceConflicts(1))
    // Повтор сравнивает с before: строку 1 изменили после отмены — повторять нечего.
    act(() =>
      setRows(rows =>
        rows.map(row => (row.id === '1' ? { ...row, age: 90 } : row)),
      ),
    )
    const sent = batches.length
    await redo()
    expect(batches).toHaveLength(sent)
    expect(table.getHistory().entries).toHaveLength(0)
    act(() => root!.unmount())
    root = undefined
    render({ conflict: 'overwrite' })
    await write([{ rowId: '0', columnId: 'age', value: 70 }])
    act(() =>
      setRows(rows =>
        rows.map(row => (row.id === '0' ? { ...row, age: 80 } : row)),
      ),
    )
    await undo()
    expect(ageOf('0')).toBe(20)
  })

  it('UD9: история переживает сортировку, фильтр, поиск, страницу, группировку, новый data и транзакции; ячейки строки или колонки, которой нет, пропускаются с объявлением', async () => {
    render()
    await write([
      { rowId: '0', columnId: 'age', value: 70 },
      { rowId: '5', columnId: 'age', value: 75 },
    ])
    act(() => table.setSorting([{ id: 'age', desc: true }]))
    act(() => table.setColumnFilters([{ id: 'name', value: 'Name' }]))
    act(() => table.setGlobalFilter?.('Name'))
    act(() => table.setPageIndex(0))
    act(() => table.setGrouping(['name']))
    act(() => table.setGrouping([]))
    act(() => setRows(rows => [...rows].reverse()))
    expect(table.canUndo()).toBe(true)
    act(() => setRows(rows => rows.filter(row => row.id !== '5')))
    announce()
    await undo()
    expect(batches.at(-1)!.cells.map(cell => cell.rowId)).toEqual(['0'])
    expect(ageOf('0')).toBe(20)
    expect(said()).toContain(own.announceMissing(1))
  })

  it('UD11: режим «Применить» — запись появляется при записи черновиков; отмена и повтор меняют черновики без onCommitEdits; после «Применить» отмена даёт черновик', async () => {
    render({ saveMode: 'manual' })
    await write([{ rowId: '0', columnId: 'age', value: 70 }])
    expect(batches).toHaveLength(0)
    expect(table.getHistory().entries).toHaveLength(1)
    const draftOf = () =>
      (table.getDrafts?.() ?? []).find(
        (draft: { target: { cell?: [string, string] } }) =>
          draft.target.cell?.[0] === '0',
      )
    expect(draftOf()).toBeDefined()
    await undo()
    expect(batches).toHaveLength(0)
    expect(draftOf()).toBeUndefined()
    await redo()
    expect(draftOf()).toBeDefined()
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    expect(batches).toHaveLength(1)
    expect(ageOf('0')).toBe(70)
    await undo()
    expect(batches).toHaveLength(1)
    expect(draftOf()).toBeDefined()
  })

  it('UD14: undo, redo, rewindHistory возвращают Promise<boolean>; canUndo, canRedo, clearHistory, getHistory; срез editHistory — счётчики без записей', async () => {
    render()
    expect(table.canUndo()).toBe(false)
    expect(await undo()).toBe(false)
    for (const value of [31, 32, 33])
      await write([{ rowId: '0', columnId: 'age', value }])
    const [first] = table.getHistory().entries
    let ok = false
    await act(async () => {
      ok = await table.rewindHistory(first.id)
    })
    expect(ok).toBe(true)
    expect(table.getHistory().position).toBe(1)
    expect(ageOf('0')).toBe(31)
    expect(table.canRedo()).toBe(true)
    expect(table.store.get()['plugin:editHistory']).toMatchObject({
      size: 3,
      position: 1,
      busy: false,
    })
    expect(table.getHistory().entries[0].label).toBe(
      own.entryCell(
        'Paste',
        objectTargetText(table, { cell: ['0', 'age'] }, ENGLISH_LABELS),
      ),
    )
    act(() => table.clearHistory())
    expect(table.getHistory()).toMatchObject({ entries: [], position: 0 })
  })

  it('UD15: pushHistory кладёт запись приложения: undo и redo получают signal, промис ждёт, отказ и «стоп» — как у записи ячеек; target — цель «Показать»', async () => {
    render()
    const signals: AbortSignal[] = []
    let gate = deferred()
    const entry = {
      label: 'Archive',
      target: { row: '2' },
      undo: ({ signal }: { signal: AbortSignal }) => {
        signals.push(signal)
        return gate.promise
      },
      redo: () => undefined,
    }
    let id = ''
    act(() => {
      id = table.pushHistory(entry)
    })
    expect(table.getHistory().entries[0]).toMatchObject({
      id,
      label: 'Archive',
      source: 'app',
      target: { row: '2' },
    })
    let undone: Promise<boolean> | undefined
    act(() => {
      undone = table.undo()
    })
    await flush()
    expect(table.getHistory().busy).toBe(true)
    await act(async () => {
      gate.reject(new Error('locked'))
    })
    let ok = true
    await act(async () => {
      ok = await undone!
    })
    expect(ok).toBe(false)
    expect(table.getHistory().position).toBe(1)
    expect(Object.values(readFailures(table))).toHaveLength(1)
    // «Стоп» прерывает signal, запись остаётся.
    gate = deferred()
    act(() => {
      undone = table.undo()
    })
    await flush()
    act(() => void cancelPending(table, { kind: 'history' }))
    await act(async () => {
      ok = await undone!
    })
    expect(signals.at(-1)!.aborted).toBe(true)
    expect(ok).toBe(false)
    expect(table.getHistory().position).toBe(1)
    // Шаг той же записи прошёл — её отказ уходит из журнала.
    gate = deferred()
    act(() => {
      undone = table.undo()
    })
    await flush()
    await act(async () => {
      gate.resolve()
      ok = await undone!
    })
    expect(ok).toBe(true)
    expect(Object.values(readFailures(table))).toHaveLength(0)
  })

  it('UD21: объявления «Отменено: …» и «Повторено: …» с подписью записи; действия editHistory undo, redo, rewind — в канале действий', async () => {
    const actions: DebugAction[] = []
    render({ onDebugAction: action => actions.push(action) })
    await write([{ rowId: '0', columnId: 'age', value: 31 }])
    announce()
    await undo()
    await redo()
    const [entry] = table.getHistory().entries
    await act(async () => {
      await table.rewindHistory(entry.id)
    })
    expect(said()).toContain(own.announceUndone(entry.label))
    expect(said()).toContain(own.announceRedone(entry.label))
    const names = actions
      // Шаги истории; пакеты отмены и повтора — те же действия от записи (`auto`).
      .filter(
        action => action.plugin === 'editHistory' && action.source !== 'auto',
      )
      .map(action => action.action)
    expect(names).toEqual(['undo', 'redo', 'rewind'])
  })

  it('UD26: режим «Применить» — addRow даёт запись; отмена убирает новую строку, а применённую — кладёт черновик удаления; повтор возвращает строку с тем же id, значениями и местом', async () => {
    render({ saveMode: 'manual', flat: true })
    let id = ''
    act(() => {
      id = table.addRow({ name: 'New', age: 50 }, { index: 2 })
    })
    const kinds = (rowId: string) =>
      (table.getDrafts?.() ?? [])
        .filter(
          (draft: { target: { row?: string } }) => draft.target.row === rowId,
        )
        .map((draft: { kind: string }) => draft.kind)
    expect(table.getHistory().entries).toHaveLength(1)
    expect(kinds(id)).toEqual(['rowInsert'])
    await undo()
    expect(kinds(id)).toEqual([])
    await redo()
    expect(kinds(id)).toEqual(['rowInsert'])
    const draft = (
      table.getDrafts() as {
        kind: string
        target: { row?: string }
        value: { values: object; index: number }
      }[]
    ).find(item => item.target.row === id)!
    expect(draft.value).toMatchObject({
      values: { name: 'New', age: 50 },
      index: 2,
    })
    // Применили — строка в данных; отмена кладёт черновик её удаления.
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    expect(table.getRowSource().byId(id)).toBeDefined()
    expect(kinds(id)).toEqual([])
    await undo()
    expect(kinds(id)).toEqual(['rowDelete'])
  })

  it('UD27: режим «Применить» — removeRow даёт запись; отмена снимает черновик удаления, а при применённом удалении кладёт черновик вставки с прежними значениями, тем же id и на прежнее место; повтор удаляет снова', async () => {
    render({ saveMode: 'manual', flat: true })
    const kinds = (rowId: string) =>
      (table.getDrafts?.() ?? [])
        .filter(
          (draft: { target: { row?: string } }) => draft.target.row === rowId,
        )
        .map((draft: { kind: string }) => draft.kind)
    act(() => table.removeRow('2'))
    expect(kinds('2')).toEqual(['rowDelete'])
    await undo()
    expect(kinds('2')).toEqual([])
    await redo()
    expect(kinds('2')).toEqual(['rowDelete'])
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    expect(table.getRowSource().byId('2')).toBeUndefined()
    await undo()
    expect(kinds('2')).toEqual(['rowInsert'])
    const draft = (
      table.getDrafts() as {
        target: { row?: string }
        value: { values: object; index: number; after?: string }
      }[]
    ).find(item => item.target.row === '2')!
    expect(draft.value).toMatchObject({
      values: { id: '2', name: 'Name 2', age: 22 },
      index: 2,
      after: '1',
    })
    await redo()
    expect(kinds('2')).toEqual([])
  })

  it('UD31: строка не на месте после переноса — отмена её пропускает с объявлением, запись уходит; conflict overwrite переносит', async () => {
    const ends: RowDragEnd[] = []
    render({ onRowDragEnd: end => ends.push(end) })
    const order = () =>
      table.getRowModel().rows.map((row: { id: string }) => row.id)
    act(() => moveRow(table.getRowSource().byId('1'), table, 1))
    await flush()
    expect(order().slice(0, 3)).toEqual(['0', '2', '1'])
    expect(table.getHistory().entries).toHaveLength(1)
    // Строку переставили снова — данными приложения.
    act(() =>
      setRows(rows => {
        const next = rows.filter(row => row.id !== '1')
        next.splice(
          4,
          0,
          rows.find(row => row.id === '1')!,
        )
        return next
      }),
    )
    await flush()
    announce()
    await undo()
    expect(order().indexOf('1')).toBe(4)
    expect(table.getHistory().entries).toHaveLength(0)
    expect(said()).toContain(own.announceMoveSkipped)
    act(() => root!.unmount())
    root = undefined
    render({ onRowDragEnd: end => ends.push(end), conflict: 'overwrite' })
    act(() => moveRow(table.getRowSource().byId('1'), table, 1))
    await flush()
    act(() =>
      setRows(rows => {
        const next = rows.filter(row => row.id !== '1')
        next.splice(
          4,
          0,
          rows.find(row => row.id === '1')!,
        )
        return next
      }),
    )
    await flush()
    await undo()
    expect(order().indexOf('1')).toBe(1)
    expect(ends.at(-1)).toMatchObject({ rowId: '1', index: 1, source: 'undo' })
  })

  it('UD25: умолчание маркера — режим range и при включённой истории', () => {
    render()
    expect(table.options.cellSelectionHandle.mode).toBe('range')
  })
})
