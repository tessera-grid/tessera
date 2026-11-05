/**
 * Перенос строк в ленивом дереве (ADR 0112): итог переноса без ответа цели, запрет без
 * `onRowDragEnd`, плагины без импорта друг друга.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type { RowMoves } from '../shared/rowMoves'
import {
  DEFAULT_ROW_DRAG_OVERLAY_STATE,
  getRowDraggingEvents,
  rowDragging,
} from '../plugins/rowDragging'
import { commitRowMove } from '../plugins/rowDragging/commitRowMove'
import { dropPlace } from '../plugins/rowDragging/dropPlace'
import { reconcileRowMoves } from '../plugins/rowDragging/reconcileRowMoves'
import {
  canDragRow,
  canMoveInLazyTree,
} from '../plugins/rowDragging/rowDraggingFeature'
import { hostTable } from './tableHost'
import { __resetLogger } from '../util/logger'
import { captureInertWarnings } from './inertWarnings'

type Item = { id: string }

const atom = <T>(value: T) => ({
  get: () => value,
  set: (next: T) => {
    value = next
  },
})

/** Таблица с теми срезами, что читают итог переноса и согласование. */
const lazyTable = (data: Item[], answers: Record<string, Item[]>) => {
  const atoms = {
    rowMoves: atom<RowMoves>({}),
    rowMoveFailed: atom<Record<string, number>>({}),
    flashes: atom<Record<string, unknown>>({}),
    loadedChildren: atom<Record<string, readonly unknown[]>>(answers),
    rowExpandPending: atom<Record<string, number>>({}),
  }
  const table = {
    atoms,
    store: {},
    options: {
      data: data as readonly unknown[],
      onRowOrderChange: vi.fn((updater: (prev: any[]) => any[]) => {
        table.options.data = updater(table.options.data as any[])
      }),
    },
    getRowId: (item: Item) => item.id,
    getHooks: () => ({}),
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
    getCoreRowModel: () => ({
      rowsById: Object.fromEntries(
        ['g', 'r', 'a', 'b'].map(id => [id, { id }]),
      ),
    }),
  }
  return table
}

const ids = (rows: readonly unknown[] | undefined) =>
  (rows as Item[] | undefined)?.map(row => row.id)

describe('Перенос в ленивом дереве (ADR 0112)', () => {
  it('LT4: бросок до прихода детей сообщает index 0; без ответа к успеху перенос ждёт его и встаёт в ответ первым, если его там нет; отказ загрузки снимает перенос', async () => {
    // Слот сразу под свёрнутой группой на уровне её детей.
    const rows = [
      { id: 'g', index: 0, depth: 0 },
      { id: 'r', index: 1, depth: 0 },
    ]
    const place = dropPlace(rows, rows[1]!, { from: 1, to: 1, depth: 1 })
    expect(place.parent?.id).toBe('g')
    expect(place.index).toBe(0)

    const run = async (arrived: Item[] | undefined) => {
      const g = { id: 'g' }
      const r = { id: 'r' }
      const table = lazyTable([g, r], {})
      // Группа грузит детей.
      table.atoms.rowExpandPending.set({ g: 1 })
      const onRowDragEnd = vi.fn(() => Promise.resolve())
      commitRowMove(
        table,
        {
          rowId: 'r',
          dragIndex: 1,
          hoverIndex: 1,
          parentId: 'g',
          index: place.index,
          lazy: {
            original: r,
            from: { parentId: undefined, index: 1, lazy: false },
            to: { parentId: 'g', index: 0, lazy: true },
          },
        },
        onRowDragEnd,
      )
      expect(onRowDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'g', index: 0 }),
      )
      await Promise.resolve()
      await Promise.resolve()
      // Корень записан, ответа цели нет — перенос ждёт.
      expect(ids(table.options.data)).toEqual(['g'])
      expect(table.atoms.rowMoves.get().r?.pending).toBe(false)
      reconcileRowMoves(table)
      expect(table.atoms.rowMoves.get().r, 'загрузка идёт').toBeDefined()
      // Ответ пришёл — или загрузка упала: ожидание снято, ответа нет.
      if (arrived) table.atoms.loadedChildren.set({ g: arrived })
      table.atoms.rowExpandPending.set({})
      reconcileRowMoves(table)
      return table
    }

    const fresh = await run([{ id: 'a' }, { id: 'b' }])
    expect(ids(fresh.atoms.loadedChildren.get().g)).toEqual(['r', 'a', 'b'])
    expect(fresh.atoms.rowMoves.get()).toEqual({})

    const already = await run([{ id: 'a' }, { id: 'r' }])
    expect(ids(already.atoms.loadedChildren.get().g)).toEqual(['a', 'r'])
    expect(already.atoms.rowMoves.get()).toEqual({})

    const failed = await run(undefined)
    expect(failed.atoms.loadedChildren.get()).toEqual({})
    expect(failed.atoms.rowMoves.get()).toEqual({})
  })

  describe('без onRowDragEnd', () => {
    const warnings = captureInertWarnings()
    const lazyWarnings = () =>
      warnings().filter(text => text.includes('onRowDragEnd'))

    const row = (id: string, index: number, extra = {}) => ({
      id,
      index,
      depth: 0,
      subRows: [] as unknown[],
      getCanExpand: () => false,
      getIsExpanded: () => false,
      getIsLastSubRow: () => false,
      getParentRow: (): unknown => undefined,
      getIsLazyParent: () => false,
      ...extra,
    })
    type FakeRow = ReturnType<typeof row>

    /** Сессия перетаскивания строки `active` над строками `rows` с хуками `hooks`. */
    const lazyDrag = (rows: FakeRow[], active: FakeRow) => {
      let state = { ...DEFAULT_ROW_DRAG_OVERLAY_STATE, activeId: active.id }
      const table = {
        options: {
          enableRowDragging: true,
          rowDragExpandDelay: 0,
          rowDragReportsMoves: false,
        },
        getHeaderGroups: () => [],
        // Переключатель rowExpanding есть: свёрнутая ленивая группа принимает детей (ADR 0109, §5).
        getKeyboardActions: () => [{ expands: true }],
        getHooks: () => ({}),
        getRowModel: () => ({
          rows,
          rowsById: Object.fromEntries(rows.map(r => [r.id, r])),
        }),
        getVisibleLeafColumns: () => [],
        atoms: { rowDragging: { get: () => state } },
        setRowDragging: (updater: (prev: typeof state) => typeof state) => {
          state = updater(state)
        },
      }
      const from = rows.indexOf(active)
      const hold = (over: number, level: number) => {
        getRowDraggingEvents(table as never, {
          levelAt: () => level,
        }).onRowDragMove!({
          active: {
            id: active.id,
            data: { current: { virtualIndex: from, row: active } },
          },
          over: {
            id: rows[over]!.id,
            data: { current: { virtualIndex: over, row: rows[over] } },
          },
          delta: { x: 0, y: 0 },
        } as never)
        return state
      }
      return {
        table,
        hold,
        reportMoves: () => {
          table.options.rowDragReportsMoves = true
        },
      }
    }

    /** Свёрнутая ленивая группа и строка под ней: слот на уровне её детей или корня. */
    const underLazyGroup = () => {
      const group = row('g', 0, {
        getCanExpand: () => true,
        getIsLazyParent: () => true,
      })
      const active = row('r', 1)
      return lazyDrag([group, active], active)
    }

    it('LT9: без onRowDragEnd уровень в ленивую группу недопустим и ленивые дети не тянутся; в dev — предупреждение rowDragging:lazyTree', () => {
      const { table, hold, reportMoves } = underLazyGroup()
      const child = (parent: object) => ({
        table,
        getParentRow: () => parent,
      })
      expect(hold(1, 1), 'без колбэка').toMatchObject({ depth: 0 })
      expect(lazyWarnings(), 'бросок').toHaveLength(1)

      // Предупреждение печатается один раз — сброс, чтобы увидеть его от ручки.
      __resetLogger()
      const lazyParent = { getIsLazyParent: () => true }
      const dataParent = { getIsLazyParent: () => false }
      expect(canDragRow(child(lazyParent) as never), 'ленивый ребёнок').toBe(
        false,
      )
      expect(lazyWarnings(), 'ручка').toHaveLength(2)
      expect(canDragRow(child(dataParent) as never), 'ребёнок данных').toBe(
        true,
      )

      // Настоящая таблица: хуки в ней дополнены пустым колбэком, он не считается заданным.
      const columns = [{ id: 'name', accessorKey: 'name' }]
      expect(
        canMoveInLazyTree(hostTable({ columns, plugins: [rowDragging()] })),
        'таблица без колбэка',
      ).toBe(false)
      expect(
        canMoveInLazyTree(
          hostTable({
            columns,
            plugins: [rowDragging({ onRowDragEnd: () => {} })],
          }),
        ),
        'таблица с колбэком',
      ).toBe(true)

      reportMoves()
      expect(canDragRow(child(lazyParent) as never), 'с колбэком').toBe(true)
      expect(hold(1, 1), 'с колбэком').toMatchObject({
        depth: 1,
        acceptable: true,
      })
    })

    it('DI8: ленивое дерево без onRowDragEnd — уровень в ленивую группу недопустим, слот уходит на допустимый уровень, если он есть, иначе место недопустимо; предупреждение — когда уровень указателя запрещён ленивым родителем, и тогда, когда слот ушёл на другой уровень', () => {
      // Есть уровень корня: слот уходит на него, предупреждение — всё равно.
      const under = underLazyGroup()
      expect(under.hold(1, 1)).toMatchObject({ depth: 0, acceptable: true })
      expect(lazyWarnings(), 'слот ушёл на корень').toHaveLength(1)
      // Уровень указателя — корень: ленивый родитель не задет, нового предупреждения нет.
      __resetLogger()
      expect(under.hold(1, 0)).toMatchObject({ depth: 0, acceptable: true })
      expect(lazyWarnings(), 'уровень корня').toHaveLength(1)

      // Между детьми раскрытой ленивой группы уровень места — только 1.
      __resetLogger()
      const group = row('g', 0, {
        getCanExpand: () => true,
        getIsExpanded: () => true,
        getIsLazyParent: () => true,
      })
      const first = row('c1', 0, { depth: 1, getParentRow: () => group })
      const second = row('c2', 1, { depth: 1, getParentRow: () => group })
      group.subRows = [first, second]
      const active = row('r', 1)
      const inside = lazyDrag([group, first, second, active], active)
      expect(inside.hold(2, 0)).toMatchObject({ depth: 1, acceptable: false })
      expect(lazyWarnings(), 'место недопустимо').toHaveLength(2)
      inside.reportMoves()
      expect(inside.hold(2, 0), 'с колбэком').toMatchObject({
        depth: 1,
        acceptable: true,
      })
    })
  })

  it('LT11: rowDragging распознаёт ленивого родителя и пишет ответы без импорта rowExpanding — модули плагина его не тянут', () => {
    const root = resolve(__dirname, '..')
    const seen = new Set<string>()
    const resolveImport = (from: string, spec: string) => {
      const base = resolve(dirname(from), spec)
      return [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
        base,
      ].find(path => existsSync(path) && /\.tsx?$/.test(path))
    }
    const walk = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      for (const [, spec] of source.matchAll(
        /(?:from|import)\s+'(\.{1,2}\/[^']+)'/g,
      )) {
        const next = resolveImport(file, spec!)
        if (next) walk(next)
      }
    }
    walk(join(root, 'plugins/rowDragging/index.ts'))
    const reached = [...seen].map(file =>
      relative(root, file).replaceAll('\\', '/'),
    )
    expect(reached).toContain('shared/rowMoves.ts')
    expect(
      reached.filter(file => file.startsWith('plugins/rowExpanding/')),
    ).toEqual([])
  })
})
