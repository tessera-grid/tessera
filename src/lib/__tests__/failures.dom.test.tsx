// @vitest-environment happy-dom
/**
 * Реестр отказов (ADR 0177, OB11, OB14, OB15): запись нерешённого отказа, её снятие и
 * повтор у `trackCellAction`.
 * Запуск: npx vitest run --config vitest.node.config.ts failures
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import {
  cellFailureKey,
  type Failure,
  readFailures,
} from '../core/failures/failuresFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  columnFilteringModel,
  columnSortingModel,
  paginationModel,
} from '../plugins'
import { startEditSession } from '../plugins/cellEditing/session'
import { cellEditingLabels } from '../plugins/cellEditing/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string }

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Row[] = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
  { id: '3', name: 'C' },
]

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
  plugins: TesseraFeatureEntry[]
  data?: Row[]
  onFailure?: (failure: Failure) => void
}

// Ячейка правки — содержимое слота `cellEditing` строки `editRow`, иначе редактора нет в DOM.
let editRow = '1'

const Host = ({ plugins, data = ROWS, onFailure }: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    plugins,
    ...(onFailure ? { onFailure } : {}),
  } as never)
  const row = captured.getRowSource().byId(editRow)
  if (!row) return null
  const cell = row.getAllCells()[0]
  const slot = captured
    .getRenderSlots()
    .cellSlot.find((entry: { id: string }) => entry.id === 'cellEditing')
  return slot
    ? createElement(slot.component, { ...cell.getContext(), content: '' })
    : null
}

let lastProps: HostProps | undefined

const render = (props: HostProps) => {
  lastProps = props
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const flush = () => act(async () => {})

/** Открыть правку ячейки строки `rowId` и сохранить `value` через Enter. */
const editAndCommit = (rowId: string, value: string) => {
  editRow = rowId
  // Приложение не перерисовывается от срезов таблицы (ADR 0196): ячейку другой строки
  // показывает новая отрисовка хоста.
  render(lastProps!)
  act(() =>
    startEditSession(captured, captured.getRowSource().byId(rowId), {
      id: 'name',
    }),
  )
  const input = container!.querySelector('input')!
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
  })
}

const failureOf = (rowId: string) =>
  readFailures(captured)[cellFailureKey(rowId, 'name')]

describe('Реестр отказов (ADR 0177)', () => {
  it('OB11: отметку отказа снимают успешное сохранение ячейки, «Сбросить», изменение значения извне и удаление строки; не снимают время, прокрутка, сортировка, страница, фильтр и уход строки из окна', async () => {
    const answers: ReturnType<typeof deferred>[] = []
    const onEditCancel = vi.fn()
    const plugins = [
      cellEditing({
        canEditCell: () => true,
        onCellEdit: () => {
          const answer = deferred()
          answers.push(answer)
          return answer.promise
        },
        onEditCancel,
      }),
      columnSortingModel(),
      columnFilteringModel(),
      paginationModel({ initialPageSize: 2 }),
    ]
    const refuse = async (rowId: string, value: string) => {
      editAndCommit(rowId, value)
      await act(async () => answers.at(-1)!.reject(new Error('Server down')))
      await flush()
      expect(failureOf(rowId)?.reason).toBe('Server down')
    }
    render({ plugins })

    // Время, сортировка, страница и фильтр — строка уходит из списка и из DOM, отказ живёт.
    await refuse('1', 'X')
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    act(() => captured.setSorting([{ id: 'name', desc: true }]))
    render({ plugins })
    expect(captured.getRowModel().rows.map((row: Row) => row.id)).toEqual([
      '3',
      '2',
    ])
    act(() => captured.setPageIndex(1))
    render({ plugins })
    act(() => captured.setPageIndex(0))
    act(() =>
      captured.setColumnFilters([
        { id: 'name', value: { operator: 'contains', value: 'B' } },
      ]),
    )
    render({ plugins })
    expect(captured.getRowModel().rows.map((row: Row) => row.id)).toEqual(['2'])
    act(() => captured.setColumnFilters([]))
    act(() => captured.setSorting([]))
    // Новая ссылка данных с прежними значениями — не изменение значения.
    render({ plugins, data: ROWS.map(row => ({ ...row })) })
    expect(failureOf('1')).toBeDefined()

    // Успешное сохранение.
    editAndCommit('1', 'Y')
    await act(async () => answers.at(-1)!.resolve())
    await flush()
    expect(failureOf('1')).toBeUndefined()

    // «Сбросить».
    await refuse('1', 'Z')
    act(() => failureOf('1')!.discard!())
    expect(failureOf('1')).toBeUndefined()
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowId: '1', reason: 'cancel', draft: 'Z' }),
    )

    // Изменение значения извне: отклонённый черновик — в onEditCancel с `conflict`.
    await refuse('2', 'Q')
    render({
      plugins,
      data: ROWS.map(row => (row.id === '2' ? { ...row, name: 'B2' } : row)),
    })
    await flush()
    expect(failureOf('2')).toBeUndefined()
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowId: '2', reason: 'conflict', draft: 'Q' }),
    )

    // Удаление строки.
    await refuse('3', 'W')
    render({ plugins, data: ROWS.filter(row => row.id !== '3') })
    await flush()
    expect(failureOf('3')).toBeUndefined()

    // Отказ из trackCellAction без cellEditing — те же правила снятия.
    act(
      () =>
        void captured
          .trackCellAction(
            { cell: ['1', 'name'] },
            Promise.reject(new Error('No')),
          )
          .catch(() => {}),
    )
    await flush()
    expect(failureOf('1')?.reason).toBe('No')
    render({ plugins, data: ROWS.map(row => ({ ...row })) })
    expect(failureOf('1')).toBeDefined()
    render({
      plugins,
      data: ROWS.map(row => (row.id === '1' ? { ...row, name: 'A2' } : row)),
    })
    await flush()
    expect(failureOf('1')).toBeUndefined()
  })

  it('OB14: реестр отказов в ядре — запись с подписью действия, целью, причиной, временем, повтором и закрытием; встроенные плагины и trackCellAction пишут в него; table.getFailures() и колбэк onFailure', async () => {
    const onFailure = vi.fn()
    const plugins = [
      cellEditing({
        canEditCell: () => true,
        onCellEdit: () => Promise.reject(new Error('Server down')),
      }),
    ]
    render({ plugins, onFailure })
    expect(captured.getFailures()).toEqual([])

    // Встроенный плагин.
    const before = Date.now()
    editAndCommit('1', 'X')
    await flush()
    const saved = captured.getFailures()[0] as Failure
    expect(saved).toEqual(
      expect.objectContaining({
        key: cellFailureKey('1', 'name'),
        // Имя — действие справочника, а не колонка: колонку называет цель (ADR 0182).
        action: { plugin: 'cellEditing', action: 'edit' },
        target: { cell: ['1', 'name'] },
        reason: 'Server down',
        retry: expect.any(Function),
        discard: expect.any(Function),
      }),
    )
    expect(saved.label).toBeUndefined()
    expect(captured.getActionLabel(saved.action!)).toBe(
      cellEditingLabels(ENGLISH_LABELS).cellDraftKind,
    )
    expect(saved.time).toBeGreaterThanOrEqual(before)
    expect(onFailure).toHaveBeenLastCalledWith(saved)

    // trackCellAction.
    await act(async () => {
      await captured
        .trackCellAction({ row: '2' }, Promise.reject(new Error('Locked')), {
          label: 'Archive',
        })
        .catch(() => {})
    })
    const failures = captured.getFailures() as Failure[]
    expect(failures.map(failure => failure.target)).toEqual([
      { cell: ['1', 'name'] },
      { row: '2' },
    ])
    expect(failures[1]).toEqual(
      expect.objectContaining({ label: 'Archive', reason: 'Locked' }),
    )
    expect(onFailure).toHaveBeenCalledTimes(2)

    // API приложения: запись, замена записи той же цели, закрытие.
    let key = ''
    act(() => {
      key = captured.reportFailure({
        label: 'Sync',
        target: { process: 'sync' },
        reason: 'Offline',
      })
    })
    act(() =>
      captured.reportFailure({
        label: 'Sync',
        target: { process: 'sync' },
        reason: 'Timeout',
      }),
    )
    expect(
      (captured.getFailures() as Failure[]).filter(f => f.key === key),
    ).toEqual([expect.objectContaining({ reason: 'Timeout' })])
    act(() => captured.resolveFailure(key))
    act(() => captured.resolveFailure(cellFailureKey('1', 'name')))
    expect(
      (captured.getFailures() as Failure[]).map(failure => failure.target),
    ).toEqual([{ row: '2' }])
  })

  it('OB15: trackCellAction(target, promise, { retry }) — функция повтора; с ней в записи отказа есть «Повторить», без неё — нет', async () => {
    render({ plugins: [] })
    const retry = vi.fn(() =>
      captured.trackCellAction({ cell: ['1', 'name'] }, Promise.resolve()),
    )
    await act(async () => {
      await captured
        .trackCellAction(
          { cell: ['1', 'name'] },
          Promise.reject(new Error('Down')),
          { retry },
        )
        .catch(() => {})
      await captured
        .trackCellAction(
          { cell: ['2', 'name'] },
          Promise.reject(new Error('Down')),
        )
        .catch(() => {})
    })
    expect(failureOf('1')?.retry).toBe(retry)
    expect(failureOf('2')).toBeDefined()
    expect(failureOf('2')!.retry).toBeUndefined()

    // Повтор из записи: успех снимает отказ.
    await act(async () => {
      await failureOf('1')!.retry!()
    })
    expect(retry).toHaveBeenCalledTimes(1)
    expect(failureOf('1')).toBeUndefined()
  })
})
