/**
 * Источник строк серверной модели (ADR 0138, §2–§4): одно хранилище блоков на таблицу,
 * строки блока собирает публичная `constructRow` TanStack. Окно и быструю прокрутку
 * сообщает тело (`observe`); блоки активной ячейки и правки не вытесняются.
 */
import { constructRow } from '@tanstack/react-table'

import { reportAction, reportOutcome } from '../../core/debugActions'
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
import { readPluginHooks } from '../../core/definePlugin/channels'
import type { RowSource, RowWindow } from '../../core/rowSource'
import { BlockStore } from './blockStore'
import type { ServerRowModelHooks, ServerRowsRequest } from './types'

export const SERVER_ROW_MODEL = 'serverRowModel'

export const DEFAULT_BLOCK_SIZE = 100
export const DEFAULT_MAX_BLOCKS = 100

type Query = Pick<
  ServerRowsRequest,
  'sorting' | 'columnFilters' | 'globalFilter'
>

interface ServerTable {
  options: {
    serverRowModelBlockSize?: number
    serverRowModelMaxBlocks?: number
    serverRowModelRowCount?: number
  }
  atoms: Record<string, { get: () => unknown } | undefined>
  store: { get: () => Record<string, unknown> }
  getRowId: (original: unknown, index: number) => string
  getHooks: () => unknown
}

interface SourceRow {
  id: string
}

export interface ServerSource extends RowSource<SourceRow> {
  store: BlockStore<unknown, SourceRow, Query>
}

const sources = new WeakMap<object, ServerSource>()

/** Строки, чьи блоки держатся: активная ячейка и строка в правке. */
const pinnedOf = (t: ServerTable, indexOf: (id: string) => number) => {
  const pinned: number[] = []
  const active = t.atoms[pluginStateKey('keyboardNavigation')]?.get() as
    { rowIndex?: number } | undefined
  if (active?.rowIndex !== undefined && active.rowIndex >= 0) {
    pinned.push(active.rowIndex)
  }
  const editing = t.atoms[pluginStateKey('cellEditing')]?.get() as
    { active?: { cell: { rowId: string } } | null } | undefined
  const editedRow = editing?.active?.cell.rowId
  const edited = editedRow === undefined ? -1 : indexOf(editedRow)
  if (edited >= 0) pinned.push(edited)
  return pinned
}

const createServerSource = (table: unknown): ServerSource => {
  const t = table as ServerTable
  let version = 0
  const store = new BlockStore<unknown, SourceRow, Query>({
    blockSize: t.options.serverRowModelBlockSize ?? DEFAULT_BLOCK_SIZE,
    maxBlocks: t.options.serverRowModelMaxBlocks ?? DEFAULT_MAX_BLOCKS,
    rowCount: t.options.serverRowModelRowCount,
    query: () => {
      const state = t.store.get()
      return {
        sorting: (state.sorting ?? []) as Query['sorting'],
        columnFilters: (state.columnFilters ?? []) as Query['columnFilters'],
        globalFilter: (state.globalFilter ?? '') as string,
      }
    },
    getRows: ({ query, signal, ...range }) => {
      const { getRows } = readPluginHooks<ServerRowModelHooks>(
        t as never,
        SERVER_ROW_MODEL,
      )
      // Запрос блока и его итог — в канал действий (ADR 0125): ответ, отказ, отмена.
      const report = { plugin: SERVER_ROW_MODEL, action: 'loadBlock' }
      const cause = reportAction(table, {
        ...report,
        detail: range,
        source: 'auto',
      })
      signal.addEventListener(
        'abort',
        () =>
          reportAction(table, {
            ...report,
            action: 'loadBlockCancelled',
            source: 'auto',
            cause,
          }),
        { once: true },
      )
      const result = getRows?.({ ...range, ...query, signal }) ?? { rows: [] }
      reportOutcome(table, { ...report, cause }, result)
      return result
    },
    toRows: (data, start) =>
      data.map(
        (original, offset) =>
          constructRow(
            table as never,
            t.getRowId(original, start + offset),
            original as never,
            start + offset,
            0,
          ) as unknown as SourceRow,
      ),
    idOf: row => row.id,
    // Срез плагина — счётчик изменений: корень грида перерисовывается по нему.
    onChange: () => setPluginState(table, SERVER_ROW_MODEL, ++version),
  })
  return {
    store,
    count: () => store.count(),
    at: index => store.rowAt(index),
    byId: id => store.rowById(id),
    indexOf: id => store.indexOf(id),
    observe: ({ first, last, fast }: RowWindow) => {
      store.setPinned(pinnedOf(t, id => store.indexOf(id)))
      store.setWindow(first, last, fast)
    },
  }
}

/** Источник таблицы: создаётся при первом обращении и живёт с таблицей. */
export const serverSourceOf = (table: unknown): ServerSource => {
  let source = sources.get(table as object)
  if (!source) {
    source = createServerSource(table)
    sources.set(table as object, source)
  }
  return source
}
