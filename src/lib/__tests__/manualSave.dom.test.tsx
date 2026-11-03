// @vitest-environment happy-dom
/**
 * Сохранение правок по кнопке (ADR 0178, §5; DR14, DR17, DR19, DR24, DR25): черновик ячейки
 * вместо `onCellEdit`, пакет `onCommitEdits`, жизнь черновика по id строки, порядок
 * «Применить всё» и черновики в полёте.
 * Запуск: npx vitest run --config vitest.node.config.ts manualSave
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyAllDrafts, type Draft } from '../core/drafts/drafts'
import { cellFailureKey, readFailures } from '../core/failures/failuresFeature'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  columnFiltering,
  columnSortingModel,
  paginationModel,
  serverRowModel,
} from '../plugins'
import { cellValueDraftKind } from '../plugins/cellEditing/cellDrafts'
import {
  readEditingState,
  saveEdit,
  startEditSession,
} from '../plugins/cellEditing/session'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; age: number }

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const ROWS: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

let captured: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
})

interface HostProps {
  data?: Row[]
  saveMode?: 'auto' | 'manual'
  onCellEdit?: () => unknown
  onCommitEdits?: (
    batch: CellEditBatch,
  ) => CellEditBatchResult | void | Promise<CellEditBatchResult | void>
  onDraftsChange?: (next: readonly Draft[]) => void
}

const Host = ({
  data = ROWS,
  saveMode = 'manual',
  onCellEdit = () => {},
  onCommitEdits,
  onDraftsChange,
}: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    ...(onDraftsChange ? { onDraftsChange } : {}),
    plugins: [
      cellEditing({ saveMode, onCellEdit, onCommitEdits } as never),
      columnSortingModel(),
      paginationModel({ initialPageSize: 10 } as never),
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

/** Открыть правку возраста строки и сохранить текст, как Enter. */
const edit = (rowId: string, text: string) => {
  act(() =>
    startEditSession(captured, captured.getRowSource().byId(rowId), {
      id: 'age',
    }),
  )
  act(() =>
    saveEdit(
      captured,
      { rowId, columnId: 'age' },
      { text },
      captured.getHooks().cellEditing,
    ),
  )
}

const cellDrafts = (): Draft[] =>
  captured.getDrafts().filter((draft: Draft) => draft.kind === 'cellValue')
const draftAt = (rowId: string) =>
  cellDrafts().find(
    draft => 'cell' in draft.target && draft.target.cell[0] === rowId,
  )
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

describe('сохранение по кнопке (ADR 0178)', () => {
  it("DR14: cellEditing({ saveMode: 'manual' }) — законченная правка становится черновиком вида cellValue, onCellEdit не вызывается; аргумент живой", () => {
    const onCellEdit = vi.fn()
    render({ onCellEdit })
    edit('1', '77')
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(readEditingState(captured).active).toBeNull()
    expect(draftAt('1')).toEqual({
      kind: 'cellValue',
      target: { cell: ['1', 'age'] },
      value: { value: 77, text: '77' },
    })

    // Правка того же значения, что в данных, снимает черновик.
    edit('1', '21')
    expect(draftAt('1')).toBeUndefined()

    // Аргумент живой: в 'auto' правка снова уходит в onCellEdit.
    render({ onCellEdit, saveMode: 'auto' })
    edit('2', '5')
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(draftAt('2')).toBeUndefined()
  })

  it('DR17: «Применить» и «Применить всё» вызывают onCommitEdits(edits, { signal }) одним вызовом; пока промис не решён — ожидание на ячейках пакета; успех снимает черновики и пишет сохранённые строки; отказ части пакета — отказ на ячейке, её черновик остаётся', async () => {
    const answer = deferred()
    const onCommitEdits = vi.fn(() => answer.promise)
    render({ onCommitEdits })
    edit('1', '77')
    edit('2', '5')
    edit('3', '40')
    expect(cellDrafts()).toHaveLength(3)

    // Запись сохранённого в кэш строк — как у серверной модели (ADR 0139).
    const setRowData = vi.fn()
    captured.setRowData = setRowData
    act(() => void cellValueDraftKind.applyAll!(captured, cellDrafts()))
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const [batch, context] = onCommitEdits.mock.calls[0] as unknown as [
      CellEditBatch,
      { signal: AbortSignal },
    ]
    expect(
      batch.cells.map(cell => [cell.rowId, cell.value, cell.original]),
    ).toEqual([
      ['1', 77, 21],
      ['2', 5, 22],
      ['3', 40, 23],
    ])
    expect(context.signal).toBeInstanceOf(AbortSignal)
    // Ожидание на ячейках пакета.
    expect(
      Object.values(readEditingState(captured).submitted).map(
        entry => entry.status,
      ),
    ).toEqual(['pending', 'pending', 'pending'])

    // Сервер отказал строке 2: у неё отказ и черновик, остальные сохранены.
    answer.resolve({
      refused: [{ rowId: '2', columnId: 'age', reason: 'Locked' }],
    })
    await flush()
    expect(cellDrafts().map(draft => draft.target)).toEqual([
      { cell: ['2', 'age'] },
    ])
    expect(readFailures(captured)[cellFailureKey('2', 'age')]?.reason).toBe(
      'Locked',
    )
    expect(setRowData.mock.calls.map(([rowId]) => rowId)).toEqual(['1', '3'])
    expect(setRowData.mock.calls[0]![1]({ id: '1', age: 21 })).toEqual({
      id: '1',
      age: 77,
    })
    expect(readEditingState(captured).submitted).toEqual({
      [Object.keys(readEditingState(captured).submitted)[0]!]:
        expect.objectContaining({ rowId: '2', status: 'error' }),
    })

    // «Применить» одной записи — тот же пакетный колбэк; ответ без отказов снимает черновик.
    onCommitEdits.mockImplementation(() => Promise.resolve())
    act(() => void cellValueDraftKind.apply(captured, draftAt('2')!))
    expect(onCommitEdits).toHaveBeenCalledTimes(2)
    await flush()
    expect(cellDrafts()).toEqual([])
    expect(readFailures(captured)[cellFailureKey('2', 'age')]).toBeUndefined()
  })

  it('DR19: черновики ячеек живут по id строки — переживают виртуализацию, страницу, сортировку, вытеснение блока серверной модели; строка ушла из данных — её черновики снимаются с onDraftsChange', () => {
    const onDraftsChange = vi.fn()
    render({ onDraftsChange })
    edit('1', '77')
    edit('25', '9')
    expect(cellDrafts()).toHaveLength(2)

    // Страница и сортировка: строки вне текущей страницы и порядка — черновики на месте.
    act(() => captured.setPageIndex(2))
    act(() => captured.setSorting([{ id: 'age', desc: true }]))
    render({ onDraftsChange, data: [...ROWS] })
    expect(cellDrafts()).toHaveLength(2)

    // Строка 25 ушла из данных — её черновик снят, приложение узнало об этом.
    onDraftsChange.mockClear()
    render({ onDraftsChange, data: ROWS.filter(row => row.id !== '25') })
    expect(cellDrafts().map(draft => draft.target)).toEqual([
      { cell: ['1', 'age'] },
    ])
    expect(onDraftsChange).toHaveBeenLastCalledWith([draftAt('1')])
    act(() => root!.unmount())
    root = undefined

    // Серверная модель: строки нет в кэше (блок не загружен или вытеснен) — черновик живёт.
    const ServerHost = () => {
      captured = useCreateTable({
        columns: columns as never,
        data: [],
        plugins: [
          serverRowModel({
            blockSize: 10,
            maxBlocks: 1,
            getRows: ({ start, end }: { start: number; end: number }) => ({
              rows: ROWS.slice(start, end),
              rowCount: ROWS.length,
            }),
          }),
          cellEditing({ saveMode: 'manual' } as never),
        ],
      } as never)
      return null
    }
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root!.render(createElement(ServerHost)))
    act(() =>
      captured.setDraft({
        kind: 'cellValue',
        target: { cell: ['25', 'age'] },
        value: { value: 9, text: '9' },
      }),
    )
    act(() => root!.render(createElement(ServerHost)))
    expect(captured.getRowSource().byId('25')).toBeUndefined()
    expect(cellDrafts()).toHaveLength(1)
  })

  it('DR24: «Применить всё» — сначала один пакет onCommitEdits со всеми черновиками данных, затем одно серверное действие со всеми условиями фильтров, не дожидаясь ответа на пакет', () => {
    const calls: string[] = []
    const commit = deferred()
    const onCommitEdits = vi.fn(() => {
      calls.push('commit')
      return commit.promise
    })
    const onFilterChange = vi.fn(() => {
      calls.push('filter')
      return new Promise(() => {})
    })
    const FilterHost = () => {
      captured = useCreateTable({
        columns: columns as never,
        data: ROWS,
        getRowId: (row: Row) => row.id,
        dataMode: { filtering: 'server' },
        plugins: [
          // Вид фильтра — раньше вида ячеек: порядок задаёт «Применить всё», а не набор.
          columnFiltering({ onFilterChange }),
          cellEditing({ saveMode: 'manual', onCommitEdits } as never),
        ],
      } as never)
      return null
    }
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root!.render(createElement(FilterHost)))
    edit('1', '77')
    edit('2', '5')
    act(() => {
      captured.setDraft({
        kind: 'columnFilter',
        target: { column: 'name' },
        value: { operator: 'contains', value: 'Name 1' },
      })
      captured.setDraft({
        kind: 'columnFilter',
        target: { column: 'age' },
        value: { operator: 'equals', value: 21 },
      })
    })

    act(() => applyAllDrafts(captured))
    // Пакет и фильтры — без ожидания ответа на пакет: промис пакета ещё не решён.
    expect(calls).toEqual(['commit', 'filter'])
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    expect(
      (onCommitEdits.mock.calls[0] as unknown as [CellEditBatch])[0].cells.map(
        cell => cell.rowId,
      ),
    ).toEqual(['1', '2'])
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(
      (onFilterChange.mock.calls[0] as unknown as [{ id: string }[]])[0].map(
        filter => filter.id,
      ),
    ).toEqual(['name', 'age'])
  })

  it('DR25: черновик в пакете без ответа повторно не отправляется; ответ снимает черновик, только если значение не менялось после отправки', async () => {
    const answer = deferred()
    const later = deferred()
    const onCommitEdits = vi
      .fn()
      .mockImplementationOnce(() => answer.promise)
      .mockImplementationOnce(() => later.promise)
    render({ onCommitEdits })
    edit('1', '77')
    edit('2', '5')
    act(() => void cellValueDraftKind.applyAll!(captured, cellDrafts()))
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    // Повторное «Применить всё», пока пакет ждёт: тех же черновиков нет в новом пакете.
    act(() => void cellValueDraftKind.applyAll!(captured, cellDrafts()))
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    // Ячейка в ожидании не правится, но черновик ей задало приложение — значение сменилось
    // после отправки.
    act(() =>
      captured.setDraft({
        kind: 'cellValue',
        target: { cell: ['1', 'age'] },
        value: { value: 80, text: '80' },
      }),
    )

    // Ответ на пакет: черновик ячейки 2 снят, сменившийся черновик ячейки 1 — на месте.
    answer.resolve()
    await flush()
    expect(cellDrafts()).toEqual([
      {
        kind: 'cellValue',
        target: { cell: ['1', 'age'] },
        value: { value: 80, text: '80' },
      },
    ])

    // Он — новый черновик: следующее «Применить» отправляет его.
    act(() => void cellValueDraftKind.applyAll!(captured, cellDrafts()))
    expect(onCommitEdits).toHaveBeenCalledTimes(2)
    expect(
      (onCommitEdits.mock.calls[1] as unknown as [CellEditBatch])[0].cells.map(
        cell => [cell.rowId, cell.value],
      ),
    ).toEqual([['1', 80]])
  })
})
