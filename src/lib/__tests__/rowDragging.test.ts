/**
 * Headless-проверка плагина rowDragging, включая гейты (многоуровневая шапка /
 * сортировка / группировка).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { rowGrouping } from '../plugins/rowGrouping'
import {
  COLUMN_DRAGGING_ID,
  DEFAULT_ROW_DRAG_OVERLAY_STATE,
  getRowDraggingEvents,
  rowDragging,
} from '../plugins/rowDragging'
import { createExpandTimer } from '../plugins/rowDragging/expandTimer'
import { commitRowMove } from '../plugins/rowDragging/commitRowMove'
import { rowHighlightKey } from '../core/highlights/highlightFeature'
import { __resetLogger } from '../util/logger'
import { captureInertWarnings } from './inertWarnings'
import { findDraggableRow, getSortableRowIds } from '../grid/DndBodyWrapper'
import { reorderRows } from '../plugins/rowDragging/reorderRows'
import { canNestRow } from '../plugins/rowDragging/moveRow'
import {
  getAllowedDepth,
  getMaxDepth,
  getMinDepth,
  getValidDepth,
} from '../plugins/rowDragging/draggingHelpers'
import { rowExpanding } from '../plugins/rowExpanding'
import { rowExpandingModel } from '../plugins/rowExpandingModel'

const build = (
  extraEntries: any[],
  dragOpts = {},
  userColumns: any[] = [
    { id: 'cat', accessorKey: 'cat' },
    { id: 'name', accessorKey: 'name' },
  ],
) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...extraEntries,
    rowDragging(dragOpts),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  const columns = injectServiceColumns(userColumns, folded.serviceColumns)
  const table = constructTable({
    features,
    data: [
      { id: '1', cat: 'a', name: 'X' },
      { id: '2', cat: 'a', name: 'Y' },
    ],
    columns,
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
  return { table, folded }
}

describe('rowDragging', () => {
  const warnings = captureInertWarnings()

  it('foldEntries: опция + сервисная колонка-ручка (order 0)', () => {
    const { folded } = build([])
    expect(folded.options).toMatchObject({ enableRowDragging: true })
    expect(folded.serviceColumns.map(c => c.id)).toContain(COLUMN_DRAGGING_ID)
  })

  it('колонка-ручка инъектирована первой', () => {
    const { table } = build([])
    expect(table.getAllLeafColumns()[0].id).toBe(COLUMN_DRAGGING_ID)
  })

  it('состояние: rowDragging по умолчанию, updater пишет в атом', () => {
    const { table } = build([])
    expect(table.atoms.rowDragging.get()).toMatchObject({
      activeId: null,
      acceptable: true,
    })

    table.options.onRowDraggingChange({
      activeId: '1',
      offsetLeft: 0,
      isExpanded: false,
      acceptable: true,
    })
    expect(table.atoms.rowDragging.get().activeId).toBe('1')
  })

  it('D39: нажатие на ручку без сдвига при состоянии по умолчанию не пишет в store таблицы', () => {
    vi.stubGlobal('document', { body: { style: {} } })
    try {
      const { table } = build([])
      const before = table.atoms.rowDragging.get()
      const notified = vi.fn()
      const subscription = table.store.subscribe(notified)

      getRowDraggingEvents(table).onRowDragAbort!({} as never)

      expect(notified).not.toHaveBeenCalled()
      expect(table.atoms.rowDragging.get()).toBe(before)
      subscription.unsubscribe()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('getCanDrag: плоская шапка → true; canDragRow запрещает строку → false', () => {
    expect(build([]).table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(
      build([], { canDragRow: () => false })
        .table.getRowModel()
        .rows[0].getCanDrag(),
    ).toBe(false)
  })

  it('PC4: активная группировка делает rowDragging инертным и предупреждает', () => {
    const { table } = build([rowGrouping()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(warnings()).toHaveLength(0)

    table.setGrouping(['cat'])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('rowGrouping')
  })

  it('PC6: активная сортировка делает rowDragging инертным и предупреждает', () => {
    const { table } = build([columnSorting()])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(true)
    expect(warnings()).toHaveLength(0)

    table.setSorting([{ id: 'name', desc: false }])
    expect(table.getRowModel().rows[0].getCanDrag()).toBe(false)
    table.getRowModel().rows[1].getCanDrag()
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('сортировк')
  })
})

describe('rowDragging — поиск перетаскиваемой строки', () => {
  it('D33: без активного перетаскивания тело не обходит строки в поисках перетаскиваемой', () => {
    let reads = 0
    const list = [{ id: 'a' }, { id: 'b' }]
    const rows = {
      byId: (id: string) => {
        reads++
        return list.find(row => row.id === id)
      },
    }
    expect(findDraggableRow(rows, null)).toBeUndefined()
    expect(reads).toBe(0)
    expect(findDraggableRow(rows, 'b')).toEqual({ id: 'b' })
  })
})

describe('rowDragging — id для SortableContext', () => {
  it('D34: items SortableContext тела — id строк окна виртуализатора в порядке индекса, а не все строки модели', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }))
    // Окно 10–14 и закреплённая перетаскиваемая строка 500 (rangeExtractor).
    const virtualRows = [10, 11, 12, 13, 14, 500].map(index => ({ index }))
    expect(getSortableRowIds(rows, virtualRows)).toEqual([
      'r10',
      'r11',
      'r12',
      'r13',
      'r14',
      'r500',
    ])
  })
})

describe('reorderRows — чистый обновитель (ADR 0091)', () => {
  const tree = () => [
    {
      id: 'a',
      subRows: [
        { id: 'a1', parentId: 'a', subRows: [] },
        { id: 'a2', parentId: 'a', subRows: [] },
        { id: 'a3', parentId: 'a', subRows: [] },
      ],
    },
    { id: 'b', subRows: [{ id: 'b1', parentId: 'b', subRows: [] }] },
    { id: 'c', subRows: [] },
  ]
  const target = (id: string, index: number, parentId?: string) =>
    ({
      id,
      index,
      parentId,
      getIsLastSubRow: () => false,
      getParentRow: () => undefined,
    }) as never

  it('EV10: перенос подстроки и строки не меняет prev, повторный вызов даёт тот же результат', () => {
    const moves = [
      // В своей группе: a1 за a2.
      {
        activeParentId: 'a',
        overParentId: 'a',
        activeOriginalIndex: 0,
        overOriginalIndex: 1,
        targetItem: target('a2', 1, 'a'),
        isDownMove: true,
        currentDepth: 1,
      },
      // Из группы a в группу b.
      {
        activeParentId: 'a',
        overParentId: 'b',
        activeOriginalIndex: 1,
        overOriginalIndex: 0,
        targetItem: target('b1', 0, 'b'),
        isDownMove: true,
        currentDepth: 1,
      },
      // Из корня в группу b.
      {
        overParentId: 'b',
        activeOriginalIndex: 2,
        overOriginalIndex: 0,
        targetItem: target('b1', 0, 'b'),
        isDownMove: false,
        currentDepth: 1,
      },
    ]
    for (const move of moves) {
      const prev = tree()
      const snapshot = structuredClone(prev)
      const first = reorderRows(prev, move)
      const second = reorderRows(prev, move)
      expect(prev, JSON.stringify(move)).toEqual(snapshot)
      expect(second).toEqual(first)
    }
    const within = reorderRows(tree(), moves[0]!)
    expect(within[0].subRows.map((row: { id: string }) => row.id)).toEqual([
      'a2',
      'a1',
      'a3',
    ])
  })
})

describe('rowDragging — пауза над свёрнутой группой (ADR 0109)', () => {
  it('NX4: expandDelay — живой аргумент: смена на лету меняет паузу, 0 выключает раскрытие паузой', () => {
    expect(
      foldEntries([rowDragging({ expandDelay: 300 })] as never).options,
    ).toMatchObject({ rowDragExpandDelay: 300 })

    vi.useFakeTimers()
    try {
      const expanded = new Set<string>()
      const row = (id: string, index: number, extra = {}) => ({
        id,
        index,
        depth: 0,
        subRows: [] as unknown[],
        getCanExpand: () => false,
        getIsExpanded: () => expanded.has(id),
        getIsLastSubRow: () => false,
        getParentRow: () => undefined,
        ...extra,
      })
      const active = row('r', 0)
      const group = row('g', 1, {
        subRows: [{}],
        getCanExpand: () => true,
        setExpandedByUser: (open: boolean) =>
          open ? expanded.add('g') : expanded.delete('g'),
      })
      let state = { ...DEFAULT_ROW_DRAG_OVERLAY_STATE, activeId: 'r' }
      const options: { rowDragExpandDelay?: number } = {}
      const table = {
        options,
        getRowModel: () => ({
          rows: [active, group],
          rowsById: { r: active, g: group },
        }),
        // Шаг уровня для смещения облака: без служебных колонок — 16 px.
        getVisibleLeafColumns: () => [],
        // Переключатель rowExpanding есть: группу раскрывает пауза (ADR 0109, §5).
        getKeyboardActions: () => [{ expands: true }],
        atoms: { rowDragging: { get: () => state } },
        setRowDragging: (updater: (prev: typeof state) => typeof state) => {
          state = updater(state)
        },
      }
      const timer = createExpandTimer()
      // Слот под группой `g` на уровне её детей; обработчики — как после перерисовки.
      const hold = () =>
        getRowDraggingEvents(table as never, {
          levelAt: () => 1,
          expandTimer: timer,
        }).onRowDragMove!({
          active: {
            id: 'r',
            data: { current: { virtualIndex: 0, row: active } },
          },
          over: { id: 'g', data: { current: { virtualIndex: 1, row: group } } },
          delta: { x: 0, y: 0 },
        } as never)
      const reset = () => {
        timer.clear()
        expanded.clear()
        state = { ...state, openedByDelay: [] }
      }

      // По умолчанию — 500 мс.
      hold()
      vi.advanceTimersByTime(499)
      expect(expanded.has('g')).toBe(false)
      vi.advanceTimersByTime(1)
      expect(expanded.has('g')).toBe(true)
      expect(state.openedByDelay).toEqual(['g'])

      reset()
      options.rowDragExpandDelay = 0
      hold()
      vi.advanceTimersByTime(5000)
      expect(expanded.has('g'), 'expandDelay: 0').toBe(false)

      reset()
      options.rowDragExpandDelay = 800
      hold()
      vi.advanceTimersByTime(799)
      expect(expanded.has('g')).toBe(false)
      vi.advanceTimersByTime(1)
      expect(expanded.has('g'), 'expandDelay: 800').toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rowDragging — вспышка перестановки (ADR 0110, ADR 0134)', () => {
  it('LD5: перестановка пишет вспышку arrived строки в срез вспышек ядра; повторная перестановка перезапускает время; срез highlights не меняется', () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    })
    try {
      const { table } = build([])
      const highlights = table.atoms.highlights?.get()
      const flash = () => table.atoms.flashes.get()[rowHighlightKey('1')]
      const move = () =>
        commitRowMove(
          table,
          { rowId: '1', dragIndex: 0, hoverIndex: 1, index: 1 },
          undefined,
        )
      // Без смонтированного грида удержание и угасание — запасные 300 и 500 мс.
      move()
      expect(flash()?.outcome).toBe('arrived')
      vi.advanceTimersByTime(200)
      move()
      vi.advanceTimersByTime(200)
      expect(flash()?.out, 'время перезапущено').toBeUndefined()
      vi.advanceTimersByTime(100)
      expect(flash()?.out).toBe(true)
      vi.advanceTimersByTime(500)
      expect(flash()).toBeUndefined()
      expect(table.atoms.highlights?.get()).toBe(highlights)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rowDragging — дерево без переключателя (ADR 0109, §5)', () => {
  it('NX12: без rowExpanding вложить строку в свёрнутую предыдущую группу нельзя, в раскрытую — можно; с rowExpanding — можно и в свёрнутую', () => {
    const tree = (...expanding: any[]) => {
      const entries = [
        {
          id: 'reactivity',
          features: { coreReactivityFeature: storeReactivityBindings() },
        },
        ...expanding,
        rowDragging(),
      ]
      const folded = foldEntries(entries)
      return constructTable({
        features: buildTesseraFeatures(entries as never),
        data: [
          { id: 'g', name: 'G', subRows: [{ id: 'g-0', name: 'G0' }] },
          { id: 'r', name: 'R' },
        ],
        columns: injectServiceColumns(
          [{ id: 'name', accessorKey: 'name' }],
          folded.serviceColumns,
        ),
        getRowId: (row: any) => row.id,
        getSubRows: (row: any) => row.subRows,
        ...folded.options,
        keyboardActions: folded.keyboardActions,
      } as never) as any
    }
    const canNest = (table: any) => canNestRow(table.getRow('r'), table)

    const model = tree(rowExpandingModel())
    expect(canNest(model), 'свёрнутая, только модель').toBe(false)
    model.getRow('g').toggleExpanded(true)
    expect(canNest(model), 'раскрытая, только модель').toBe(true)

    const off = tree(rowExpandingModel(), rowExpanding({ enabled: false }))
    expect(canNest(off), 'свёрнутая, rowExpanding выключен').toBe(false)

    expect(canNest(tree(rowExpanding())), 'свёрнутая, rowExpanding').toBe(true)
  })
})

describe('rowDragging — допустимые уровни места (ADR 0137)', () => {
  type Node = { id: string; children?: Node[]; expanded?: boolean }
  type FakeRow = {
    id: string
    index: number
    depth: number
    parentId?: string
    subRows: FakeRow[]
    getCanExpand: () => boolean
    getIsExpanded: () => boolean
    getIsLastSubRow: () => boolean
    getParentRow: () => FakeRow | undefined
  }

  /** Показанные строки дерева; перетаскиваемая группа на время сессии свёрнута. */
  const flatten = (nodes: Node[], collapsed: string) => {
    const out: FakeRow[] = []
    const walk = (list: Node[], parent: FakeRow | undefined, depth: number) =>
      list.forEach((node, index) => {
        const open = !!node.expanded && node.id !== collapsed
        const row: FakeRow = {
          id: node.id,
          index,
          depth,
          parentId: parent?.id,
          subRows: [],
          getCanExpand: () => !!node.children?.length,
          getIsExpanded: () => open,
          getIsLastSubRow: () => !!parent && index === list.length - 1,
          getParentRow: () => parent,
        }
        out.push(row)
        if (node.children) {
          // Дети свёрнутой группы — в `subRows`, но не среди показанных строк.
          const at = out.length
          walk(node.children, row, depth + 1)
          row.subRows = out.slice(at).filter(sub => sub.parentId === row.id)
          if (!open) out.length = at
        }
      })
    walk(nodes, undefined, 0)
    return out
  }

  const TREE: Node[] = [
    { id: 'a' },
    {
      id: 'g1',
      expanded: true,
      children: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    },
    {
      id: 'g2',
      expanded: true,
      children: [{ id: 'd1', expanded: true, children: [{ id: 'd1x' }] }],
    },
    { id: 'b' },
    { id: 'g3', children: [{ id: 'e1' }] },
  ]

  /** Слот строки `activeId` над индексом `over` при уровне указателя `level`. */
  const hold = (activeId: string, over: number, level: number) => {
    const rows = flatten(TREE, activeId)
    const from = rows.findIndex(row => row.id === activeId)
    let state = { ...DEFAULT_ROW_DRAG_OVERLAY_STATE, activeId }
    const table = {
      options: { rowDragExpandDelay: 0 },
      getRowModel: () => ({
        rows,
        rowsById: Object.fromEntries(rows.map(row => [row.id, row])),
      }),
      getVisibleLeafColumns: () => [],
      getKeyboardActions: () => [{ expands: true }],
      atoms: { rowDragging: { get: () => state } },
      setRowDragging: (updater: (prev: typeof state) => typeof state) => {
        state = updater(state)
      },
    }
    getRowDraggingEvents(table as never, {
      levelAt: () => level,
    }).onRowDragMove!({
      active: {
        id: activeId,
        data: { current: { virtualIndex: from, row: rows[from] } },
      },
      over: {
        id: rows[over]!.id,
        data: { current: { virtualIndex: over, row: rows[over] } },
      },
      delta: { x: 0, y: 0 },
    } as never)
    return { rows, from, state }
  }

  it('DI7: допустимые уровни места — в пределах места, у строки с детьми только 0; выбор — ближайший к уровню указателя, при равенстве меньший; паритет с прежней проверкой места на каждом уровне каждого места', () => {
    expect(getAllowedDepth(1, 0, 2, depth => depth !== 1)).toBe(0)
    expect(getAllowedDepth(2, 0, 2, depth => depth === 0)).toBe(0)
    expect(getAllowedDepth(1, 1, 1, depth => depth === 0)).toBeUndefined()

    const ids = flatten(TREE, '').map(row => row.id)
    let invalid = 0
    let clamped = 0
    for (const activeId of ids) {
      const { rows, from } = hold(activeId, 0, 0)
      for (let over = 0; over < rows.length; over++) {
        const active = rows[from]!
        const target = from < over ? rows[over] : rows[over - 1]
        const min = getMinDepth(
          active as never,
          target as never,
          rows[over]!.id,
        )
        const max = getMaxDepth(target as never, {
          getKeyboardActions: () => [{ expands: true }],
        })
        // Прежняя проверка места: строка с детьми — только на уровне 0.
        const before = (depth: number) => !active.getCanExpand() || depth === 0
        for (let level = -1; level <= 3; level++) {
          const valid = getValidDepth(level, min, max)
          const range: number[] = []
          for (let d = Math.min(min, valid); d <= Math.max(max, valid); d++)
            range.push(d)
          const nearest = range
            .filter(before)
            .sort(
              (x, y) => Math.abs(x - valid) - Math.abs(y - valid) || x - y,
            )[0]
          const { state } = hold(activeId, over, level)
          const label = `${activeId} над ${rows[over]!.id}, уровень ${level}`
          if (before(valid)) {
            expect(state, label).toMatchObject({
              depth: valid,
              acceptable: true,
            })
          } else if (nearest === undefined) {
            invalid++
            expect(state, label).toMatchObject({
              depth: valid,
              acceptable: false,
            })
          } else {
            clamped++
            expect(state, label).toMatchObject({
              depth: nearest,
              acceptable: true,
            })
          }
        }
      }
    }
    // Оба случая запрета встречаются на дереве.
    expect(invalid).toBeGreaterThan(0)
    expect(clamped).toBeGreaterThan(0)
  })
})
