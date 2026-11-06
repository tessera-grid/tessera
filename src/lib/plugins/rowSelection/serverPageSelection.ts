/**
 * «Выбрать всё» страницы в серверной модели строк (ADR 0188): строки верхнего уровня страницы.
 * Незагруженные приходят через `loadRange`, мимо кэша окна, поэтому строки выбора помнятся здесь:
 * флажок считает состояние и по строкам, которых в кэше нет.
 */
import { announceLabel } from '../../core/announcer'
import { type CancelSource, registerPending } from '../../core/cancellation'
import { isPaginationActive, partialRowsReason } from '../../core/dataMode'
import { type DebugActionSource, reportAction } from '../../core/debugActions'
import { activePageOf } from '../../core/pagination'
import { dataRowSourceOf, LIST_SLICES, watchSlices } from '../../core/rowSource'
import {
  rowSelectionValueOf,
  setRowSelectionValue,
  toggleBranchRowIn,
  toggleGroupIn,
  toggleRowIn,
  type RowSelectionValue,
} from '../../core/rowSelectionAll'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import type { Row } from '../../types'
import {
  groupKeysOfRow,
  isBranchCascade,
  isServerGroupRow,
} from '../rowSelectionModel/selectionHelpers'
import { branchSelectionOfRow, groupSelectionOfRow } from './keyboardActions'
import type { RowSelectionHooks } from './types'
import { selectAllScopeOf } from './selectAllScope'

type PageRow = Row<any, any>

interface PageTable {
  store: object
}

interface Remembered {
  key: string
  rows: Map<number, PageRow>
}

const remembered = new WeakMap<object, Remembered>()
const waiting = new WeakMap<object, () => void>()
let attempts = 0

/** В SSRM охват страницы действует только при пагинации (ADR 0188, §1). */
export const selectsServerPage = (table: unknown) =>
  partialRowsReason(table) === 'serverRowModel' &&
  isPaginationActive(table) &&
  selectAllScopeOf(table) === 'currentPage'

const pageKeyOf = (table: unknown) => {
  const source = dataRowSourceOf(table)
  const page = activePageOf(table)
  return `${source.epoch?.()}:${page?.pageIndex}:${page?.pageSize}`
}

/** Индексы строк верхнего уровня страницы и их строки, какие известны. */
const pageRoots = (table: unknown) => {
  const source = dataRowSourceOf<PageRow>(table)
  const known = remembered.get((table as PageTable).store)
  const memo = known?.key === pageKeyOf(table) ? known.rows : undefined
  const indexes = source.pageRootIndexes?.() ?? []
  const rows = new Map<number, PageRow>()
  for (const index of indexes) {
    const row = source.at(index) ?? memo?.get(index)
    if (row) rows.set(index, row)
  }
  return { indexes, rows }
}

const isPageRowSelected = (row: PageRow) => {
  if (isServerGroupRow(row)) return groupSelectionOfRow(row) === 'all'
  if (isBranchCascade(row.table)) return branchSelectionOfRow(row) === 'all'
  return row.getIsSelected()
}

/** Флажок шапки: «выбран» — все строки страницы известны и выбраны. */
export const serverPageSelectionOf = (table: unknown) => {
  const { indexes, rows } = pageRoots(table)
  const selectable = [...rows.values()].filter(row => row.getCanSelect())
  const selected = selectable.filter(isPageRowSelected).length
  return {
    all:
      indexes.length > 0 &&
      rows.size === indexes.length &&
      selected === selectable.length &&
      selected > 0,
    some: selected > 0,
    disabled: indexes.length === 0,
  }
}

const writePage = (
  table: unknown,
  rows: readonly PageRow[],
  selected: boolean,
) => {
  let value: RowSelectionValue = rowSelectionValueOf(table)
  for (const row of rows) {
    if (!row.getCanSelect()) continue
    if (isServerGroupRow(row)) {
      value = toggleGroupIn(value, groupKeysOfRow(row), selected)
    } else if (isBranchCascade(table)) {
      value = toggleBranchRowIn(value, [], row.id, selected, row.getCanExpand())
    } else {
      value = toggleRowIn(value, [], row.id, selected)
    }
  }
  setRowSelectionValue(table, value)
}

/** Подряд идущие индексы одним запросом. */
const rangesOf = (indexes: readonly number[]) => {
  const ranges: { first: number; last: number }[] = []
  for (const index of indexes) {
    const range = ranges.at(-1)
    if (range?.last === index - 1) range.last = index
    else ranges.push({ first: index, last: index })
  }
  return ranges
}

const clearRefusal = (table: unknown) => {
  if (readServerAction(table).failed?.kind === 'selectPage') {
    writeServerAction(table, ({ pending }) => (pending ? { pending } : {}))
  }
}

/** Смена страницы и выборки прерывает загрузку: её строки уже не те (ADR 0188, §3). */
const WATCHED = ['pagination', ...LIST_SLICES] as const

/** Выбрать страницу или снять с неё выбор; строки, которых нет, сперва приходят. */
export const toggleServerPage = (
  table: unknown,
  hooks: Pick<Partial<RowSelectionHooks>, 'onSelectAllRows'>,
  source: DebugActionSource,
) => {
  const t = table as PageTable
  waiting.get(t.store)?.()
  const selected = !serverPageSelectionOf(table).all
  const cause = reportAction(table, {
    plugin: 'rowSelection',
    action: 'toggleAllPageRows',
    detail: { selected, scope: 'currentPage' },
    source,
  })
  const finishWith = (rows: readonly PageRow[]) => {
    writePage(table, rows, selected)
    clearRefusal(table)
    hooks.onSelectAllRows?.(selected, 'currentPage')
  }
  const { indexes, rows } = pageRoots(table)
  const missing = indexes.filter(index => !rows.has(index))
  if (missing.length === 0) {
    finishWith([...rows.values()])
    return
  }

  const key = pageKeyOf(table)
  const controller = new AbortController()
  // Ожидание снимается сразу: блок в пути может не ответить на прерывание.
  const finish = () => {
    unwatch()
    unregister()
    waiting.delete(t.store)
    writeServerAction(table, ({ loadingRows: _rows, ...status }) => ({
      ...status,
      loadingRows: undefined,
    }))
  }
  const stop = () => {
    if (controller.signal.aborted) return
    controller.abort()
    finish()
    reportAction(table, {
      plugin: 'rowSelection',
      action: 'selectPageCancelled',
      source: 'auto',
      cause,
    })
  }
  waiting.set(t.store, stop)
  const unwatch = watchSlices(table, WATCHED, stop)
  writeServerAction(table, status => ({
    ...status,
    loadingRows: { kind: 'selectPage', since: performance.now() },
  }))
  const unregister = registerPending(table, {
    kind: 'selectPage',
    id: 'selectPage',
    cancel: (cancelSource: CancelSource) => {
      if (controller.signal.aborted) return
      controller.abort()
      finish()
      reportAction(table, {
        plugin: 'rowSelection',
        action: 'cancel',
        detail: { action: 'selectPage' },
        source: cancelSource,
        cause,
      })
      announceLabel(table, l => l.announceActionCancelled(l.actionSelectPage))
    },
  })
  const load = dataRowSourceOf<PageRow>(table).loadRange
  Promise.all(
    rangesOf(missing).map(async ({ first, last }) => {
      const fetched = await load!(first, last, controller.signal)
      fetched.forEach((row, offset) => {
        if (row) rows.set(first + offset, row)
      })
    }),
  )
    .then(() => {
      if (controller.signal.aborted) return
      finish()
      remembered.set(t.store, { key, rows })
      finishWith([...rows.values()])
      reportAction(table, {
        plugin: 'rowSelection',
        action: 'selectPageResolved',
        source: 'auto',
        cause,
      })
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) return
      finish()
      reportAction(table, {
        plugin: 'rowSelection',
        action: 'selectPageRejected',
        detail: { error: (error as Error | undefined)?.message },
        source: 'auto',
        cause,
      })
      writeServerAction(table, () => ({
        failed: {
          kind: 'selectPage',
          attempt: ++attempts,
          error,
          retry: () => toggleServerPage(table, hooks, 'pointer'),
        },
      }))
    })
}
