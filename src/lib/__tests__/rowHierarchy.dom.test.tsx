// @vitest-environment happy-dom
/**
 * Иерархия строк — точка расширения ядра (ADR 0168, §4); её читает навигация (ADR 0170, §2).
 * Запуск: npx vitest run --config vitest.node.config.ts rowHierarchy
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { definePlugin, pluginStateKey } from '../core/definePlugin'
import {
  isTreeGrid,
  resolveActive,
  ROW_FOCUS_COLUMN,
} from '../core/keyboardNavigation/model'
import { neverInert } from '../core/pluginDiagnostics'
import { hasRowHierarchy } from '../core/rowHierarchy'
import { useCreateTable } from '../core/useCreateTable'
import {
  rowDragging,
  rowExpanding,
  rowExpandingModel,
  rowGroupingModel,
  serverRowModel,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const Host = ({ plugins }: { plugins: unknown[] }) => {
  captured = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name' }] as never,
    data: [{ id: '1', name: 'A' }],
    plugins: plugins as never,
  })
  return null
}

// Набор фич фиксируется при монтировании: каждый набор — своя таблица.
const mount = (plugins: unknown[]) => {
  act(() => root?.unmount())
  root = createRoot(document.createElement('div'))
  act(() => root!.render(<Host plugins={plugins} />))
}

const facts = () => ({
  tree: hasRowHierarchy(captured, 'tree'),
  groups: hasRowHierarchy(captured, 'groups'),
})

describe('иерархия строк (ADR 0168)', () => {
  it('DM6: иерархию объявляют модели дерева и группировки, выключенная модель — нет; rowDragging показывает «вложить» и «вынести» по ней и не читает enableExpanding', () => {
    mount([rowDragging({ onRowDragEnd: () => {} })])
    expect(facts()).toEqual({ tree: false, groups: false })

    mount([rowDragging({ onRowDragEnd: () => {} }), rowExpandingModel()])
    expect(facts()).toEqual({ tree: true, groups: false })

    mount([
      rowDragging({ onRowDragEnd: () => {} }),
      rowExpandingModel({ enabled: false }),
    ])
    expect(facts()).toEqual({ tree: false, groups: false })

    mount([rowGroupingModel()])
    expect(facts().groups).toBe(true)

    const sources = import.meta.glob<string>(
      '../plugins/rowDragging/**/*.{ts,tsx}',
      { query: '?raw', import: 'default', eager: true },
    )
    const component = sources['../plugins/rowDragging/RowDraggingComponent.tsx']
    expect(component).toMatch(/hasRowHierarchy\(table, 'tree'\)/)
    expect(
      Object.keys(sources).filter(path =>
        /\.enableExpanding\b/.test(sources[path]),
      ),
    ).toEqual([])
  })

  it('CH2: роль treegrid и фокус на строке — по факту иерархии строк ядра: у модели дерева, группировки и серверной модели, без чтения опций плагинов', () => {
    // Своя запись с опцией вместо факта.
    const ownOptions = (options: Record<string, unknown>) =>
      definePlugin<{ enabled?: boolean }>()({
        id: 'ownOptions',
        diagnose: neverInert,
        options: () => options,
      })()
    const rowFocus = () =>
      resolveActive(captured, {
        [pluginStateKey('keyboardNavigation')]: {
          rowIndex: 0,
          columnIndex: ROW_FOCUS_COLUMN,
        },
      }).columnIndex === ROW_FOCUS_COLUMN

    mount([])
    expect([isTreeGrid(captured), rowFocus()]).toEqual([false, false])
    mount([ownOptions({ enableExpanding: true, enableGrouping: true })])
    expect([isTreeGrid(captured), rowFocus()]).toEqual([false, false])

    mount([rowExpandingModel()])
    expect([isTreeGrid(captured), rowFocus()]).toEqual([true, true])
    mount([rowGroupingModel()])
    expect([isTreeGrid(captured), rowFocus()]).toEqual([true, true])
    mount([ownOptions({ treeRows: true })])
    expect([isTreeGrid(captured), rowFocus()]).toEqual([true, true])
    mount([rowExpandingModel({ enabled: false })])
    expect(isTreeGrid(captured)).toBe(false)

    mount([
      serverRowModel({ getRows: () => new Promise(() => {}) }),
      rowExpanding({ hasChildren: () => true }),
    ])
    expect(isTreeGrid(captured)).toBe(true)
  })
})
