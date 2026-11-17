// @vitest-environment happy-dom
/**
 * Итог массового применения (ADR 0227, этап 2 «Модель»): отказ запроса целиком, отказы ответа
 * одной записью в реестр, строки, которых на сервере нет, предел вспышек, объявление, канал
 * действий, серверная модель строк, `batch` отказов операции записи.
 * Запуск: npx vitest run --config vitest.node.config.ts applyOutcome
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import type { DebugAction } from '../core/debugActions'
import type { Draft } from '../core/drafts/drafts'
import type { Failure } from '../core/failures/failuresFeature'
import { readFlashes } from '../core/flashes/flashFeature'
import { tableNotice } from '../core/headerActions/actionStatus'
import { readActionStatus } from '../core/headerActions/actionStatusFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import { cellEditing, serverRowModel } from '../plugins'
import { cellValueDraftKind } from '../plugins/cellEditing/cellDrafts'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import {
  OUTCOME_FLASH_LIMIT,
  readApplyOutcome,
  readEditingState,
} from '../plugins/cellEditing/session'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; age: number }

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const rowsOf = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Name ${i}`,
    age: 20 + i,
  }))

type Answer = CellEditBatchResult | void | Promise<CellEditBatchResult | void>

interface HostProps {
  data?: Row[]
  columns?: typeof COLUMNS
  saveMode?: 'auto' | 'manual'
  onCommitEdits?: (batch: CellEditBatch) => Answer
  initialDrafts?: readonly Draft[]
  onFailure?: (failure: Failure) => void
  onDebugAction?: (action: DebugAction) => void
  /** Серверная модель строк: в кэше нет ни одной строки — блоки грузит окно тела. */
  server?: boolean
}

let table: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
})

const Host = ({
  data = rowsOf(6),
  columns = COLUMNS,
  saveMode = 'manual',
  onCommitEdits,
  initialDrafts,
  onFailure,
  onDebugAction,
  server = false,
}: HostProps) => {
  table = useCreateTable({
    columns: columns as never,
    data: server ? [] : data,
    getRowId: (row: Row) => row.id,
    ...(initialDrafts ? { initialDrafts } : {}),
    ...(onFailure ? { onFailure } : {}),
    ...(onDebugAction ? { onDebugAction } : {}),
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: 10,
              maxBlocks: 1,
              getRows: ({ start, end }: { start: number; end: number }) => ({
                rows: data.slice(start, end),
                rowCount: data.length,
              }),
            }),
          ]
        : []),
      cellEditing({ saveMode, onCommitEdits } as never),
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

const flush = () => act(async () => {})

const deferred = () => {
  let resolve!: (value: CellEditBatchResult | void) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<CellEditBatchResult | void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const ageDraft = (rowId: string, value: number): Draft => ({
  kind: 'cellValue',
  target: { cell: [rowId, 'age'] },
  value: { value, text: String(value) },
})

const cellDrafts = (): Draft[] =>
  table.getDrafts().filter((draft: Draft) => draft.kind === 'cellValue')

const applyAll = () =>
  act(() => void cellValueDraftKind.applyAll!(table, cellDrafts()))

const failures = (): Failure[] => table.getFailures()

const say = vi.fn()
const listen = () => {
  say.mockClear()
  registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
}
const own = cellEditingLabels(ENGLISH_LABELS)

describe('итог применения (ADR 0227)', () => {
  it('AO3: отклонённый промис onCommitEdits — одна запись реестра с целью-таблицей, действием cellEditing.commit, причиной и повтором без discard, итог применения с причиной и повтором; ячейки пакета остаются черновиками без ожидания и отметки отказа; повтор применяет тот же набор', async () => {
    let answer = deferred()
    const onCommitEdits = vi.fn((_batch: CellEditBatch) => answer.promise)
    render({
      onCommitEdits,
      initialDrafts: [ageDraft('1', 71), ageDraft('2', 72), ageDraft('3', 73)],
    })
    applyAll()
    answer.reject(new Error('Network down'))
    await flush()

    expect(failures()).toHaveLength(1)
    const [failure] = failures()
    expect(failure).toMatchObject({
      target: { table: true },
      action: { plugin: 'cellEditing', action: 'commit' },
      reason: 'Network down',
    })
    expect(failure!.retry).toBeTypeOf('function')
    expect(failure!.discard).toBeUndefined()
    // Ни одна ячейка не отклонена сама: ни ожидания, ни «ошибки», черновики на месте.
    expect(readEditingState(table).submitted).toEqual({})
    expect(cellDrafts()).toHaveLength(3)
    expect(readApplyOutcome(table)).toMatchObject({
      saved: 0,
      refused: 3,
      failed: { reason: 'Network down' },
    })

    // Повтор — тот же набор одним вызовом; запись отказа применения уходит.
    answer = deferred()
    act(() => readApplyOutcome(table)!.retry!())
    expect(onCommitEdits).toHaveBeenCalledTimes(2)
    expect(
      onCommitEdits.mock.calls[1]![0].cells.map(cell => [
        cell.rowId,
        cell.value,
      ]),
    ).toEqual([
      ['1', 71],
      ['2', 72],
      ['3', 73],
    ])
    expect(failures()).toEqual([])
    answer.resolve()
    await flush()
    expect(cellDrafts()).toEqual([])
  })

  it('AO5: отказы одного ответа пакета пишутся в срез отказов одной записью в хранилище; onFailure зовётся на каждый отказ; все отказы ответа несут один batch', async () => {
    const answer = deferred()
    const onFailure = vi.fn()
    render({
      onFailure,
      onCommitEdits: () => answer.promise,
      initialDrafts: [
        ageDraft('1', 71),
        ageDraft('2', 72),
        ageDraft('3', 73),
        ageDraft('4', 74),
      ],
    })
    applyAll()
    const writes = vi.spyOn(table, 'setFailures')
    answer.resolve({
      refused: ['1', '2', '3'].map(rowId => ({
        rowId,
        columnId: 'age',
        reason: 'Locked',
      })),
    })
    await flush()
    expect(writes).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledTimes(3)
    const batches = new Set(failures().map(failure => failure.batch))
    expect(failures()).toHaveLength(3)
    expect(batches.size).toBe(1)
    expect([...batches][0]).toMatch(/^apply-\d+$/)
    expect(readApplyOutcome(table)?.id).toBe([...batches][0])
  })

  it('AO14: вспышек итога применения — не больше OUTCOME_FLASH_LIMIT', () => {
    const count = OUTCOME_FLASH_LIMIT + 1
    render({
      data: rowsOf(count),
      onCommitEdits: () => {},
      initialDrafts: Array.from({ length: count }, (_, i) =>
        ageDraft(String(i), 1000 + i),
      ),
    })
    applyAll()
    expect(cellDrafts()).toEqual([])
    expect(Object.keys(readFlashes(table)).length).toBeLessThanOrEqual(
      OUTCOME_FLASH_LIMIT,
    )
    // В пределе — вспышка на каждой цели.
    render({
      data: rowsOf(count),
      onCommitEdits: () => {},
      initialDrafts: [ageDraft('1', 5), ageDraft('2', 6)],
    })
    act(() => table.setFlashes(() => ({})))
    act(() => {
      table.setDraft(ageDraft('1', 5))
      table.setDraft(ageDraft('2', 6))
    })
    applyAll()
    expect(Object.keys(readFlashes(table))).toHaveLength(2)
  })

  it('AO15: на одно применение — одно объявление скринридеру с текстом итога: всё сохранено, отказ части, отказ запроса целиком', async () => {
    let answer = deferred()
    render({
      onCommitEdits: () => answer.promise,
      initialDrafts: [ageDraft('1', 71), ageDraft('2', 72), ageDraft('3', 73)],
    })
    listen()
    // Отказ части: ячейка и новая строка — одно объявление на всё применение.
    let rowId = ''
    act(() => {
      rowId = table.addRow({ name: 'New', age: 1 }, { index: 0 })
    })
    act(() => void cellValueDraftKind.applyAll!(table, table.getDrafts()))
    answer.resolve({
      refused: [
        { rowId: '2', columnId: 'age', reason: 'Locked' },
        { rowId, reason: 'No room' },
      ],
    })
    await flush()
    expect(say.mock.calls.map(([text]) => String(text))).toEqual([
      own.applyPartly(2, 4),
    ])
    expect(own.applyPartly(2, 4)).toBe('Saved 2 of 4')

    // Отказ запроса целиком.
    say.mockClear()
    answer = deferred()
    act(() => void cellValueDraftKind.applyAll!(table, table.getDrafts()))
    answer.reject(new Error('Server error'))
    await flush()
    expect(say.mock.calls.map(([text]) => String(text))).toEqual([
      own.applyFailed('Server error'),
    ])

    // Всё сохранено.
    say.mockClear()
    answer = deferred()
    act(() => void cellValueDraftKind.applyAll!(table, table.getDrafts()))
    answer.resolve()
    await flush()
    expect(say.mock.calls.map(([text]) => String(text))).toEqual([
      own.applySaved(2),
    ])
  })

  it('AO23: применение, в котором сервер отказал всем правкам, говорит, что ничего не сохранено, и называет общее число правок', async () => {
    render({
      onCommitEdits: batch => ({
        refused: batch.cells.map(cell => ({ ...cell, reason: 'Locked' })),
      }),
      initialDrafts: [ageDraft('1', 71), ageDraft('2', 72), ageDraft('3', 73)],
    })
    listen()
    applyAll()
    await flush()
    const notice = tableNotice(readActionStatus(table))?.notice
    expect(notice?.title(ENGLISH_LABELS)).toBe(own.applyNone(3))
    expect(own.applyNone(3)).toBe('Nothing was saved: 0 of 3')
    // Ничего не сохранено — провал: вид плашки отказа, без тона.
    expect(notice?.tone).toBeUndefined()
    expect(say.mock.calls.map(([text]) => String(text))).toEqual([
      own.applyNone(3),
    ])
  })

  it('AO18: итог применения — действие applied канала действий с id, числами сохранённых и несохранённых и причиной отказа целиком', async () => {
    const onDebugAction = vi.fn()
    let answer = deferred()
    render({
      onDebugAction,
      onCommitEdits: () => answer.promise,
      initialDrafts: [ageDraft('1', 71), ageDraft('2', 72)],
    })
    const applied = () =>
      onDebugAction.mock.calls
        .map(([action]) => action as DebugAction)
        .filter(action => action.action === 'applied')
    applyAll()
    answer.resolve({
      refused: [{ rowId: '2', columnId: 'age', reason: 'Not found' }],
    })
    await flush()
    expect(applied()).toHaveLength(1)
    expect(applied()[0]).toMatchObject({
      plugin: 'cellEditing',
      source: 'auto',
      detail: {
        id: readApplyOutcome(table)!.id,
        saved: 1,
        refused: 1,
      },
    })
    answer = deferred()
    applyAll()
    answer.reject(new Error('Down'))
    await flush()
    expect(applied()).toHaveLength(2)
    expect(applied()[1]!.detail).toMatchObject({
      saved: 0,
      refused: 1,
      failed: 'Down',
    })
  })

  it('AO20: в серверной модели строк итог применения тот же: отказ строки, которой нет в кэше, приходит, держится после согласования и смены колонок и несёт batch', async () => {
    const answer = deferred()
    const data = rowsOf(30)
    render({
      server: true,
      data,
      onCommitEdits: () => answer.promise,
      initialDrafts: [ageDraft('25', 71), ageDraft('26', 72)],
    })
    expect(table.getRowSource().byId('25')).toBeUndefined()
    applyAll()
    // Перерисовка во время ожидания: согласование не снимает ячейки незагруженных строк.
    render({
      server: true,
      data,
      onCommitEdits: () => answer.promise,
    })
    answer.resolve({
      refused: [{ rowId: '25', columnId: 'age', reason: 'Locked' }],
    })
    await flush()
    expect(readApplyOutcome(table)).toMatchObject({ saved: 1, refused: 1 })
    // Новые колонки — проход по отказам ушедших строк: строки нет в кэше, отказ остаётся.
    render({
      server: true,
      data,
      columns: [...COLUMNS],
      onCommitEdits: () => answer.promise,
    })
    await flush()
    expect(failures()).toHaveLength(1)
    expect(failures()[0]).toMatchObject({
      target: { cell: ['25', 'age'] },
      reason: 'Locked',
      batch: readApplyOutcome(table)!.id,
    })
    expect(cellDrafts().map(draft => draft.target)).toEqual([
      { cell: ['25', 'age'] },
    ])
  })

  it('AO21: отказы ячеек операции записи несут batch операции — отказ ответа и нераспознанный текст; отказ пакета целиком — запись без discard, её закрытие снимает плашку', async () => {
    let answer = deferred()
    const onCommitEdits = vi.fn((_batch: CellEditBatch) => answer.promise)
    render({ saveMode: 'auto', onCommitEdits })
    const write = (changes: object[]) =>
      act(async () => {
        await table.writeCells(changes, { source: 'paste' })
      })
    await write([
      { rowId: '1', columnId: 'age', text: '71' },
      { rowId: '2', columnId: 'age', text: '72' },
      { rowId: '3', columnId: 'age', text: 'abc' },
    ])
    const id = onCommitEdits.mock.calls[0]![0].id
    answer.resolve({ refused: [{ rowId: '2', columnId: 'age', reason: 'No' }] })
    await flush()
    expect(
      failures().map(failure => [
        'cell' in failure.target ? failure.target.cell[0] : undefined,
        failure.batch,
      ]),
    ).toEqual([
      ['3', id],
      ['2', id],
    ])

    // Отказ пакета целиком: одна запись с целью-таблицей, без правки за ней.
    answer = deferred()
    await write([{ rowId: '4', columnId: 'age', text: '74' }])
    const next = onCommitEdits.mock.calls[1]![0].id
    answer.reject(new Error('Down'))
    await flush()
    const whole = failures().find(failure => 'table' in failure.target)!
    expect(whole).toMatchObject({ batch: next, reason: 'Down' })
    expect(whole.discard).toBeUndefined()
    const tableStatus = () =>
      Object.values(readActionStatus(table)).filter(
        entry => entry.failed && entry.table,
      )
    expect(tableStatus()).toHaveLength(1)
    act(() => table.resolveFailure(whole.key))
    expect(tableStatus()).toEqual([])
  })
})
