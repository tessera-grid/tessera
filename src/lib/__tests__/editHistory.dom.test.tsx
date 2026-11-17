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
import { type Draft, discardDraft } from '../core/drafts/drafts'
import { readFailures } from '../core/failures/failuresFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { readServerAction } from '../core/serverActions'
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
  maxCells?: number
  sources?: readonly string[]
  canRecordChange?: (change: any) => boolean
  writeLimits?: { confirm?: number; max?: number } | false
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
    refused,
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
// Отказ строки приходит без колонки: отказанную новую строку приложение не добавляет.
const insertRows = (rows: Row[], batch: CellEditBatch, refused: Set<string>) =>
  (batch.inserts ?? []).reduce((next, insert) => {
    if (refused.has(`${insert.rowId}:undefined`)) return next
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
  maxCells,
  sources,
  canRecordChange,
  writeLimits,
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
    ...(writeLimits === undefined ? {} : { writeLimits }),
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
        ...(maxCells ? { maxCells } : {}),
        ...(sources ? { sources } : {}),
        ...(canRecordChange ? { canRecordChange } : {}),
      } as never),
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

  it('UD34: rewindHistory(null) откатывает все выполненные записи — позиция 0 — и возвращает false на первом отказе', async () => {
    let refuse = false
    render({
      answer: batch =>
        refuse && batch.cells.some(cell => cell.rowId === '2')
          ? Promise.reject(new Error('locked'))
          : undefined,
    })
    await write([{ rowId: '1', columnId: 'age', value: 91 }])
    await write([{ rowId: '2', columnId: 'age', value: 92 }])
    await write([{ rowId: '3', columnId: 'age', value: 93 }])
    const rewindAll = async () => {
      let ok: boolean | undefined
      await act(async () => {
        ok = await table.rewindHistory(null)
      })
      await flush()
      return ok
    }
    refuse = true
    expect(await rewindAll()).toBe(false)
    expect(table.getHistory().position).toBe(2)
    expect([ageOf('2'), ageOf('3')]).toEqual([92, 23])
    refuse = false
    expect(await rewindAll()).toBe(true)
    expect(table.getHistory().position).toBe(0)
    expect([ageOf('1'), ageOf('2'), ageOf('3')]).toEqual([21, 22, 23])
    expect(await rewindAll()).toBe(true)
  })

  it('LM5: шаг истории, после которого черновиков стало бы больше max, отказывает с причиной; запись остаётся на месте', async () => {
    render({ saveMode: 'manual', writeLimits: { max: 10 } })
    await write([
      { rowId: '1', columnId: 'age', value: 91 },
      { rowId: '2', columnId: 'age', value: 92 },
    ])
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    expect(ageOf('1')).toBe(91)
    // Предел опускают: отмена применённой правки дала бы два черновика при max 1.
    render({ saveMode: 'manual', writeLimits: { max: 1 } })
    expect(await undo()).toBe(false)
    expect(table.getHistory().position).toBe(1)
    expect(table.getHistory().entries).toHaveLength(1)
    expect(readServerAction(table).failed?.kind).toBe('write')
    expect(table.getDrafts()).toEqual([])
  })

  it('LM7: maxCells — сумма ячеек записей больше предела: уходят самые старые записи; запись больше предела остаётся одна', async () => {
    render({ maxCells: 3 })
    await write([
      { rowId: '1', columnId: 'age', value: 91 },
      { rowId: '2', columnId: 'age', value: 92 },
    ])
    await write([
      { rowId: '3', columnId: 'age', value: 93 },
      { rowId: '4', columnId: 'age', value: 94 },
    ])
    // Четыре ячейки при пределе три — первая запись ушла.
    expect(table.getHistory().entries).toHaveLength(1)
    expect(table.getHistory().entries[0].cells).toBe(2)
    await write(
      ['0', '1', '2', '3', '4'].map(rowId => ({
        rowId,
        columnId: 'age',
        value: 70,
      })),
    )
    expect(table.getHistory().entries).toHaveLength(1)
    expect(table.getHistory().entries[0].cells).toBe(5)
  })

  it('UD35: сбрасывание черновиков ячеек — одна запись истории на действие; отмена возвращает черновики с прежними значениями, повтор снова сбрасывает', async () => {
    render({ saveMode: 'manual' })
    await write([
      { rowId: '1', columnId: 'age', value: 91 },
      { rowId: '2', columnId: 'age', value: 92 },
      { rowId: '3', columnId: 'age', value: 93 },
    ])
    const cellDrafts = () =>
      (table.getDrafts() as Draft[]).filter(draft => draft.kind === 'cellValue')
    expect(cellDrafts()).toHaveLength(3)
    // «Сбросить всё» пульта — один проход по черновикам: одна запись.
    act(() => {
      for (const draft of cellDrafts()) discardDraft(table, draft)
    })
    await flush()
    const { entries } = table.getHistory()
    expect(entries).toHaveLength(2)
    expect(entries[1]).toMatchObject({ source: 'discard', cells: 3 })
    expect(cellDrafts()).toHaveLength(0)
    await undo()
    expect(
      cellDrafts().map(
        (draft: Draft) => (draft.value as { value: unknown }).value,
      ),
    ).toEqual([91, 92, 93])
    await redo()
    expect(cellDrafts()).toHaveLength(0)
    // Одна ячейка — запись на одну цель.
    await undo()
    act(() => discardDraft(table, cellDrafts()[0]!))
    await flush()
    expect(table.getHistory().entries.at(-1)).toMatchObject({
      source: 'discard',
      cells: 1,
    })
  })

  it('UD36: «Сбросить» новой или удалённой строки и «Сбросить» отказанной строки в журнале отказов — запись истории; отмена возвращает черновик строки, повтор снова откатывает', async () => {
    let refuseRows = false
    render({
      saveMode: 'manual',
      flat: true,
      answer: batch =>
        refuseRows
          ? {
              refused: (batch.inserts ?? []).map(item => ({
                rowId: item.rowId,
                reason: 'no',
              })),
            }
          : undefined,
    })
    const kinds = (rowId: string) =>
      (table.getDrafts() as Draft[])
        .filter(draft => 'row' in draft.target && draft.target.row === rowId)
        .map(draft => draft.kind)
    const rowDraftOf = (rowId: string) =>
      (table.getDrafts() as Draft[]).find(
        draft => 'row' in draft.target && draft.target.row === rowId,
      )!
    // Новая строка: откат убирает её, отмена отката возвращает.
    let id = ''
    act(() => {
      id = table.addRow({ name: 'New', age: 50 }, { index: 1 })
    })
    act(() => discardDraft(table, rowDraftOf(id)))
    await flush()
    expect(table.getHistory().entries.at(-1)).toMatchObject({
      source: 'discard',
    })
    expect(kinds(id)).toEqual([])
    await undo()
    expect(kinds(id)).toEqual(['rowInsert'])
    await redo()
    expect(kinds(id)).toEqual([])
    // Удалённая строка: откат возвращает её, отмена отката снова удаляет.
    act(() => table.removeRow('2'))
    act(() => discardDraft(table, rowDraftOf('2')))
    await flush()
    expect(kinds('2')).toEqual([])
    await undo()
    expect(kinds('2')).toEqual(['rowDelete'])
    await redo()
    expect(kinds('2')).toEqual([])
    // Журнал отказов: «Сбросить» отказанной новой строки — тоже запись.
    refuseRows = true
    act(() => {
      id = table.addRow({ name: 'Refused', age: 51 }, { index: 1 })
    })
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    const failure = Object.values(readFailures(table)).find(
      item => 'row' in item.target && item.target.row === id,
    )!
    expect(failure.discard).toBeDefined()
    const before = table.getHistory().entries.length
    act(() => failure.discard!())
    await flush()
    expect(kinds(id)).toEqual([])
    expect(table.getHistory().entries).toHaveLength(before + 1)
    expect(table.getHistory().entries.at(-1)).toMatchObject({
      source: 'discard',
    })
    await undo()
    expect(kinds(id)).toEqual(['rowInsert'])
  })

  it('AO13: «Сбросить правку» отклонённой ячейки из журнала отказов при подключённой истории правок — запись истории; отмена возвращает черновик', async () => {
    render({
      saveMode: 'manual',
      answer: batch => ({
        refused: batch.cells
          .filter(cell => cell.rowId === '1')
          .map(cell => ({ ...cell, reason: 'no' })),
      }),
    })
    await write([
      { rowId: '1', columnId: 'age', value: 91 },
      { rowId: '2', columnId: 'age', value: 92 },
    ])
    await act(async () => {
      commitAllDrafts(table)
    })
    await flush()
    const failure = Object.values(readFailures(table)).find(
      item => 'cell' in item.target && item.target.cell[0] === '1',
    )!
    const cellDraft = () =>
      (table.getDrafts() as Draft[]).find(
        draft => draft.kind === 'cellValue' && 'cell' in draft.target,
      )
    expect(cellDraft()).toBeDefined()
    const before = table.getHistory().entries.length
    act(() => failure.discard!())
    await flush()
    expect(cellDraft()).toBeUndefined()
    expect(table.getHistory().entries).toHaveLength(before + 1)
    expect(table.getHistory().entries.at(-1)).toMatchObject({
      source: 'discard',
      cells: 1,
    })
    await undo()
    expect((cellDraft()!.value as { value: unknown }).value).toBe(91)
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

  it('UD41: sources — пишутся только изменения перечисленных видов: ячеек, строк, сбрасывания и записи приложения; не записанное в попапе не видно и Ctrl+Z его не отменяет', async () => {
    render({ sources: ['paste'], saveMode: 'manual', flat: true })
    await write([{ rowId: '0', columnId: 'age', value: 70 }], 'paste')
    await write([{ rowId: '1', columnId: 'age', value: 71 }], 'api')
    let id: string | undefined = ''
    act(() => {
      table.addRow({ name: 'New', age: 50 }, { index: 1 })
      id = table.pushHistory({ label: 'Mine', undo: () => {}, redo: () => {} })
    })
    await flush()
    expect(id).toBeUndefined()
    expect(
      table
        .getHistory()
        .entries.map((entry: { source: string }) => entry.source),
    ).toEqual(['paste'])
    // Сбрасывание черновика — тоже вид: без 'discard' записи нет.
    const draft = (table.getDrafts() as Draft[]).find(
      item => 'cell' in item.target && item.target.cell[0] === '1',
    )!
    act(() => discardDraft(table, draft))
    await flush()
    expect(table.getHistory().entries).toHaveLength(1)
    expect(await undo()).toBe(true)
    expect(await undo()).toBe(false)
  })

  it('UD42: canRecordChange получает вид, ячейки, строки и перенос, у записи приложения — подпись; запись пишется, если вид в sources и предикат согласен; pushHistory не записанной возвращает undefined', async () => {
    const seen: any[] = []
    render({
      sources: ['paste', 'app'],
      canRecordChange: change => {
        seen.push(change)
        return change.source === 'app'
          ? change.label === 'Kept'
          : change.cells.every(
              (cell: { columnId: string }) => cell.columnId === 'age',
            )
      },
    })
    await write([{ rowId: '0', columnId: 'age', value: 70 }])
    await write([{ rowId: '1', columnId: 'name', value: 'Other' }])
    await write([{ rowId: '2', columnId: 'age', value: 72 }], 'api')
    let kept: string | undefined
    let dropped: string | undefined = ''
    act(() => {
      kept = table.pushHistory({
        label: 'Kept',
        undo: () => {},
        redo: () => {},
      })
      dropped = table.pushHistory({
        label: 'Dropped',
        undo: () => {},
        redo: () => {},
      })
    })
    expect(typeof kept).toBe('string')
    expect(dropped).toBeUndefined()
    expect(seen[0]).toMatchObject({
      source: 'paste',
      cells: [{ rowId: '0', columnId: 'age', before: 20, after: 70 }],
    })
    // Вид вне sources до предиката не доходит.
    expect(seen.map(change => change.source)).toEqual([
      'paste',
      'paste',
      'app',
      'app',
    ])
    expect(seen.find(change => change.source === 'app')).toMatchObject({
      label: 'Kept',
      cells: [],
    })
    expect(
      table
        .getHistory()
        .entries.map((entry: { source: string }) => entry.source),
    ).toEqual(['paste', 'app'])
  })

  it('UD43: смена sources и canRecordChange на лету действует на новые изменения, прежние записи остаются', async () => {
    render({ sources: ['paste'] })
    await write([{ rowId: '0', columnId: 'age', value: 70 }])
    render({ sources: ['api'] })
    await write([{ rowId: '1', columnId: 'age', value: 71 }])
    await write([{ rowId: '2', columnId: 'age', value: 72 }], 'api')
    expect(
      table
        .getHistory()
        .entries.map((entry: { source: string }) => entry.source),
    ).toEqual(['paste', 'api'])
    render({ canRecordChange: () => false })
    await write([{ rowId: '3', columnId: 'age', value: 73 }])
    expect(table.getHistory().entries).toHaveLength(2)
    render({})
    await write([{ rowId: '4', columnId: 'age', value: 74 }])
    expect(table.getHistory().entries).toHaveLength(3)
  })

  it("UD44: отмена записи, чьи ячейки с тех пор изменило не записанное в историю изменение, — конфликт: 'skip' пропускает ячейку и объявляет, 'overwrite' пишет поверх", async () => {
    render({ sources: ['paste'] })
    await write([
      { rowId: '0', columnId: 'age', value: 70 },
      { rowId: '1', columnId: 'age', value: 71 },
    ])
    await write([{ rowId: '0', columnId: 'age', value: 80 }], 'api')
    expect(table.getHistory().entries).toHaveLength(1)
    announce()
    await undo()
    expect(ageOf('0')).toBe(80)
    expect(ageOf('1')).toBe(21)
    expect(said()).toContain(own.announceConflicts(1))
    act(() => root!.unmount())
    root = undefined
    render({ sources: ['paste'], conflict: 'overwrite' })
    await write([{ rowId: '0', columnId: 'age', value: 70 }])
    await write([{ rowId: '0', columnId: 'age', value: 80 }], 'api')
    await undo()
    expect(ageOf('0')).toBe(20)
  })
})
