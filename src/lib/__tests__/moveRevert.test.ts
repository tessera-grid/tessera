/**
 * Откат переноса при отказе — выбор приложения (ADR 0114, §4): `revertOnReject` у
 * `rowDragging` и `columnDragging`, по умолчанию `true`, читается в момент отказа.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RowMoves } from '../core/rowMoves'
import { settleColumnMove } from '../plugins/columnDragging/commitColumnMove'
import { commitRowMove } from '../plugins/rowDragging/commitRowMove'

type Item = { id: string }

const atom = <T>(value: T) => ({
  get: () => value,
  set: (next: T) => {
    value = next
  },
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

/** Промис, который тест отклоняет сам. */
const rejectable = () => {
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((_, fail) => (reject = fail))
  return { promise, reject: () => reject(new Error('no')) }
}

const rowTable = (data: Item[], answers: Record<string, Item[]> = {}) => {
  const atoms = {
    rowMoves: atom<RowMoves>({}),
    rowMoveFailed: atom<Record<string, number>>({}),
    flashes: atom<Record<string, unknown>>({}),
    loadedChildren: atom<Record<string, readonly unknown[]>>(answers),
  }
  const table = {
    atoms,
    store: {},
    options: {
      rowDragRevertOnReject: true as boolean,
      data: data as readonly unknown[],
      onRowOrderChange: vi.fn((updater: (prev: any[]) => any[]) => {
        table.options.data = updater(table.options.data as any[])
      }),
    },
    getRowId: (item: Item) => item.id,
    setFlashes: (updater: (prev: Record<string, unknown>) => any) =>
      atoms.flashes.set(updater(atoms.flashes.get())),
    setRowMoves: (updater: (prev: RowMoves) => RowMoves) =>
      atoms.rowMoves.set(updater(atoms.rowMoves.get())),
    setRowMoveFailed: (updater: (prev: Record<string, number>) => any) =>
      atoms.rowMoveFailed.set(updater(atoms.rowMoveFailed.get())),
    setLoadedChildren: (
      rowId: string,
      updater: (prev: readonly unknown[]) => readonly unknown[],
    ) => {
      const prev = atoms.loadedChildren.get()
      if (rowId in prev) {
        atoms.loadedChildren.set({ ...prev, [rowId]: updater(prev[rowId]!) })
      }
    },
  }
  return table
}

const ids = (rows: readonly unknown[] | undefined) =>
  (rows as Item[] | undefined)?.map(row => row.id)

/** Обычный перенос корня `a` в конец: a, b, c → b, c, a. */
const moveRoot = (table: ReturnType<typeof rowTable>, result: Promise<void>) =>
  commitRowMove(
    table,
    {
      rowId: 'a',
      dragIndex: 0,
      hoverIndex: 2,
      index: 2,
      original: { id: 'a' },
      anchors: ['b', 'c'],
      fromAnchors: ['b', 'c'],
      fromIndex: 0,
      write: () =>
        table.options.onRowOrderChange(prev => [
          ...prev.filter(item => item.id !== 'a'),
          { id: 'a' },
        ]),
    },
    () => result,
  )

describe('Откат переноса при отказе (ADR 0114)', () => {
  it('CO15: revertOnReject: false — колонка и обычная строка остаются на новом месте, ленивый перенос записывается как при успехе; аргумент читается в момент отказа', async () => {
    // Обычная строка: опцию выключили после броска, до отказа — откат не пишется.
    const rows = rowTable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const kept = rejectable()
    moveRoot(rows, kept.promise)
    rows.options.rowDragRevertOnReject = false
    kept.reject()
    await flush()
    expect(rows.options.onRowOrderChange).toHaveBeenCalledTimes(1)
    expect(ids(rows.options.data)).toEqual(['b', 'c', 'a'])

    // С откатом — строка возвращается к прежним сёстрам.
    const reverted = rowTable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const back = rejectable()
    moveRoot(reverted, back.promise)
    back.reject()
    await flush()
    expect(ids(reverted.options.data)).toEqual(['a', 'b', 'c'])

    // Ленивый перенос корня `r` в группу `g` без отката — записан, как при успехе.
    const lazy = rowTable([{ id: 'g' }, { id: 'r' }], { g: [{ id: 'x' }] })
    lazy.options.rowDragRevertOnReject = false
    const lost = rejectable()
    commitRowMove(
      lazy,
      {
        rowId: 'r',
        dragIndex: 1,
        hoverIndex: 1,
        parentId: 'g',
        index: 0,
        lazy: {
          original: { id: 'r' },
          from: { parentId: undefined, index: 1, lazy: false },
          to: { parentId: 'g', index: 0, lazy: true, anchors: ['x'] },
        },
      },
      () => lost.promise,
    )
    lost.reject()
    await flush()
    expect(ids(lazy.options.data)).toEqual(['g'])
    expect(ids(lazy.atoms.loadedChildren.get().g)).toEqual(['r', 'x'])

    // Колонка без отката: порядок не трогается.
    const setColumnOrder = vi.fn()
    const columns = {
      store: {},
      options: { columnDragRevertOnReject: false },
      atoms: { columnMoves: atom({}) },
      setColumnOrder,
      setColumnMoves: (updater: (prev: object) => object) =>
        columns.atoms.columnMoves.set(updater(columns.atoms.columnMoves.get())),
      setColumnMoveFailed: vi.fn(),
    }
    const column = rejectable()
    settleColumnMove(
      columns,
      'a',
      { leaves: ['a'], before: 'b' },
      column.promise,
    )
    column.reject()
    await flush()
    expect(setColumnOrder).not.toHaveBeenCalled()
    expect(columns.setColumnMoveFailed).toHaveBeenCalledTimes(1)
  })
})
