/**
 * Сторож значения смонтированной ячейки (ADR 0221, §4) — вклад в тело: ячейка зовёт `watch`
 * после коммита, когда её значение сменилось; первая отрисовка — не смена. Вспышки одного
 * коммита пишутся в срез одной записью на итог.
 */
import type { BodyContributions } from '../../core/bodyContributions'
import { readPluginHooks } from '../../core/definePlugin'
import { followDataChanges } from '../../core/dataFollow'
import { viewportOf } from '../../core/scrollToRow/viewport'
import {
  flashOutcome,
  type FlashOutcome,
} from '../../core/flashes/flashFeature'
import { consumeOwnWrite } from '../../shared/ownWrites'
import type { Cell, Table } from '../../types'
import {
  changeOutcome,
  sameCellValue,
  type CompareColumn,
} from '../../shared/cellValues'
import type { ValueChangeFlashHooks } from './types'
import type { ValueChangeFlashColumnDef } from './valueChangeFlashFeature'

export const ID = 'valueChangeFlash'

type Pending = Map<
  string,
  {
    cell: [string, string]
    outcome: FlashOutcome
    own: boolean
    original: unknown
  }
>

const queues = new WeakMap<object, Pending>()

/** Кадр без браузера (серверный рендер, тесты в node) — следующая задача. */
export const nextFrame = (run: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 0)
}

/**
 * Вспышки коммита — одной записью на итог в следующем кадре: новые значения красятся сразу, а
 * перерисовка вспыхнувших ячеек не удлиняет задачу смены данных (ADR 0221, §4, VC18).
 */
const enqueue = (
  table: { store: object },
  rowId: string,
  columnId: string,
  outcome: FlashOutcome,
  original: unknown,
) => {
  let queue = queues.get(table.store)
  if (!queue) {
    const pending: Pending = new Map()
    queue = pending
    queues.set(table.store, pending)
    nextFrame(() => {
      queues.delete(table.store)
      const byOutcome = new Map<FlashOutcome, { cell: [string, string] }[]>()
      for (const { cell, outcome, own } of pending.values()) {
        if (own) continue
        const list = byOutcome.get(outcome) ?? []
        list.push({ cell })
        byOutcome.set(outcome, list)
      }
      for (const [kind, targets] of byOutcome)
        flashOutcome(table, targets, kind)
    })
  }
  const key = `${rowId}\u0000${columnId}`
  const queued = queue.get(key)
  // Ячейка в запасе и видимая строка могут наблюдать одно эхо записи в одном коммите.
  const sameUpdate = queued && queued.original === original
  queue.set(key, {
    cell: [rowId, columnId],
    outcome,
    original,
    own: sameUpdate ? queued.own : consumeOwnWrite(table, rowId, columnId),
  })
}

export interface WatchColumn extends CompareColumn {
  columnDef: ValueChangeFlashColumnDef
  getIsActionsColumn: () => boolean
  getServiceColumn: () => unknown
}

/** Вид колонки: своё поле или умолчание плагина; служебные колонки не вспыхивают. */
export const modeOf = (
  column: WatchColumn,
  columnDefault: ValueChangeFlashHooks['columnDefault'],
) =>
  column.getServiceColumn() || column.getIsActionsColumn()
    ? false
    : (column.columnDef.changeFlash ?? columnDefault)

/** Смена значения ячейки: своя запись и равное по типу — без вспышки. */
const watch = (
  cell: Cell<any, any, unknown>,
  value: unknown,
  previous: unknown,
) => {
  const row = cell.row as { id: string; getIsGrouped?: () => boolean }
  if (row.getIsGrouped?.()) return
  const column = cell.column as unknown as WatchColumn
  const table = cell.getContext().table as unknown as { store: object }
  // Без слайса хуков плагин выключен: его вклад в тело ещё не ушёл.
  const hooks = readPluginHooks<Partial<ValueChangeFlashHooks>>(
    table as never,
    ID,
  )
  if (hooks.columnDefault === undefined) return
  const mode = modeOf(column, hooks.columnDefault)
  if (mode === false) return
  if (sameCellValue(table, column, previous, value)) return
  enqueue(
    table,
    row.id,
    column.id,
    changeOutcome(column, previous, value, mode === 'direction'),
    cell.row.original,
  )
}

export const valueChangeFlashBody: BodyContributions = {
  cell: {
    id: ID,
    slices: [],
    select: () => null,
    render: () => null,
    watch,
  },
}

/** Сравниваем одно и то же видимое окно двух списков только при смене данных. */
export const followEnteringRows = (instance: unknown) => {
  const table = instance as Table<any, any>
  return followDataChanges(table, (before, after, previousCore) => {
    const range = viewportOf(table)?.rows.range
    if (!range) return
    const { startIndex, endIndex } = range
    let previousWindow: Set<string> | undefined
    for (let i = startIndex; i <= endIndex; i++) {
      const id = after[i]?.id
      if (id === undefined || before[i]?.id === id) continue
      previousWindow ??= new Set(
        before.slice(startIndex, endIndex + 1).map(row => row.id),
      )
      if (previousWindow.has(id)) continue
      const old = previousCore.rowsById[id]
      const row = table.getCoreRowModel().rowsById[id]
      if (!old || !row || old.original === row.original) continue
      const { columnDefault } = readPluginHooks<ValueChangeFlashHooks>(
        table,
        ID,
      )
      if (columnDefault === undefined) continue
      for (const column of table.getAllLeafColumns()) {
        const mode = modeOf(column, columnDefault)
        if (!column.accessorFn || mode === false) continue
        const previous = old.getValue(column.id)
        const value = row.getValue(column.id)
        if (sameCellValue(table, column, previous, value)) continue
        enqueue(
          table,
          id,
          column.id,
          changeOutcome(column, previous, value, mode === 'direction'),
          row.original,
        )
      }
    }
  })
}
