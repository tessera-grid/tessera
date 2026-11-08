// @vitest-environment happy-dom
/**
 * Канал вклада в тело для авторов плагинов (ADR 0173): поле `body` у `definePlugin` и его
 * типы (BC1), пространство имён (BC3), изоляция ошибок (BC4), dev-замер выбора (BC5).
 * Запуск: npx vitest run --config vitest.node.config.ts pluginBody
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  bodyOf,
  type CellContribution,
  mergeContributions,
  type PluginBody,
  type PluginBodyOutput,
  type PluginCellContext,
  type PluginRootBody,
  type PluginRowContext,
  RootHooks,
} from '../core/bodyContributions'
import { definePlugin } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import { __resetLogger, __setLoggerProduction } from '../util/logger'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  __resetLogger()
  __setLoggerProduction(undefined)
  vi.restoreAllMocks()
})

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const DATA = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
]

/** Таблица с плагинами; без DOM грида — вклады зовутся напрямую. */
const mount = (plugins: unknown[]) => {
  let table: any
  const Host = () => {
    table = useCreateTable({
      columns: COLUMNS,
      data: DATA,
      getRowId: (row: { id: string }) => row.id,
      plugins,
    } as never)
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Host)))
  return { table: () => table, root }
}

const cellContext = (table: any, rowId = '1'): PluginCellContext => ({
  table,
  cell: table.getRow(rowId).getAllCells()[0],
  rowIndex: 0,
  navigation: false,
})

const authored = <T extends { author?: true }>(items: T[]) =>
  items.filter(item => item.author)

const statusOf = (table: any, id: string) =>
  table.getPluginDiagnostics().find((item: { id: string }) => item.id === id)

describe('канал вклада в тело для авторов (ADR 0173)', () => {
  it('BC1: поле body у definePlugin отдаёт вклад ячейки и строки (выбор из состояния, атрибуты и переменные стиля), корня (атрибуты, события, хук) и клавиш; типы контекстов — в публичном API; данных окна, слоя, tabIndex и атрибутов корня темы в типах нет', () => {
    const seen: string[] = []
    const marks = definePlugin<{ enabled?: boolean; tone?: string }>()({
      id: 'marks',
      body: o => ({
        cell: {
          slices: [],
          select: (_state, context) => context.cell.row.id === '2',
          render: (marked: boolean) =>
            marked
              ? {
                  attrs: { 'data-marks-on': '' },
                  style: { '--marks-tone': o.tone ?? 'red' },
                }
              : null,
        },
        row: {
          slices: [],
          select: (_state, context) => context.row.id,
          render: (id: string) => ({ attrs: { 'data-marks-row': id } }),
        },
        root: {
          attrs: () => ({ 'data-marks-root': '' }),
          events: { dblclick: () => seen.push('dblclick') },
          useRoot: () => null,
        },
        keys: { onKey: event => event.key === 'm' },
      }),
    })
    const { table: tableOf } = mount([marks({ tone: 'blue' })])
    const table = tableOf()
    const body = bodyOf(table)
    const [cell] = authored(body.cell)
    const [row] = authored(body.row)
    const [root] = authored(body.root)
    const keys = body.keys.find(item => item.id === 'marks')!
    expect([cell!.id, row!.id, root!.id]).toEqual(['marks', 'marks', 'marks'])

    const state = table.store.get()
    const context = cellContext(table, '2')
    expect(
      cell!.render(cell!.select(state, context as never), context as never),
    ).toEqual({
      attrs: { 'data-marks-on': '' },
      style: { '--marks-tone': 'blue' },
    })
    const rowContext = { ...context, row: table.getRow('1') }
    expect(
      row!.render(row!.select(state, rowContext as never), rowContext as never),
    ).toEqual({
      attrs: { 'data-marks-row': '1' },
      style: undefined,
    })
    expect(root!.attrs?.({ table, navigation: false, state })).toEqual({
      'data-marks-root': '',
    })
    root!.events!.dblclick!(new MouseEvent('dblclick'), { table })
    expect(seen).toEqual(['dblclick'])
    expect(typeof root!.useRoot).toBe('function')
    expect(
      keys.onKey!(
        {
          key: 'm',
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        },
        { table, active: { rowIndex: 0, columnIndex: 0 }, pageRows: 10 },
      ),
    ).toBe(true)

    // Внутреннее канала автору не видно.
    expectTypeOf<PluginCellContext>().not.toHaveProperty('window')
    expectTypeOf<PluginRowContext>().not.toHaveProperty('window')
    expectTypeOf<PluginBodyOutput>().not.toHaveProperty('tabIndex')
    expectTypeOf<PluginRootBody>().not.toHaveProperty('themeAttrs')
    expectTypeOf<PluginBody>().not.toHaveProperty('window')
    expectTypeOf<NonNullable<PluginBody['cell']>>().not.toHaveProperty('layer')
  })

  it('BC3: плагин автора пишет только атрибуты data-<id>-* и aria-* и переменные --<id>-*; остальное пропускается с одним dev-предупреждением на ключ; токены --tsr-* и атрибуты грида не меняются', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const marks = definePlugin<{ enabled?: boolean }>()({
      id: 'marks',
      body: () => ({
        cell: {
          slices: [],
          select: () => true,
          render: () => ({
            attrs: {
              'data-marks-on': '',
              'aria-description': 'changed',
              'aria-selected': false,
              'data-other': 'x',
              role: 'button',
              'data-column-id': 'hijack',
            },
            style: {
              '--marks-tone': 'red',
              '--tsr-comp-body-bg': 'red',
              color: 'red',
            },
          }),
        },
        root: { attrs: () => ({ 'aria-label': 'Hijacked', 'data-x': '1' }) },
      }),
    })
    const { table: tableOf } = mount([marks()])
    const table = tableOf()
    const [cell] = authored(bodyOf(table).cell) as CellContribution[]
    const context = cellContext(table)
    const render = () =>
      cell!.render(
        cell!.select(table.store.get(), context as never),
        context as never,
      )
    expect(render()).toEqual({
      attrs: {
        'data-marks-on': '',
        'aria-description': 'changed',
        'aria-selected': false,
      },
      style: { '--marks-tone': 'red' },
    })
    render()
    const skipped = warn.mock.calls
      .map(call => String(call[0]))
      .filter(text => text.includes('outside the plugin namespace'))
    // Одно предупреждение на каждый чужой ключ, хотя вывод был дважды.
    expect(skipped).toHaveLength(5)
    for (const key of [
      'data-other',
      'role',
      'data-column-id',
      '--tsr-comp-body-bg',
      'color',
    ]) {
      expect(
        skipped.some(text => text.includes(`"${key}"`)),
        key,
      ).toBe(true)
    }

    // Атрибут, уже заданный встроенным вкладом, автор не перезаписывает.
    const builtIn: CellContribution = {
      id: 'builtIn',
      slices: [],
      select: () => true,
      render: () => ({ attrs: { 'aria-selected': true } }),
    }
    for (const order of [
      [builtIn, cell!],
      [cell!, builtIn],
    ]) {
      const merged = mergeContributions(
        order,
        order.map(item => item.select(table.store.get(), context as never)),
        context as never,
      )
      expect(merged.attrs['aria-selected']).toBe(true)
    }

    // Атрибуты HTML регистр не различают: id в camelCase — те же data-<id>-*; переменные
    // стиля регистр различают.
    const camel = definePlugin<{ enabled?: boolean }>()({
      id: 'myMarks',
      body: () => ({
        cell: {
          slices: [],
          select: () => true,
          render: () => ({
            attrs: { 'data-mymarks-on': '' },
            style: { '--myMarks-tone': 'red', '--mymarks-tone': 'blue' },
          }),
        },
      }),
    })
    const camelTable = mount([camel()]).table()
    const [camelCell] = authored(bodyOf(camelTable).cell) as CellContribution[]
    const camelContext = cellContext(camelTable)
    expect(
      camelCell!.render(
        camelCell!.select(camelTable.store.get(), camelContext as never),
        camelContext as never,
      ),
    ).toEqual({
      attrs: { 'data-mymarks-on': '' },
      style: { '--myMarks-tone': 'red' },
    })
  })

  it("BC4: исключение в выборе, отрисовке, обработчике события, хуке корня или onKey вклада автора не роняет грид: упавший вклад выключается, у плагина в диагностике — status: 'error'", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = (where: string) =>
      definePlugin<{ enabled?: boolean }>()({
        id: `fail-${where}`,
        body: () => {
          const fail = (part: string) => {
            if (part === where) throw new Error(`${where} failed`)
          }
          return {
            cell: {
              slices: [],
              select: () => {
                fail('select')
                return true
              },
              render: () => {
                fail('render')
                return null
              },
            },
            root: {
              events: { dblclick: () => fail('event') },
              useRoot: () => {
                fail('hook')
                return null
              },
            },
            keys: {
              onKey: () => {
                fail('key')
                return false
              },
            },
          }
        },
      })
    const wheres = ['select', 'render', 'event', 'hook', 'key']
    const { table: tableOf } = mount(wheres.map(where => failing(where)()))
    const table = tableOf()
    const state = table.store.get()
    const context = cellContext(table)
    const cells = authored(bodyOf(table).cell) as CellContribution[]
    const roots = authored(bodyOf(table).root)
    const keys = bodyOf(table).keys
    const byId = <T extends { id: string }>(items: T[], id: string) =>
      items.find(item => item.id === id)!

    expect(() => {
      for (const item of cells)
        item.render(item.select(state, context as never), context as never)
      for (const item of roots)
        item.events?.dblclick?.(new MouseEvent('dblclick'), { table })
      for (const item of keys)
        item.onKey?.(
          {
            key: 'x',
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
          },
          { table, active: { rowIndex: 0, columnIndex: 0 }, pageRows: 10 },
        )
    }).not.toThrow()
    // Хук корня — в границе ошибок: падение не выходит из рендера грида.
    const host = createRoot(document.createElement('div'))
    expect(() =>
      act(() =>
        host.render(
          createElement(RootHooks, { table, getScrollElement: () => null }),
        ),
      ),
    ).not.toThrow()

    for (const where of wheres) {
      expect(statusOf(table, `fail-${where}`)).toEqual({
        id: `fail-${where}`,
        status: 'error',
        error: `${where} failed`,
      })
    }
    // Выключенный вклад больше не зовётся и ничего не вносит.
    const select = byId(cells, 'fail-render')
    expect(
      select.render(select.select(state, context as never), context as never),
    ).toBeNull()
    expect(
      byId(keys, 'fail-select').onKey!(
        {
          key: 'x',
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        },
        { table, active: { rowIndex: 0, columnIndex: 0 }, pageRows: 10 },
      ),
    ).toBe(false)
  })

  it('BC5: в dev — предупреждение о дорогом вкладе: выбор отдаёт новый объект при том же состоянии или средний вызов выбора дороже 0,05 мс; в production замера нет', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const busy = () => {
      const until = performance.now() + 0.2
      while (performance.now() < until) {
        // Дорогой выбор автора.
      }
      return 1
    }
    const plugins = [
      definePlugin<{ enabled?: boolean }>()({
        id: 'fresh',
        body: () => ({
          cell: {
            slices: [],
            select: () => ({ marked: true }),
            render: () => null,
          },
        }),
      })(),
      definePlugin<{ enabled?: boolean }>()({
        id: 'slow',
        body: () => ({
          cell: { slices: [], select: busy, render: () => null },
        }),
      })(),
    ]
    const run = () => {
      const { table: tableOf } = mount(plugins)
      const table = tableOf()
      const state = table.store.get()
      const context = cellContext(table)
      for (const item of authored(bodyOf(table).cell)) {
        for (let i = 0; i < 500; i++) item.select(state, context as never)
      }
    }
    const messages = () => warn.mock.calls.map(call => String(call[0]))

    run()
    expect(
      messages().some(text =>
        text.includes('fresh: body select returns a new object'),
      ),
    ).toBe(true)
    expect(
      messages().some(text => text.includes('slow: body select takes')),
    ).toBe(true)
    expect(
      messages().some(text =>
        text.includes('slow: body select returns a new object'),
      ),
    ).toBe(false)

    warn.mockClear()
    __resetLogger()
    __setLoggerProduction(true)
    run()
    expect(messages().filter(text => text.includes('body select'))).toEqual([])
  })
})
