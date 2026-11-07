// @vitest-environment happy-dom
/**
 * Транзакции строк серверной модели на таблице (ADR 0157; RT1–RT7, RT10–RT11, RT13–RT14) и
 * выбор строки SSRM из пустого выбора (ADR 0138, SD50).
 * Запуск: npx vitest run --config vitest.node.config.ts serverTransactions
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import type { DebugAction } from '../core/debugActions'
import { ENGLISH_LABELS, resolveLabels } from '../core/localization'
import type { RowSource } from '../core/rowSource'
import {
  countSelectionIn,
  rowSelectionValueOf,
  setRowSelectionValue,
} from '../core/rowSelectionAll'
import { useCreateTable } from '../core/useCreateTable'
import {
  rowExpanding,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { toggleRowSelection } from '../plugins/rowSelection/keyboardActions'
import { captureInertWarnings } from './inertWarnings'
import { serverRowModelLabels } from '../plugins/serverRowModel/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const BLOCK = 10
const TOTAL = 1000
const NO_DATA: Item[] = []
/** Транзакции применяются задачей после кадра; запасной таймер — 100 мс. */
const AFTER_FRAME_MS = 150

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const Grid = ({
  loader = true,
  enabled = true,
  onDebugAction,
  extra = [],
}: {
  loader?: boolean
  enabled?: boolean
  onDebugAction?: (report: DebugAction) => void
  extra?: readonly unknown[]
}) => {
  table = useCreateTable({
    rowCount: TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    onDebugAction: onDebugAction as never,
    plugins: [
      serverRowModel({
        enabled,
        getRows: loader ? getRows : undefined,
        blockSize: BLOCK,
        maxBlocks: 10,
      }),
      ...extra,
    ] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<{ id: string }>
const idAt = (index: number) => source().at(index)?.id

const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

/** Ответить строками диапазона: `r<номер>`, у детей — `<родитель>.<номер>`. */
const answer = async (call = calls.at(-1)!, count?: number) => {
  const { start, end, parentId } = call.request
  const last = count === undefined ? end : Math.min(end, count)
  const prefix = parentId ? `${parentId}.` : 'r'
  await act(async () => {
    call.resolve({
      rows: Array.from({ length: Math.max(0, last - start) }, (_, i) => ({
        id: `${prefix}${start + i}`,
        name: `N${start + i}`,
      })),
      ...(count === undefined ? {} : { rowCount: count }),
    })
  })
}

/** Окно `[0, 19]` из двух загруженных блоков, на экране — первый. */
const loadTwoBlocks = async () => {
  show(0, 19)
  await answer(calls[0])
  await answer(calls[1])
  show(0, 9)
}

const item = (id: string): Item => ({ id, name: id })

/** Дождаться задачи после кадра, которой применяются транзакции. */
const flush = () =>
  act(() => new Promise(resolve => setTimeout(resolve, AFTER_FRAME_MS)))

const transact = (transaction: object) =>
  act(() => table.applyRowTransaction(transaction))

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('транзакции строк серверной модели (ADR 0157)', () => {
  const warnings = captureInertWarnings()

  it('RT1: add с index — строки на месте списка, итог растёт, индексы ниже сдвинуты, getRows не зовётся, пока в окне нет незагруженных строк', async () => {
    act(() => root.render(<Grid />))
    await loadTwoBlocks()
    const requested = calls.length
    let result: unknown
    act(() => {
      result = table.applyRowTransaction({
        add: [item('n1'), item('n2')],
        index: 3,
      })
    })
    expect(result).toBe('applied')
    await flush()
    expect([idAt(2), idAt(3), idAt(4), idAt(5)]).toEqual([
      'r2',
      'n1',
      'n2',
      'r3',
    ])
    expect(source().count()).toBe(TOTAL + 2)
    expect(source().indexOf('r9')).toBe(11)
    expect(source().at(11)?.id).toBe('r9')
    expect(calls.length).toBe(requested)
  })

  it("RT2: add без index — тихий перезапрос окна, строки на экране до ответа, итог из ответа, итог транзакции 'refetch'", async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer()
    const shown = source().at(0)
    const requested = calls.length
    let result: unknown
    act(() => {
      result = table.applyRowTransaction({ add: [item('n1')] })
    })
    expect(result).toBe('refetch')
    expect(calls.length).toBe(requested + 1)
    expect(source().refreshing!()).toBe(true)
    expect(source().at(0)).toBe(shown)
    await answer(calls.at(-1)!, TOTAL + 1)
    expect(source().refreshing!()).toBe(false)
    expect(source().count()).toBe(TOTAL + 1)
  })

  it('RT3: remove — загруженные строки уходят, итог уменьшается; незагруженные id без rowCount игнорируются, с rowCount итог задан им; запроса нет', async () => {
    act(() => root.render(<Grid />))
    await loadTwoBlocks()
    const requested = calls.length
    transact({ remove: ['r2', 'r500'] })
    await flush()
    expect([idAt(1), idAt(2)]).toEqual(['r1', 'r3'])
    expect(source().indexOf('r2')).toBe(-1)
    expect(source().count()).toBe(TOTAL - 1)

    transact({ remove: ['r600'], rowCount: 990 })
    await flush()
    expect(source().count()).toBe(990)
    expect(idAt(2)).toBe('r3')
    expect(calls.length).toBe(requested)
  })

  it('RT4: update — загруженные строки по id меняются, прочие объекты строк прежние; незагруженные игнорируются', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer()
    const neighbour = source().at(1)
    transact({
      update: [
        { id: 'r2', name: 'changed' },
        { id: 'r500', name: 'far' },
      ],
    })
    const original = (index: number) =>
      (source().at(index) as unknown as { original: Item }).original
    expect(original(2).name).toBe('changed')
    expect(source().at(1)).toBe(neighbour)
    expect(source().indexOf('r500')).toBe(-1)
    expect(source().count()).toBe(TOTAL)
  })

  it('RT5: запросы с места изменения отменяются и в кэш не попадают, новые — по сдвинутым смещениям; неполный блок не запрашивается, пока окно не дойдёт до пропуска', async () => {
    act(() => root.render(<Grid />))
    show(0, 19)
    await answer(calls[0])
    const stale = calls[1]!
    expect(stale.request.start).toBe(10)
    transact({ add: [item('n1')], index: 2 })
    await flush()
    expect(stale.request.signal.aborted).toBe(true)
    // Окну нужны строки 11–19: блок 10 запрошен заново.
    const fresh = calls.at(-1)!
    expect(fresh).not.toBe(stale)
    expect(fresh.request.start).toBe(10)
    await answer(stale)
    expect(idAt(12)).toBeUndefined()
    expect(idAt(10)).toBe('r9')

    // Неполный блок с известными строками окна — без запроса до пропуска.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    calls = []
    act(() => root.render(<Grid />))
    await loadTwoBlocks()
    show(0, 18)
    const requested = calls.length
    transact({ remove: ['r1'] })
    await flush()
    expect(calls.length).toBe(requested)
    show(0, 19)
    expect(calls.length).toBe(requested + 1)
    expect(calls.at(-1)!.request.start).toBe(10)
  })

  describe('ветки (RT6)', () => {
    const expand = async (expanded: Record<string, boolean>) => {
      act(() => table.setExpanded(expanded))
      source().count()
      await act(async () => {})
    }

    it("RT6: parentId — изменение в загруженной ветке; ветка не загружена — 'branchNotLoaded', кэш не меняется", async () => {
      act(() =>
        root.render(
          <Grid
            extra={[rowExpanding({ hasChildren: row => row.depth === 0 })]}
          />,
        ),
      )
      show(0, 9)
      await answer()
      let result: unknown
      act(() => {
        result = table.applyRowTransaction({
          add: [item('c-new')],
          index: 0,
          parentId: 'r1',
        })
      })
      expect(result).toBe('branchNotLoaded')
      await flush()
      expect(source().count()).toBe(TOTAL)
      expect(source().indexOf('c-new')).toBe(-1)

      await expand({ r1: true })
      await answer(
        calls.find(call => call.request.parentId === 'r1'),
        3,
      )
      expect([idAt(2), idAt(3), idAt(4), idAt(5)]).toEqual([
        'r1.0',
        'r1.1',
        'r1.2',
        'r2',
      ])
      act(() => {
        result = table.applyRowTransaction({
          add: [item('c-new')],
          index: 1,
          parentId: 'r1',
        })
      })
      expect(result).toBe('applied')
      await flush()
      expect([idAt(2), idAt(3), idAt(4)]).toEqual(['r1.0', 'c-new', 'r1.1'])
      expect((source().at(3) as unknown as { depth: number }).depth).toBe(1)
      expect(source().count()).toBe(TOTAL + 4)
    })
  })

  it('RT7: удалённые id выпадают из выбранных и из исключений { all, except }, счётчик пересчитан', async () => {
    act(() => root.render(<Grid extra={[rowSelection()]} />))
    await loadTwoBlocks()
    act(() => setRowSelectionValue(table, { r1: true, r2: true }))
    transact({ remove: ['r1'] })
    await flush()
    expect(rowSelectionValueOf(table)).toEqual({ r2: true })

    act(() => setRowSelectionValue(table, { all: true, except: ['r3', 'r4'] }))
    const counted = () =>
      countSelectionIn(rowSelectionValueOf(table) as never, () =>
        source().count(),
      )
    expect(counted()).toBe(TOTAL - 1 - 2)
    transact({ remove: ['r3'] })
    await flush()
    expect(rowSelectionValueOf(table)).toEqual({ all: true, except: ['r4'] })
    expect(counted()).toBe(TOTAL - 2 - 1)
  })

  it('RT10: объявление «Добавлено / удалено N строк» — ключи словаря localization', async () => {
    act(() => root.render(<Grid />))
    await loadTwoBlocks()
    const say = vi.fn()
    registerAnnouncer(table, {
      say,
      labels: resolveLabels(
        {
          'serverRowModel.announceRowsAdded': count => `+${count}`,
          'serverRowModel.announceRowsRemoved': count => `-${count}`,
        },
        'en-US',
      ),
    })
    transact({ add: [item('n1'), item('n2')], index: 0 })
    await flush()
    expect(say).toHaveBeenLastCalledWith('+2')
    transact({ remove: ['r3'] })
    await flush()
    expect(say).toHaveBeenLastCalledWith('-1')
    expect(serverRowModelLabels(ENGLISH_LABELS).announceRowsAdded(1)).toBe(
      'Added 1 row',
    )
    expect(serverRowModelLabels(ENGLISH_LABELS).announceRowsRemoved(3)).toBe(
      'Removed 3 rows',
    )
  })

  it('RT11: транзакции одного кадра применяются вместе одной задачей после кадра — до неё список прежний, после одно объявление', async () => {
    act(() => root.render(<Grid />))
    await loadTwoBlocks()
    const say = vi.fn()
    registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
    act(() => {
      table.applyRowTransaction({ add: [item('n1')], index: 1 })
      table.applyRowTransaction({ add: [item('n2')], index: 1 })
      table.applyRowTransaction({ remove: ['r5'] })
    })
    expect(idAt(1)).toBe('r1')
    expect(source().count()).toBe(TOTAL)
    await flush()
    expect([idAt(1), idAt(2), idAt(3)]).toEqual(['n2', 'n1', 'r1'])
    expect(source().indexOf('r5')).toBe(-1)
    expect(source().count()).toBe(TOTAL + 1)
    expect(say).toHaveBeenCalledTimes(1)
    expect(say).toHaveBeenCalledWith('Added 2 rows. Removed 1 row')
  })

  it("RT13: плагин подключён, но выключен или без getRows — транзакция клиентская: без onDataChange ничего не меняет, итог 'unavailable', dev-предупреждение", () => {
    for (const props of [{ loader: false }, { enabled: false }]) {
      act(() => root.render(<Grid {...props} />))
      let result: unknown = 'not called'
      act(() => {
        result = table.applyRowTransaction({ add: [item('n1')], index: 0 })
      })
      expect(result).toBe('unavailable')
      expect(source().count()).toBe(0)
    }
    expect(
      warnings().filter(text => text.includes('applyRowTransaction')).length,
    ).toBeGreaterThan(0)
  })

  it('RT14: транзакция — действие канала rowTransaction с числами строк add, update, remove и источником api', async () => {
    const reports: DebugAction[] = []
    act(() =>
      root.render(<Grid onDebugAction={report => reports.push(report)} />),
    )
    show(0, 9)
    await answer()
    transact({
      add: [item('n1'), item('n2')],
      index: 0,
      update: [{ id: 'r1', name: 'x' }],
      remove: ['r3', 'r4', 'r5'],
    })
    expect(
      reports.find(report => report.action === 'rowTransaction'),
    ).toMatchObject({
      plugin: 'serverRowModel',
      source: 'api',
      detail: { add: 2, update: 1, remove: 3 },
    })
  })
})

describe('выбор строки SSRM (ADR 0138)', () => {
  it('SD50: флажок и Space выбирают строку SSRM и при пустом выборе — переключение идёт через срез выбора', async () => {
    act(() => root.render(<Grid extra={[rowSelection()]} />))
    show(0, 9)
    await answer()
    const row = source().at(1) as never
    act(() => toggleRowSelection(row, {}, undefined))
    expect(rowSelectionValueOf(table)).toEqual({ r1: true })
    act(() => toggleRowSelection(source().at(1) as never, {}, undefined))
    expect(rowSelectionValueOf(table)).toEqual({})
  })
})
